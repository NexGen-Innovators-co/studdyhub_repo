// LivePodcastHost.tsx - Updated with responsive UI and fixed permission handling
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  X,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Radio,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  Crown,
  UserPlus,
  UserMinus,
  UserCheck,
  VolumeX,
  Menu,
  MessageSquare,
  MessageSquareOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWebRTC } from '@/hooks/useWebRTC';
import { formatDistanceToNow } from 'date-fns';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { ParticipationManager } from './ParticipationManager';
import { AudioMixer } from '@/utils/audioMixer';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '../ui/sheet';

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

interface PodcastData {
  id: string;
  title: string;
  description?: string;
  user_id: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
  live_started_at?: string;
}

export interface UserData {
  id: string;
  full_name: string;
  avatar_url?: string;
  username?: string;
}
export const LivePodcastHost: React.FC<LivePodcastHostProps> = ({
  podcastId,
  onEndStream
}) => {
  const [podcast, setPodcast] = useState<PodcastData | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const [startTime] = useState(Date.now());
  const [recentJoiner, setRecentJoiner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [participants, setParticipants] = useState<Array<{ userId: string; stream: MediaStream; isSpeaking: boolean; isMuted: boolean }>>([]);
  const [permissionRequests, setPermissionRequests] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'participants' | 'cohosts'>('stats');
  const [cohosts, setCohosts] = useState<any[]>([]);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'stats' | 'participants' | 'cohosts'>('stats');
  const [grantedPermissions, setGrantedPermissions] = useState<Set<string>>(new Set());

  const audioMixerRef = useRef<AudioMixer | null>(null);
  const mobileToggleRef = useRef<number>(0);
  const mobileLockRef = useRef<number>(0);
  // Debug + debounce refs
  const renders = useRef(0);
  const listenersDebounceRef = useRef<number | null>(null);
  const permissionBufferRef = useRef<any[]>([]);
  const permissionTimerRef = useRef<number | null>(null);
  const handleMobileSheetOpenChange = useCallback((open: boolean) => {
    const now = Date.now();
    if (now - mobileToggleRef.current < 250) return;
    mobileToggleRef.current = now;

    if (open) {
      // Lock against immediate close for a short window
      mobileLockRef.current = now + 700;
      setMobileSheetOpen(true);
      return;
    }

    // If within lock window, ignore close events
    if (now < mobileLockRef.current) {
      return;
    }

    setMobileSheetOpen(false);
  }, []);

  // Render counter for debugging frequent rerenders
  renders.current++;

  useEffect(() => {
    //console.log('[Host] LivePodcastHost render count:', renders.current);
  });

  useEffect(() => {
    // Initialize audio mixer
    audioMixerRef.current = new AudioMixer();

    return () => {
      if (audioMixerRef.current) {
        audioMixerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) setCurrentUser({ id: data.user.id });
      } catch (err) {
        //console.warn('Failed to get current user', err);
      }
    })();
  }, []);

  // Load co-hosts from database
  useEffect(() => {
    const loadCohosts = async () => {
      try {
        // Fetch cohost rows (no relational join to avoid FK dependency)
        const { data: cohostsRows, error } = await supabase
          .from('podcast_cohosts')
          .select('user_id, permissions, created_at')
          .eq('podcast_id', podcastId)
          .eq('is_active', true);

        if (error) throw error;

        if (!cohostsRows || cohostsRows.length === 0) {
          setCohosts([]);
          return;
        }

        const userIds = cohostsRows.map((r: any) => r.user_id);
        const { data: usersData } = await supabase
          .from('social_users')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        const usersMap = new Map(
          (usersData || []).map((u: any) => [u.id, u])
        );

        const mapped = cohostsRows.map((row: any) => ({
          ...row,
          user: {
            full_name: usersMap.get(row.user_id)?.display_name || 'Co-host',
            avatar_url: usersMap.get(row.user_id)?.avatar_url
          }
        }));

        setCohosts(mapped);
      } catch (error) {
        //console.error('Error loading cohosts:', error);
      }
    };

    loadCohosts();
  }, [podcastId]);

  const {
    isConnected,
    isMuted,
    connectionQuality,
    error,
    participants: webrtcParticipants,
    permissionRequests: webrtcPermissionRequests,
    toggleMute,
    stopBroadcasting,
    grantPermission,
    revokePermission,
    setParticipantsMuted
  } = useWebRTC({
    podcastId,
    isHost: true,
    onParticipantJoined: (userId, stream) => {
      //console.log('[Host] Participant joined:', userId);
      setParticipants(prev => {
        // Check if participant already exists
        const existingIndex = prev.findIndex(p => p.userId === userId);
        let newArr: Array<{ userId: string; stream: MediaStream; isSpeaking: boolean; isMuted: boolean }>;
        if (existingIndex >= 0) {
          // Update existing participant
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], stream };
          newArr = updated;
        } else {
          // Add new participant
          newArr = [...prev, { userId, stream, isSpeaking: false, isMuted: false }];
        }
        //console.log('[Host] Participants updated, count:', newArr.length, 'ids:', newArr.map(p => p.userId));
        return newArr;
      });
      
      // Add to audio mixer
      if (audioMixerRef.current) {
        audioMixerRef.current.addStream(userId, stream);
      }

      // Check if this user was granted permission
      if (grantedPermissions.has(userId)) {
        toast.success(`${userId} is now speaking`);
      }
    },
    onParticipantLeft: (userId) => {
      //console.log('[Host] Participant left:', userId);
      setParticipants(prev => {
        const newArr = prev.filter(p => p.userId !== userId);
        //console.log('[Host] Participants updated after leave, count:', newArr.length, 'ids:', newArr.map(p => p.userId));
        return newArr;
      });
      
      // Remove from audio mixer
      if (audioMixerRef.current) {
        audioMixerRef.current.removeStream(userId);
      }
      
      // Remove from granted permissions if they were a participant
      if (grantedPermissions.has(userId)) {
        setGrantedPermissions(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    },
    onPermissionRequest: (userId, requestType) => {
      //consolele.log('[Host] Permission request:', userId, requestType);
      toast.info(`${userId} requested ${requestType} permission`, {
            action: {
          label: 'Review',
          onClick: () => {
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
            if (isDesktop) {
              setActiveTab('participants');
            } else {
              setMobileActiveTab('participants');
              handleMobileSheetOpenChange(true);
            }
          }
        },
        duration: 10000
      });

      // Add to permission requests (do not auto-open UI)
      setPermissionRequests(prev => [...prev, { userId, requestType, timestamp: Date.now() }]);
    },
    onPermissionGranted: (userId, requestType) => {
      //console.log('[Host] Permission granted callback:', userId, requestType);
      // This callback might be triggered for co-hosts granting permissions to others
    },
    onPermissionRevoked: (userId) => {
      //console.log('[Host] Permission revoked:', userId);
      setGrantedPermissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      
      // Remove from participants if they were speaking
      setParticipants(prev => prev.filter(p => p.userId !== userId));
    }
  });

  useEffect(() => {
    loadPodcast();

    // Helper: debounced loadListeners to avoid frequent re-fetches
    const scheduleLoadListeners = () => {
      if (listenersDebounceRef.current) {
        window.clearTimeout(listenersDebounceRef.current);
      }
      listenersDebounceRef.current = window.setTimeout(() => {
        loadListeners();
        listenersDebounceRef.current = null;
      }, 250);
    };

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
        async (payload) => {
          // Debounce full listener reloads
          scheduleLoadListeners();

          // Show join notification for new listeners (best-effort)
          if (payload.eventType === 'INSERT') {
            try {
              const userData = await fetchUserData(payload.new.user_id);
              const name = userData?.full_name || 'Someone';
              setRecentJoiner(`${name} joined`);
              setTimeout(() => setRecentJoiner(null), 3000);
            } catch (err) {
              setRecentJoiner('Someone joined');
              setTimeout(() => setRecentJoiner(null), 3000);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to permission requests with batching to avoid rapid UI churn
    const permissionChannel = supabase
      .channel(`podcast-permissions-${podcastId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'podcast_participation_requests',
          filter: `podcast_id=eq.${podcastId}`
        },
        (payload) => {
          //console.log('Permission request update:', payload);
          if (payload.eventType === 'INSERT') {
            // Buffer inserts and merge them in a short batch window
            const newRequest = payload.new;
            permissionBufferRef.current.push({
              userId: newRequest.user_id,
              requestType: newRequest.request_type,
              timestamp: Date.now(),
              id: newRequest.id
            });

            if (permissionTimerRef.current) {
              window.clearTimeout(permissionTimerRef.current);
            }

            permissionTimerRef.current = window.setTimeout(() => {
              setPermissionRequests(prev => {
                const map = new Map<string, any>();
                prev.forEach((p) => map.set(p.userId, p));
                permissionBufferRef.current.forEach((n) => map.set(n.userId, n));
                permissionBufferRef.current = [];
                return Array.from(map.values());
              });
              permissionTimerRef.current = null;
            }, 200);
          } else if (payload.eventType === 'UPDATE') {
            // Request updated (approved/rejected)
            const updatedRequest = payload.new;
            if (updatedRequest.status === 'approved') {
              // Add to granted permissions
              setGrantedPermissions(prev => {
                const newSet = new Set(prev);
                newSet.add(updatedRequest.user_id);
                return newSet;
              });
              
              // Remove from pending requests
              setPermissionRequests(prev => 
                prev.filter(req => req.userId !== updatedRequest.user_id)
              );
              
              // Show success toast
              toast.success(`Permission granted to ${updatedRequest.user_id}`);
            } else if (updatedRequest.status === 'rejected' || updatedRequest.status === 'revoked') {
              // Remove from pending requests
              setPermissionRequests(prev => 
                prev.filter(req => req.userId !== updatedRequest.user_id)
              );
            }
          }
        }
      )
      .subscribe();

    // Update stream duration every second
    const durationInterval = setInterval(() => {
      setStreamDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      try { listenersChannel.unsubscribe(); } catch (e) {}
      try { permissionChannel.unsubscribe(); } catch (e) {}
      if (listenersDebounceRef.current) {
        window.clearTimeout(listenersDebounceRef.current);
        listenersDebounceRef.current = null;
      }
      if (permissionTimerRef.current) {
        window.clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = null;
      }
      clearInterval(durationInterval);
    };
  }, [podcastId]);

  useEffect(() => {
    if (podcast) {
      loadListeners();
    }
  }, [podcast]);

  // In LivePodcastHost.tsx, update the fetchUserData function and loadPodcast function

// Update the loadPodcast function (already partially fixed):
const loadPodcast = async () => {
  try {
    const { data, error } = await supabase
      .from('ai_podcasts')
      .select('*')
      .eq('id', podcastId)
      .single();

    if (error) throw error;

    // Fetch user details from social_users table for consistency
    if (data?.user_id) {
      const { data: userData } = await supabase
        .from('social_users')
        .select('id, display_name, avatar_url, username')
        .eq('id', data.user_id)
        .single();

      setPodcast({
        ...data,
        user: userData ? {
          full_name: userData.display_name || 'Host',
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
    //console.error('Error loading podcast:', error);
    toast.error('Failed to load podcast');
  }
};

// Update the fetchUserData function:
const fetchUserData = async (userId: string): Promise<UserData> => {
  try {
    // First try social_users table (main source for social features)
    const { data: socialUser, error: socialError } = await supabase
      .from('social_users')
      .select('id, display_name, avatar_url, username')
      .eq('id', userId)
      .single();

    if (!socialError && socialUser) {
      return {
        id: userId,
        full_name: socialUser.display_name || 'Anonymous User',
        avatar_url: socialUser.avatar_url,
        username: socialUser.username || ''
      };
    }

    // Fallback to profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single();

    return {
      id: userId,
      full_name: profile?.full_name || 'Anonymous User',
      avatar_url: profile?.avatar_url,
      username: ''
    };
  } catch (error) {
    //console.error('Error fetching user data:', error);
    return {
      id: userId,
      full_name: 'Anonymous User',
      avatar_url: undefined,
      username: ''
    };
  }
};

// Update the loadListeners function to use fetchUserData:
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
      const listenersWithUsers = await Promise.all(
        data.map(async (listener) => {
          const userData = await fetchUserData(listener.user_id);
          return {
            ...listener,
            user: {
              full_name: userData.full_name,
              avatar_url: userData.avatar_url
            }
          };
        })
      );

      setListeners(listenersWithUsers);
    } else {
      setListeners([]);
    }
  } catch (error) {
    //console.error('Error loading listeners:', error);
  }
};

const handleGrantPermission = useCallback(async (userId: string, requestType: 'speak' | 'cohost') => {
  //console.log('Granting permission to:', userId, 'type:', requestType);

  try {
    // First update database
    const { error: dbError } = await supabase
      .from('podcast_participation_requests')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString(),
        responder_id: currentUser?.id
      })
      .eq('podcast_id', podcastId)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (dbError) throw dbError;

    // If cohost request, add to cohosts table
    if (requestType === 'cohost') {
      await supabase
        .from('podcast_cohosts')
        .upsert({
          podcast_id: podcastId,
          user_id: userId,
          permissions: ['speak', 'moderate'],
          is_active: true
        });
    }

    // Then call WebRTC grantPermission (this will attempt to broadcast)
    await grantPermission(userId, requestType);

    // Update local state for immediate feedback
    setGrantedPermissions(prev => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });

    // Remove from permission requests
    setPermissionRequests(prev => prev.filter(req => req.userId !== userId));

    // Send a direct message via Supabase Realtime as backup
    try {
      const directChannel = supabase.channel(`direct-permission-${podcastId}-${userId}`);
      await directChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await directChannel.send({
            type: 'broadcast',
            event: 'permission-approved',
            payload: {
              userId,
              requestType,
              grantedBy: currentUser?.id,
              timestamp: Date.now()
            }
          });
          setTimeout(() => { try { directChannel.unsubscribe(); } catch (e) {} }, 1000);
        }
      });
    } catch (err) {
      ////console.warn('Direct backup permission broadcast failed', err);
    }

    toast.success(`Permission granted to user`);
  } catch (error: any) {
    //console.error('Error granting permission:', error);
    toast.error('Failed to grant permission');
  }
}, [grantPermission, podcastId, currentUser]);

  // Fallback: ensure the listener receives the permission-granted message
  // even if they missed the signaling broadcast. Send an explicit
  // broadcast on the same channel name used by WebRTC.
  const sendFallbackPermissionBroadcast = useCallback(async (userId: string, requestType: 'speak' | 'cohost') => {
    try {
      const channel = supabase.channel(`podcast-webrtc-${podcastId}`);
      await channel.send({
        type: 'broadcast',
        event: 'permission-granted',
        payload: {
          userId,
          requestType,
          grantedBy: currentUser?.id || null,
          timestamp: Date.now()
        }
      });
      // Best-effort unsubscribe the temporary channel
      try { channel.unsubscribe(); } catch (e) {}
    } catch (err) {
      //console.warn('Fallback permission broadcast failed', err);
    }
  }, [podcastId, currentUser]);

  const handleRevokePermission = useCallback(async (userId: string) => {
    try {
      //console.log('Revoking permission from:', userId);
      
      // Call the WebRTC revokePermission function
      revokePermission(userId);
      
      // Update local state immediately
      setGrantedPermissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      
      // Remove from participants
      setParticipants(prev => prev.filter(p => p.userId !== userId));
      
      toast.info('Permission revoked');
      
    } catch (error: any) {
      //console.error('Error revoking permission:', error);
      toast.error('Failed to revoke permission');
    }
  }, [revokePermission]);

  const handleEndStream = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      toast.info('Ending stream and saving recording...', { 
        duration: Infinity, 
        id: 'ending-stream' 
      });

      // Stop broadcasting and get recorded audio
      const audioBlob = await stopBroadcasting();

      if (audioBlob) {
        // Upload audio to Supabase Storage
        const audioFileName = `live-podcasts/${podcastId}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('podcasts')
          .upload(audioFileName, audioBlob, {
            contentType: 'audio/webm',
            upsert: true
          });

        if (uploadError) {
          throw new Error('Failed to save audio recording');
        }

        // Get public URL for the audio
        const { data: { publicUrl } } = supabase.storage
          .from('podcasts')
          .getPublicUrl(audioFileName);

        // Start transcription in background
        toast.info('Generating transcript with AI...', { 
          duration: Infinity, 
          id: 'transcribing' 
        });

        try {
          const transcriptionResult = await transcribeLivePodcast(
            audioBlob,
            podcast?.title || 'Live Podcast',
            streamDuration,
            publicUrl
          );

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
            description: transcriptionResult.summary || podcast?.description
          };

          // Update podcast with audio URL, transcript, and formatted script
          const { error: updateError } = await supabase
            .from('ai_podcasts')
            .update(updateData)
            .eq('id', podcastId);

          if (updateError) throw updateError;

          toast.dismiss('transcribing');
          toast.dismiss('ending-stream');
          toast.success('Recording saved with transcript!', { 
            description: 'Your podcast is ready to share',
            duration: 5000
          });
        } catch (transcriptionError: any) {
          //console.error('Transcription error:', transcriptionError);
          
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

      // Deactivate all co-hosts
      await supabase
        .from('podcast_cohosts')
        .update({ is_active: false })
        .eq('podcast_id', podcastId);

      // Clear all permission requests
      await supabase
        .from('podcast_participation_requests')
        .update({ status: 'revoked' })
        .eq('podcast_id', podcastId)
        .eq('status', 'pending');

      // Wait a moment to ensure database updates propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      onEndStream();
    } catch (error: any) {
      //console.error('Error ending stream:', error);
      toast.dismiss('ending-stream');
      toast.dismiss('transcribing');
      toast.error('Failed to end stream: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  }, [podcastId, podcast, streamDuration, stopBroadcasting, onEndStream, isSaving]);

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
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'poor':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const isUserCohost = (userId: string) => {
    return cohosts.some(cohost => cohost.user_id === userId);
  };

  const handleRemoveCohost = async (userId: string) => {
    try {
      // Update database
      const { error } = await supabase
        .from('podcast_cohosts')
        .update({ is_active: false })
        .eq('podcast_id', podcastId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setCohosts(prev => prev.filter(cohost => cohost.user_id !== userId));
      
      // Revoke permission
      revokePermission(userId);
      
      toast.info('Co-host removed');
    } catch (error) {
      //console.error('Error removing co-host:', error);
      toast.error('Failed to remove co-host');
    }
  };

  const addCohost = async (userId: string) => {
    try {
      // Add to database
      const { error } = await supabase
        .from('podcast_cohosts')
        .upsert({
          podcast_id: podcastId,
          user_id: userId,
          permissions: ['speak', 'moderate'],
          is_active: true
        });

      if (error) throw error;

      // Reload cohosts
      const { data } = await supabase
        .from('podcast_cohosts')
        .select(`
          user_id,
          permissions,
          created_at,
          user:social_users!inner(display_name, avatar_url)
        `)
        .eq('podcast_id', podcastId)
        .eq('is_active', true);

      if (data) {
        const mapped = data.map((row: any) => ({
          ...row,
          user: {
            full_name: row.user?.display_name || row.user?.full_name || 'Co-host',
            avatar_url: row.user?.avatar_url
          }
        }));
        setCohosts(mapped);
      }

      // Grant permission
      grantPermission(userId, 'cohost');
      
      toast.success('Co-host added');
    } catch (error) {
      //console.error('Error adding co-host:', error);
      toast.error('Failed to add co-host');
    }
  };

  if (!podcast) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  const liveDuration = podcast.live_started_at
    ? formatDistanceToNow(new Date(podcast.live_started_at), { addSuffix: false })
    : '0m';

  // Mobile Controls Component
  const MobileControls = () => {
    return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-black/95 border-t border-gray-200 dark:border-gray-800 z-40">
      <div className="p-4">
        {/* Stats Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <div className="text-black dark:text-white font-mono text-xl">{formatDuration(streamDuration)}</div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-black dark:text-white font-mono text-xl">{listeners.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Listeners</div>
          </div>
          <div className="text-center">
            <div className="text-blue-500 font-medium">Live</div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Status</div>
          </div>
        </div>

        {/* Control Buttons */}
          <div className="flex gap-3">
          <Button
            size="lg"
            variant={isMuted ? 'default' : 'outline'}
            onClick={toggleMute}
            className={`${isMuted ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-900/50 border-slate-800 text-black dark:text-white hover:bg-slate-800'} flex-1 rounded-full h-12`}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={handleEndStream}
            disabled={isSaving}
            className="flex-1 bg-red-600 hover:bg-red-700 rounded-full h-12"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <PhoneOff className="h-5 w-5" />
            )}
          </Button>

          {/* Mobile Menu Button */}

          <Button
            size="lg"
            variant="outline"
            onClick={() => handleMobileSheetOpenChange(true)}
            className="bg-slate-900/50 border-slate-800 text-black dark:text-white hover:bg-slate-800 rounded-full h-12 w-12"
          >
            <Menu className="h-5 w-5" />
          </Button>

          
        </div>
      </div>
    </div>
    );
  }

  return (
  <div className="fixed inset-0 z-50 bg-white dark:bg-black overflow-hidden">

    {/* Join Notification Overlay */}
    {recentJoiner && (
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-blue-600/90 dark:bg-blue-600/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg shadow-blue-500/20 dark:shadow-blue-500/20 flex items-center gap-2">
          <Users className="h-3 w-3" />
          {recentJoiner}
        </div>
      </div>
    )}

    {/* Main Content */}
    <div className="h-full flex flex-col lg:flex-row pt-12 md:pt-0">
      {/* Center Content */}
      <div className="flex-1 relative bg-white dark:bg-black overflow-hidden lg:w-[70%]">
        <div className="w-full h-full flex items-center justify-center">
          {/* Background */}
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-black">
            <div className="relative">
              {/* Animated Circle */}
              <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full p-2 ${
                isConnected && !isMuted
                  ? 'bg-gradient-to-tr from-blue-600 via-blue-400 to-blue-600 dark:from-blue-500 dark:via-blue-300 dark:to-blue-500 animate-spin-slow'
                  : 'bg-gray-200 dark:bg-slate-800'
              }`}>
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                  {isMuted ? (
                    <MicOff className="h-16 w-16 md:h-24 md:w-24 text-gray-500 dark:text-slate-600" />
                  ) : (
                    <Mic className="h-16 w-16 md:h-24 md:w-24 text-blue-500 dark:text-blue-400" />
                  )}
                </div>
                {isConnected && !isMuted && (
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 dark:border-blue-400/50 animate-ping"></div>
                )}
              </div>

              {/* Status Badges */}
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                ON AIR
              </div>
            </div>

            {/* Connection Status */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-black/80 text-black dark:text-white px-3 py-1.5 rounded-full text-sm backdrop-blur-sm flex items-center gap-2">
              {getConnectionIcon()}
              <span className="uppercase">{connectionQuality}</span>
            </div>

            {/* Quick Stats Overlay for Mobile */}
            <div className="md:hidden absolute top-4 right-4 bg-white/80 dark:bg-black/80 backdrop-blur-sm rounded-lg p-3 shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  <span className="text-black dark:text-white text-sm">{listeners.length} listeners</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  <span className="text-black dark:text-white text-sm">{participants.length} speakers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Desktop */}
      <div className="hidden lg:block w-[30%] mt-12 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="grid grid-cols-3 mb-6 bg-gray-100 dark:bg-gray-900/50">
              <TabsTrigger value="stats" className="data-[state=active]:bg-blue-600 dark:data-[state=active]:bg-blue-600">
                Stats
              </TabsTrigger>
              <TabsTrigger value="participants" className="data-[state=active]:bg-blue-600 dark:data-[state=active]:bg-blue-600">
                Participants
              </TabsTrigger>
              <TabsTrigger value="cohosts" className="data-[state=active]:bg-yellow-600 dark:data-[state=active]:bg-yellow-600">
                Co-hosts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="space-y-6">
              {/* Stats Section */}
              <div>
                <h1 className="text-black dark:text-white font-bold text-lg mb-4">Stream Stats</h1>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Duration</span>
                    <span className="text-black dark:text-white font-mono text-lg">{formatDuration(streamDuration)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Listeners</span>
                    <span className="text-black dark:text-white font-mono text-lg">{listeners.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Active Speakers</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-lg">
                      {participants.filter(p => p.isSpeaking).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Co-hosts</span>
                    <span className="text-yellow-600 dark:text-yellow-400 font-mono text-lg">
                      {participants.filter(p => isUserCohost(p.userId)).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status</span>
                    <span className="text-blue-600 dark:text-blue-500 font-medium">Live</span>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Connection Quality</span>
                  <div className="flex items-center gap-2">
                    {getConnectionIcon()}
                    <span className="text-black dark:text-white uppercase">{connectionQuality}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      connectionQuality === 'excellent' ? 'bg-blue-500 dark:bg-blue-500 w-full' :
                      connectionQuality === 'good' ? 'bg-blue-400 dark:bg-blue-400 w-3/4' :
                      connectionQuality === 'poor' ? 'bg-yellow-500 dark:bg-yellow-500 w-1/2' :
                      'bg-red-500 dark:bg-red-500 w-1/4'
                    }`}
                  ></div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    size="lg"
                    variant={isMuted ? 'default' : 'outline'}
                    onClick={toggleMute}
                    className={`rounded-full h-12 font-bold flex items-center justify-center ${
                      isMuted
                        ? 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700'
                          : 'bg-gray-900/50 dark:bg-slate-900/50 border-gray-300 dark:border-slate-800 text-black dark:text-white hover:bg-gray-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-5 w-5 mr-2" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5 mr-2" />
                        Mute
                      </>
                    )}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
                      if (isDesktop) {
                        setActiveTab('participants');
                      } else {
                        setMobileActiveTab('participants');
                        handleMobileSheetOpenChange(true);
                      }
                    }}
                    className="rounded-full h-12 font-bold flex items-center justify-center bg-gray-900/50 dark:bg-slate-900/50 border-gray-300 dark:border-slate-800 text-black dark:text-white hover:bg-gray-800 dark:hover:bg-slate-800"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Participants
                  </Button>

                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleEndStream}
                    disabled={isSaving}
                    className="rounded-full h-12 font-bold flex items-center justify-center shadow-lg shadow-red-900/20"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Ending
                      </>
                    ) : (
                      <>
                        <PhoneOff className="h-5 w-5 mr-2" />
                        End
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="participants">
              <ParticipationManager
                podcastId={podcastId}
                currentUserId={currentUser?.id || ''}
                isHost={true}
                participants={participants}
                permissionRequests={permissionRequests}
                grantedPermissions={Array.from(grantedPermissions)}
                onGrantPermission={handleGrantPermission}
                onRevokePermission={handleRevokePermission}
                onMuteParticipant={setParticipantsMuted}
              />
            </TabsContent>

            <TabsContent value="cohosts">
              {/* Co-host Management Section */}
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    Co-host Management
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-100/70 text-sm mb-4">
                    Co-hosts can speak and moderate participants. They appear with a crown badge.
                  </p>
                  
                  <div className="space-y-3">
                    {/* Co-host list */}
                    {cohosts.length > 0 ? (
                      cohosts.map(cohost => (
                        <div key={cohost.user_id} className="flex items-center justify-between p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={cohost.user?.avatar_url} />
                              <AvatarFallback className="bg-yellow-500 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100">
                                <Crown className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-black dark:text-white">{cohost.user?.full_name || 'Co-host'}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Mic className="h-3 w-3 mr-1" />
                                  Can Speak
                                </Badge>
                                {cohost.permissions?.includes('moderate') && (
                                  <Badge variant="outline" className="text-xs border-yellow-500 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Can Moderate
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCohost(cohost.user_id)}
                            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <Crown className="h-12 w-12 mx-auto mb-3 text-yellow-300 dark:text-yellow-700/50" />
                        <p className="text-yellow-700 dark:text-yellow-200/50">No co-hosts yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-500 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                    onClick={() => {
                      // You can implement a dialog to select from current participants
                      if (participants.length > 0) {
                        const firstParticipant = participants[0];
                        if (firstParticipant.userId !== currentUser?.id) {
                          addCohost(firstParticipant.userId);
                        }
                      } else {
                        toast.info('No participants available to add as co-host');
                      }
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Co-host
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    onClick={() => {
                      participants.forEach(p => {
                        if (p.userId !== currentUser?.id) {
                          setParticipantsMuted(p.userId, true);
                        }
                      });
                      toast.info('All participants muted');
                    }}
                  >
                    <VolumeX className="h-4 w-4 mr-2" />
                    Mute All
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Mobile Controls */}
    <MobileControls />

    {/* Mobile Sheet (bottom) for controls and participants */}
    <Sheet open={mobileSheetOpen} onOpenChange={handleMobileSheetOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-[20px] p-4 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <SheetTitle className="text-black dark:text-white">Live Controls</SheetTitle>
          <Button variant="ghost" size="icon" onClick={() => handleMobileSheetOpenChange(false)} className="text-black dark:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Tabs value={mobileActiveTab} onValueChange={(v: any) => setMobileActiveTab(v)} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4 bg-gray-100 dark:bg-gray-900/50">
            <TabsTrigger value="stats" className="data-[state=active]:bg-blue-600 dark:data-[state=active]:bg-blue-600">Stats</TabsTrigger>
            <TabsTrigger value="participants" className="data-[state=active]:bg-blue-600 dark:data-[state=active]:bg-blue-600">Participants</TabsTrigger>
            <TabsTrigger value="cohosts" className="data-[state=active]:bg-yellow-600 dark:data-[state=active]:bg-yellow-600">Co-hosts</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Duration</span>
              <span className="text-black dark:text-white font-mono">{formatDuration(streamDuration)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Listeners</span>
              <span className="text-black dark:text-white font-mono">{listeners.length}</span>
            </div>

            <div className="flex gap-3 mt-3">
              <Button
                size="lg"
                variant={isMuted ? 'default' : 'outline'}
                onClick={toggleMute}
                className={`flex-1 rounded-full h-12 ${isMuted ? 'bg-blue-600 text-white' : 'bg-gray-900/50 dark:bg-slate-900/50 text-black dark:text-white'}`}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <Button size="lg" variant="destructive" onClick={handleEndStream} disabled={isSaving} className="flex-1 rounded-full h-12 bg-red-600">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="participants">
            <div className="h-[50vh] overflow-y-auto">
              <ParticipationManager
                podcastId={podcastId}
                currentUserId={currentUser?.id || ''}
                isHost={true}
                participants={participants}
                permissionRequests={permissionRequests}
                grantedPermissions={Array.from(grantedPermissions)}
                onGrantPermission={handleGrantPermission}
                onRevokePermission={handleRevokePermission}
                onMuteParticipant={setParticipantsMuted}
              />
            </div>
          </TabsContent>

          <TabsContent value="cohosts">
            <div className="space-y-4">
              {cohosts.length > 0 ? (
                cohosts.map((cohost) => (
                  <div key={cohost.user_id} className="flex items-center justify-between p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={cohost.user?.avatar_url} />
                        <AvatarFallback className="bg-yellow-500 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100">
                          <Crown className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-black dark:text-white">{cohost.user?.full_name || 'Co-host'}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            <Mic className="h-3 w-3 mr-1" />
                            Can Speak
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveCohost(cohost.user_id)} className="text-red-500 dark:text-red-400">
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-yellow-700 dark:text-yellow-200/50">No co-hosts yet</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>

    {/* Error Message for Mobile */}
    {error && (
      <div className="md:hidden fixed top-16 left-4 right-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/50 rounded-lg p-3 z-50">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )}
  </div>
);
};