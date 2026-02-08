// LivePodcastHost.tsx — Zoom / Google Meet style UI
import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Trash2, Mic, MicOff, X, UserPlus, Video, VideoOff, MessageSquare, 
  Users, Volume2, VolumeX, Edit, Send, BookmarkPlus,
  Captions, Radio, BarChart2, HelpCircle, AlertCircle, Wifi, WifiOff,
  Lightbulb, Loader2, MoreVertical, MessageCircle
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useChunkedRecording } from '@/hooks/useChunkedRecording';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { saveTranscriptionResult, uploadTempChunk, invokeRealtimeTranscription } from '@/services/podcastLiveService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface LivePodcastHostProps {
  podcastId: string;
  onEndStream: () => void;
}

const LivePodcastHost: React.FC<LivePodcastHostProps> = ({ podcastId, onEndStream }) => {
  const [enableVideo, setEnableVideo] = useState(false);
  const [recordingStreamType, setRecordingStreamType] = useState<'audio' | 'video'>('audio');
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [streamTime, setStreamTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'participants' | 'requests' | 'chat' | 'analytics' | 'notes'>('participants');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const chatChannelRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [notesDraft, setNotesDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartRef = useRef<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const transcriptChannelRef = useRef<any>(null);
  const [liveViewers, setLiveViewers] = useState(0);
  const [engagementScore, setEngagementScore] = useState(0);
  const [captions, setCaptions] = useState<Array<{ text: string; timestamp: number }>>([]);
  const captionsChannelRef = useRef<any>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const captionRecorderRef = useRef<MediaRecorder | null>(null);
  const captionChannelRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCaptionSendRef = useRef<number>(0);
  const [hasVideoTracks, setHasVideoTracks] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const {
    localStream,
    isConnected,
    isMuted,
    participants,
    permissionRequests,
    connectionQuality,
    error,
    toggleMute,
    stopBroadcasting,
    startBroadcasting,
    grantPermission,
    revokePermission,
    setParticipantsMuted,
    addLocalVideo
  } = useWebRTC({ podcastId, isHost: true, enableVideo });

  const chunked = useChunkedRecording();

  // Stream timer
  useEffect(() => {
    const timer = setInterval(() => setStreamTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch real live metrics
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchMetrics = async () => {
      const { data, error } = await supabase
        .from('podcast_listeners')
        .select('user_id', { count: 'exact', head: true })
        .eq('podcast_id', podcastId)
        .eq('is_active', true);
      if (!error) setLiveViewers(data?.length || 0);
    };
    fetchMetrics();
    interval = setInterval(fetchMetrics, 5000);
    return () => { if (interval) clearInterval(interval); };
  }, [podcastId]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Monitor video tracks in the stream
  useEffect(() => {
    if (!localStream) {
      setHasVideoTracks(false);
      return;
    }

    const checkVideoTracks = () => {
      const videoTracks = localStream.getVideoTracks();
      const hasVideo = videoTracks.length > 0;
      // //consolee.log('Checking video tracks:', hasVideo, videoTracks.length);
      setHasVideoTracks(hasVideo);
    };

    // Check immediately
    checkVideoTracks();

    // Check periodically in case tracks are added
    const interval = setInterval(checkVideoTracks, 500);

    // Listen for track changes
    const handleTrackAdded = () => {
      // //consolee.log('Track added to stream');
      checkVideoTracks();
    };

    localStream.addEventListener('addtrack', handleTrackAdded);

    return () => {
      clearInterval(interval);
      localStream.removeEventListener('addtrack', handleTrackAdded);
    };
  }, [localStream]);

  // Video upgrade - handle when user toggles video on
  useEffect(() => {
    if (!enableVideo) return;
    
    (async () => {
      try {
        // If we already have video tracks, no need to re-add
        if (localStream?.getVideoTracks().length) {
          //consolee.log('Video tracks already present');
          return;
        }
        
        //consolee.log('Adding video to stream...');
        if (addLocalVideo) {
          await addLocalVideo();
        } else {
          await startBroadcasting();
        }
      } catch (e) {
        //consolee.error('Failed to upgrade stream with video:', e);
        toast.error('Failed to enable video');
      }
    })();
  }, [enableVideo, localStream, addLocalVideo, startBroadcasting]);

  // FIXED: Attach localStream to preview with proper video track handling
  useEffect(() => {
    if (!localVideoRef.current || !localStream) {
      //consolee.log('Video ref or stream not available');
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    //consolee.log('Stream attachment effect - Video tracks:', videoTracks.length, 'Enable video:', enableVideo, 'Has video tracks state:', hasVideoTracks);
    
    // Only proceed if we have video tracks (when video is enabled)
    if (enableVideo && videoTracks.length === 0) {
      //consolee.warn('Video enabled but no video tracks in stream yet, waiting...');
      return;
    }

    // Don't attach if video is disabled
    if (!enableVideo) {
      //consolee.log('Video disabled, skipping attachment');
      return;
    }

    //consolee.log('✅ Attaching stream to video element with', videoTracks.length, 'video tracks');
    
    // Set the stream to video element
    localVideoRef.current.srcObject = localStream;
    
    // Force play - use multiple strategies
    const playVideo = async () => {
      if (!localVideoRef.current) return;
      
      try {
        // Strategy 1: Direct play
        //consolee.log('Attempting direct play...');
        await localVideoRef.current.play();
        //consolee.log('✅ Video preview playing successfully (direct)');
      } catch (e: any) {
        //consolee.warn('Play attempt 1 failed:', e.message);
        
        // Strategy 2: Load then play
        try {
          //consolee.log('Attempting load + play...');
          localVideoRef.current.load();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          await localVideoRef.current.play();
          //consolee.log('✅ Video playing after load');
        } catch (e2: any) {
          //consolee.error('❌ All play attempts failed:', e2.message);
          
          // Strategy 3: Wait for loadedmetadata
          try {
            //consolee.log('Waiting for loadedmetadata event...');
            await new Promise<void>((resolve, reject) => {
              if (!localVideoRef.current) {
                reject(new Error('Video ref lost'));
                return;
              }
              
              const onLoadedMetadata = async () => {
                //consolee.log('Metadata loaded, attempting play...');
                try {
                  await localVideoRef.current?.play();
                  //consolee.log('✅ Video playing after metadata load');
                  resolve();
                } catch (err) {
                  reject(err);
                }
              };
              
              const onError = (err: Event) => {
                //consolee.error('Video element error:', err);
                reject(err);
              };
              
              localVideoRef.current.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
              localVideoRef.current.addEventListener('error', onError, { once: true });
              
              // Timeout after 5 seconds
              setTimeout(() => reject(new Error('Timeout waiting for metadata')), 5000);
            });
          } catch (e3) {
            //consolee.error('❌ Metadata strategy also failed:', e3);
            toast.error('Video preview failed to start. Please check camera permissions.');
          }
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(playVideo, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (localVideoRef.current) {
        localVideoRef.current.pause();
        localVideoRef.current.srcObject = null;
      }
    };
  }, [localStream, enableVideo, hasVideoTracks]); // Added hasVideoTracks dependency

  // Subscribe to captions channel
  useEffect(() => {
    if (!podcastId) return;
    if (captionsChannelRef.current) return;
    const channel = supabase.channel(`podcast-captions-${podcastId}`);
    captionsChannelRef.current = channel;
    channel.on('broadcast', { event: 'caption' }, ({ payload }) => {
      if (payload?.text) setCaptions(prev => [...prev.slice(-20), { text: payload.text, timestamp: Date.now() }]);
    }).subscribe();
    return () => {
      channel.unsubscribe();
      captionsChannelRef.current = null;
    };
  }, [podcastId]);

  // Subscribe to live chat broadcast channel
  useEffect(() => {
    if (!podcastId) return;
    const channel = supabase.channel(`podcast-chat-${podcastId}`);
    chatChannelRef.current = channel;
    channel.on('broadcast', { event: 'chat-message' }, ({ payload }) => {
      if (payload) {
        const msg = payload as ChatMessage;
        setChatMessages(prev => [...prev.slice(-100), msg]);
        // Increment unread if chat panel is not active
        if (activeTab !== 'chat' || !showSidePanel) {
          setUnreadChat(prev => prev + 1);
        }
      }
    }).subscribe();
    return () => {
      channel.unsubscribe();
      chatChannelRef.current = null;
    };
  }, [podcastId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Clear unread when chat tab is active
  useEffect(() => {
    if (activeTab === 'chat' && showSidePanel) {
      setUnreadChat(0);
    }
  }, [activeTab, showSidePanel]);

  // Send a chat message via broadcast
  const sendChatMessage = async () => {
    if (!chatDraft.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: user?.id || 'host',
        senderName: 'Host',
        text: chatDraft.trim(),
        timestamp: Date.now(),
      };
      // Add locally immediately
      setChatMessages(prev => [...prev.slice(-100), msg]);
      setChatDraft('');
      // Broadcast to all participants
      await supabase.channel(`podcast-chat-${podcastId}`).send({
        type: 'broadcast',
        event: 'chat-message',
        payload: msg,
      });
    } catch (e) {
      toast.error('Failed to send message');
    }
  };

  // Save key points to the user's personal notes table
  const saveNotesToUserNotes = async () => {
    if (keyPoints.length === 0) {
      toast.error('No notes to save');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated'); return; }
      // Fetch podcast title for a meaningful note title
      const { data: podcast } = await supabase.from('ai_podcasts').select('title').eq('id', podcastId).single();
      const title = `Live Podcast Notes — ${podcast?.title || 'Untitled'}`;
      const content = keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const { error } = await supabase.from('notes').insert({
        user_id: user.id,
        title,
        content,
        category: 'podcast',
        tags: ['live-podcast', 'auto-saved'],
      });
      if (error) throw error;
      toast.success('Notes saved to My Notes');
    } catch (e) {
      toast.error('Failed to save notes');
    }
  };

  const handleEndStream = async () => {
    setIsEnding(true);
    try {
      await chunked.stop();
      await stopBroadcasting();
      
      // Stop recording stream tracks
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { }
        });
        recordingStreamRef.current = null;
      }

      // Auto-save key points to user's notes
      if (keyPoints.length > 0) {
        await saveNotesToUserNotes();
      }
      
      await supabase.from('ai_podcasts').update({ is_live: false }).eq('id', podcastId);
      toast.success('Stream ended successfully');
      onEndStream();
    } catch (e) {
      toast.error('Failed to end stream');
    } finally {
      setIsEnding(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = recordingStreamRef.current || localStream;
      if (!stream) {
        toast.error('No active stream');
        return;
      }
      await chunked.start(podcastId, { stream, mimeType: 'audio/webm;codecs=opus' });
      setIsRecording(true);
      recordingStartRef.current = Date.now();
      toast.success('Recording started');
    } catch (e) {
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      await chunked.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      recordingStartRef.current = null;
      toast.success('Recording stopped');
    } catch (e) {
      toast.error('Failed to stop recording');
    }
  };

  const toggleCaptions = async () => {
    if (isCaptioning) {
      if (captionRecorderRef.current && captionRecorderRef.current.state !== 'inactive') {
        captionRecorderRef.current.stop();
      }
      setIsCaptioning(false);
      toast.info('Captions stopped');
    } else {
      try {
        const stream = localStream;
        if (!stream) {
          toast.error('No active stream for captions');
          return;
        }
        const audioStream = new MediaStream(stream.getAudioTracks());
        const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
        captionRecorderRef.current = recorder;
        
        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && Date.now() - lastCaptionSendRef.current > 2000) {
            lastCaptionSendRef.current = Date.now();
            try {
              const formData = new FormData();
              formData.append('audio', event.data, 'caption.webm');
              const { data } = await supabase.functions.invoke('transcribe-caption', { body: formData });
              if (data?.text) {
                await supabase.channel(`podcast-captions-${podcastId}`).send({
                  type: 'broadcast',
                  event: 'caption',
                  payload: { text: data.text }
                });
              }
            } catch (e) {
              //consolee.error('Caption error:', e);
            }
          }
        };
        
        recorder.start(2000);
        setIsCaptioning(true);
        toast.success('Live captions started');
      } catch (e) {
        toast.error('Failed to start captions');
      }
    }
  };

  const promoteToCohost = async (userId: string) => {
    try {
      await supabase.from('podcast_members').update({ role: 'cohost' })
        .eq('podcast_id', podcastId).eq('user_id', userId);
      toast.success('User promoted to co-host');
    } catch (e) {
      toast.error('Failed to promote user');
    }
  };

  const bootParticipant = async (userId: string) => {
    try {
      revokePermission(userId);
      toast.success('Participant removed');
    } catch (e) {
      toast.error('Failed to remove participant');
    }
  };

  const approveRequest = async (userId: string, requestType: 'speak' | 'cohost') => {
    try {
      await grantPermission(userId, requestType);
      toast.success(`${requestType} request approved`);
    } catch (e) {
      toast.error('Failed to approve request');
    }
  };

  const addKeyPoint = async (point: string) => {
    if (!point.trim()) return;
    const newPoints = [...keyPoints, point.trim()];
    setKeyPoints(newPoints);
    setNotesDraft('');
    // Persist notes to ai_podcasts.visual_assets.notes
    try {
      const { data: podcast } = await supabase
        .from('ai_podcasts')
        .select('visual_assets')
        .eq('id', podcastId)
        .single();
      const existingAssets = (podcast?.visual_assets as Record<string, any>) || {};
      await supabase
        .from('ai_podcasts')
        .update({ visual_assets: { ...existingAssets, notes: newPoints } })
        .eq('id', podcastId);
      toast.success('Key point saved');
    } catch (e) {
      toast.success('Key point added locally');
    }
  };

  // Load existing notes from DB on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ai_podcasts')
        .select('visual_assets')
        .eq('id', podcastId)
        .single();
      const existing = (data?.visual_assets as Record<string, any>);
      if (existing?.notes && Array.isArray(existing.notes)) {
        setKeyPoints(existing.notes);
      }
    })();
  }, [podcastId]);

  const getConnectionQualityColor = () => {
    if (connectionQuality === 'excellent') return 'text-green-500';
    if (connectionQuality === 'good') return 'text-yellow-500';
    if (connectionQuality === 'poor') return 'text-orange-500';
    return 'text-red-500';
  };

  // Cleanup all streams on component unmount
  useEffect(() => {
    return () => {
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { }
        });
        recordingStreamRef.current = null;
      }
      
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) { }
      }
    };
  }, []);

  // Side panel toggle helper
  const toggleSidePanel = (tab: 'participants' | 'requests' | 'chat' | 'analytics' | 'notes') => {
    if (activeTab === tab && showSidePanel) {
      setShowSidePanel(false);
    } else {
      setActiveTab(tab);
      setShowSidePanel(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#202124] text-white flex flex-col overflow-hidden font-sans">
      
      {/* ===== 1. Top Bar — Transparent overlay ===== */}
      <div className="flex-none h-14 px-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
        {/* Left: LIVE + Timer + Viewers */}
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="animate-pulse bg-red-600 hover:bg-red-700 text-white border-none gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-white block" />
            LIVE
          </Badge>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-white/90 text-sm font-mono tracking-wide">{formatTime(streamTime)}</span>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-1.5 text-white/80 text-sm">
            <Users className="h-3.5 w-3.5" />
            <motion.span key={liveViewers} initial={{ scale: 1.3, color: '#4ade80' }} animate={{ scale: 1, color: '#fff' }}>{liveViewers}</motion.span>
          </div>
          {isRecording && (
            <>
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                <motion.div className="h-2 w-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                REC
              </div>
            </>
          )}
        </div>

        {/* Right: Connection quality */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium",
            connectionQuality === 'excellent' ? 'text-green-400' : connectionQuality === 'good' ? 'text-yellow-400' : 'text-red-400'
          )}>
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline capitalize">{connectionQuality}</span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4">
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/15 px-4 py-2 rounded-lg border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 2. Main Stage Area ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex items-center justify-center relative p-2 sm:p-4">
          <div className="relative w-full h-full max-w-6xl max-h-[calc(100vh-8rem)] rounded-xl overflow-hidden bg-[#3c4043] shadow-2xl flex items-center justify-center border border-white/5">
            
            {enableVideo && hasVideoTracks ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ display: 'block', backgroundColor: '#000', transform: 'scaleX(-1)' }}
              />
            ) : (
              /* Audio-only: Large avatar with wave rings */
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
                  <Avatar className="h-32 w-32 border-4 border-[#3c4043] shadow-xl z-10 relative">
                    <AvatarFallback className="bg-gradient-to-br from-red-600 to-pink-600 text-4xl font-bold">
                      <Radio className="h-14 w-14" />
                    </AvatarFallback>
                  </Avatar>
                  {/* Pulse rings */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute border border-red-500/30 rounded-full"
                        initial={{ width: '100%', height: '100%', opacity: 0.8 }}
                        animate={{ width: `${100 + i * 25}%`, height: `${100 + i * 25}%`, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                      />
                    ))}
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">Audio Stream Active</h2>
                <p className="text-gray-400 max-w-md">Broadcasting to {liveViewers} listener{liveViewers !== 1 ? 's' : ''}</p>
                {enableVideo && <p className="text-gray-500 text-sm mt-3">Waiting for video stream...</p>}
              </div>
            )}

            {/* Captions Overlay */}
            <AnimatePresence>
              {isCaptioning && captions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none"
                >
                  <div className="bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg max-w-3xl text-center text-base md:text-lg font-medium shadow-lg">
                    {captions[captions.length - 1].text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Self-view label (video mode) */}
            {enableVideo && hasVideoTracks && (
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-md z-10">
                You (Host)
              </div>
            )}
          </div>
        </div>

        {/* ===== 3. Side Panel (Drawer) ===== */}
        <AnimatePresence>
          {showSidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100%' : 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#202124] border-l border-white/10 flex flex-col h-full absolute right-0 top-0 z-20 md:relative shadow-2xl"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-base font-medium text-white">
                  {activeTab === 'participants' ? 'People' : activeTab === 'requests' ? 'Requests' : activeTab === 'chat' ? 'In-call messages' : activeTab === 'analytics' ? 'Analytics' : 'Notes'}
                </h3>
                <button onClick={() => setShowSidePanel(false)} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 flex items-center justify-center transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Panel Tabs */}
              <div className="flex border-b border-white/10">
                {(['participants', 'requests', 'chat', 'analytics', 'notes'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-medium transition-colors relative",
                      activeTab === tab ? "text-[#8ab4f8]" : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1 relative">
                      {tab === 'participants' && <Users className="h-4 w-4" />}
                      {tab === 'requests' && <MessageSquare className="h-4 w-4" />}
                      {tab === 'chat' && (
                        <>
                          <MessageCircle className="h-4 w-4" />
                          {unreadChat > 0 && activeTab !== 'chat' && (
                            <span className="absolute -top-1 -right-2 h-3.5 w-3.5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">{unreadChat > 9 ? '9+' : unreadChat}</span>
                          )}
                        </>
                      )}
                      {tab === 'analytics' && <BarChart2 className="h-4 w-4" />}
                      {tab === 'notes' && <Edit className="h-4 w-4" />}
                    </div>
                    {activeTab === tab && <motion.div layoutId="host-tab-indicator" className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#8ab4f8] rounded-full" />}
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Participants */}
                {activeTab === 'participants' && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">In this call ({participants.length})</span>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {participants.map((p, idx) => (
                        <motion.div
                          key={p.userId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: idx * 0.03 }}
                          className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-[#3c4043]/50 hover:bg-[#3c4043] transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="relative">
                              <Avatar className="h-9 w-9 border border-white/10">
                                <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-600 to-purple-600">
                                  {p.userId?.[0]?.toUpperCase() ?? 'U'}
                                </AvatarFallback>
                              </Avatar>
                              {p.isSpeaking && (
                                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-[#202124]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{p.userId?.split('@')[0] || p.userId}</p>
                              <span className={cn("text-xs", p.isSpeaking ? "text-green-400" : p.isMuted ? "text-red-400" : "text-gray-500")}>
                                {p.isSpeaking ? 'Speaking' : p.isMuted ? 'Muted' : 'Connected'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setParticipantsMuted(p.userId, !p.isMuted)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                              {p.isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => promoteToCohost(p.userId)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                              <UserPlus className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => bootParticipant(p.userId)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {participants.length === 0 && (
                      <div className="text-center py-12">
                        <Users className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                        <p className="text-sm text-gray-500">No participants yet</p>
                      </div>
                    )}
                  </>
                )}

                {/* Chat */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-full -m-4 -mt-3">
                    <div className="bg-[#3c4043]/50 rounded-lg p-2.5 text-xs text-gray-400 text-center mx-4 mt-4 mb-2">
                      Messages are visible to everyone in the call and are deleted when the call ends.
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 space-y-3 min-h-0">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-8">
                          <MessageCircle className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                          <p className="text-sm text-gray-500">No messages yet</p>
                          <p className="text-xs text-gray-600 mt-1">Messages from participants will appear here</p>
                        </div>
                      )}
                      {chatMessages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-2.5"
                        >
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5 border border-white/10">
                            <AvatarFallback className="text-[10px] font-semibold bg-gradient-to-br from-blue-600 to-purple-600">
                              {msg.senderName?.[0]?.toUpperCase() ?? 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-white">{msg.senderName}</span>
                              <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed break-words">{msg.text}</p>
                          </div>
                        </motion.div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="border-t border-white/10 p-3">
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={chatDraft}
                          onChange={(e) => setChatDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                          placeholder="Send a message to everyone"
                          rows={1}
                          className="flex-1 bg-[#3c4043] border border-transparent focus:border-blue-400 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 resize-none text-sm outline-none transition-colors max-h-20"
                        />
                        <button
                          onClick={sendChatMessage}
                          disabled={!chatDraft.trim()}
                          className="h-9 w-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full shrink-0 transition-colors"
                        >
                          <Send className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Requests */}
                {activeTab === 'requests' && (
                  <>
                    {permissionRequests.length > 0 ? permissionRequests.map((req, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#3c4043] rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-white/10">
                            <AvatarFallback className="text-xs bg-blue-600/30 text-blue-300">{req.userId?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{req.userId?.split('@')[0] || req.userId}</p>
                            <p className="text-xs text-gray-400">Wants to {req.requestType}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveRequest(req.userId, req.requestType)} className="flex-1 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">Accept</button>
                          <button className="flex-1 py-2 rounded-full bg-[#3c4043] hover:bg-[#4a4e51] text-white text-sm font-medium border border-white/10 transition-colors">Decline</button>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="text-center py-12">
                        <HelpCircle className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                        <p className="text-sm text-gray-500">No pending requests</p>
                      </div>
                    )}
                  </>
                )}

                {/* Analytics */}
                {activeTab === 'analytics' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#3c4043] rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">{liveViewers}</p>
                        <p className="text-xs text-gray-400 mt-1">Viewers</p>
                      </div>
                      <div className="bg-[#3c4043] rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">{participants.length}</p>
                        <p className="text-xs text-gray-400 mt-1">Speakers</p>
                      </div>
                      <div className="bg-[#3c4043] rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">{formatTime(streamTime)}</p>
                        <p className="text-xs text-gray-400 mt-1">Duration</p>
                      </div>
                      <div className="bg-[#3c4043] rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-white">{engagementScore}%</p>
                        <p className="text-xs text-gray-400 mt-1">Engagement</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        placeholder="Add a key point or note..."
                        className="w-full h-24 bg-[#3c4043] border border-transparent focus:border-blue-400 rounded-lg p-3 text-white placeholder:text-gray-500 resize-none text-sm outline-none transition-colors"
                      />
                      <button
                        onClick={() => addKeyPoint(notesDraft)}
                        disabled={!notesDraft.trim()}
                        className="absolute bottom-2 right-2 h-8 w-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full transition-colors"
                      >
                        <Lightbulb className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    {keyPoints.length > 0 && (
                      <>
                        <div className="space-y-2">
                          {keyPoints.map((point, i) => (
                            <div key={i} className="bg-[#3c4043]/50 p-3 rounded-lg border border-white/5 text-sm text-gray-300 leading-relaxed">
                              <span className="text-yellow-400 mr-2">#{i + 1}</span>{point}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={saveNotesToUserNotes}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <BookmarkPlus className="h-4 w-4" />
                          Save to My Notes
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== 4. Bottom Control Bar — Google Meet style ===== */}
      <div className="flex-none h-20 bg-[#202124] flex items-center justify-between px-4 sm:px-8 z-20 border-t border-white/5">
        
        {/* Left: Stream info */}
        <div className="hidden md:flex items-center min-w-[200px]">
          <div className="flex flex-col">
            <span className="font-medium text-base text-white truncate max-w-[200px]">Live Podcast</span>
            <span className="text-xs text-gray-400">studdyhub.vercel.app</span>
          </div>
        </div>

        {/* Center: Main controls */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1">
          {/* Mic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleMute}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                  isMuted ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white border border-transparent hover:border-gray-500"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
          </Tooltip>

          {/* Video */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setEnableVideo(!enableVideo)}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                  !enableVideo ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white border border-transparent hover:border-gray-500"
                )}
              >
                {enableVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">{enableVideo ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
          </Tooltip>

          {/* Captions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleCaptions}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                  isCaptioning ? "bg-[#8ab4f8]/20 text-[#8ab4f8] ring-1 ring-[#8ab4f8]/50" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white border border-transparent hover:border-gray-500"
                )}
              >
                <Captions className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">{isCaptioning ? 'Turn off captions' : 'Turn on captions'}</TooltipContent>
          </Tooltip>

          {/* Record */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                  isRecording ? "bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-500/50" : "bg-[#3c4043] hover:bg-[#4a4e51] text-white border border-transparent hover:border-gray-500"
                )}
              >
                <Radio className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">{isRecording ? 'Stop recording' : 'Start recording'}</TooltipContent>
          </Tooltip>

          {/* End Stream — red pill button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleEndStream}
                disabled={isEnding}
                className="h-12 w-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white shadow-lg transition-all duration-200 ml-2"
              >
                {isEnding ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-6 w-6" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">{isEnding ? 'Ending...' : 'End stream'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Panel toggles */}
        <div className="flex items-center justify-end min-w-0 sm:min-w-[200px] gap-2">
          {/* Desktop panel buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidePanel('participants')}
                className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'participants' && showSidePanel && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}
              >
                <Users className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">People</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidePanel('chat')}
                className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors relative", activeTab === 'chat' && showSidePanel && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}
              >
                <MessageCircle className="h-5 w-5" />
                {unreadChat > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{unreadChat > 9 ? '9+' : unreadChat}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">Chat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidePanel('requests')}
                className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors relative", activeTab === 'requests' && showSidePanel && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}
              >
                <MessageSquare className="h-5 w-5" />
                {permissionRequests.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{permissionRequests.length}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">Requests</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidePanel('analytics')}
                className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'analytics' && showSidePanel && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}
              >
                <BarChart2 className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">Analytics</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidePanel('notes')}
                className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'notes' && showSidePanel && "bg-[#8ab4f8]/20 text-[#8ab4f8]")}
              >
                <Edit className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 text-white border-0">Notes</TooltipContent>
          </Tooltip>

          {/* Mobile "More" overflow menu */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowMobileMore(!showMobileMore)}
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors relative",
                showMobileMore && "bg-[#3c4043]"
              )}
            >
              <MoreVertical className="h-5 w-5" />
              {(unreadChat > 0 || permissionRequests.length > 0) && !showMobileMore && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 rounded-full" />
              )}
            </button>

            <AnimatePresence>
              {showMobileMore && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-30" onClick={() => setShowMobileMore(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-14 right-0 z-40 bg-[#2d2e31] rounded-xl shadow-2xl border border-white/10 py-2 min-w-[180px]"
                  >
                    <button
                      onClick={() => { toggleSidePanel('chat'); setShowMobileMore(false); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#3c4043] transition-colors", activeTab === 'chat' && showSidePanel && "text-[#8ab4f8]")}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chat
                      {unreadChat > 0 && <span className="ml-auto h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{unreadChat > 9 ? '9+' : unreadChat}</span>}
                    </button>
                    <button
                      onClick={() => { toggleSidePanel('participants'); setShowMobileMore(false); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#3c4043] transition-colors", activeTab === 'participants' && showSidePanel && "text-[#8ab4f8]")}
                    >
                      <Users className="h-4 w-4" />
                      People
                    </button>
                    <button
                      onClick={() => { toggleSidePanel('requests'); setShowMobileMore(false); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#3c4043] transition-colors", activeTab === 'requests' && showSidePanel && "text-[#8ab4f8]")}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Requests
                      {permissionRequests.length > 0 && <span className="ml-auto h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{permissionRequests.length}</span>}
                    </button>
                    <button
                      onClick={() => { toggleSidePanel('analytics'); setShowMobileMore(false); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#3c4043] transition-colors", activeTab === 'analytics' && showSidePanel && "text-[#8ab4f8]")}
                    >
                      <BarChart2 className="h-4 w-4" />
                      Analytics
                    </button>
                    <button
                      onClick={() => { toggleSidePanel('notes'); setShowMobileMore(false); }}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#3c4043] transition-colors", activeTab === 'notes' && showSidePanel && "text-[#8ab4f8]")}
                    >
                      <Edit className="h-4 w-4" />
                      Notes
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePodcastHost;