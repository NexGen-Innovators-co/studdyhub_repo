// usePodcastAudio.ts - Audio playback hook extracted from PodcastPanel
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { resolveSignedUrl, deriveFullAudioUrl } from '../podcastUtils';
import type { PodcastData, VisualAsset } from '../podcastTypes';

export interface UsePodcastAudioOptions {
  podcast: PodcastData | null;
  isOpen: boolean;
  isSegmentsLoaded: boolean;
  loadedCount: number;
}

export interface UsePodcastAudioReturn {
  // State
  isPlaying: boolean;
  isMuted: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  loadingAudio: boolean;
  mediaLoading: boolean;
  audioReady: boolean;
  replay: boolean;
  playbackSpeed: number;
  playbackSrc: string | null;
  currentSegmentIndex: number;
  isSingleAudio: boolean;
  fullAudioDuration: number;
  fullAudioProgress: number;
  segmentsProgress: { start: number; end: number }[];
  derivedFullAudioUrl: string | undefined;
  autoAdvancingRef: React.MutableRefObject<boolean>;
  // Refs
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  signedUrlCacheRef: React.MutableRefObject<Map<string, string>>;
  audioLoadTimeoutRef: React.MutableRefObject<number | null>;
  switchingPodcastRef: React.MutableRefObject<{ active: boolean; timeout?: number | null }>;
  audioStaleRef: React.MutableRefObject<boolean>;
  // Setters (needed by visual player and controls)
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingAudio: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAudioReady: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentSegmentIndex: React.Dispatch<React.SetStateAction<number>>;
  setFullAudioDuration: React.Dispatch<React.SetStateAction<number>>;
  setFullAudioProgress: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setReplay: React.Dispatch<React.SetStateAction<boolean>>;
  setPlaybackSrc: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSingleAudio: React.Dispatch<React.SetStateAction<boolean>>;
  setSegmentsProgress: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  // Actions
  playFullAudio: () => Promise<void>;
  playSegment: (segmentIndex: number, opts?: { autoAdvance?: boolean }) => Promise<void>;
  handlePlayPause: () => void;
  handleNextSegment: () => void;
  handlePreviousSegment: () => void;
  handleSpeedChange: () => void;
  handleToggleMute: () => void;
  handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleSegmentProgressClick: (segmentIndex: number) => void;
  handleShare: () => Promise<void>;
  // Cleanup
  cleanupAudio: () => void;
}

