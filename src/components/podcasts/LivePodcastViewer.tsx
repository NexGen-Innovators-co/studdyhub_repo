// Enhanced LivePodcastViewer.tsx - Improved with video support, better captions, reactions animation, and educative elements
import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Mic, MicOff, X, Headphones, MessageCircle, Heart, 
  ThumbsUp, Send, Clock, Volume2, VolumeX, Share2,
  HelpCircle
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { addPodcastListener, removePodcastListener, createParticipationRequest } from '@/services/podcastLiveService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion'; // For engaging animations
import { Progress } from '../ui/progress'; // For buffer/progress if needed

interface LivePodcastViewerProps {
  podcastId: string;
  onClose: () => void;
}

const LivePodcastViewer: React.FC<LivePodcastViewerProps> = ({ podcastId, onClose }) => {
    // Remove transcript panel, keep only captions overlay
    
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [question, setQuestion] = useState('');
  const [reactions, setReactions] = useState<Record<string, number>>({ clap: 0, like: 0, heart: 0 });
  const [captions, setCaptions] = useState<Array<{text: string; timestamp: number}>>([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [enableVideo, setEnableVideo] = useState(false);
  const [keyPoints, setKeyPoints] = useState<string[]>([]); // Educative: Fetch or subscribe to host's key points

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
// Cleanup media streams on unmount or live end
  useEffect(() => {
    return () => {
      if (audioRef.current && audioRef.current.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        audioRef.current.srcObject = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
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
// Transcript channel logic removed
  // Detect and subscribe to podcast_type for video/audio switching in real time
  useEffect(() => {
    let isMounted = true;
    // Initial fetch
    (async () => {
      const { data } = await supabase.from('ai_podcasts').select('podcast_type').eq('id', podcastId).single();
      if (!isMounted) return;
      setEnableVideo(!!data?.podcast_type && data.podcast_type.includes('video'));
    })();

    // Subscribe to changes in podcast_type
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
      const hasVideo = stream.getVideoTracks().length > 0;
      if (hasVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } else if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {});
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

  // Educative: Subscribe to key points (assume host updates visual_assets or a field)
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
      toast.success('Requested to speak');
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
      await supabase.from('social_posts').insert({
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
    // Animate reaction (engaging)
    // Assume a floating animation or confetti can be added with libraries like react-confetti
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('podcast_shares').insert({ podcast_id: podcastId, user_id: user?.id, share_type: 'reaction', platform: type });
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <Card className="w-full max-w-7xl h-[95vh] md:h-[90vh] p-0 border shadow-xl overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">
                <div className="h-2 w-2 rounded-full bg-white mr-2"></div>
                LIVE
              </Badge>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatTime(streamDuration)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Live Transcript Button and Side Panel removed */}
              <Button size={isMobile ? "icon" : "sm"} variant="ghost" onClick={() => { setIsMuted(!isMuted); toggleMute(); }}>
                {isMobile ? (isMuted ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />) : (
                  <>
                    {isMuted ? <VolumeX className="h-4 w-4 mr-2" /> : <Headphones className="h-4 w-4 mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </>
                )}
              </Button>
              <Button size={isMobile ? "icon" : "sm"} variant="outline" onClick={onClose}>
                {isMobile ? <X className="h-4 w-4" /> : 'Close'}
              </Button>
            </div>
          </div>

          {/* Main Content - Responsive */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Media Panel */}
            <div className="flex-1 flex flex-col p-4 gap-4">
              <div className="flex-1 relative bg-muted rounded-lg border overflow-hidden">
                {enableVideo ? (
                  <video ref={videoRef} className="w-full h-full object-contain" controls playsInline />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6">
                    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
                      <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-full p-10 border border-primary/20">
                        <Headphones className="h-16 w-16 text-primary" />
                      </div>
                    </motion.div>
                    <h3 className="text-xl font-semibold mb-2 text-center">Live Podcast</h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-sm">Listen to the live audio stream</p>
                    <audio ref={audioRef} controls className="w-full max-w-md" />
                  </div>
                )}
              </div>
              {/* Captions Overlay (like YouTube) */}
              {captions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 24,
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontSize: 18,
                    maxWidth: '90%',
                    margin: '0 auto',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'opacity 0.2s',
                  }}>
                    {captions[captions.length - 1].text}
                  </div>
                </div>
              )}
            </div>

            {/* Interaction Panel */}
            <div className={`${isMobile ? 'w-full border-t p-4' : 'w-full md:w-96 border-l p-4'} flex flex-col gap-6 overflow-y-auto`}>
              {/* Request to Speak */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mic className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Want to speak?</h3>
                    <p className="text-sm text-muted-foreground">Request permission from the host</p>
                  </div>
                </div>
                <Button className="w-full" onClick={handleRequestToSpeak} disabled={isRequesting}>
                  {isRequesting ? 'Requesting...' : <><Mic className="h-4 w-4 mr-2" />Request to Speak</>}
                </Button>
              </div>

              {/* Reactions - With animations */}
              <div>
                <h3 className="font-semibold mb-3">Send Reactions</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['clap', 'like', 'heart'].map(type => (
                    <motion.button
                      key={type}
                      whileTap={{ scale: 1.2 }}
                      onClick={() => sendReaction(type as any)}
                      className="border rounded-lg p-4 flex flex-col items-center gap-1 hover:bg-muted"
                    >
                      {type === 'clap' ? <span className="text-2xl">👏</span> : type === 'like' ? <ThumbsUp className="h-6 w-6" /> : <Heart className="h-6 w-6" />}
                      <span className="text-xs">{type.charAt(0).toUpperCase() + type.slice(1)} {reactions[type] > 0 && `(${reactions[type]})`}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Questions */}
              <div>
                <h3 className="font-semibold mb-3">Ask a Question</h3>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Type your question..."
                  className="w-full h-32 p-3 rounded-lg border bg-background resize-none mb-3"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuestion('')}>Clear</Button>
                  <Button size="sm" onClick={postQuestion} disabled={!question.trim()}>
                    <Send className="h-4 w-4 mr-2" />Send
                  </Button>
                </div>
              </div>

              {/* Educative: Key Points from Host */}
              {keyPoints.length > 0 && (
                <div className="bg-info/10 p-4 rounded-lg border border-info/20">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-info" />
                    Key Learning Points
                  </h4>
                  <ul className="space-y-2">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="text-sm">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LivePodcastViewer;