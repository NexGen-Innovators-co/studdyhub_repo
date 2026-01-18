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
  AlertCircle,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [showListeners, setShowListeners] = useState(false);
  const [recentJoiner, setRecentJoiner] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    isConnected,
    connectionQuality,
    error,
    startBroadcasting // This will trigger a re-announcement if we add it to the hook
  } = useWebRTC({
    podcastId,
    isHost: false,
    onRemoteStream: (stream) => {
      setRemoteStream(stream);
    },
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        toast.success('Connected to live stream');
      } else if (state === 'disconnected' || state === 'failed') {
        toast.error('Connection lost. Attempting to reconnect...');
      }
    }
  });

  useEffect(() => {
    if (remoteStream && audioRef.current) {
      
      // Only attach if not already attached to avoid interruptions
      if (audioRef.current.srcObject !== remoteStream) {
        audioRef.current.srcObject = remoteStream;
      }
      
      // Ensure volume and mute states are synced
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = isAudioMuted;
      
      // Try to play
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          //console.error('Audio play error:', err);
          // If auto-play fails, we might need user interaction
          if (err.name === 'NotAllowedError') {
            toast.info('Click anywhere to enable audio', {
              id: 'audio-permission-needed',
              action: {
                label: 'Enable Audio',
                onClick: () => {
                  audioRef.current?.play();
                  toast.dismiss('audio-permission-needed');
                }
              }
            });
          }
        });
      }
    }
  }, [remoteStream, isAudioMuted, volume]); // Removed podcast from dependencies to avoid interruptions

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
      //console.error('Error loading podcast:', error);
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
      //console.error('Error loading listeners:', error);
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
      //console.error('Error joining as listener:', error);
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
      //console.error('Error leaving:', error);
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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center md:p-4 backdrop-blur-sm">
      <Card className="w-full max-w-5xl h-full md:h-[90vh] flex flex-col bg-slate-950 border-slate-800 rounded-none md:rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10">
        {/* Header */}
        <CardHeader className="border-b border-slate-800/50 flex-shrink-0 p-4 md:p-6 bg-slate-900/30">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white animate-pulse text-[10px] md:text-xs border-none px-2 py-0.5">
                  <Radio className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
                <div className="flex items-center gap-1 md:gap-2 text-blue-400/80 text-xs md:text-sm font-medium">
                  <Clock className="h-3 w-3 md:h-4 md:w-4" />
                  {liveDuration}
                </div>
                <div className="flex items-center gap-1 md:gap-2 text-slate-400 text-xs md:text-sm">
                  <Users className="h-3 w-3 md:h-4 md:w-4" />
                  {listeners.length}
                </div>
              </div>
              <CardTitle className="text-lg md:text-2xl text-white font-bold tracking-tight truncate">{podcast.title}</CardTitle>
              <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-3">
                <div className="relative">
                  <Avatar className="h-6 w-6 md:h-10 md:w-10 border-2 border-blue-500/30">
                    <AvatarImage src={podcast.user?.avatar_url} />
                    <AvatarFallback className="bg-blue-600 text-white text-[10px] md:text-xs">
                      {podcast.user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs md:text-sm font-semibold text-slate-200 truncate">{podcast.user?.full_name || 'Unknown Host'}</span>
                  <span className="text-[10px] md:text-xs text-blue-400/70">Host</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

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

            {/* Hidden audio element for playback */}
            <audio 
              ref={audioRef} 
              muted={isAudioMuted} 
              autoPlay 
              playsInline 
            />

            <div className="text-center space-y-6 md:space-y-8 w-full max-w-md z-10">
              <div className="relative mx-auto w-28 h-28 md:w-40 md:h-40">
                <div className={`w-full h-full rounded-full p-1 ${
                  isConnected
                    ? 'bg-gradient-to-tr from-blue-600 via-blue-400 to-blue-600 animate-spin-slow'
                    : 'bg-slate-800'
                }`}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    {podcast.user?.avatar_url ? (
                      <img src={podcast.user.avatar_url} alt="Host" className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <Radio className="h-12 w-12 md:h-20 md:w-20 text-blue-500" />
                    )}
                  </div>
                </div>
                {isConnected && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping"></div>
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      ON AIR
                    </div>
                  </>
                )}
              </div>

              {/* Connection Status */}
              <div className="space-y-2">
                <h2 className="text-white text-xl md:text-2xl font-bold tracking-tight">
                  {isConnected ? 'Listening Live' : 'Connecting...'}
                </h2>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800">
                    {connectionQuality === 'excellent' || connectionQuality === 'good' ? (
                      <Wifi className="h-3.5 w-3.5 text-green-500" />
                    ) : connectionQuality === 'poor' ? (
                      <Activity className="h-3.5 w-3.5 text-yellow-500" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className={`text-xs font-medium uppercase tracking-wider ${
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
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-950/30 border border-red-500/50 rounded-xl p-4 max-w-md mx-auto backdrop-blur-md">
                  <div className="flex items-center gap-3 text-red-200">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-xs md:text-sm text-left">{error}</p>
                  </div>
                </div>
              )}

              {/* Audio Controls */}
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 md:p-6 space-y-4 w-full shadow-xl">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsAudioMuted(!isAudioMuted);
                      if (audioRef.current) {
                        audioRef.current.muted = !isAudioMuted;
                      }
                    }}
                    className="text-white h-10 w-10 hover:bg-slate-800 rounded-full"
                  >
                    {isAudioMuted ? <VolumeX className="h-5 w-5 text-slate-400" /> : <Volume2 className="h-5 w-5 text-blue-400" />}
                  </Button>
                  <div className="flex-1 space-y-1">
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
                      className="cursor-pointer"
                      disabled={isAudioMuted}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">
                    {isAudioMuted ? '0%' : `${volume}%`}
                  </span>
                </div>
                
                {!isAudioMuted && isConnected && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] text-slate-500 hover:text-blue-400 w-full h-auto py-1 transition-colors"
                    onClick={() => {
                      if (audioRef.current && remoteStream) {
                        audioRef.current.srcObject = null;
                        audioRef.current.srcObject = remoteStream;
                        audioRef.current.play().catch(console.error);
                        toast.success('Audio synced');
                      }
                    }}
                  >
                    Not hearing anything? Tap to sync audio
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 md:mt-10 z-10">
              <Button 
                variant="outline" 
                onClick={handleShare} 
                className="bg-slate-900/50 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full px-6"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Stream
              </Button>
            </div>
          </div>

          {/* Sidebar - Listeners */}
          <div className={`
            ${isMobile ? (showListeners ? 'h-80' : 'h-14') : 'w-80'} 
            border-t md:border-t-0 md:border-l border-slate-800 flex flex-col bg-slate-950/50 backdrop-blur-xl transition-all duration-500 ease-in-out z-30
          `}>
            <div 
              className="p-4 border-b border-slate-800/50 flex items-center justify-between cursor-pointer md:cursor-default bg-slate-900/20"
              onClick={() => isMobile && setShowListeners(!showListeners)}
            >
              <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Listeners
                <Badge variant="secondary" className="ml-1 bg-slate-800 text-slate-300 border-none h-5 px-1.5">
                  {listeners.length}
                </Badge>
              </h3>
              {isMobile && (
                <div className="bg-slate-800/50 p-1 rounded-full">
                  {showListeners ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                </div>
              )}
            </div>
            <ScrollArea className={`flex-1 ${isMobile && !showListeners ? 'hidden' : 'block'}`}>
              <div className="p-4 space-y-4">
                {listeners.map((listener) => (
                  <div key={listener.id} className="flex items-center gap-3 group">
                    <div className="relative">
                      <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-slate-800 group-hover:border-blue-500/50 transition-colors">
                        <AvatarImage src={listener.user?.avatar_url} />
                        <AvatarFallback className="bg-slate-800 text-slate-400 text-[10px] md:text-xs">
                          {listener.user?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 border-2 border-slate-950 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                        {listener.user?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-[10px] md:text-xs text-slate-500">
                        {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {listeners.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center">
                      <Users className="h-6 w-6 text-slate-700" />
                    </div>
                    <p className="text-slate-500 text-xs md:text-sm">
                      Waiting for listeners to join...
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
};