export function usePodcastAudio({ podcast, isOpen, isSegmentsLoaded, loadedCount }: UsePodcastAudioOptions): UsePodcastAudioReturn {
  const isOnline = useOnlineStatus();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [replay, setReplay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackSrc, setPlaybackSrc] = useState<string | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isSingleAudio, setIsSingleAudio] = useState(false);
  const [fullAudioDuration, setFullAudioDuration] = useState(0);
  const [fullAudioProgress, setFullAudioProgress] = useState(0);
  const [segmentsProgress, setSegmentsProgress] = useState<{ start: number; end: number }[]>([]);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());
  const audioLoadTimeoutRef = useRef<number | null>(null);
  const autoAdvancingRef = useRef(false);
  const switchingPodcastRef = useRef<{ active: boolean; timeout?: number | null }>({ active: false, timeout: null });
  const audioStaleRef = useRef(false);

  const derivedUrl = deriveFullAudioUrl(podcast);

  // Detect single audio
  useEffect(() => {
    if (podcast) {
      const hasSegments = podcast.audioSegments && podcast.audioSegments.length > 0;
      const hasUrl = !!derivedUrl;
      if (hasUrl && (!hasSegments || (hasSegments && podcast.audioSegments.length === 1))) {
        setIsSingleAudio(true);
      } else {
        setIsSingleAudio(false);
      }
    }
  }, [podcast, derivedUrl]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
          const obj = (audioRef.current as any)?._objectUrl;
          if (obj) { try { URL.revokeObjectURL(obj); } catch (_e) {} }
        } catch (_e) {}
        audioRef.current = null;
      }
      if (audioLoadTimeoutRef.current) {
        window.clearTimeout(audioLoadTimeoutRef.current);
        audioLoadTimeoutRef.current = null;
      }
      if (switchingPodcastRef.current.timeout) {
        window.clearTimeout(switchingPodcastRef.current.timeout as number);
        switchingPodcastRef.current.timeout = null;
      }
      setPlaybackSrc(null);
    };
  }, []);

  // Pause/resume when CloudTTS generates audio elsewhere
  useEffect(() => {
    const pausedByTtsRef = { current: false };
    const onGenerating = () => {
      try {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          pausedByTtsRef.current = true;
          setIsPlaying(false);
        }
      } catch (_e) {}
    };
    const resumeIfPaused = () => {
      try {
        if (pausedByTtsRef.current && audioRef.current) {
          audioRef.current.play().catch(() => {});
          pausedByTtsRef.current = false;
          setIsPlaying(true);
        }
      } catch (_e) {}
    };
    window.addEventListener('cloud-tts:generating', onGenerating);
    window.addEventListener('cloud-tts:generated', resumeIfPaused);
    window.addEventListener('cloud-tts:playback-ended', resumeIfPaused);
    window.addEventListener('cloud-tts:error', resumeIfPaused);
    return () => {
      window.removeEventListener('cloud-tts:generating', onGenerating);
      window.removeEventListener('cloud-tts:generated', resumeIfPaused);
      window.removeEventListener('cloud-tts:playback-ended', resumeIfPaused);
      window.removeEventListener('cloud-tts:error', resumeIfPaused);
    };
  }, []);

  // Cleanup previous audio when switching podcasts
  useEffect(() => {
    if (!isOpen) return;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
        try {
          (audioRef.current as any).onloadedmetadata = null;
          (audioRef.current as any).ontimeupdate = null;
          (audioRef.current as any).onended = null;
          (audioRef.current as any).onerror = null;
        } catch (_e) {}
      } catch (_e) {}
      try {
        const obj = (audioRef.current as any)?._objectUrl;
        if (obj) { try { URL.revokeObjectURL(obj); } catch (_e) {} }
      } catch (_e) {}
      audioStaleRef.current = true;
    }
    if (audioLoadTimeoutRef.current) {
      window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setFullAudioProgress(0);
    setReplay(false);
    setCurrentSegmentIndex(0);
    setPlaybackSrc(null);
    if (switchingPodcastRef.current.timeout) {
      window.clearTimeout(switchingPodcastRef.current.timeout as number);
    }
    switchingPodcastRef.current.active = true;
    switchingPodcastRef.current.timeout = window.setTimeout(() => {
      switchingPodcastRef.current.active = false;
      switchingPodcastRef.current.timeout = null;
    }, 800) as unknown as number;
  }, [podcast?.id, isOpen]);

  // Calculate segment progress for YouTube-style segmented progress bar
  const calculateSegmentsProgress = useCallback(() => {
    if (!podcast?.audioSegments || podcast.audioSegments.length === 0) return;
    const segments = podcast.audioSegments;
    const hasExplicitTimes = segments.every(s => typeof s.start_time === 'number' && typeof s.end_time === 'number');
    let progressSegments: { start: number; end: number }[] = [];
    if (hasExplicitTimes) {
      progressSegments = segments.map(s => ({ start: s.start_time || 0, end: s.end_time || 0 }));
    } else {
      const total = (podcast?.duration ? (podcast.duration * 60) : fullAudioDuration) || 0;
      const segmentDuration = total > 0 ? total / segments.length : 0;
      progressSegments = segments.map((_, index) => ({
        start: index * segmentDuration,
        end: (index + 1) * segmentDuration,
      }));
    }
    setSegmentsProgress(progressSegments);
  }, [podcast?.audioSegments, fullAudioDuration]);

  useEffect(() => {
    if (!isOpen || !podcast) return;
    calculateSegmentsProgress();
  }, [isOpen, podcast?.audioSegments, podcast?.duration, fullAudioDuration, calculateSegmentsProgress, isSegmentsLoaded]);

  // Helper to get or create an audio element from the ref
  const getOrCreateAudioEl = (): HTMLAudioElement => {
    if (audioRef.current && (audioRef.current instanceof HTMLAudioElement)) {
      return audioRef.current;
    }
    if (audioRef.current && (audioRef.current as any).tagName === 'AUDIO') {
      return audioRef.current as HTMLAudioElement;
    }
    if (audioRef.current && (audioRef.current as any).src) {
      return audioRef.current as unknown as HTMLAudioElement;
    }
    const created = new Audio();
    audioRef.current = created as any;
    return created;
  };

  // Play single continuous audio
  const playFullAudio = useCallback(async () => {
    if (!isOnline) { toast.error('No internet connection'); return; }
    if (!derivedUrl) { toast.error('No audio available'); return; }
    setLoadingAudio(true);
    setMediaLoading(true);
    try {
      const resolved = await resolveSignedUrl(derivedUrl, signedUrlCacheRef.current);

      // VIDEO flow
      if (podcast?.podcast_type === 'video') {
        setPlaybackSrc(resolved || null);
        if (audioRef.current) { try { audioRef.current.pause(); } catch (_e) {} audioRef.current = null; }
        const vid = videoRef.current;
        if (!vid) throw new Error('Video element not available');
        vid.src = resolved || '';
        vid.playbackRate = playbackSpeed;
        vid.muted = isMuted;
        vid.onloadedmetadata = () => { setFullAudioDuration(vid.duration || 0); setDuration(vid.duration || 0); setLoadingAudio(false); setMediaLoading(false); };
        vid.ontimeupdate = () => {
          const cur = vid.currentTime;
          setCurrentTime(cur); setFullAudioProgress(cur);
          if (vid.duration > 0) {
            setProgress((cur / vid.duration) * 100);
            if (podcast.audioSegments?.length > 0) setCurrentSegmentIndex(Math.floor((cur / vid.duration) * podcast.audioSegments.length));
          }
        };
        vid.onended = () => { setIsPlaying(false); setProgress(100); setCurrentTime(vid.duration || 0); setFullAudioProgress(vid.duration || 0); setReplay(true); };
        vid.onerror = () => {
          if (!switchingPodcastRef.current.active) toast.error('Video unavailable');
          setLoadingAudio(false); setMediaLoading(false); setIsPlaying(false);
        };
        try { await vid.play(); } catch (_err) {
          const resp = await fetch(resolved as string, { mode: 'cors' });
          if (!resp.ok) throw new Error('Fetch failed');
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          vid.src = objectUrl; (vid as any)._objectUrl = objectUrl;
          await vid.play();
        }
        setIsPlaying(true);
        return;
      }

      // AUDIO flow
      const audioEl = getOrCreateAudioEl();
      try { audioEl.pause(); } catch (_e) {}
      audioEl.src = resolved as string;
      audioEl.playbackRate = playbackSpeed;
      audioEl.muted = isMuted;
      audioEl.onloadedmetadata = () => {
        setFullAudioDuration(audioEl.duration); setDuration(audioEl.duration);
        setLoadingAudio(false); setMediaLoading(false);
        if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
      };
      audioEl.ontimeupdate = () => {
        const cur = audioEl.currentTime;
        setCurrentTime(cur); setFullAudioProgress(cur);
        if (audioEl.duration > 0) {
          setProgress((cur / audioEl.duration) * 100);
          if (podcast!.audioSegments?.length > 0) setCurrentSegmentIndex(Math.floor((cur / audioEl.duration) * podcast!.audioSegments.length));
        }
      };
      audioEl.onended = () => { setIsPlaying(false); setProgress(100); setCurrentTime(audioEl.duration); setFullAudioProgress(audioEl.duration); setReplay(true); };
      audioEl.onerror = () => {
        if (!switchingPodcastRef.current.active) toast.error('Failed to load audio');
        setLoadingAudio(false); setMediaLoading(false);
        if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
        setIsPlaying(false);
      };
      audioStaleRef.current = false;
      setReplay(false);
      try { await audioEl.play(); } catch (_err) {
        const resp = await fetch(resolved as string, { mode: 'cors' });
        if (!resp.ok) throw new Error('Fetch failed');
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        audioEl.src = objectUrl; (audioEl as any)._objectUrl = objectUrl;
        await audioEl.play();
      }
      if (audioLoadTimeoutRef.current) window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = window.setTimeout(() => { setLoadingAudio(false); }, 2000) as unknown as number;
      setIsPlaying(true);
    } catch (error: any) {
      if (!switchingPodcastRef.current.active) toast.error('Failed to play media: ' + (error.message || 'Unknown error'));
      setLoadingAudio(false); setMediaLoading(false); setIsPlaying(false);
    }
  }, [podcast, playbackSpeed, isMuted, derivedUrl, isOnline]);

  // Play segment (for segmented audio)
  const playSegment = useCallback(async (segmentIndex: number, opts?: { autoAdvance?: boolean }) => {
    if (!isOnline) { toast.error('No internet connection'); return; }
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (!podcast?.audioSegments[segmentIndex]) { toast.error('Segment not available'); return; }
    if (!opts?.autoAdvance) setLoadingAudio(true);
    setCurrentTime(0); setProgress(0); setDuration(0);
    const segment = podcast.audioSegments[segmentIndex];
    try {
      let sourceUrl: string | undefined;
      if (segment.audio_url) {
        sourceUrl = segment.audio_url;
      } else if (segment.audioContent) {
        sourceUrl = `data:audio/mp3;base64,${segment.audioContent.replace(/`/g, '').trim()}`;
      } else {
        toast.error('No audio source available for this segment');
        setLoadingAudio(false); return;
      }
      const resolved = await resolveSignedUrl(sourceUrl, signedUrlCacheRef.current);

      // VIDEO segment
      if (podcast?.podcast_type === 'video') {
        const vid = videoRef.current;
        if (!vid) throw new Error('Video element not available');
        setPlaybackSrc(resolved || null);
        vid.src = resolved || ''; vid.playbackRate = playbackSpeed; vid.muted = isMuted;
        vid.onloadedmetadata = () => { setDuration(vid.duration || 0); setLoadingAudio(false); };
        vid.ontimeupdate = () => { setCurrentTime(vid.currentTime); if (vid.duration > 0) setProgress((vid.currentTime / vid.duration) * 100); };
        vid.onended = () => {
          setProgress(100); setCurrentTime(vid.duration || 0);
          if (segmentIndex < (podcast.audioSegments?.length || 0) - 1) {
            autoAdvancingRef.current = true;
            setTimeout(() => {
              setCurrentSegmentIndex(segmentIndex + 1);
              playSegment(segmentIndex + 1, { autoAdvance: true }).catch(console.error).finally(() => { window.setTimeout(() => { autoAdvancingRef.current = false; }, 700); });
            }, 500);
          } else { setIsPlaying(false); setReplay(true); }
        };
        vid.onerror = () => {
          if (!switchingPodcastRef.current.active) toast.error('Video unavailable');
          setLoadingAudio(false); setIsPlaying(false);
        };
        setCurrentSegmentIndex(segmentIndex); setReplay(false);
        try { await vid.play(); } catch (_err) {
          const resp = await fetch(resolved as string, { mode: 'cors' });
          if (!resp.ok) throw new Error('Fetch failed');
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          vid.src = objectUrl; (vid as any)._objectUrl = objectUrl; await vid.play();
        }
        setIsPlaying(true); return;
      }

      // AUDIO segment
      const audioEl = getOrCreateAudioEl();
      try { audioEl.pause(); } catch (_e) {}
      audioEl.src = resolved as string; audioEl.playbackRate = playbackSpeed; audioEl.muted = isMuted;
      audioEl.onloadedmetadata = () => { setDuration(audioEl.duration); setLoadingAudio(false); if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; } };
      audioEl.ontimeupdate = () => { setCurrentTime(audioEl.currentTime); if (audioEl.duration > 0) setProgress((audioEl.currentTime / audioEl.duration) * 100); };
      audioEl.onended = () => {
        setProgress(100); setCurrentTime(audioEl.duration);
        if (segmentIndex < (podcast.audioSegments?.length || 0) - 1) {
          autoAdvancingRef.current = true;
          setTimeout(() => {
            setCurrentSegmentIndex(segmentIndex + 1);
            playSegment(segmentIndex + 1, { autoAdvance: true }).catch(console.error).finally(() => { window.setTimeout(() => { autoAdvancingRef.current = false; }, 700); });
          }, 500);
        } else { setIsPlaying(false); setReplay(true); }
      };
      audioEl.onerror = () => {
        if (!switchingPodcastRef.current.active) toast.error('Failed to load audio segment');
        setLoadingAudio(false); if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
        setIsPlaying(false);
      };
      audioStaleRef.current = false;
      setCurrentSegmentIndex(segmentIndex); setReplay(false);
      try { await audioEl.play(); } catch (_err) {
        const resp = await fetch(resolved as string, { mode: 'cors' });
        if (!resp.ok) throw new Error('Fetch failed');
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        audioEl.src = objectUrl; (audioEl as any)._objectUrl = objectUrl; await audioEl.play();
      }
      if (audioLoadTimeoutRef.current) window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = window.setTimeout(() => { setLoadingAudio(false); }, 2000) as unknown as number;
      setIsPlaying(true);
    } catch (error: any) {
      if (!switchingPodcastRef.current.active) toast.error('Failed to play media: ' + (error.message || 'Unknown error'));
      setLoadingAudio(false); setIsPlaying(false);
    }
  }, [podcast, playbackSpeed, isMuted, loadedCount, isOnline]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (replay) {
      setReplay(false);
      if (isSingleAudio) { playFullAudio(); } else { playSegment(0); }
      return;
    }
    if (!audioRef.current || !audioRef.current.src || audioRef.current.src === window.location.href) {
      // No audio element or no source loaded yet → kick off proper playback
      if (isSingleAudio) { playFullAudio(); } else { playSegment(currentSegmentIndex); }
      return;
    }
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => {
      // Source became stale – re-trigger proper playback
      if (isSingleAudio) { playFullAudio(); } else { playSegment(currentSegmentIndex); }
    }); setIsPlaying(true); }
  }, [loadedCount, replay, isSingleAudio, isPlaying, currentSegmentIndex, playFullAudio, playSegment]);

  // Handle next/previous segment
  const handleNextSegment = useCallback(() => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segCount = podcast?.audioSegments?.length || 1;
        const segDur = fullAudioDuration / segCount;
        const nextTime = audioRef.current.currentTime + segDur;
        audioRef.current.currentTime = nextTime < fullAudioDuration ? nextTime : fullAudioDuration - 0.1;
      }
    } else if (podcast && currentSegmentIndex < podcast.audioSegments.length - 1) {
      playSegment(currentSegmentIndex + 1);
    } else { toast.info('This is the last segment'); }
  }, [loadedCount, isSingleAudio, fullAudioDuration, podcast, currentSegmentIndex, playSegment]);

  const handlePreviousSegment = useCallback(() => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segCount = podcast?.audioSegments?.length || 1;
        const segDur = fullAudioDuration / segCount;
        const prevTime = audioRef.current.currentTime - segDur;
        audioRef.current.currentTime = prevTime > 0 ? prevTime : 0;
      }
    } else if (currentSegmentIndex > 0) {
      playSegment(currentSegmentIndex - 1);
    } else { toast.info('This is the first segment'); }
  }, [loadedCount, isSingleAudio, fullAudioDuration, podcast, currentSegmentIndex, playSegment]);

  // Speed change
  const handleSpeedChange = useCallback(() => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(playbackSpeed);
    const newSpeed = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
    toast.info(`Playback speed: ${newSpeed}x`);
  }, [loadedCount, playbackSpeed]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (audioRef.current) { audioRef.current.muted = !isMuted; setIsMuted(!isMuted); }
  }, [loadedCount, isMuted]);

  // Progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    if (isSingleAudio) {
      const newTime = percentage * fullAudioDuration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime); setFullAudioProgress(newTime); setProgress(percentage * 100);
    } else {
      const segCount = podcast?.audioSegments?.length || 1;
      const segIdx = Math.floor(percentage * segCount);
      if (segIdx < segCount) playSegment(segIdx);
    }
  }, [loadedCount, duration, isSingleAudio, fullAudioDuration, podcast, playSegment]);

  // Segment progress click
  const handleSegmentProgressClick = useCallback((segmentIndex: number) => {
    if (loadedCount === 0) { toast.error('Audio segments are still loading. Please wait.'); return; }
    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segCount = podcast?.audioSegments?.length || 1;
        const segDur = fullAudioDuration / segCount;
        const startTime = segmentIndex * segDur;
        audioRef.current.currentTime = startTime;
        setCurrentTime(startTime); setFullAudioProgress(startTime); setProgress((startTime / fullAudioDuration) * 100);
      }
    } else { playSegment(segmentIndex); }
  }, [loadedCount, isSingleAudio, fullAudioDuration, podcast, playSegment]);

  // Share
  const handleShare = useCallback(async () => {
    if (!podcast) return;
    try {
      const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;
      if (navigator.share) {
        await navigator.share({ title: podcast.title, text: `Check out this podcast: ${podcast.title}`, url: podcastUrl });
      } else {
        await navigator.clipboard.writeText(podcastUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (_error) {}
  }, [podcast]);

  // Cleanup helper (for handleClose in parent)
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_e) {}
      try { const obj = (audioRef.current as any)?._objectUrl; if (obj) URL.revokeObjectURL(obj); } catch (_e) {}
      audioRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_e) {}
      try { const obj = (videoRef.current as any)?._objectUrl; if (obj) URL.revokeObjectURL(obj); } catch (_e) {}
      try { videoRef.current.src = ''; } catch (_e) {}
      videoRef.current = null;
    }
    if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
    if (switchingPodcastRef.current.timeout) { window.clearTimeout(switchingPodcastRef.current.timeout as number); switchingPodcastRef.current.timeout = null; }
    setIsPlaying(false); setIsMuted(false); setProgress(0); setCurrentTime(0); setDuration(0);
    setFullAudioDuration(0); setFullAudioProgress(0); setCurrentSegmentIndex(0); setSegmentsProgress([]);
    setLoadingAudio(false); setMediaLoading(false); setPlaybackSrc(null);
  }, []);

  return {
    isPlaying, isMuted, progress, currentTime, duration, loadingAudio, mediaLoading,
    audioReady, replay, playbackSpeed, playbackSrc, currentSegmentIndex,
    isSingleAudio, fullAudioDuration, fullAudioProgress, segmentsProgress,
    derivedFullAudioUrl: derivedUrl, autoAdvancingRef,
    audioRef, videoRef, signedUrlCacheRef, audioLoadTimeoutRef, switchingPodcastRef, audioStaleRef,
    setIsPlaying, setLoadingAudio, setMediaLoading, setAudioReady, setCurrentSegmentIndex,
    setFullAudioDuration, setFullAudioProgress, setDuration, setCurrentTime, setProgress,
    setReplay, setPlaybackSrc, setIsSingleAudio, setSegmentsProgress,
    playFullAudio, playSegment, handlePlayPause, handleNextSegment, handlePreviousSegment,
    handleSpeedChange, handleToggleMute, handleProgressClick, handleSegmentProgressClick,
    handleShare, cleanupAudio,
  };
}
