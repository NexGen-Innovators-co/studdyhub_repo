// PodcastPanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import {
  X, Play, Pause, Download, Maximize2, Minimize2,
  Volume2, VolumeX, SkipForward, SkipBack, Loader2,
  Share2, Users, Clock, Sparkles, Radio, RefreshCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';

interface AudioSegment {
  speaker: string;
  audioContent: string;
  text: string;
  index: number;
  audio_url?: string; // For live podcasts stored in storage
}

interface PodcastData {
  id: string;
  title: string;
  script: string;
  audioSegments: AudioSegment[];
  duration: number;
  sources: string[];
  style: string;
  created_at: string;
  podcastType?: 'audio' | 'image-audio' | 'video' | 'live-stream';
  visualAssets?: Array<{
    type: 'image' | 'video';
    concept: string;
    description: string;
    url: string;
    timestamp: number | null;
    segmentIndex?: number;
  }>;
  cover_image_url?: string; // Optional cover image
  is_live?: boolean; // Whether podcast is live
  description?: string; // Optional description
  tags?: string[]; // Optional tags
  listen_count?: number; // Optional listen count
}

interface PodcastPanelProps {
  podcast: PodcastData | null;
  onClose: () => void;
  isOpen: boolean;
  panelWidth?: number;
  setPanelWidth?: React.Dispatch<React.SetStateAction<number>>;
}

