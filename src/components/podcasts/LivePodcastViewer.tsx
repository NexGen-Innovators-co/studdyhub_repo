// LivePodcastViewer.tsx - Updated with enhanced participation features
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Users,
  Clock,
  Radio,
  Loader2,
  Share2,
  Wifi,
  WifiOff,
  Activity,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Menu,
  ChevronDown,
  ChevronUp,
  Crown,
  Mic,
  MicOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';

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

interface PodcastData {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  user_id: string;
  user?: {
    full_name: string;
    avatar_url?: string;
    username?: string;
  };
  live_started_at?: string;
  listen_count?: number;
}

export const LivePodcastViewer: React.FC<LivePodcastViewerProps> = ({
  podcastId,
  onClose
}) => {
  const [podcast, setPodcast] = useState<PodcastData | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [volume, setVolume] = useState(100);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [recentJoiner, setRecentJoiner] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    connectionQuality,
    error,
    participants,
    permissionRequests,
    requestPermission,
    isCohostMode,
    toggleMute,
    isMuted,
    startBroadcasting,
    stopBroadcasting
  } = useWebRTC({
    podcastId,
    isHost: false,
    isCohost: false,
    onRemoteStream: (stream) => {
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }
    },
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        toast.success('Connected to live stream');
        setIsPlaying(true);
      } else if (state === 'disconnected' || state === 'failed') {
        toast.error('Connection lost. Attempting to reconnect...');
        setIsPlaying(false);
      }
    },
    onParticipantJoined: (userId, stream) => {
      // Handle other participants joining
    },
    onPermissionRequest: () => {
      // Handle permission request notifications if viewer becomes co-host
    },
    onPermissionGranted: (userId, requestType) => {
      if (userId === currentUser?.id) {
        setIsParticipant(true);
        setHasRequestedPermission(false);
        
        if (requestType === 'cohost') {
          toast.success('🎉 You are now a co-host! You can speak and moderate.');
        } else {
          toast.success('🎤 You can now speak! Your microphone is active.');
        }
        
        // Start broadcasting if not already
        if (!localStream) {
          startBroadcasting();
        }
      }
    },
    onPermissionRevoked: (userId) => {
      if (userId === currentUser?.id) {
        setIsParticipant(false);
        setIsMicMuted(true);
        toast.warning('Your speaking permission has been revoked.');
        
        // Stop broadcasting
        stopBroadcasting();
      }
    }
  });

  // Handle audio setup
  useEffect(() => {
    if (!audioRef.current) return;

    // Ensure volume and mute states are synced
    audioRef.current.volume = volume / 100;
    audioRef.current.muted = isAudioMuted;

    // Try to play if a stream is attached and playback is desired
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
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
  }, [isAudioMuted, volume, isPlaying]);

  // Load initial data
  useEffect(() => {
    loadPodcast();
    loadCurrentUser();
    joinAsListener();
    checkExistingPermissionRequests();

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

    // Podcast updates
    const podcastChannel = supabase
      .channel(`podcast-updates-${podcastId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_podcasts',
          filter: `id=eq.${podcastId}`
        },
        (payload) => {
          if (payload.new.is_live === false) {
            toast.info('Live stream has ended');
            onClose();
          }
        }
      )
      .subscribe();

    return () => {
      leaveAsListener();
      listenersChannel.unsubscribe();
      podcastChannel.unsubscribe();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [podcastId]);

  // Subscribe to DB changes for this user's participation request to catch approvals/revokes
  useEffect(() => {
    if (!currentUser?.id) return;

    const chanName = `participation-requests-${podcastId}-${currentUser.id}`;
    const participationChannel = supabase
      .channel(chanName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'podcast_participation_requests',
          filter: `podcast_id=eq.${podcastId},user_id=eq.${currentUser.id}`
        },
        (payload) => {
          try {
            const newStatus = payload.eventType === 'DELETE' ? 'revoked' : payload.new?.status;
            if (newStatus === 'approved') {
              setIsParticipant(true);
              setHasRequestedPermission(false);
              toast.success('Your speaking request was approved');
            } else if (newStatus === 'revoked' || newStatus === 'rejected') {
              setIsParticipant(false);
              setHasRequestedPermission(false);
              toast.warning('Your speaking permission was revoked');
            } else if (newStatus === 'pending') {
              setHasRequestedPermission(true);
            }
          } catch (err) {
            ////console.error('Error handling participation request payload:', err);
          }
        }
      )
      .subscribe();

    return () => {
      try { participationChannel.unsubscribe(); } catch (e) {}
    };
  }, [currentUser?.id, podcastId]);

  // Show controls on mouse move
  const handleVideoAreaMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
    
    setControlsTimeout(timeout);
  };

  // Touch events for mobile
  const handleTouchStart = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    
    setControlsTimeout(timeout);
  };

  // Handle close with cleanup
  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onClose();
  }, [onClose]);

const loadPodcast = async () => {
  try {
    const { data, error } = await supabase
      .from('ai_podcasts')
      .select('*')
      .eq('id', podcastId)
      .single();

    if (error) throw error;

    // Fetch user details from social_users table
    if (data?.user_id) {
      const { data: userData } = await supabase
        .from('social_users')
        .select('id, display_name, avatar_url, username')
        .eq('id', data.user_id)
        .single();

      setPodcast({
        ...data,
        user: userData ? {
          full_name: userData.display_name || 'Anonymous Host',
          avatar_url: userData.avatar_url,
          username: userData.username || ''
        } : {
          full_name: 'Host',
          avatar_url: undefined,
          username: ''
        }
      });
    } else {
      setPodcast(data);
    }
  } catch (error) {
    ////console.error('Error loading podcast:', error);
    toast.error('Failed to load podcast');
  }
};

// Update the loadListeners function:
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
        .from('social_users') // Change from profiles to social_users
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const usersMap = new Map(
        (usersData || []).map(u => [
          u.id,
          {
            full_name: u.display_name || 'Anonymous',
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
    ////console.error('Error loading listeners:', error);
  }
};

// Update the loadCurrentUser function if needed:
const loadCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Try to get from social_users first
    const { data: socialUser } = await supabase
      .from('social_users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (socialUser) {
      setCurrentUser({ ...user, ...socialUser });
    } else {
      // If social_users not present, set a minimal current user
      setCurrentUser({ id: user.id, full_name: user.user_metadata?.full_name || 'Anonymous User' } as any);
    }
  }
};

  const checkExistingPermissionRequests = async () => {
    if (!currentUser?.id) return;

    try {
      const { data, error } = await supabase
        .from('podcast_participation_requests')
        .select('*')
        .eq('podcast_id', podcastId)
        .eq('user_id', currentUser.id)
        .in('status', ['pending','approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // No request found or other error
        return;
      }

      if (data) {
        if (data.status === 'approved') {
          // User already granted permission in DB
          setIsParticipant(true);
          setHasRequestedPermission(false);
          // If needed, trigger broadcasting start
          // startBroadcasting is handled by useWebRTC onPermissionGranted as well
        } else if (data.status === 'pending') {
          setHasRequestedPermission(true);
        }
      }
    } catch (error) {
      ////console.error('Error checking permission requests:', error);
    }
  };

  const joinAsListener = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for existing listener row for this user + podcast
      const { data: existing, error: existingErr } = await supabase
        .from('podcast_listeners')
        .select('id, is_active')
        .eq('podcast_id', podcastId)
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (existingErr && existingErr.code !== 'PGRST116') {
        // If an unexpected error, log and return
        ////console.error('Error checking existing listener:', existingErr);
        return;
      }

      if (existing) {
        // If already active, don't increment again
        if (existing.is_active) {
          // Update joined_at to now for freshness but do not increment
          await supabase
            .from('podcast_listeners')
            .update({ joined_at: new Date().toISOString(), is_active: true, left_at: null })
            .eq('id', existing.id);
        } else {
          // Reactivate listener and increment count
          await supabase
            .from('podcast_listeners')
            .update({ is_active: true, joined_at: new Date().toISOString(), left_at: null })
            .eq('id', existing.id);

          await supabase.rpc('increment_podcast_listen_count', { podcast_id: podcastId });
        }
      } else {
        // No existing row: create and increment
        await supabase.from('podcast_listeners').insert({
          podcast_id: podcastId,
          user_id: user.id,
          is_active: true,
          joined_at: new Date().toISOString()
        });

        await supabase.rpc('increment_podcast_listen_count', { podcast_id: podcastId });
      }
    } catch (error) {
      ////console.error('Error joining as listener:', error);
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
    } catch (error) {
      ////console.error('Error leaving:', error);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleToggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const handleRequestToSpeak = () => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('You must be signed in to request permission');
          return;
        }

        // Check for existing pending or approved request
        const { data: existing, error } = await supabase
          .from('podcast_participation_requests')
          .select('status')
          .eq('podcast_id', podcastId)
          .eq('user_id', user.id)
          .in('status', ['pending','approved'])
          .limit(1)
          .single();

        if (!error && existing) {
          if (existing.status === 'approved') {
            setIsParticipant(true);
            setHasRequestedPermission(false);
            toast.success('You already have speaking permission');
            return;
          }
          if (existing.status === 'pending') {
            setHasRequestedPermission(true);
            toast.info('Your request is already pending approval');
            return;
          }
        }

        requestPermission('speak');
        setHasRequestedPermission(true);
        toast.info('🎤 Request to speak sent to host');
      } catch (err) {
        ////console.error('Error requesting speak permission:', err);
        toast.error('Failed to send request');
      }
    })();
  };

  const handleRequestCohost = () => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('You must be signed in to request co-host');
          return;
        }

        const { data: existing, error } = await supabase
          .from('podcast_participation_requests')
          .select('status')
          .eq('podcast_id', podcastId)
          .eq('user_id', user.id)
          .in('status', ['pending','approved'])
          .limit(1)
          .single();

        if (!error && existing) {
          if (existing.status === 'approved') {
            setIsParticipant(true);
            setHasRequestedPermission(false);
            toast.success('You already have co-host permission');
            return;
          }
          if (existing.status === 'pending') {
            setHasRequestedPermission(true);
            toast.info('Your co-host request is already pending');
            return;
          }
        }

        requestPermission('cohost');
        setHasRequestedPermission(true);
        toast.info('👑 Co-host request sent to host');
      } catch (err) {
        ////console.error('Error requesting cohost permission:', err);
        toast.error('Failed to send co-host request');
      }
    })();
  };

  const handleToggleMic = () => {
    toggleMute();
    setIsMicMuted(!isMicMuted);
    toast.info(isMicMuted ? '🎤 Microphone unmuted' : '🔇 Microphone muted');
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

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value / 100;
    }
  };

  if (!podcast) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  const liveDuration = podcast.live_started_at
    ? formatDistanceToNow(new Date(podcast.live_started_at), { addSuffix: false })
    : '0m';

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent':
      case 'good':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'poor':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };
return (
  <div className="fixed inset-0 z-50 bg-white dark:bg-black overflow-hidden">
    {/* Hidden audio element */}
    <audio ref={audioRef} autoPlay playsInline />

    {/* Top Navigation */}
    <div className={`absolute top-0 left-0 right-0 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent dark:from-black/80 dark:to-transparent">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
          <div className="text-white max-w-[60vw] md:max-w-lg">
            <h1 className="text-xs md:text-sm font-medium truncate">{podcast.title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Badge className="bg-blue-600 text-white animate-pulse text-[10px] border-0">
                <Radio className="h-2.5 w-2.5 mr-1" />
                LIVE
              </Badge>
              <span>{liveDuration}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10"
          >
            <Share2 className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 hidden sm:flex"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4 md:h-5 md:w-5" /> : <Maximize2 className="h-4 w-4 md:h-5 md:w-5" />}
          </Button>
          
          {/* Mobile menu */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    {/* Participation Status Bar */}
    <div className={`absolute top-16 left-1/2 transform -translate-x-1/2 z-30 transition-all duration-300 ${
      isParticipant || hasRequestedPermission ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    }`}>
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-full px-4 py-2 shadow-lg">
        {isParticipant ? (
          <>
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">You are speaking</span>
            <Button
              onClick={handleToggleMic}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              {isMicMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </>
        ) : hasRequestedPermission && (
          <>
            <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Waiting for host approval...</span>
          </>
        )}
      </div>
    </div>

    {/* Main Content */}
    <div 
      ref={mainContainerRef}
      className="h-full flex flex-col lg:flex-row"
    >
      {/* Video/Image Area */}
      <div 
        ref={videoAreaRef}
        className="flex-1 relative bg-white dark:bg-black overflow-hidden lg:w-[70%]"
        onMouseMove={handleVideoAreaMouseMove}
        onTouchStart={handleTouchStart}
        onClick={() => setShowControls(true)}
      >
        {/* Background Image/Content */}
        <div className="w-full h-full flex items-center justify-center">
          {podcast.cover_image_url ? (
            <img
              src={podcast.cover_image_url}
              alt={podcast.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-black">
              <Radio className="h-24 w-24 md:h-32 md:w-32 text-gray-400 dark:text-gray-700" />
            </div>
          )}

          {/* Connection Status Overlay */}
          <div className="absolute top-3 left-3 bg-black/80 text-white px-3 py-1.5 rounded-full text-xs md:text-sm backdrop-blur-sm flex items-center gap-2">
            {getConnectionIcon()}
            <span className="uppercase">{connectionQuality}</span>
          </div>

          {/* Live Badge */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-blue-600 text-white animate-pulse text-xs border-0 px-3 py-1">
              <Radio className="h-3 w-3 mr-1.5" />
              LIVE
            </Badge>
          </div>

          {/* Add participation buttons to the main content area */}
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
            {!isParticipant && !hasRequestedPermission && (
              <div className="flex gap-2 bg-slate-600 backdrop-blur-md rounded-full p-2 shadow-lg">
                <Button
                  onClick={handleRequestToSpeak}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Request to Speak
                </Button>
                <Button
                  onClick={handleRequestCohost}
                  variant="outline"
                  size="sm"
                  className="bg-yellow-500/10 border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/20"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Request Co-host
                </Button>
              </div>
            )}
          </div>

          {/* Center Play Button */}
          {(!isPlaying || showControls) && (
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 hidden md:flex items-center justify-center group"
            >
              <div className="bg-slate-600 group-hover:bg-slate-700 rounded-full p-6 md:p-8 transition-all transform group-hover:scale-110">
                {isPlaying ? (
                  <Pause className="h-12 w-12 md:h-20 md:w-20 text-white" />
                ) : (
                  <Play className="h-12 w-12 md:h-20 md:w-20 text-white ml-2 md:ml-3" />
                )}
              </div>
            </button>
          )}

          {/* Desktop Bottom Controls */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 md:p-4 transition-all duration-300 hidden md:block ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 md:h-5 md:w-5" />
                  ) : (
                    <Play className="h-4 w-4 md:h-5 md:w-5 ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMute}
                  className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"
                >
                  {isAudioMuted ? <VolumeX className="h-3 w-3 md:h-4 md:w-4" /> : <Volume2 className="h-3 w-3 md:h-4 md:w-4" />}
                </Button>

                <div className="w-24">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>

                <div className="text-white text-xs md:text-sm ml-1 md:ml-2">
                  {listeners.length} listening
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls Bar */}
      <div className="md:hidden bg-slate-400">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              onClick={handlePlayPause}
              size="icon"
              className="h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleMute}
              className="h-8 w-8 text-white"
            >
              {isAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="text-white text-sm">
            {listeners.length} listeners
          </div>
        </div>
      </div>

      {/* Right Sidebar - Desktop */}
      <div className="hidden lg:block w-[30%] bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 overflow-y-auto">
        <div className="p-4">
          {/* Podcast Info */}
          <div className="mb-6">
            <h1 className="text-black dark:text-white font-bold text-lg mb-2">{podcast.title}</h1>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-600 dark:text-gray-400 text-sm">{listeners.length} listening</span>
              <span className="text-gray-600 dark:text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">{liveDuration}</span>
            </div>
            
            {/* Creator Info */}
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={podcast.user?.avatar_url} />
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {podcast.user?.full_name?.charAt(0) || 'H'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-black dark:text-white">
                  {podcast.user?.full_name || 'Host'}
                </h3>
                <span className="text-gray-600 dark:text-gray-400 text-sm">Live Host</span>
              </div>
            </div>

            {/* Description */}
            {podcast.description && (
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 mb-4">
                <h3 className="font-semibold text-black dark:text-white mb-2">About This Stream</h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{podcast.description}</p>
              </div>
            )}
          </div>

          {/* Listeners Section */}
          <h3 className="text-black dark:text-white font-semibold mb-4 text-lg">Live Listeners</h3>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {listeners.map((listener) => (
                <div key={listener.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={listener.user?.avatar_url} />
                    <AvatarFallback className="bg-blue-500 dark:bg-blue-600 text-white text-xs">
                      {listener.user?.full_name?.charAt(0) || 'L'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-black dark:text-white text-sm font-medium truncate">
                      {listener.user?.full_name || 'Anonymous'}
                    </h4>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Joined {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
              {listeners.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No listeners yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Info Area */}
      <div className="md:hidden bg-white dark:bg-black border-t border-gray-300 dark:border-gray-800 overflow-y-auto">
        <div className="p-4">
          {/* Podcast Title and Stats */}
          <div className="mb-4">
            <h1 className="text-black dark:text-white font-bold text-lg mb-2">{podcast.title}</h1>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-3">
              <span>{listeners.length} listening</span>
              <span>•</span>
              <span>{liveDuration}</span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={podcast.user?.avatar_url} />
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {podcast.user?.full_name?.charAt(0) || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-black dark:text-white text-sm">
                    {podcast.user?.full_name || 'Host'}
                  </h3>
                  <span className="text-gray-600 dark:text-gray-400 text-xs">Live Host</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description Toggle */}
          {podcast.description && (
            <div className="mb-4">
              <Button
                variant="ghost"
                className="w-full justify-between text-black dark:text-white px-0"
                onClick={() => setShowMoreInfo(!showMoreInfo)}
              >
                <span className="text-sm">Description</span>
                {showMoreInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {showMoreInfo && (
                <div className="mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{podcast.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Listeners Section */}
          <div className="mb-4">
            <h3 className="text-black dark:text-white font-semibold mb-3">Live Listeners</h3>
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {listeners.map((listener) => (
                  <div key={listener.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={listener.user?.avatar_url} />
                      <AvatarFallback className="bg-blue-500 dark:bg-blue-600 text-white text-xs">
                        {listener.user?.full_name?.charAt(0) || 'L'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-black dark:text-white text-sm font-medium truncate">
                        {listener.user?.full_name || 'Anonymous'}
                      </h4>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Joined {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
                {listeners.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No listeners yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>

    {/* Mobile Sidebar Sheet for Listeners */}
    <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
      <SheetContent side="right" className="w-full sm:w-96 bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 p-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-black dark:text-white font-semibold text-lg">Listeners</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSidebar(false)}
              className="text-black dark:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-3">
            {listeners.map((listener) => (
              <div key={listener.id} className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={listener.user?.avatar_url} />
                  <AvatarFallback className="bg-blue-500 dark:bg-blue-600 text-white">
                    {listener.user?.full_name?.charAt(0) || 'L'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="text-black dark:text-white text-sm font-medium truncate">
                    {listener.user?.full_name || 'Anonymous'}
                  </h4>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Joined {formatDistanceToNow(new Date(listener.joined_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
            {listeners.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3" />
                <p className="text-sm">No listeners yet</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
);
};