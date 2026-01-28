// LivePodcastHost.tsx - Full integration with live preview fix
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { 
  Trash2, Mic, MicOff, X, UserPlus, Video, VideoOff, MessageSquare, 
  Save, Users, Clock, Volume2, VolumeX, Settings, Edit, Shield,
  MessageCircle, Radio, Zap, TrendingUp, Headphones, Send,
  BarChart2, HelpCircle
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useChunkedRecording } from '@/hooks/useChunkedRecording';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { saveTranscriptionResult, uploadTempChunk, invokeRealtimeTranscription } from '@/services/podcastLiveService';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { AnimatePresence, motion } from 'framer-motion';

interface LivePodcastHostProps {
  podcastId: string;
  onEndStream: () => void;
}

const LivePodcastHost: React.FC<LivePodcastHostProps> = ({ podcastId, onEndStream }) => {
  const [enableVideo, setEnableVideo] = useState(false);
  // Track the current recording stream type
  const [recordingStreamType, setRecordingStreamType] = useState<'audio' | 'video'>('audio');
  // Ref to keep the current stream for recording
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [streamTime, setStreamTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'participants' | 'requests' | 'analytics' | 'notes'>('participants');
  const [notesDraft, setNotesDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartRef = useRef<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCaptioning, setIsCaptioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Live Transcript State
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const transcriptChannelRef = useRef<any>(null);
    
  const [liveViewers, setLiveViewers] = useState(0);
  const [engagementScore, setEngagementScore] = useState(0);
  // Captions overlay state
  const [captions, setCaptions] = useState<Array<{ text: string; timestamp: number }>>([]);
  const captionsChannelRef = useRef<any>(null);
    // Subscribe to captions channel for overlay
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
  const [keyPoints, setKeyPoints] = useState<string[]>([]);

  const captionRecorderRef = useRef<MediaRecorder | null>(null);
  const captionChannelRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastCaptionSendRef = useRef<number>(0);

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

  // Fetch real live metrics (for engagement UI)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchMetrics = async () => {
      // Fetch real listeners count
      const { data, error } = await supabase
        .from('podcast_listeners')
        .select('user_id', { count: 'exact', head: true })
        .eq('podcast_id', podcastId)
        .eq('is_active', true);
      if (!error) setLiveViewers(data?.length || 0);
      // Optionally, fetch engagementScore from a real metric or leave as 0
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

  // Video upgrade
  useEffect(() => {
    if (!enableVideo) return;
    (async () => {
      try {
        if (localStream?.getVideoTracks().length) return;
        if (addLocalVideo) await addLocalVideo();
        else await startBroadcasting();
      } catch (e) {
        //console.warn('[LivePodcastHost] Failed to upgrade stream with video:', e);
      }
    })();
  }, [enableVideo, localStream, addLocalVideo, startBroadcasting]);

  // ────────────────────────────────────────────────────────────────
  // Attach localStream to preview video ref (FIX for preview not showing)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      //console.log('[LivePodcastHost] Attaching localStream to preview video');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => {
        //console.warn('[LivePodcastHost] Preview autoplay failed:', e);
        // Handle autoplay policy issues (e.g., user gesture required)
      });
    }
  }, [localStream]);
