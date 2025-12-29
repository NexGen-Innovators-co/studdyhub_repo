// LivePodcastViewer.tsx - View and interact with live podcast streams
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import {
  Radio,
  Users,
  MessageCircle,
  Send,
  UserPlus,
  Share2,
  Clock,
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useWebRTC } from '@/hooks/useWebRTC';

interface LivePodcastViewerProps {
  podcastId: string;
  onClose: () => void;
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

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
}

export const LivePodcastViewer: React.FC<LivePodcastViewerProps> = ({
  podcastId,
  onClose
}) => {
  const [podcast, setPodcast] = useState<any>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [volume, setVolume] = useState(100);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    isConnected,
    connectionQuality,
    error
  } = useWebRTC({
    podcastId,
    isHost: false,
    onRemoteStream: (stream) => {
      // Attach remote audio stream to audio element
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(err => {

          toast.error('Failed to play audio. Please check your permissions.');
        });
      }
    },
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        toast.success('Connected to live stream');
      } else if (state === 'disconnected' || state === 'failed') {
        toast.error('Connection lost');
      }
    }
  });

  useEffect(() => {
    loadPodcast();
    loadCurrentUser();
    joinAsListener();

    // Set up real-time subscriptions
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

    // Cleanup on unmount
    return () => {
      leaveAsListener();
      listenersChannel.unsubscribe();
    };
  }, [podcastId]);

  useEffect(() => {
    if (podcast) {
      loadListeners();
    }
  }, [podcast]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser({ ...user, ...profile });
    }
  };

  const loadPodcast = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_podcasts')
        .select('*')
        .eq('id', podcastId)
        .single();

      if (error) throw error;

      // Fetch user details from social_users
      if (data?.user_id) {
        const { data: userData } = await supabase
          .from('social_users')
          .select('display_name, username, avatar_url')
          .eq('id', data.user_id)
          .single();

        setPodcast({
          ...data,
          user: userData ? {
            full_name: userData.display_name || userData.username || 'Anonymous',
            avatar_url: userData.avatar_url
          } : undefined
        });
      } else {
        setPodcast(data);
      }
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

      // Fetch user details for all listeners
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

  const joinAsListener = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('podcast_listeners').insert({
        podcast_id: podcastId,
        user_id: user.id,
        is_active: true
      });

      setIsListening(true);
    } catch (error) {
      console.error('Error joining as listener:', error);
    }
  };

  const leaveAsListener = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('podcast_listeners')
        .update({
          is_active: false,
          left_at: new Date().toISOString()
        })
        .eq('podcast_id', podcastId)
        .eq('user_id', user.id);

      setIsListening(false);
    } catch (error) {
      console.error('Error leaving:', error);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/podcasts/${podcastId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');

      // Track share
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('podcast_shares').insert({
          podcast_id: podcastId,
          user_id: user.id,
          share_type: 'link',
          platform: 'clipboard'
        });
        await supabase.rpc('increment_podcast_share_count', { podcast_id: podcastId });
      }
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  if (!podcast) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </CardContent>
      </Card>
    );
  }

  const liveDuration = podcast.live_started_at
    ? formatDistanceToNow(new Date(podcast.live_started_at), { addSuffix: false })
    : '0m';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[90vh] flex flex-col bg-slate-950 border-slate-800">
        {/* Header */}
        <CardHeader className="border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-red-600 text-white animate-pulse">
                  <Radio className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Clock className="h-4 w-4" />
                  {liveDuration}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Users className="h-4 w-4" />
                  {listeners.length} listening
                </div>
              </div>
              <CardTitle className="text-2xl text-white">{podcast.title}</CardTitle>
              {podcast.description && (
                <p className="text-slate-400 mt-2">{podcast.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={podcast.user?.avatar_url} />
                  <AvatarFallback className="bg-purple-600 text-white">
                    {podcast.user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-slate-300">{podcast.user?.full_name || 'Unknown Host'}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8">
            {/* Hidden audio element for playback */}
            <audio ref={audioRef} muted={isAudioMuted} />

            <div className="text-center space-y-4">
              <div className="relative">
                <div className={`w-32 h-32 rounded-full ${
                  isConnected
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse'
                    : 'bg-slate-700'
                } flex items-center justify-center`}>
                  <Radio className="h-16 w-16 text-white" />
                </div>
                {isConnected && (
                  <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping"></div>
                )}
              </div>

              {/* Connection Status */}
              <div className="space-y-2">
                <p className="text-slate-300 text-lg font-semibold">
                  {isConnected ? 'Listening Live' : 'Connecting...'}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm">
                  {connectionQuality === 'excellent' || connectionQuality === 'good' ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : connectionQuality === 'poor' ? (
                    <Activity className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`${
                    connectionQuality === 'excellent' || connectionQuality === 'good'
                      ? 'text-green-500'
                      : connectionQuality === 'poor'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}>
                    {connectionQuality}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 max-w-md">
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              {/* Audio Controls */}
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3 max-w-md mx-auto mt-6">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsAudioMuted(!isAudioMuted);
                      if (audioRef.current) {
                        audioRef.current.muted = !isAudioMuted;
                      }
                    }}
                    className="text-white"
                  >
                    {isAudioMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                  <Slider
                    value={[volume]}
                    onValueChange={(value) => {
                      setVolume(value[0]);
                      if (audioRef.current) {
                        audioRef.current.volume = value[0] / 100;
                      }
                    }}
                    max={100}
                    step={1}
                    className="flex-1"
                    disabled={isAudioMuted}
                  />
                  <span className="text-sm text-slate-400 w-12 text-right">
                    {isAudioMuted ? '0%' : `${volume}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-8">
              <Button variant="outline" onClick={handleShare} className="border-slate-700 text-slate-300">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Sidebar - Listeners */}
          <div className="w-80 border-l border-slate-800 flex flex-col bg-slate-900/50">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="h-4 w-4" />
                Listeners ({listeners.length})
              </h3>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {listeners.map((listener) => (
                  <div key={listener.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={listener.user?.avatar_url} />
                      <AvatarFallback className="bg-purple-600 text-white text-xs">
                        {listener.user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {listener.user?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {listeners.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-8">
                    No listeners yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
};
