// LivePodcastHost.tsx - Host interface for broadcasting live podcasts
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  Radio,
  Users,
  Mic,
  MicOff,
  PhoneOff,
  AlertCircle,
  Wifi,
  WifiOff,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWebRTC } from '@/hooks/useWebRTC';
import { formatDistanceToNow } from 'date-fns';
import { transcribeLivePodcast } from '@/services/transcriptionService';

interface LivePodcastHostProps {
  podcastId: string;
  onEndStream: () => void;
}

interface Listener {
  id: string;
  user_id: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
  joined_at: string;
}

export const LivePodcastHost: React.FC<LivePodcastHostProps> = ({
  podcastId,
  onEndStream
}) => {
  const [podcast, setPodcast] = useState<any>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const [startTime] = useState(Date.now());

  const {
    isConnected,
    isMuted,
    connectionQuality,
    error,
    toggleMute,
    stopBroadcasting
  } = useWebRTC({
    podcastId,
    isHost: true,
    onConnectionStateChange: (state) => {
      console.log('Connection state:', state);
    }
  });

  useEffect(() => {
    loadPodcast();

    // Set up real-time subscriptions for listeners
    const listenersChannel = supabase
      .channel(`podcast-listeners-${podcastId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'podcast_listeners',
          filter: `podcast_id=eq.${podcastId}`
        },
        () => {
          loadListeners();
        }
      )
      .subscribe();

    // Update stream duration every second
    const durationInterval = setInterval(() => {
      setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      listenersChannel.unsubscribe();
      clearInterval(durationInterval);
    };
  }, [podcastId]);

  useEffect(() => {
    if (podcast) {
      loadListeners();
    }
  }, [podcast]);

  const loadPodcast = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_podcasts')
        .select('*')
        .eq('id', podcastId)
        .single();

      if (error) throw error;
      setPodcast(data);
    } catch (error) {
      console.error('Error loading podcast:', error);
      toast.error('Failed to load podcast');
    }
  };

  const loadListeners = async () => {
    try {
      const { data, error } = await supabase
        .from('podcast_listeners')
        .select('*')
        .eq('podcast_id', podcastId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(l => l.user_id);
        const { data: usersData } = await supabase
          .from('social_users')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        const usersMap = new Map(
          (usersData || []).map(u => [
            u.id,
            {
              full_name: u.display_name || u.username || 'Anonymous',
              avatar_url: u.avatar_url
            }
          ])
        );

        const listenersWithUsers = data.map(listener => ({
          ...listener,
          user: usersMap.get(listener.user_id)
        }));

        setListeners(listenersWithUsers);
      } else {
        setListeners([]);
      }
    } catch (error) {
      console.error('Error loading listeners:', error);
    }
  };

  const handleEndStream = async () => {
    try {
      toast.info('Ending stream and saving recording...', { duration: Infinity, id: 'ending-stream' });

      // Stop broadcasting and get recorded audio
      const audioBlob = await stopBroadcasting();

      if (audioBlob) {
        // Upload audio to Supabase Storage
        const audioFileName = `live-podcasts/${podcastId}.webm`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('podcasts')
          .upload(audioFileName, audioBlob, {
            contentType: 'audio/webm',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading audio:', uploadError);
          toast.error('Failed to save audio recording');
          toast.dismiss('ending-stream');
        } else {
          // Get public URL for the audio
          const { data: { publicUrl } } = supabase.storage
            .from('podcasts')
            .getPublicUrl(audioFileName);

          // Start transcription in background
          toast.info('Generating transcript with AI...', { duration: Infinity, id: 'transcribing' });

          try {
            const transcriptionResult = await transcribeLivePodcast(
              audioBlob,
              podcast.title,
              streamDuration,
              publicUrl
            );

            console.log('Transcription result:', transcriptionResult);

            // Prepare update data
            const updateData = {
              is_live: false,
              duration_minutes: Math.max(1, Math.ceil(streamDuration / 60)),
              audio_segments: JSON.stringify([{
                audio_url: publicUrl,
                speaker: 'Host',
                text: transcriptionResult.transcript,
                start_time: 0,
                end_time: streamDuration
              }]),
              script: transcriptionResult.script || transcriptionResult.transcript,
              description: transcriptionResult.summary || podcast.description
            };

            console.log('Updating podcast with data:', updateData);
            console.log('Updating podcast with ID:', podcastId);

            // First verify the podcast exists
            const { data: existingPodcast, error: checkError } = await supabase
              .from('ai_podcasts')
              .select('*')
              .eq('id', podcastId)
              .single();

            if (checkError || !existingPodcast) {
              console.error('Podcast not found before update:', checkError, existingPodcast);
              throw new Error('Podcast not found in database');
            }

            console.log('Existing podcast before update:', existingPodcast);

            // Update podcast with audio URL, transcript, and formatted script
            const { data: updateResult, error: updateError } = await supabase
              .from('ai_podcasts')
              .update(updateData)
              .eq('id', podcastId)
              .select();

            console.log('Update response:', { updateResult, updateError });

            if (updateError) {
              console.error('Error updating podcast:', updateError);
              throw updateError;
            }

            // Verify the update worked by fetching the podcast again
            const { data: verifyPodcast, error: verifyError } = await supabase
              .from('ai_podcasts')
              .select('*')
              .eq('id', podcastId)
              .single();

            console.log('Podcast after update:', verifyPodcast);

            if (!verifyPodcast || verifyPodcast.is_live !== false) {
              console.error('Update failed - podcast still live:', verifyPodcast);
              throw new Error('Failed to update podcast status');
            }

            console.log('Podcast updated successfully:', updateResult);

            toast.dismiss('transcribing');
            toast.dismiss('ending-stream');
            toast.success('Recording saved with transcript!', { 
              description: 'Your podcast is ready to share',
              duration: 5000
            });
          } catch (transcriptionError: any) {
            console.error('Transcription error:', transcriptionError);
            
            // Save without transcript if it fails
            await supabase
              .from('ai_podcasts')
              .update({
                is_live: false,
                duration_minutes: Math.max(1, Math.ceil(streamDuration / 60)),
                audio_segments: JSON.stringify([{
                  audio_url: publicUrl,
                  speaker: 'Host',
                  text: 'Transcription in progress...',
                  start_time: 0,
                  end_time: streamDuration
                }]),
                script: 'Transcript will be generated shortly. Please check back in a few minutes.'
              })
              .eq('id', podcastId);

            toast.dismiss('transcribing');
            toast.dismiss('ending-stream');
            toast.warning('Recording saved, but transcription failed. You can retry later.', {
              description: transcriptionError.message,
              duration: 7000
            });
          }
        }
      } else {
        // No recording, just update status
        await supabase
          .from('ai_podcasts')
          .update({
            is_live: false,
            duration_minutes: Math.max(1, Math.ceil(streamDuration / 60))
          })
          .eq('id', podcastId);
        
        toast.dismiss('ending-stream');
        toast.info('Stream ended (no recording available)');
      }

      // Remove all active listeners
      await supabase
        .from('podcast_listeners')
        .update({ is_active: false })
        .eq('podcast_id', podcastId);

      // Wait a moment to ensure database updates propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      // Close the modal and refresh
      onEndStream();
    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast.dismiss('ending-stream');
      toast.dismiss('transcribing');
      toast.error('Failed to end stream: ' + error.message);
      
      // Still close the modal even on error
      onEndStream();
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent':
      case 'good':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'poor':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  if (!podcast) {
    return <div>Loading...</div>;
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Header */}
      <CardHeader className="border-b border-slate-800 bg-gradient-to-r from-red-900/20 to-pink-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge className="bg-red-500 text-white animate-pulse">
              <Radio className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
            <div>
              <CardTitle className="text-2xl text-white">{podcast.title}</CardTitle>
              <p className="text-sm text-slate-400 mt-1">Broadcasting to {listeners.length} listeners</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-mono text-white">{formatDuration(streamDuration)}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                {getConnectionIcon()}
                {connectionQuality}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mx-6 mt-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className={`w-40 h-40 rounded-full ${
                isConnected && !isMuted
                  ? 'bg-gradient-to-br from-red-500 to-pink-500 animate-pulse'
                  : 'bg-slate-700'
              } flex items-center justify-center`}>
                {isMuted ? (
                  <MicOff className="h-20 w-20 text-white" />
                ) : (
                  <Mic className="h-20 w-20 text-white" />
                )}
              </div>
              {isConnected && !isMuted && (
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>
              )}
            </div>

            <div>
              <p className="text-white text-xl font-semibold mb-2">
                {isMuted ? 'Microphone Muted' : 'Broadcasting...'}
              </p>
              <p className="text-slate-400 text-sm">
                {isConnected
                  ? 'Your audio is being streamed to all listeners'
                  : 'Connecting to audio stream...'}
              </p>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 mt-8">
              <Button
                size="lg"
                variant={isMuted ? 'default' : 'outline'}
                onClick={toggleMute}
                className={isMuted ? 'bg-red-600 hover:bg-red-700' : 'border-slate-700 text-white'}
              >
                {isMuted ? <MicOff className="h-5 w-5 mr-2" /> : <Mic className="h-5 w-5 mr-2" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                onClick={handleEndStream}
                className="bg-red-600 hover:bg-red-700"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                End Stream
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Listeners */}
        <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-900/50">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Listeners ({listeners.length})
            </h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {listeners.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  Waiting for listeners to join...
                </p>
              ) : (
                listeners.map((listener) => (
                  <div
                    key={listener.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={listener.user?.avatar_url} />
                      <AvatarFallback className="bg-purple-600 text-white text-xs">
                        {listener.user?.full_name?.charAt(0) || 'L'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {listener.user?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Joined {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
