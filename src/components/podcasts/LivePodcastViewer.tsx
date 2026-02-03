// Enhanced LivePodcastViewer.tsx - Modern UI with Dark/Light Mode Support
import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Mic, MicOff, X, Headphones, MessageCircle, Heart, 
  ThumbsUp, Send, Clock, Volume2, VolumeX, Share2,
  HelpCircle, Sparkles, Radio, Wifi, Video as VideoIcon, Loader2
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { addPodcastListener, removePodcastListener, createParticipationRequest } from '@/services/podcastLiveService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LivePodcastViewerProps {
  podcastId: string;
  onClose: () => void;
}

const LivePodcastViewer: React.FC<LivePodcastViewerProps> = ({ podcastId, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
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
    enableVideo,
    onRemoteStream: (stream: MediaStream) => {
      // console.log('Received remote stream:', stream.id, 'video tracks:', stream.getVideoTracks().length, 'audio tracks:', stream.getAudioTracks().length);
      
      const hasVideo = stream.getVideoTracks().length > 0;
      
      if (hasVideo && videoRef.current) {
        // console.log('Setting video stream');
        videoRef.current.srcObject = stream;
        setIsStreamLoaded(true);
        
        // Force video to play
        const attemptPlay = () => {
          if (!videoRef.current) return;
          
          videoRef.current.play()
            .then(() => {
              // console.log('Video autoplay succeeded');
            })
            .catch(e => {
              // console.warn('Video autoplay failed, user interaction may be required:', e);
              // Try with muted first
              if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(err => console.error('Muted play also failed:', err));
              }
            });
        };

        // Try immediate play
        if (videoRef.current.readyState >= 2) {
          attemptPlay();
        } else {
          // Wait for loadeddata event
          videoRef.current.addEventListener('loadeddata', attemptPlay, { once: true });
        }
      } else if (audioRef.current) {
        // console.log('Setting audio stream');
        audioRef.current.srcObject = stream;
        setIsStreamLoaded(true);
        audioRef.current.play().catch(e => console.warn('Audio play failed:', e));
      }
    }
  });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await createParticipationRequest(podcastId, user.id, 'speak');
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

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-background to-muted/20 backdrop-blur-sm">
      <Card className="h-full w-full border-0 rounded-none shadow-none bg-transparent overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Enhanced Header */}
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative border-b bg-card/95 backdrop-blur-xl shadow-lg z-10"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5" />
            <div className="relative px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Badge variant="destructive" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold shadow-lg shadow-red-500/20">
                    <motion.div 
                      className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-white"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    LIVE
                  </Badge>
                </motion.div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted/50">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <span className="font-mono font-semibold text-xs sm:text-sm">{formatTime(streamDuration)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Stream Duration</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted/50",
                      connectionQuality === 'excellent' ? "text-green-500" : connectionQuality === 'good' ? "text-yellow-500" : connectionQuality === 'poor' ? "text-orange-500" : "text-red-500"
                    )}>
                      <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="font-semibold text-xs sm:text-sm capitalize hidden sm:inline">{connectionQuality}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Connection Quality</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 ml-auto sm:ml-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size={isMobile ? "sm" : "default"}
                      variant={isMuted ? "destructive" : "outline"}
                      onClick={() => { setIsMuted(!isMuted); toggleMute(); }}
                      className="shadow-md h-8 sm:h-9 md:h-10"
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                      <span className="ml-1.5 sm:ml-2 hidden md:inline text-sm">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</TooltipContent>
                </Tooltip>

                <Button 
                  size={isMobile ? "sm" : "default"}
                  variant="outline" 
                  onClick={onClose}
                  className="shadow-md h-8 sm:h-9 md:h-10"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="ml-1.5 sm:ml-2 hidden md:inline text-sm">Close</span>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Media Panel */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-1 relative bg-gradient-to-br from-muted/30 to-background p-4 md:p-6"
            >
              <div className="h-full rounded-2xl overflow-hidden shadow-2xl border bg-black/90 relative">
                {enableVideo ? (
                  <>
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-contain" 
                      autoPlay
                      muted={false}
                      controls
                      playsInline
                      style={{ display: 'block', backgroundColor: '#000' }}
                      // onLoadStart={() => console.log('Video load started')}
                      // // onLoadedMetadata={() => console.log('Video metadata loaded')}
                      // onLoadedData={() => console.log('Video data loaded')}
                      // onCanPlay={() => console.log('Video can play')}
                      // onPlaying={() => console.log('Video is playing')}
                      // onWaiting={() => console.log('Video is waiting')}
                      // onError={(e) => console.error('Video error:', e)}
                    />
                    {!isStreamLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="text-center">
                          <Loader2 className="h-12 w-12 animate-spin text-white mb-4 mx-auto" />
                          <p className="text-white/80">Connecting to live stream...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-white">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="relative mb-8"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl rounded-full" />
                      <div className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-12 rounded-full border border-white/10">
                        <Headphones className="h-24 w-24 text-purple-500" />
                      </div>
                    </motion.div>
                    <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                      Audio Stream
                    </h3>
                    <p className="text-white/60 text-center max-w-md mb-6">
                      Tune in and enjoy the live conversation
                    </p>
                    <audio ref={audioRef} controls className="w-full max-w-md" />
                  </div>
                )}

                {/* Captions Overlay */}
                <AnimatePresence>
                  {captions.length > 0 && (
                    <motion.div
                      key={captions[captions.length - 1].timestamp}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 max-w-4xl w-11/12"
                    >
                      <div className="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl text-center shadow-2xl border border-white/10">
                        <p className="text-lg leading-relaxed">
                          {captions[captions.length - 1].text}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Interaction Panel */}
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full md:w-96 border-t md:border-t-0 md:border-l bg-card/50 backdrop-blur-sm p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 sm:space-y-6"
            >
              {/* Request to Speak */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
              >
                <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-primary/10">
                    <Mic className="h-5 w-5 sm:h-5.5 sm:w-5.5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base sm:text-lg mb-1">Want to speak?</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Request permission from the host to join the conversation
                    </p>
                  </div>
                </div>
                <Button 
                  className="w-full gap-1.5 sm:gap-2 shadow-lg shadow-primary/20 h-10 sm:h-11 md:h-12 text-sm sm:text-base" 
                  onClick={handleRequestToSpeak} 
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                      </motion.div>
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                      Request to Speak
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Reactions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500" />
                  Send Reactions
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(['clap', 'like', 'heart'] as const).map((type, idx) => (
                    <motion.button
                      key={type}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 1.2 }}
                      onClick={() => sendReaction(type)}
                      className="relative border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-accent transition-all group"
                    >
                      <div className="relative">
                        {type === 'clap' ? (
                          <span className="text-2xl sm:text-3xl md:text-4xl group-hover:scale-110 transition-transform">👏</span>
                        ) : type === 'like' ? (
                          <ThumbsUp className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-blue-500 group-hover:scale-110 transition-transform" />
                        ) : (
                          <Heart className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-pink-500 group-hover:scale-110 transition-transform group-hover:fill-pink-500" />
                        )}
                      </div>
                      <span className="text-xs font-medium capitalize">{type}</span>
                      {reactions[type] > 0 && (
                        <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs">
                          {reactions[type]}
                        </Badge>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Questions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border bg-card"
              >
                <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Ask a Question
                </h3>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full h-24 sm:h-28 md:h-32 p-3 sm:p-4 rounded-lg sm:rounded-xl border bg-background resize-none mb-2 sm:mb-3 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm sm:text-base"
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setQuestion('')}
                    disabled={!question.trim()}
                  >
                    Clear
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={postQuestion} 
                    disabled={!question.trim()}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </motion.div>

              {/* Key Learning Points */}
              <AnimatePresence>
                {keyPoints.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20"
                  >
                    <h4 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                      <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                      Key Learning Points
                    </h4>
                    <ul className="space-y-2 sm:space-y-3">
                      {keyPoints.map((point, i) => (
                        <motion.li 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm"
                        >
                          <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-500">{i + 1}</span>
                          </div>
                          <p className="flex-1">{point}</p>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </Card>

      {/* Reaction Effect */}
      <AnimatePresence>
        {showReactionEffect && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="text-8xl">❤️</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LivePodcastViewer;