// Subscribe to transcript channel
    useEffect(() => {
      if (!showTranscript) return;
      if (!podcastId) return;
      if (transcriptChannelRef.current) return;
      const channel = supabase.channel(`podcast-transcript-${podcastId}`);
      transcriptChannelRef.current = channel;
      channel.on('broadcast', { event: 'transcript' }, ({ payload }) => {
        if (payload?.text) setTranscript(prev => [...prev, payload.text]);
      }).subscribe();
      return () => {
        channel.unsubscribe();
        transcriptChannelRef.current = null;
      };
    }, [showTranscript, podcastId]);
  // ────────────────────────────────────────────────────────────────
  // END STREAM - Full original logic preserved + background transcription
  // ────────────────────────────────────────────────────────────────
  const handleEndStream = async () => {
    //console.log(`[LivePodcastHost] Starting stream end process for podcast ${podcastId}`, { timestamp: new Date().toISOString() });
    setIsEnding(true);
    try {
      //console.log(`[LivePodcastHost] Stopping captioning before ending stream`);
      try { await stopCaptioning(); } catch (e) { /* best-effort */ }

      const recorded = await stopBroadcasting();
      //console.log(`[LivePodcastHost] Broadcasting stopped, recorded blob:`, { size: recorded?.size, type: recorded?.type });

      // Mark podcast as not live
      //console.log(`[LivePodcastHost] Updating podcast live status to false`);
      const { error: updateErr } = await supabase
        .from('ai_podcasts')
        .update({ is_live: false })
        .eq('id', podcastId);
      if (updateErr) //console.warn('Failed to update podcast live state', updateErr);

      // Upload recorded blob & trigger transcription
      if (recorded) {
        //console.log(`[LivePodcastHost] Processing recorded blob for upload and transcription`);
        try {
          const filename = `live-podcasts/${podcastId}_${Date.now()}.webm`;
          const hasVideoRecorded = recorded.type?.includes('video');
          const contentType = hasVideoRecorded ? 'video/webm' : 'audio/webm';
          //console.log(`[LivePodcastHost] Uploading recording to storage:`, { filename, contentType, size: recorded.size });

          const { error: uploadErr } = await supabase.storage
            .from('podcasts')
            .upload(filename, recorded as any, { contentType });

          if (uploadErr) {
            //console.warn('Failed to upload recording', uploadErr);
            toast.error('Failed to upload recording');
          } else {
            const { data } = supabase.storage.from('podcasts').getPublicUrl(filename);
            const publicUrl = data.publicUrl;

            if (publicUrl) {
              // Determine podcast type and a rough duration estimate
              const hasVideo = hasVideoRecorded;
              // Prefer streamTime when available, otherwise estimate from blob size
              let estimatedSeconds = streamTime || 0;
              if (!estimatedSeconds || estimatedSeconds < 1) {
                // crude bytes-per-second heuristic: video ~200KB/s, audio ~16KB/s
                const bps = hasVideo ? 200000 : 16000;
                estimatedSeconds = Math.max(1, Math.round((recorded.size || 0) / bps));
              }
              const estimatedMinutes = Math.max(1, Math.round(estimatedSeconds / 60));

              try {
                const { error: metaErr } = await supabase
                  .from('ai_podcasts')
                  .update({
                    podcast_type: hasVideo ? 'video' : 'audio',
                    duration_minutes: estimatedMinutes,
                    audio_url: publicUrl
                  })
                  .eq('id', podcastId);
                // if (metaErr) //console.warn('Failed to update podcast metadata', metaErr);
              } catch (updErr) {
                //console.warn('Podcast metadata update failed', updErr);
              }

              toast.success('Recording uploaded');
              //console.log(`[LivePodcastHost] Recording uploaded successfully, starting background transcription:`, { publicUrl });

              // Fire transcription in background (IIFE)
              (async () => {
                try {
                  const { data: podcastMeta } = await supabase
                    .from('ai_podcasts')
                    .select('title,duration_minutes')
                    .eq('id', podcastId)
                    .single();

                  const title = podcastMeta?.title || 'Live Podcast';
                  const durationSeconds = Math.max(0, Math.floor((podcastMeta?.duration_minutes || estimatedMinutes) * 60));

                  //console.log(`[LivePodcastHost] Starting background transcription:`, { title, durationSeconds, publicUrl });
                  const transcription = await transcribeLivePodcast(recorded as Blob, title, durationSeconds, publicUrl);

                  if (transcription?.transcript) {
                    const { data: userData } = await supabase.auth.getUser();
                    const userId = userData.user?.id || null;
                    // console.log(`[LivePodcastHost] Transcription completed, saving results:`, { 
                    //   transcriptLength: transcription.transcript.length, 
                    //   userId 
                    // });
                    await saveTranscriptionResult(
                      podcastId, 
                      publicUrl, 
                      transcription.transcript, 
                      transcription.summary, 
                      userId, 
                      transcription.script || null
                    );
                  }
                } catch (transErr) {
                  // console.warn('Background transcription failed', transErr);
                }
              })();
            }
          }
        } catch (uploadErr) {
          // console.warn('Recording upload/transcription processing failed', uploadErr);
        }
      }

      // Cleanup media tracks
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        localVideoRef.current.srcObject = null;
      }

      toast.success('Stream ended');
      onEndStream();
    } catch (e) {
      // console.error('Error ending stream', e);
      toast.error('Failed to end stream');
    } finally {
      setIsEnding(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Captioning Logic (your original detailed version)
  // ────────────────────────────────────────────────────────────────
  const startCaptioning = async () => {
    // console.log(`[LivePodcastHost] Starting captioning for podcast ${podcastId}`);
    if (!localStream) {
      // console.warn(`[LivePodcastHost] Cannot start captioning: no local stream`);
      return;
    }

    try {
      // Create caption broadcast channel
      if (!captionChannelRef.current) {
        const channel = supabase.channel(`podcast-captions-${podcastId}`, { config: { broadcast: { ack: true, self: true } } });
        captionChannelRef.current = channel;
        channel.subscribe();
      }

      const channel = captionChannelRef.current;

      // Use audio-only stream for captions
      const audioTracks = localStream.getAudioTracks?.() || [];
      if (!audioTracks.length) {
        toast.error('No audio track available for captions');
        return;
      }

      const audioOnlyStream = new MediaStream(audioTracks.map(t => t.clone()));

      const options = { mimeType: 'audio/webm;codecs=opus' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(audioOnlyStream, options);
      } catch (err) {
        //console.warn('[LivePodcastHost] MediaRecorder options failed, using fallback');
        recorder = new MediaRecorder(audioOnlyStream);
      }

      captionRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        try {
          const chunk = e.data;
          if (!chunk?.size) return;

          const now = Date.now();
          if (now - (lastCaptionSendRef.current || 0) < 800) return;

          // Silence detection
          let isSilent = false;
          try {
            if (audioCtxRef.current) {
              const arrayBuffer = await chunk.arrayBuffer();
              const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
              let sum = 0;
              for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
                const data = audioBuffer.getChannelData(c);
                for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
              }
              const rms = Math.sqrt(sum / (audioBuffer.numberOfChannels * audioBuffer.length));
              if (rms < 0.008) isSilent = true;
            }
          } catch (decodeErr) {
            // console.warn('[LivePodcastHost] Silence detection failed:', decodeErr);
          }

          if (isSilent) return;

          // Convert chunk to clean base64
          const chunkBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const commaIdx = dataUrl.indexOf(',');
              resolve(commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl);
            };
            reader.readAsDataURL(chunk);
          });

          if (chunkBase64.length < 200) return;

          const mime = (chunk.type || 'audio/webm').split(';')[0].trim();

          // Try realtime transcription
          try {
            const resp = await invokeRealtimeTranscription(undefined, chunkBase64, mime);
            lastCaptionSendRef.current = now;
            const text = resp?.partial || resp?.transcript || '';
            if (text && channel) {
              channel.send({
                type: 'broadcast',
                event: 'caption',
                payload: { text, timestamp: now }
              });
            }
          } catch (inlineErr) {
            // //console.warn('[LivePodcastHost] Inline realtime failed, trying fallback');
            try {
              const fileUrl = await uploadTempChunk(chunk);
              if (fileUrl) {
                const resp = await invokeRealtimeTranscription(fileUrl);
                lastCaptionSendRef.current = now;
                const text = resp?.partial || resp?.transcript || '';
                if (text && channel) {
                  channel.send({
                    type: 'broadcast',
                    event: 'caption',
                    payload: { text, timestamp: now }
                  });
                }
              }
            } catch (fallbackErr) {
              //console.warn('[LivePodcastHost] Fallback realtime failed:', fallbackErr);
            }
          }
        } catch (err) {
          //console.warn('[LivePodcastHost] Caption chunk error:', err);
        }
      };

      recorder.start(2000);
      setIsCaptioning(true);
      toast.success('Live captions enabled');
    } catch (e) {
      //console.error('Start captioning failed', e);
      toast.error('Failed to enable captions');
    }
  };

  const stopCaptioning = useCallback(async () => {
    //console.log(`[LivePodcastHost] Stopping captioning for podcast ${podcastId}`);
    try {
      if (captionRecorderRef.current?.state !== 'inactive') {
        captionRecorderRef.current?.stop();
      }
      captionRecorderRef.current = null;

      if (captionChannelRef.current) {
        captionChannelRef.current.unsubscribe();
        captionChannelRef.current = null;
      }

      setIsCaptioning(false);
      toast.success('Live captions disabled');
    } catch (e) {
      //console.warn('Stop captioning failed', e);
    }
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      //console.log(`[LivePodcastHost] Component unmounting, cleaning up`);
      stopCaptioning();
      stopBroadcasting();
      if (localVideoRef.current?.srcObject) {
        (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        localVideoRef.current.srcObject = null;
      }
    };
  }, [stopCaptioning, stopBroadcasting]);

  // ────────────────────────────────────────────────────────────────
  // Additional original logics: Recording toggle, boot/promote, etc.
  // ────────────────────────────────────────────────────────────────
  const handleToggleRecording = async () => {
    try {
      if (!isRecording) {
        // Determine stream type
        let streamType: 'audio' | 'video' = enableVideo ? 'video' : 'audio';
        setRecordingStreamType(streamType);
        let stream: MediaStream | null = null;
        if (localStream) {
          // If video is enabled and available, use both tracks
          if (streamType === 'video' && localStream.getVideoTracks().length > 0) {
            stream = new MediaStream([
              ...localStream.getAudioTracks().map(t => t.clone()),
              ...localStream.getVideoTracks().map(t => t.clone()),
            ]);
          } else {
            // Audio only
            stream = new MediaStream(localStream.getAudioTracks().map(t => t.clone()));
          }
        }
        recordingStreamRef.current = stream;
        await startBroadcasting();
        setIsRecording(true);
        recordingStartRef.current = Date.now();
        setRecordingDuration(0);
        toast.success('Recording started');
        // start chunked
        try {
          await chunked.start(podcastId, { stream });
        } catch (e) {
          //console.warn('[LivePodcastHost] Chunked start failed', e);
        }
        toast.success('Recording started');
      } else {
        //console.log(`[LivePodcastHost] Stopping recording for podcast ${podcastId}`);
        try {
          await chunked.stop();
        } catch (e) {
          //console.warn('[LivePodcastHost] Chunked stop failed', e);
        }
        await stopBroadcasting();
        setIsRecording(false);
        recordingStartRef.current = null;
        setRecordingDuration(0);
        toast.success('Recording stopped');
      }
    } catch (e) {
      toast.error('Recording error');
    }
  };

  // If the host toggles video on/off during recording, restart recording with new stream
  useEffect(() => {
    if (!isRecording) return;
    // Determine the new stream type
    let newType: 'audio' | 'video' = enableVideo ? 'video' : 'audio';
    if (newType !== recordingStreamType) {
      // Stop current recording and start a new one with the new stream
      (async () => {
        try {
          await chunked.stop();
        } catch {}
        let stream: MediaStream | null = null;
        if (localStream) {
          if (newType === 'video' && localStream.getVideoTracks().length > 0) {
            stream = new MediaStream([
              ...localStream.getAudioTracks().map(t => t.clone()),
              ...localStream.getVideoTracks().map(t => t.clone()),
            ]);
          } else {
            stream = new MediaStream(localStream.getAudioTracks().map(t => t.clone()));
          }
        }
        recordingStreamRef.current = stream;
        setRecordingStreamType(newType);
        try {
          await chunked.start(podcastId, { stream });
        } catch {}
        toast.info(`Recording restarted with ${newType === 'video' ? 'video' : 'audio'} stream`);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableVideo]);

  // Update live recording duration badge while recording
  useEffect(() => {
    let t: number | null = null;
    if (isRecording) {
      t = window.setInterval(() => {
        const start = recordingStartRef.current || 0;
        const seconds = start ? Math.floor((Date.now() - start) / 1000) : streamTime;
        setRecordingDuration(seconds);
      }, 1000) as unknown as number;
    }
    return () => {
      if (t) window.clearInterval(t as unknown as number);
    };
  }, [isRecording, streamTime]);

  const bootParticipant = async (userId: string) => {
    //console.log(`[LivePodcastHost] Booting participant:`, { userId });
    try {
      await supabase.from('podcast_listeners').update({ is_active: false, left_at: new Date().toISOString() }).eq('podcast_id', podcastId).eq('user_id', userId);
      toast.success('Participant removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  const promoteToCohost = async (userId: string) => {
    try {
      await supabase.from('podcast_cohosts').upsert({ podcast_id: podcastId, user_id: userId, permissions: ['speak','moderate'], is_active: true });
      toast.success('Promoted to co-host');
    } catch (e) {
      toast.error('Failed to promote');
    }
  };

  const approveRequest = async (userId: string, requestType: string | null) => {
    try {
      await supabase.from('podcast_participation_requests').update({ status: 'approved', responder_id: (await supabase.auth.getUser()).data.user?.id, responded_at: new Date().toISOString() }).eq('podcast_id', podcastId).eq('user_id', userId).eq('status','pending');
      if (requestType === 'cohost') {
        await supabase.from('podcast_cohosts').upsert({ podcast_id: podcastId, user_id: userId, permissions: ['speak','moderate'], is_active: true });
      }
      grantPermission(userId, requestType as any);
      toast.success('Request approved');
    } catch (e) {
      toast.error('Failed to approve');
    }
  };

  const saveShowNotes = async () => {
    try {
      await supabase.from('ai_podcasts').update({ description: notesDraft }).eq('id', podcastId);
      toast.success('Show notes saved');
    } catch (e) {
      toast.error('Failed to save notes');
    }
  };

  const handleForceCleanup = async () => {
    try {
      await stopCaptioning();
      await stopBroadcasting();
      if (localVideoRef.current?.srcObject) {
        (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        localVideoRef.current.srcObject = null;
      }
      toast.success('Force cleanup complete');
    } catch (e) {
      //console.error('Force cleanup failed', e);
    }
  };

  // Add key point (from enhanced UI)
  const addKeyPoint = (point: string) => {
    if (point.trim()) {
      setKeyPoints(prev => [...prev, point]);
      setNotesDraft('');
      toast.success('Key point added');
    }
  };

  // ────────────────────────────────────────────────────────────────
  // UI Rendering
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <Card className="w-full max-w-7xl h-[95vh] md:h-[90vh] p-0 border shadow-xl overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header - Now includes Recording Toggle */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">
                <Radio className="h-4 w-4 mr-2" /> LIVE
              </Badge>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                    <Zap className="h-4 w-4 mr-2" /> {connectionQuality}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Connection quality</TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> {formatTime(streamTime)}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                            {/* Live Transcript Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setShowTranscript(true)}>
                                  <MessageCircle className="h-4 w-4 mr-2" /> Live Transcript
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Show full live transcript</TooltipContent>
                            </Tooltip>
                    {/* Live Transcript Side Panel */}
                    {showTranscript && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-end">
                        <div className="absolute inset-0 bg-black/30" onClick={() => setShowTranscript(false)} />
                        <div className="relative w-full max-w-md h-full bg-card border-l shadow-2xl flex flex-col">
                          <div className="flex items-center justify-between p-4 border-b bg-background">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <MessageCircle className="h-5 w-5 text-primary" /> Live Transcript
                            </h3>
                            <Button size="icon" variant="ghost" onClick={() => setShowTranscript(false)}>
                              <X className="h-5 w-5" />
                            </Button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {transcript.length === 0 ? (
                              <div className="text-muted-foreground text-sm">Waiting for transcript...</div>
                            ) : (
                              transcript.map((line, i) => (
                                <div key={i} className="text-sm p-2 rounded bg-muted">{line}</div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
              {/* Video Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={enableVideo ? "default" : "outline"}
                    onClick={async () => {
                      const newEnableVideo = !enableVideo;
                      setEnableVideo(newEnableVideo);
                      if (newEnableVideo) {
                        // Update podcast_type to 'video' in DB so listeners switch to video
                        await supabase.from('ai_podcasts').update({ podcast_type: 'video' }).eq('id', podcastId);
                      }
                    }}
                  >
                    {enableVideo ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle video (requires camera permission)</TooltipContent>
              </Tooltip>

              {/* Mute Toggle */}
              <Button size="icon" variant={isMuted ? "destructive" : "outline"} onClick={toggleMute}>
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              {/* Recording Toggle - NEW */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecording ? "destructive" : "default"}
                    size="sm"
                    onClick={handleToggleRecording}
                    disabled={isEnding}
                    className="min-w-[140px] gap-2"
                  >
                    {isRecording ? (
                      <>
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRecording
                    ? "Stop capturing audio/video (will be saved & transcribed)"
                    : "Start recording this live session (audio/video will be saved after ending)"}
                </TooltipContent>
              </Tooltip>

              {/* REC badge + duration when recording */}
              {isRecording && (
                <div className="flex items-center gap-2 ml-2">
                  <Badge variant="destructive" className="px-2 py-1 text-xs flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> REC
                  </Badge>
                  <div className="text-sm text-muted-foreground font-mono">{formatTime(recordingDuration)}</div>
                </div>
              )}

              {/* End Stream */}
              <Button variant="destructive" size="sm" onClick={handleEndStream} disabled={isEnding}>
                {isEnding ? 'Ending...' : 'End Stream'}
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Preview */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div className="relative bg-muted rounded-lg border overflow-hidden flex-1">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <Badge variant="secondary">Host Preview</Badge>
                </div>
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-info/10 p-4 rounded-lg border border-info/20">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-info" /> Hosting Tip
                </h4>
                <p className="text-sm text-muted-foreground">Respond to requests quickly and add key points for your audience.</p>
              </motion.div>
            </div>

            {/* Right: Tabs */}
            <div className={`w-full md:w-96 border-t md:border-t-0 md:border-l flex flex-col ${isMobile ? 'overflow-y-auto' : ''}`}>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="participants"><Users className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="requests"><MessageSquare className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger value="notes"><Edit className="h-4 w-4" /></TabsTrigger>
                </TabsList>

                <TabsContent value="participants" className="flex-1 overflow-y-auto p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Participants ({participants.length})
                  </h3>
                  <AnimatePresence>
                    {participants.map(p => (
                      <motion.div
                        key={p.userId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card mb-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{p.userId?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{p.userId?.split('@')[0] || p.userId}</p>
                            <Badge variant={p.isSpeaking ? "default" : p.isMuted ? "destructive" : "secondary"} className="mt-1">
                              {p.isSpeaking ? 'Speaking' : p.isMuted ? 'Muted' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setParticipantsMuted(p.userId, !p.isMuted)}>
                            {p.isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => promoteToCohost(p.userId)}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => bootParticipant(p.userId)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="requests" className="flex-1 overflow-y-auto p-4">
                  <h3 className="font-semibold mb-4">Permission Requests ({permissionRequests.length})</h3>
                  {permissionRequests.map(req => (
                    <div key={req.userId} className="p-3 rounded-lg border bg-card mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{req.userId?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{req.userId?.split('@')[0] || req.userId}</p>
                            <Badge variant="outline">{req.requestType}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => approveRequest(req.userId, req.requestType)}>Approve</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => revokePermission(req.userId)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="analytics" className="flex-1 p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Live Analytics
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm mb-1">Live Viewers</p>
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.5 }}>
                        <Badge variant="secondary" className="text-lg">{liveViewers}</Badge>
                      </motion.div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="flex-1 p-4 flex flex-col">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Edit className="h-4 w-4" /> Show Notes & Key Points
                  </h3>
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    placeholder="Add notes or key points..."
                    className="flex-1 p-3 rounded-lg border bg-background resize-none mb-4"
                  />
                  <Button onClick={() => addKeyPoint(notesDraft)}>
                    <Save className="h-4 w-4 mr-2" /> Add Key Point
                  </Button>
                  <div className="mt-4 space-y-2">
                    {keyPoints.map((point, i) => (
                      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-2 bg-muted rounded">
                        {point}
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      {/* Captions Overlay (like YouTube) */}
      {isCaptioning && (
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
            {/* Show the last caption only */}
            {captions && captions.length > 0 && captions[captions.length - 1].text}
          </div>
        </div>
      )}
      </Card>
    </div>
  );
};

export default LivePodcastHost;