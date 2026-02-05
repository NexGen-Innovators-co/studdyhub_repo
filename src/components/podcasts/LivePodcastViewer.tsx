// Enhanced LivePodcastViewer.tsx - Modern UI with Dark/Light Mode Support
import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Mic, MicOff, X, Headphones, MessageCircle, Heart, 
  ThumbsUp, Send, Clock, Volume2, VolumeX, Share2,
  HelpCircle, Sparkles, Radio, Wifi, Video as VideoIcon, Loader2,
  MoreVertical, PhoneOff, Users, MessageSquare, Hand, Smile, Settings
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { addPodcastListener, removePodcastListener, createParticipationRequest } from '@/services/podcastLiveService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs

interface LivePodcastViewerProps {
  podcastId: string;
  onClose: () => void;
}

const LivePodcastViewer: React.FC<LivePodcastViewerProps> = ({ podcastId, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [reactions, setReactions] = useState<Record<string, number>>({ clap: 0, like: 0, heart: 0 });
  const [captions, setCaptions] = useState<Array<{text: string; timestamp: number}>>([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [enableVideo, setEnableVideo] = useState(false);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [showReactionEffect, setShowReactionEffect] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false); // New state for side panel
  const [activeTab, setActiveTab] = useState('chat'); // New state for side panel tab
  const captionsChannelRef = useRef<any>(null);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Stream timer
  useEffect(() => {
    const timer = setInterval(() => setStreamDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup media streams
  useEffect(() => {
    return () => {
      if (audioRef.current?.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        audioRef.current.srcObject = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Detect and subscribe to podcast_type for video/audio switching
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data } = await supabase.from('ai_podcasts').select('podcast_type').eq('id', podcastId).single();
      if (!isMounted) return;
      setEnableVideo(!!data?.podcast_type && data.podcast_type.includes('video'));
    })();

    const channel = supabase.channel(`podcast-row-${podcastId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_podcasts', filter: `id=eq.${podcastId}` }, (payload) => {
        const newType = payload.new?.podcast_type;
        setEnableVideo(!!newType && newType.includes('video'));
      })
      .subscribe();

    return () => {
      isMounted = false;
      void channel.unsubscribe();
    };
  }, [podcastId]);

  const {
    isConnected,
    connectionQuality,
    requestPermission,
    toggleMute,
    error,
    participants
  } = useWebRTC({
    podcastId,
    isHost: false,
    enableVideo: false, // Viewer should not send video by default, but receive it if offered
    onRemoteStream: (stream: MediaStream) => {
      // Store reference to stream for when UI becomes ready
      remoteStreamRef.current = stream;
      
      const hasVideo = stream.getVideoTracks().length > 0;
      
      // If we receive video tracks, ensure UI is in video mode
      if (hasVideo && !enableVideo) {
         setEnableVideo(true);
      }
      
      if (hasVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreamLoaded(true);
        videoRef.current.play().catch(e => {
            if (videoRef.current) {
               videoRef.current.muted = true;
               videoRef.current.play().catch(e2 => {});
            }
        });
      } else if (audioRef.current) {
        if (!hasVideo && audioRef.current.srcObject !== stream) {
           audioRef.current.srcObject = stream;
           setIsStreamLoaded(true);
           audioRef.current.play().catch(e => {});
        }
      }
    }
  });

  // Ensure video is attached when mode switches to video
  useEffect(() => {
    if (enableVideo && videoRef.current && remoteStreamRef.current) {
       videoRef.current.srcObject = remoteStreamRef.current;
       videoRef.current.play().catch(e => {
           if (videoRef.current) {
               videoRef.current.muted = true;
               videoRef.current.play().catch(e2 => {});
           }
       });
    }
  }, [enableVideo]);

  // Subscribe to captions
  useEffect(() => {
    const channel = supabase.channel(`podcast-captions-${podcastId}`);
    channel.on('broadcast', { event: 'caption' }, ({ payload }) => {
      if (payload?.text) setCaptions(prev => [...prev.slice(-20), { text: payload.text, timestamp: Date.now() }]);
    }).subscribe();
    return () => { void channel.unsubscribe(); };
  }, [podcastId]);

  // Listener registration
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await addPodcastListener(podcastId, user.id);
    })();
    return () => {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await removePodcastListener(podcastId, user.id);
      })();
    };
  }, [podcastId]);

  // Subscribe to host end
  useEffect(() => {
    const channel = supabase.channel(`podcast-row-${podcastId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_podcasts', filter: `id=eq.${podcastId}` }, (payload) => {
        if (payload.new?.is_live === false) onClose();
      })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [podcastId, onClose]);

  // Subscribe to key points
  useEffect(() => {
    const channel = supabase.channel(`podcast-keypoints-${podcastId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_podcasts', filter: `id=eq.${podcastId}` }, (payload) => {
        const notes = payload.new?.visual_assets?.notes || [];
        setKeyPoints(notes);
      })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [podcastId]);

  const handleRequestToSpeak = async () => {
    setIsRequesting(true);
    try {
      requestPermission('speak');
      // Request is handled by useWebRTC internally (broadcast + db insert)
      toast.success('Request sent to host');
    } catch (e) {
      toast.error('Request failed');
    } finally {
      setIsRequesting(false);
    }
  };

  const postQuestion = async () => {
    if (!question.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('posts').insert({
        author_id: user?.id,
        content: question,
        privacy: 'public',
        metadata: { type: 'podcast-question', podcastId }
      });
      setQuestion('');
      toast.success('Question posted');
    } catch (e) {
      toast.error('Failed to post question');
    }
  };

  const sendReaction = async (type: 'clap' | 'like' | 'heart') => {
    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
    setShowReactionEffect(true);
    setTimeout(() => setShowReactionEffect(false), 1000);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('podcast_shares').insert({ 
        podcast_id: podcastId, 
        user_id: user?.id, 
        share_type: 'reaction', 
        platform: type 
      });
    } catch (e) {}
  };
  
  const toggleSidePanel = (tab: string) => {
    if (showSidePanel && activeTab === tab) {
      setShowSidePanel(false);
    } else {
      setActiveTab(tab);
      setShowSidePanel(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#202124] text-white flex flex-col overflow-hidden font-sans">
      
      {/* 1. Top Bar */}
      <div className="flex-none h-14 px-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-3">
           <Badge variant="destructive" className="animate-pulse bg-red-600 hover:bg-red-700 text-white border-none gap-1.5 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white block" />
              LIVE
           </Badge>
           <div className="h-4 w-px bg-white/20" />
           <span className="text-white/90 text-sm font-medium tracking-wide">{formatTime(streamDuration)}</span>
        </div>
        
        <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded bg-[#3c4043]/80 backdrop-blur-sm text-xs",
              connectionQuality === 'excellent' ? "text-green-400" : connectionQuality === 'good' ? "text-yellow-400" : "text-red-400"
            )}>
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline capitalize">{connectionQuality}</span>
            </div>
            <Avatar className="h-8 w-8 border border-white/10 hidden sm:block">
               <AvatarFallback className="bg-purple-600 text-xs">AI</AvatarFallback>
            </Avatar>
        </div>
      </div>

      {/* 2. Main Staging Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex items-center justify-center relative p-4 bg-[#202124]">
           <div className="relative w-full h-full max-w-6xl max-h-[calc(100vh-8rem)] rounded-xl overflow-hidden bg-[#3c4043] shadow-2xl flex items-center justify-center border border-white/5">
              {enableVideo ? (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-contain bg-black" 
                    autoPlay
                    muted={false}
                    controls
                    playsInline
                  />
                   {!isStreamLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#202124] text-center p-6">
                      <div className="bg-blue-500/10 p-4 rounded-full mb-4">
                         <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                      </div>
                      <h3 className="text-xl font-medium text-white mb-2">Connecting...</h3>
                      <p className="text-gray-400 text-sm">Getting the best quality stream for you</p>
                    </div>
                  )}
                </>
              ) : (
                 <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="relative mb-8">
                       <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                       <Avatar className="h-32 w-32 border-4 border-[#3c4043] shadow-xl z-10">
                          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-4xl font-bold">P</AvatarFallback>
                       </Avatar>
                       {/* Audio Wave Animation */}
                       <div className="absolute inset-0 flex items-center justify-center">
                          {[1, 2, 3].map((i) => (
                             <motion.div
                               key={i}
                               className="absolute border border-blue-500/30 rounded-full" // Use Tailwind class for shape
                               initial={{ width: '100%', height: '100%', opacity: 0.8 }}
                               animate={{ width: `${100 + i * 20}%`, height: `${100 + i * 20}%`, opacity: 0 }}
                               transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                             />
                          ))}
                        </div>
                    </div>
                    <h2 className="text-2xl font-google-sans text-white mb-2">Audio Stream Active</h2>
                    <p className="text-gray-400 max-w-md">Listen to the conversation live. Use the controls below to interact.</p>
                    <audio ref={audioRef} className="hidden" />
                 </div>
              )}

              {/* Captions Overlay - Google Meet Style */}
              <AnimatePresence>
                {captions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none"
                  >
                    <div className="bg-black/60 backdrop-blur-sm text-white px-6 py-3 rounded-lg max-w-3xl text-center text-lg md:text-xl font-medium shadow-lg">
                      {captions[captions.length - 1].text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>

        {/* 3. Side Panel (Drawer) */}
        <AnimatePresence>
          {showSidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100%' : 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white dark:bg-[#202124] border-l border-white/10 flex flex-col h-full absolute right-0 top-0 z-20 md:relative shadow-2xl"
            >
               <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#202124]">
                  <h3 className="text-lg font-medium text-white">
                    {activeTab === 'chat' ? 'In-call messages' : activeTab === 'people' ? 'People' : 'Activities'}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowSidePanel(false)} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8">
                     <X className="h-5 w-5" />
                  </Button>
               </div>

               <div className="flex-1 overflow-y-auto bg-[#202124] p-4 space-y-4">
                  {/* Chat Section */}
                  {activeTab === 'chat' && (
                     <>
                        <div className="bg-[#3c4043]/50 rounded-lg p-3 text-sm text-gray-300 text-center mb-4">
                           Messages can only be seen by people in the call and are deleted when the call ends.
                        </div>
                        
                        {/* Question Input */}
                         <div className="space-y-3">
                           {/* Only showing input for "questions" as chat is simplified here */}
                            <label className="text-sm font-medium text-gray-300 ml-1">Ask a question</label>
                            <div className="relative">
                              <textarea
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                placeholder="Send a message to everyone"
                                className="w-full h-24 bg-[#3c4043] border border-transparent focus:border-blue-400 rounded-lg p-3 text-white placeholder:text-gray-500 resize-none text-sm outline-none transition-colors"
                              />
                               <Button 
                                  size="icon" 
                                  className="absolute bottom-2 right-2 h-8 w-8 bg-blue-600 hover:bg-blue-500 rounded-full"
                                  disabled={!question.trim()}
                                  onClick={postQuestion}
                                >
                                  <Send className="h-4 w-4 text-white" />
                               </Button>
                            </div>
                         </div>
                     </>
                  )}

                  {/* People Section (Reactions/Requests) */}
                  {activeTab === 'people' && (
                     <div className="space-y-6">
                        {/* Request Card */}
                        <div className="bg-[#3c4043] rounded-xl p-4 space-y-3">
                           <div className="flex items-center gap-3 mb-2">
                             <div className="bg-blue-600/20 p-2 rounded-full">
                                <Mic className="h-5 w-5 text-blue-400" />
                             </div>
                             <div>
                               <h4 className="text-white font-medium text-sm">Join the stage</h4>
                               <p className="text-gray-400 text-xs">Request to speak via audio</p>
                             </div>
                           </div>
                           <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full h-9" 
                            onClick={handleRequestToSpeak}
                            disabled={isRequesting}
                          >
                             {isRequesting ? 'Requesting...' : 'Request to speak'}
                          </Button>
                        </div>
                     </div>
                  )}

                  {/* Activities Section (Reactions/Keys) */}
                  {activeTab === 'activities' && (
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <h4 className="text-gray-300 text-sm font-medium px-1">Reactions</h4>
                          <div className="grid grid-cols-3 gap-3">
                             {(['clap', 'like', 'heart'] as const).map(type => (
                                <button
                                  key={type}
                                  onClick={() => sendReaction(type)}
                                  className="flex flex-col items-center justify-center p-3 bg-[#3c4043] hover:bg-[#4a4e51] rounded-xl transition-colors gap-2 group border border-transparent hover:border-gray-500"
                                >
                                    <div className="text-2xl group-hover:scale-110 transition-transform">
                                      {type === 'clap' ? '👏' : type === 'like' ? '👍' : '❤️'}
                                    </div>
                                    <span className="text-xs text-gray-400 capitalize">{type}</span>
                                </button>
                             ))}
                          </div>
                       </div>
                       
                       {keyPoints.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-white/10">
                              <h4 className="text-gray-300 text-sm font-medium px-1 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-yellow-400" />
                                Key Highlights
                              </h4>
                              <div className="space-y-2">
                                {keyPoints.map((point, i) => (
                                  <div key={i} className="bg-[#3c4043]/50 p-3 rounded-lg border border-white/5 text-sm text-gray-300 leading-relaxed">
                                    • {point}
                                  </div>
                                ))}
                              </div>
                          </div>
                       )}
                    </div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Bottom Control Bar */}
      <div className="flex-none h-20 bg-[#202124] flex items-center justify-between px-4 sm:px-8 space-x-4 z-20 border-t border-white/5">
         
         {/* Left Info (Desktop) */}
         <div className="hidden md:flex items-center min-w-[200px] text-white select-none">
            <div className="flex flex-col">
               <span className="font-medium text-base truncate max-w-[200px]">Live Podcast Session</span>
               <span className="text-xs text-gray-400">Join via studdyhub.com</span>
            </div>
         </div>

         {/* Center Controls */}
         <div className="flex items-center justify-center gap-2 sm:gap-4 flex-1">
            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    onClick={() => { setIsMuted(!isMuted); toggleMute(); }}
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                      isMuted ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#3c4043] hover:bg-[#434649] text-white border border-transparent hover:border-gray-500"
                    )}
                  >
                     {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">{isMuted ? 'Turn on microphone' : 'Turn off microphone'}</TooltipContent>
            </Tooltip>

            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    disabled={!enableVideo} // Usually Viewers cannot turn on camera unless they are speakers, keeping disabled for now
                    className="h-12 w-12 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#434649] text-white/50 cursor-not-allowed border border-transparent"
                  >
                     <VideoIcon className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Camera unavailable for listeners</TooltipContent>
            </Tooltip>

            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    onClick={() => toggleSidePanel('people')}
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                      isRequesting ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-[#3c4043] hover:bg-[#434649] text-white border border-transparent hover:border-gray-500"
                    )}
                  >
                     <Hand className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Raise hand</TooltipContent>
            </Tooltip>
            
            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    onClick={() => toggleSidePanel('activities')}
                    className="h-12 w-12 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#434649] text-white border border-transparent hover:border-gray-500 transition-all duration-200"
                  >
                     <Smile className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Send reaction</TooltipContent>
            </Tooltip>

            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                    onClick={onClose}
                    className="h-12 w-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all duration-200 ml-2"
                  >
                     <PhoneOff className="h-6 w-6 fill-current" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Leave call</TooltipContent>
            </Tooltip>
         </div>

         {/* Right Controls */}
         <div className="flex items-center justify-end min-w-[200px] gap-3">
             <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                     onClick={() => toggleSidePanel('activities')} 
                     className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'activities' && showSidePanel && "bg-[#8ab4f8]/30 text-[#8ab4f8]")}
                  >
                     <Sparkles className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Activities</TooltipContent>
            </Tooltip>

            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                     onClick={() => toggleSidePanel('people')} 
                     className={cn("hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'people' && showSidePanel && "bg-[#8ab4f8]/30 text-[#8ab4f8]")}
                  >
                     <Users className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Show everyone</TooltipContent>
            </Tooltip>
            
            <Tooltip>
               <TooltipTrigger asChild>
                  <button 
                     onClick={() => toggleSidePanel('chat')} 
                     className={cn("h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#3c4043] text-white transition-colors", activeTab === 'chat' && showSidePanel && "bg-[#8ab4f8]/30 text-[#8ab4f8]")}
                  >
                     <MessageSquare className="h-5 w-5" />
                  </button>
               </TooltipTrigger>
               <TooltipContent className="bg-gray-800 text-white border-0">Chat with everyone</TooltipContent>
            </Tooltip>
         </div>
      </div>

      {/* Floating Reaction Animations */}
      <AnimatePresence>
        {showReactionEffect && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0], y: -100 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="fixed bottom-24 left-10 md:left-1/3 z-50 pointer-events-none"
          >
            <div className="text-6xl filter drop-shadow-lg">
               {Object.entries(reactions).sort(([,a], [,b]) => b - a)[0]?.[0] === 'like' ? '👍' : 
                Object.entries(reactions).sort(([,a], [,b]) => b - a)[0]?.[0] === 'clap' ? '👏' : '❤️'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LivePodcastViewer;