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
  UserPlus,
  Wifi,
  WifiOff,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWebRTC } from '@/hooks/useWebRTC';
import { formatDistanceToNow } from 'date-fns';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [showListeners, setShowListeners] = useState(false);
  const [recentJoiner, setRecentJoiner] = useState<string | null>(null);
  const isMobile = useIsMobile();

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
          event: 'INSERT',
          schema: 'public',
          table: 'podcast_listeners',
          filter: `podcast_id=eq.${podcastId}`
        },
        async (payload) => {
          loadListeners();
          // Show join notification
          const { data: userData } = await supabase
            .from('social_users')
            .select('display_name, username')
            .eq('id', payload.new.user_id)
            .single();
          
          if (userData) {
            const name = userData.display_name || userData.username || 'Someone';
            setRecentJoiner(`${name} joined`);
            setTimeout(() => setRecentJoiner(null), 3000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
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
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="border-b border-slate-800/50 bg-slate-900/30 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Badge className="bg-blue-600 text-white animate-pulse text-[10px] md:text-xs border-none px-2 py-0.5">
              <Radio className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
            <div className="min-w-0">
              <CardTitle className="text-lg md:text-2xl text-white font-bold truncate">{podcast.title}</CardTitle>
              <p className="text-[10px] md:text-sm text-blue-400/70 mt-0.5 md:mt-1 font-medium truncate">
                Broadcasting to {listeners.length} listeners
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-lg md:text-2xl font-mono text-white font-bold">{formatDuration(streamDuration)}</div>
              <div className="text-[10px] md:text-xs text-slate-400 flex items-center justify-end gap-1">
                {getConnectionIcon()}
                <span className="hidden sm:inline uppercase tracking-wider font-medium">{connectionQuality}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-950/30 border-l-4 border-red-500 p-3 md:p-4 mx-4 md:mx-6 mt-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
            <p className="text-red-200 text-xs md:text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Join Notification Overlay */}
        {recentJoiner && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-blue-600/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg shadow-blue-500/20 flex items-center gap-2">
              <UserPlus className="h-3 w-3" />
              {recentJoiner}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-blue-950/10 to-slate-950 p-4 md:p-8 overflow-y-auto relative">
          {/* Background Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-400/5 rounded-full blur-[100px]"></div>
          </div>

          <div className="text-center space-y-6 md:space-y-8 w-full max-w-md z-10">
            <div className="relative mx-auto w-36 h-36 md:w-48 md:h-48">
              <div className={`w-full h-full rounded-full p-1.5 ${
                isConnected && !isMuted
                  ? 'bg-gradient-to-tr from-blue-600 via-blue-400 to-blue-600 animate-spin-slow'
                  : 'bg-slate-800'
              }`}>
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  {isMuted ? (
                    <MicOff className="h-12 w-12 md:h-20 md:w-20 text-slate-600" />
                  ) : (
                    <Mic className="h-12 w-12 md:h-20 md:w-20 text-blue-500" />
                  )}
                </div>
              </div>
              {isConnected && !isMuted && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping"></div>
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                    ON AIR
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-white text-xl md:text-2xl font-bold tracking-tight">
                {isMuted ? 'Microphone Muted' : 'Broadcasting Live'}
              </h2>
              <p className="text-slate-400 text-xs md:text-sm font-medium">
                {isConnected
                  ? 'Your audio is being streamed to all listeners'
                  : 'Connecting to audio stream...'}
              </p>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-8 md:mt-10">
              <Button
                size="lg"
                variant={isMuted ? 'default' : 'outline'}
                onClick={toggleMute}
                className={`${isMuted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900/50 border-slate-800 text-white hover:bg-slate-800'} w-full sm:flex-1 rounded-full h-12 md:h-14 font-bold transition-all`}
              >
                {isMuted ? <MicOff className="h-5 w-5 mr-2" /> : <Mic className="h-5 w-5 mr-2" />}
                {isMuted ? 'Unmute Mic' : 'Mute Mic'}
              </Button>

              <Button
                size="lg"
                variant="destructive"
                onClick={handleEndStream}
                className="bg-red-600 hover:bg-red-700 w-full sm:flex-1 rounded-full h-12 md:h-14 font-bold shadow-lg shadow-red-900/20 transition-all"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                End Stream
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Listeners */}
        <div className={`
          ${isMobile ? (showListeners ? 'h-80' : 'h-14') : 'w-80'} 
          border-t md:border-t-0 md:border-l border-slate-800/50 flex flex-col bg-slate-900/80 backdrop-blur-xl transition-all duration-300 z-10
        `}>
          <div 
            className="p-4 border-b border-slate-800/50 flex items-center justify-between cursor-pointer md:cursor-default"
            onClick={() => isMobile && setShowListeners(!showListeners)}
          >
            <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
              <Users className="h-4 w-4 text-blue-500" />
              Active Listeners
              <Badge variant="secondary" className="ml-1 bg-blue-500/10 text-blue-400 border-none">
                {listeners.length}
              </Badge>
            </h3>
            {isMobile && (
              showListeners ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />
            )}
          </div>

          <ScrollArea className={`flex-1 ${isMobile && !showListeners ? 'hidden' : 'block'}`}>
            <div className="p-4 space-y-3">
              {listeners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-xs md:text-sm font-medium">
                    Waiting for listeners to join...
                  </p>
                </div>
              ) : (
                listeners.map((listener) => (
                  <div
                    key={listener.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="relative">
                      <Avatar className="h-9 w-9 border border-slate-700">
                        <AvatarImage src={listener.user?.avatar_url} />
                        <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                          {listener.user?.full_name?.charAt(0) || 'L'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                        {listener.user?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
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