export const PodcastPanel: React.FC<PodcastPanelProps> = ({
  podcast,
  onClose,
  isOpen,
  panelWidth: externalPanelWidth,
  setPanelWidth: externalSetPanelWidth
}) => {
  // Debug log for visualAssets (must be inside component to access podcast prop)
  useEffect(() => {
    if (podcast && podcast.visualAssets) {
      // eslint-disable-next-line no-//console
      //console.log('PodcastPanel visualAssets:', podcast.visualAssets);
      podcast.visualAssets.forEach((asset, idx) => {
        // eslint-disable-next-line no-//console
        //console.log(`Asset #${idx} url:`, asset.url);
      });
    }
  }, [podcast]);
  const [internalPanelWidth, setInternalPanelWidth] = useState(65);
  const panelWidth = externalPanelWidth !== undefined ? externalPanelWidth : internalPanelWidth;
  const setPanelWidth = externalSetPanelWidth || setInternalPanelWidth;

  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPrompts, setShowPrompts] = useState(false); // State to toggle prompts
  const [podcastData, setPodcastData] = useState<PodcastData | null>(null);
  const [showTranscript, setShowTranscript] = useState(false); // State to toggle transcript visibility
  const [replay, setReplay] = useState(false); // State to handle replay functionality
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Cleanup audio on unmount or podcast change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [podcast?.id]);

  // Fetch podcast data
  const fetchPodcastData = async (podcastId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_podcasts')
        .select('id, title, is_public, audio_segments, duration_minutes, style, cover_image_url, script, sources, created_at') // Updated duration to duration_minutes
        .eq('id', podcastId)
        .single();

      if (error) {
        console.error('Error fetching podcast data:', error);
        toast.error('Failed to load podcast data. Please try again later.');
        return null;
      }

      // Transform the API response to match the PodcastData type
      const transformedData = {
        ...data,
        audioSegments: data.audio_segments, // Map snake_case to camelCase
        duration: data.duration_minutes, // Map duration_minutes to duration
      };

      return transformedData;
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred. Please try again later.');
      return null;
    }
  };

  useEffect(() => {
    if (podcast?.id) {
      fetchPodcastData(podcast.id).then((data) => {
        if (data) {
          // Update state with fetched data
          setPodcastData(data);
        }
      });
    }
  }, [podcast?.id]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = lastMousePos.current.x - e.clientX;
      const viewportWidth = window.innerWidth;
      const deltaPercent = (deltaX / viewportWidth) * 100;
      
      setPanelWidth(prev => {
        const newWidth = Math.max(30, Math.min(80, prev + deltaPercent));
        localStorage.setItem('podcastPanelWidth', newWidth.toString());
        return newWidth;
      });
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setPanelWidth]);

  // Play audio segment
  const playSegment = useCallback((index: number) => {
    if (!podcast) return;
    
    const segment = podcast.audioSegments[index];
    if (!segment) return;

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      let audio: HTMLAudioElement;

      // Check if this is a live podcast with audio_url or generated podcast with audioContent
      if (segment.audio_url) {
        // Live podcast - use storage URL
        audio = new Audio(segment.audio_url);
      } else if (segment.audioContent) {
        // Generated podcast - use base64 audio
        // Sanitize audioContent to remove backticks
        const cleanedAudio = segment.audioContent.replace(/`/g, '').trim();
        audio = new Audio(`data:audio/mp3;base64,${cleanedAudio}`);
      } else {
        //console.error('No audio source found in segment:', segment);
        toast.error('Audio not available for this segment');
        return;
      }

      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        if (isFinite(audio.duration) && audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        // Auto-play next segment
        if (index < podcast.audioSegments.length - 1) {
          setCurrentSegment(index + 1);
          setTimeout(() => playSegment(index + 1), 300);
        } else {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
          setReplay(true); // Set replay state
        }
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e, 'Audio source:', segment.audio_url || segment.audioContent);
        toast.error(`Failed to play segment ${index + 1}`);
        setIsPlaying(false);
      };

      audio.play()
        .then(() => {
          setIsPlaying(true);
          setCurrentSegment(index);
        })
        .catch(err => {
          console.error('Play error:', err, 'Audio source:', segment.audio_url || segment.audioContent);
          toast.error('Failed to play audio');
          setIsPlaying(false);
        });

    } catch (err) {
      //console.error('Audio creation error:', err);
      toast.error('Invalid audio data');
      setIsPlaying(false);
    }
  }, [podcast]);

  const handlePlayPause = () => {
    if (replay) {
      setReplay(false); // Reset replay state
      playSegment(0); // Replay from the beginning
      return;
    }

    if (!audioRef.current) {
      playSegment(currentSegment);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (!podcast || currentSegment >= podcast.audioSegments.length - 1) return;
    playSegment(currentSegment + 1);
  };

  const handlePrevious = () => {
    if (currentSegment > 0) {
      playSegment(currentSegment - 1);
    }
  };

  const handleToggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    // Check if duration is valid before seeking
    if (!isFinite(audioRef.current.duration) || audioRef.current.duration === 0) {
      //console.warn('Audio duration not ready yet');
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * audioRef.current.duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  };

  const downloadPodcast = async () => {
    if (!podcast) return;
    
    const loadingToast = toast.loading('Preparing podcast download...');
    
    try {
      // Combine all audio segments
      const audioContext = new AudioContext();
      const segments: AudioBuffer[] = [];
      
      // Decode all segments
      for (const segment of podcast.audioSegments) {
        let cleanedAudio = segment.audioContent.trim();
        if (cleanedAudio.includes(',')) {
          cleanedAudio = cleanedAudio.split(',')[1];
        }
        cleanedAudio = cleanedAudio.replace(/[\r\n\s]/g, '');
        
        const binaryData = atob(cleanedAudio);
        const arrayBuffer = new ArrayBuffer(binaryData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        segments.push(audioBuffer);
      }
      
      // Calculate total length
      const totalLength = segments.reduce((sum, buffer) => sum + buffer.length, 0);
      
      // Combine segments
      const combinedBuffer = audioContext.createBuffer(
        segments[0].numberOfChannels,
        totalLength,
        segments[0].sampleRate
      );
      
      let offset = 0;
      for (const segment of segments) {
        for (let channel = 0; channel < segment.numberOfChannels; channel++) {
          combinedBuffer.copyToChannel(segment.getChannelData(channel), channel, offset);
        }
        offset += segment.length;
      }
      
      // Convert to WAV
      const wavBlob = await audioBufferToWav(combinedBuffer);
      
      // Create download link
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${podcast.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_podcast.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Podcast downloaded successfully!', { id: loadingToast });
    } catch (error) {
      //console.error('Download error:', error);
      toast.error('Failed to download podcast', { id: loadingToast });
    }
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];
    
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 0;
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };
    
    const writeUint32 = (value: number) => {
      view.setUint32(offset, value, true);
      offset += 4;
    };
    
    const writeUint16 = (value: number) => {
      view.setUint16(offset, value, true);
      offset += 2;
    };
    
    // Write WAV header
    writeString('RIFF');
    writeUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1); // PCM
    writeUint16(buffer.numberOfChannels);
    writeUint32(buffer.sampleRate);
    writeUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
    writeUint16(buffer.numberOfChannels * 2);
    writeUint16(16); // 16-bit
    writeString('data');
    writeUint32(length - offset - 4);
    
    // Interleave samples
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const sharePodcast = async () => {
    if (!podcast) return;
    
    const loadingToast = toast.loading('Sharing podcast...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to share', { id: loadingToast });
        return;
      }
      
      // Check if podcast exists in database and get its current state
      const { data: podcastData, error: fetchError } = await supabase
        .from('ai_podcasts')
        .select('id, is_public')
        .eq('id', podcast.id)
        .single();
      
      if (fetchError) {
        //console.error('Podcast fetch error:', fetchError);
        toast.error('Podcast not found in database', { id: loadingToast });
        return;
      }
      
      // If podcast is private, make it public before sharing
      if (!podcastData.is_public) {
        const { error: updateError } = await supabase
          .from('ai_podcasts')
          .update({ is_public: true })
          .eq('id', podcast.id);
        
        if (updateError) {
          //console.error('Update error:', updateError);
          toast.error('Failed to make podcast public', { id: loadingToast });
          return;
        }
      }
      
      // Create social post with link to podcast
      const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;
      const content = `🎙️ Check out my AI-generated podcast: "${podcast.title}"

${podcast.audioSegments.length} segments • ${podcast.duration} minutes
Style: ${podcast.style}

🔗 Listen now: ${podcastUrl}

Generated with StuddyHub AI Podcasts!`;
      
      const { error } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          content,
          privacy: 'public',
          metadata: {
            type: 'podcast',
            podcastId: podcast.id,
            title: podcast.title,
            description: podcast.description || '',
            coverUrl: podcast.cover_image_url,
            authorName: user.user_metadata?.full_name || user.email
          }
        });
      
      if (error) throw error;
      
      toast.success('Podcast shared to your social feed! (Made public)', { id: loadingToast });
    } catch (error) {
      //console.error('Share error:', error);
      toast.error('Failed to share podcast', { id: loadingToast });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !podcast) return null;

  const containerWidth = isFullScreen ? 100 : panelWidth;

  return (
    <motion.div
      ref={containerRef}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full bg-white text-black dark:bg-blue-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-700"
      style={{ width: `${containerWidth}%` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-400 dark:from-blue-800 dark:to-blue-900">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-white" />
          <div>
            <h3 className="font-bold text-white">AI Podcast</h3>
            <p className="text-xs text-white/80">
              {podcast.audioSegments.length} segments • {podcast.duration} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="h-8 w-8 text-white"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Podcast Info */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {podcast.title}
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              <Sparkles className="h-3 w-3 mr-1" />
              {podcast.style}
            </Badge>
          </div>
        </div>

        {/* Visual Assets Display (for image-audio, video, live-stream types) */}
        {podcast.visualAssets && podcast.visualAssets.length > 0 && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {podcast.podcastType === 'video' ? '🎥 Video Podcast' : 
                 podcast.podcastType === 'live-stream' ? '🔴 Live Stream' : 
                 '🖼️ Visual Podcast'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrompts(!showPrompts)}
                className="text-xs"
              >
                {showPrompts ? 'Hide Prompts' : 'Show Prompts'}
              </Button>
            </div>
            
            {/* Current visual based on playback time */}
            {podcast.visualAssets.map((asset, index) => {
              let isCurrentAsset = false;
              if (asset.type === 'image' && typeof asset.segmentIndex === 'number') {
                const nextImageAsset = podcast.visualAssets
                  .filter((a) => a.type === 'image' && typeof a.segmentIndex === 'number' && a.segmentIndex! > asset.segmentIndex!)
                  .sort((a, b) => (a.segmentIndex! - b.segmentIndex!))[0];
                if (nextImageAsset) {
                  isCurrentAsset = currentSegment >= asset.segmentIndex && currentSegment < nextImageAsset.segmentIndex!;
                } else {
                  isCurrentAsset = currentSegment >= asset.segmentIndex && currentSegment < podcast.audioSegments.length;
                }
                if (!isCurrentAsset) return null;
              } else if (asset.type === 'video' && typeof asset.timestamp === 'number') {
                const nextAsset = podcast.visualAssets![index + 1];
                isCurrentAsset = currentTime >= asset.timestamp && (!nextAsset || currentTime < nextAsset.timestamp);
              }
              if (!isCurrentAsset) return null;
              return (
                <div key={index} className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-video">
                  {asset.type === 'video' ? (
                    <video
                      src={asset.url}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                    />
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.concept}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder
                        (e.target as HTMLImageElement).src = `https://placehold.co/1792x1024/6366f1/white?text=${encodeURIComponent(asset.concept)}`;
                      }}
                    />
                  )}
                  {showPrompts && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {asset.type === 'video' ? '🎥 Video' : '🖼️ Image'}
                        </Badge>
                        <p className="text-white text-sm font-medium flex-1">{asset.concept}</p>
                      </div>
                      <p className="text-white/80 text-xs mt-1">{asset.description}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Visual timeline */}
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {podcast.visualAssets.map((asset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = asset.timestamp;
                    }
                  }}
                  className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all relative ${
                    currentTime >= asset.timestamp && 
                    (!podcast.visualAssets![index + 1] || currentTime < podcast.visualAssets![index + 1].timestamp)
                      ? 'border-purple-500 shadow-lg'
                      : 'border-slate-300 dark:border-slate-600 hover:border-purple-300'
                  }`}
                  title={asset.concept}
                >
                  {asset.type === 'video' ? (
                    <>
                      <video
                        src={asset.url}
                        className="w-16 h-10 object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                    </>
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.concept}
                      className="w-16 h-10 object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Segment */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {podcast.audioSegments[currentSegment]?.speaker}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Segment {currentSegment + 1} of {podcast.audioSegments.length}
            </span>
          </div>
          
          <ScrollArea className="h-24 bg-white dark:bg-slate-900 rounded-lg p-3">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {podcast.audioSegments[currentSegment]?.text}
            </p>
          </ScrollArea>
        </div>

        {/* Player Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
          {/* Progress Bar */}
          <div 
            className="mb-4 cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={currentSegment === 0}
              className="h-10 w-10"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            {/* Update the play/pause button to reflect replay state */}
            <Button
              onClick={handlePlayPause}
              className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg"
            >
              {replay ? (
                <RefreshCcw className="h-6 w-6" /> // Replay icon
              ) : isPlaying ? (
                <Pause className="h-6 w-6" /> // Pause icon
              ) : (
                <Play className="h-6 w-6" /> // Play icon
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={currentSegment >= podcast.audioSegments.length - 1}
              className="h-10 w-10"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Volume & Actions */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleMute}
              className="h-8 w-8"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPodcast}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={sharePodcast}
                className="text-xs"
              >
                <Share2 className="h-3 w-3 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-shrink-0 mb-4">
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Full Transcript
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-xs"
              >
                {showTranscript ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
          {showTranscript && (
            <div className="px-4 pb-4">
              <div className="space-y-4">
                {podcast.audioSegments.map((segment, index) => (
                  <button
                    key={index}
                    onClick={() => playSegment(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      currentSegment === index
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {segment.speaker}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {segment.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
