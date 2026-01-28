// PodcastPanel.tsx - Complete fixed version
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  X, Play, Pause, Download, Maximize2, Minimize2,
  Volume2, VolumeX, SkipForward, SkipBack, Loader2,
  Share2, Users, Clock, Radio, RefreshCcw,
  ThumbsUp, ThumbsDown, MoreVertical, MessageSquare,
  List, Eye, Flag, ChevronLeft, ChevronRight, Menu, ChevronDown, ChevronUp,
  Captions
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { getBlobDuration } from '@/services/podcastLiveService';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { saveTranscriptionResult } from '@/services/podcastLiveService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { PodcastData } from './PodcastGenerator';

// Types matching database schema exactly
interface AudioSegment {
  speaker: string;
  text: string;
  audioContent?: string;
  audio_url?: string;
  transcript?: string | null;
  summary?: string | null;
  index: number;
  start_time?: number;
  end_time?: number;
}

interface VisualAsset {
  type: 'image' | 'video';
  url: string;
  concept: string;
  segmentIndex?: number;
}

interface PodcastPanelProps {
  podcast: PodcastData | null;
  onClose: () => void;
  isOpen: boolean;
  onPodcastSelect?: (podcastId: string) => void;
  panelWidth?: number;
  setPanelWidth?: React.Dispatch<React.SetStateAction<number>>;
}

export interface PodcastPanelRef {
  audioRef: React.RefObject<HTMLAudioElement>;
}

export const PodcastPanel = forwardRef<PodcastPanelRef, PodcastPanelProps>(({
  podcast,
  onClose,
  isOpen,
  onPodcastSelect
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  // Live captions state
  const [showLiveCaptions, setShowLiveCaptions] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState<string[]>([]);
  const liveCaptionSubRef = useRef<any>(null);
  const [showMobileListeners, setShowMobileListeners] = useState(false);
  const [showMobileRelated, setShowMobileRelated] = useState(false);
  const [liked, setLiked] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [subscribed, setSubscribed] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<any>(null);
  const [relatedPodcasts, setRelatedPodcasts] = useState<any[]>([]);
  const [relatedPage, setRelatedPage] = useState(0);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedHasMore, setRelatedHasMore] = useState(false);
  const relatedSentinelRef = useRef<HTMLDivElement | null>(null);
  const relatedContainerRef = useRef<HTMLDivElement | null>(null);

  const [listenersList, setListenersList] = useState<any[]>([]);
  const [listenersPage, setListenersPage] = useState(0);
  const [listenersLoading, setListenersLoading] = useState(false);
  const [listenersHasMore, setListenersHasMore] = useState(false);
  const listenersSentinelRef = useRef<HTMLDivElement | null>(null);
  const listenersContainerRef = useRef<HTMLDivElement | null>(null);
  const relatedLoadingRef = useRef(false);
  const listenersLoadingRef = useRef(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [replay, setReplay] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isPodcastDataLoaded, setIsPodcastDataLoaded] = useState(false);
  const [isSegmentsLoaded, setIsSegmentsLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState<VisualAsset | null>(null);
  const [displayedVisualAsset, setDisplayedVisualAsset] = useState<VisualAsset | null>(null);
  const [prevVisualAsset, setPrevVisualAsset] = useState<VisualAsset | null>(null);
  const [currentImageVisible, setCurrentImageVisible] = useState(true);
  const [segmentsProgress, setSegmentsProgress] = useState<{start: number, end: number}[]>([]);
  const [isSingleAudio, setIsSingleAudio] = useState(false);
  const [fullAudioDuration, setFullAudioDuration] = useState(0);
  const [fullAudioProgress, setFullAudioProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [playbackSrc, setPlaybackSrc] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const audioLoadTimeoutRef = useRef<number | null>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const autoAdvancingRef = useRef(false);
  const switchingPodcastRef = useRef<{ active: boolean; timeout?: number | null }>({ active: false, timeout: null });
  const audioStaleRef = useRef(false);

  // Transcript auto-scroll refs and user-interaction detection
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const userInteractingRef = useRef(false);
  const userInteractTimeoutRef = useRef<number | null>(null);

  const markUserInteraction = useCallback(() => {
    userInteractingRef.current = true;
    if (userInteractTimeoutRef.current) {
      window.clearTimeout(userInteractTimeoutRef.current);
    }
    userInteractTimeoutRef.current = window.setTimeout(() => {
      userInteractingRef.current = false;
      userInteractTimeoutRef.current = null;
    }, 2000) as unknown as number;
  }, []);


  // Derive a single full-audio URL from podcast data (some recordings store audio_url inside segments)
  const deriveFullAudioUrl = () => {
    if (!podcast) return undefined;
    if ((podcast as any).audio_url) return (podcast as any).audio_url;
    if (podcast.audioSegments && podcast.audioSegments.length === 1 && podcast.audioSegments[0].audio_url) {
      return podcast.audioSegments[0].audio_url;
    }
    if ((podcast as any).audio_segments) {
      try {
        const parsed = typeof (podcast as any).audio_segments === 'string'
          ? JSON.parse((podcast as any).audio_segments)
          : (podcast as any).audio_segments || [];
        if (Array.isArray(parsed) && parsed.length === 1 && parsed[0].audio_url) {
          return parsed[0].audio_url;
        }
      } catch (e) {
        // ignore
      }
    }
    return undefined;
  };

  const derivedFullAudioUrl = deriveFullAudioUrl();

  // Expose audioRef to parent
  useImperativeHandle(ref, () => ({
    audioRef
  }));

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          const obj = (audioRef.current as any)?._objectUrl;
          if (obj) {
            try { URL.revokeObjectURL(obj); } catch (e) {}
          }
        } catch (e) {}
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
    };
  }, []);

  // Pause/resume when CloudTTS generates audio elsewhere
  useEffect(() => {
    const pausedByTtsRef = { current: false } as { current: boolean };

    const onGenerating = (_: Event) => {
      try {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          pausedByTtsRef.current = true;
          setIsPlaying(false);
        }
      } catch (e) {
        // ignore
      }
    };

    const resumeIfPaused = (_: Event) => {
      try {
        if (pausedByTtsRef.current && audioRef.current) {
          audioRef.current.play().catch(() => {});
          pausedByTtsRef.current = false;
          setIsPlaying(true);
        }
      } catch (e) {}
    };

    window.addEventListener('cloud-tts:generating', onGenerating as EventListener);
    window.addEventListener('cloud-tts:generated', resumeIfPaused as EventListener);
    window.addEventListener('cloud-tts:playback-ended', resumeIfPaused as EventListener);
    window.addEventListener('cloud-tts:error', resumeIfPaused as EventListener);

    return () => {
      window.removeEventListener('cloud-tts:generating', onGenerating as EventListener);
      window.removeEventListener('cloud-tts:generated', resumeIfPaused as EventListener);
      window.removeEventListener('cloud-tts:playback-ended', resumeIfPaused as EventListener);
      window.removeEventListener('cloud-tts:error', resumeIfPaused as EventListener);
    };
  }, []);

  // Cleanup previous audio when switching podcasts: pause and clear audio element and timers
  // Only run when panel is open to avoid unnecessary teardown during closed state transitions
  useEffect(() => {
    if (!isOpen) return;
    // This runs on podcast.id change; pause/clear any previously playing audio
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        // remove event handlers to avoid stray callbacks
        try {
          (audioRef.current as any).onloadedmetadata = null;
          (audioRef.current as any).ontimeupdate = null;
          (audioRef.current as any).onended = null;
          (audioRef.current as any).onerror = null;
        } catch (e) {}
      } catch (e) {
        // ignore
      }
      try {
        const obj = (audioRef.current as any)?._objectUrl;
        if (obj) {
          try { URL.revokeObjectURL(obj); } catch (e) {}
        }
      } catch (e) {}
      // Mark existing audio as stale so initialization can replace it.
      audioStaleRef.current = true;
    }

    if (audioLoadTimeoutRef.current) {
      window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = null;
    }

    // Reset playback UI state for new podcast
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setFullAudioProgress(0);
    setReplay(false);
    setCurrentSegmentIndex(0);
    // Clear visual assets immediately to avoid showing previous podcast images
    setCurrentImage(null);
    setDisplayedVisualAsset(null);
    setPrevVisualAsset(null);
    // Mark that we are switching podcasts for a short window to suppress
    // transient error toasts that occur due to the old audio element being torn down.
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

    // If segments include explicit start_time/end_time use those
    const hasExplicitTimes = segments.every(s => typeof s.start_time === 'number' && typeof s.end_time === 'number');

    let progressSegments: { start: number; end: number }[] = [];

    if (hasExplicitTimes) {
      progressSegments = segments.map(s => ({ start: s.start_time || 0, end: s.end_time || 0 }));
    } else {
      // Fallback: use podcast.duration (minutes) converted to seconds, or fullAudioDuration (seconds)
      const total = (podcast?.duration ? (podcast.duration * 60) : fullAudioDuration) || 0;
      const segmentDuration = total > 0 ? total / segments.length : 0;
      progressSegments = segments.map((_, index) => {
        const start = index * segmentDuration;
        const end = (index + 1) * segmentDuration;
        return { start, end };
      });
    }

    setSegmentsProgress(progressSegments);
  }, [podcast?.audioSegments, fullAudioDuration]);

  // Recalculate segments progress whenever segments, podcast duration, or full audio duration change
  useEffect(() => {
    if (!isOpen) return;
    if (!podcast) return;
    calculateSegmentsProgress();
  }, [isOpen, podcast?.audioSegments, podcast?.duration, fullAudioDuration, calculateSegmentsProgress, isSegmentsLoaded]);

  // Set initial image when podcast loads
  useEffect(() => {
    if (!isOpen) return;
    if (podcast?.visual_assets && podcast.visual_assets.length > 0) {
      const firstImage = podcast.visual_assets.find(asset => 
        asset.type === 'image' && asset.segmentIndex === 0
      ) || podcast.visual_assets[0];
      
      setCurrentImage(firstImage);
      setDisplayedVisualAsset(firstImage);
    } else if (podcast?.cover_image_url) {
      setCurrentImage({
        type: 'image',
        url: podcast.cover_image_url,
        concept: podcast.title
      });
      setDisplayedVisualAsset({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
    } else {
      // Clear any previous image when podcast has no visuals
      setCurrentImage(null);
      setDisplayedVisualAsset(null);
      setPrevVisualAsset(null);
    }
  }, [isOpen, podcast]);

  // Update image when segment changes (for segmented audio)
  useEffect(() => {
    if (!isOpen) return;
    if (!isSingleAudio && podcast?.visual_assets && podcast.visual_assets.length > 0) {
      const imageAssets = podcast.visual_assets.filter(asset => 
        asset.type === 'image' && asset.segmentIndex !== undefined
      );

      // Only change image when there is an asset that matches the current segment index.
      // If no asset matches, keep the last rendered asset.
      const matchingAsset = imageAssets.find(asset => asset.segmentIndex === currentSegmentIndex);
      if (matchingAsset) {
        const currentUrl = currentImage?.url || (currentImage as any)?.url;
        const newUrl = matchingAsset.url;
        if (newUrl && newUrl !== currentUrl) {
          // cross-fade: keep previous, display new, animate opacity
          setPrevVisualAsset(displayedVisualAsset);
          setDisplayedVisualAsset(matchingAsset);
          setCurrentImage(matchingAsset);
          setCurrentImageVisible(false);
          // trigger fade-in on next tick
          window.setTimeout(() => setCurrentImageVisible(true), 20);
          // clear prev after transition completes
          window.setTimeout(() => setPrevVisualAsset(null), 650);
        }
      }
    }
  }, [isOpen, currentSegmentIndex, podcast?.visual_assets, isSingleAudio]);

  // Reset loading states when podcast changes
  useEffect(() => {
    if (!isOpen) return;
    if (podcast) {
      setIsPodcastDataLoaded(false);
      setIsSegmentsLoaded(false);
      setLoadingAudio(true);
      
      // Simulate data loading
      const timer = setTimeout(() => {
        setIsPodcastDataLoaded(true);
        // Consider segments loaded if we have parsed segments, or a derived full audio URL
        const hasParsedSegments = podcast.audioSegments?.length > 0;
        const hasDerivedFullAudio = !!derivedFullAudioUrl;
        let hasRawSegmentsWithAudio = false;
        if ((podcast as any).audio_segments) {
          try {
            const parsed = typeof (podcast as any).audio_segments === 'string'
              ? JSON.parse((podcast as any).audio_segments)
              : (podcast as any).audio_segments || [];
            hasRawSegmentsWithAudio = Array.isArray(parsed) && parsed.length > 0 && !!parsed[0].audio_url;
          } catch (e) {
            hasRawSegmentsWithAudio = false;
          }
        }

        if (hasParsedSegments || hasDerivedFullAudio || hasRawSegmentsWithAudio) {
          setIsSegmentsLoaded(true);
        }
        setLoadingAudio(false);
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      setIsPodcastDataLoaded(false);
      setIsSegmentsLoaded(false);
    }
  }, [podcast?.id, isOpen]);

  // Also watch for updates to segments/raw audio and clear loading when they arrive
  useEffect(() => {
    if (!isOpen) return;
    if (!podcast) return;

    const hasParsedSegments = podcast.audioSegments?.length > 0;
    let hasRawSegmentsWithAudio = false;
    if ((podcast as any).audio_segments) {
      try {
        const parsed = typeof (podcast as any).audio_segments === 'string'
          ? JSON.parse((podcast as any).audio_segments)
          : (podcast as any).audio_segments || [];
        hasRawSegmentsWithAudio = Array.isArray(parsed) && parsed.length > 0 && !!parsed[0].audio_url;
      } catch (e) {
        hasRawSegmentsWithAudio = false;
      }
    }

    if (!isSegmentsLoaded && (hasParsedSegments || hasRawSegmentsWithAudio || !!derivedFullAudioUrl)) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-////console
        ////console.debug('PodcastPanel: segments became available', { id: podcast.id, hasParsedSegments, hasRawSegmentsWithAudio, derivedFullAudioUrl });
      }
      setIsSegmentsLoaded(true);
      setLoadingAudio(false);
      if (audioLoadTimeoutRef.current) {
        window.clearTimeout(audioLoadTimeoutRef.current);
        audioLoadTimeoutRef.current = null;
      }
    }
  }, [isOpen, podcast?.audioSegments, podcast ? (podcast as any).audio_segments : undefined, derivedFullAudioUrl]);

  // Attach scroll/interaction listeners to transcript container to detect manual scrolling
  useEffect(() => {
    if (!isOpen) return;
    const el = transcriptContainerRef.current;
    if (!el) return;

    const onUserInteract = () => markUserInteraction();
    el.addEventListener('wheel', onUserInteract, { passive: true });
    el.addEventListener('touchstart', onUserInteract, { passive: true });
    el.addEventListener('pointerdown', onUserInteract, { passive: true });
    el.addEventListener('scroll', onUserInteract, { passive: true });

    return () => {
      el.removeEventListener('wheel', onUserInteract);
      el.removeEventListener('touchstart', onUserInteract);
      el.removeEventListener('pointerdown', onUserInteract);
      el.removeEventListener('scroll', onUserInteract);
      if (userInteractTimeoutRef.current) {
        window.clearTimeout(userInteractTimeoutRef.current);
        userInteractTimeoutRef.current = null;
      }
    };
  }, [isOpen, showTranscript, isSegmentsLoaded, markUserInteraction]);

  // Auto-scroll the active transcript segment into view when currentSegmentIndex changes,
  // but avoid doing so if the user is interacting (manual scroll) to prevent interrupting them.
  useEffect(() => {
    if (!isOpen) return;
    if (!showTranscript || !isSegmentsLoaded) return;
    const container = transcriptContainerRef.current;
    const active = segmentRefs.current[currentSegmentIndex];
    if (!container || !active) return;

    // If user is interacting, skip auto-scroll
    if (userInteractingRef.current) return;

    // If already fully visible, skip scrolling
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const padding = 8;
    if (aRect.top >= cRect.top + padding && aRect.bottom <= cRect.bottom - padding) {
      return;
    }

    try {
      active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      // fallback: set scrollTop
      const offset = active.offsetTop - (container.clientHeight / 2) + (active.clientHeight / 2);
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [currentSegmentIndex, showTranscript, isSegmentsLoaded]);

  // Show controls on mouse move in video area
  const handleVideoAreaMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
      controlsTimeoutRef.current = null;
    }, 3000) as unknown as number;
  };

  // Touch events for mobile
  const handleTouchStart = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      controlsTimeoutRef.current = null;
    }, 3000) as unknown as number;
  };

  const handleControlsMouseEnter = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  };

  const handleControlsMouseLeave = () => {
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
      controlsTimeoutRef.current = null;
    }, 3000) as unknown as number;
  };

  // Handle close with audio cleanup
  const handleClose = () => {
    try {
      // Pause and clear audio
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (e) {}
        try {
          const obj = (audioRef.current as any)?._objectUrl;
          if (obj) { try { URL.revokeObjectURL(obj); } catch (e) {} }
        } catch (e) {}
        audioRef.current = null;
      }

      // Pause and clear video
      if (videoRef.current) {
        try { videoRef.current.pause(); } catch (e) {}
        try {
          const vobj = (videoRef.current as any)?._objectUrl;
          if (vobj) { try { URL.revokeObjectURL(vobj); } catch (e) {} }
        } catch (e) {}
        try { videoRef.current.src = ''; } catch (e) {}
        videoRef.current = null;
      }

      // Clear timers and timeouts
      if (controlsTimeoutRef.current) { window.clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = null; }
      if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
      if (switchingPodcastRef.current.timeout) { window.clearTimeout(switchingPodcastRef.current.timeout as number); switchingPodcastRef.current.timeout = null; }
      if (userInteractTimeoutRef.current) { window.clearTimeout(userInteractTimeoutRef.current); userInteractTimeoutRef.current = null; }

      // Reset UI state
      setIsPlaying(false);
      setIsMuted(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      setFullAudioDuration(0);
      setFullAudioProgress(0);
      setCurrentSegmentIndex(0);
      setSegmentsProgress([]);
      setIsPodcastDataLoaded(false);
      setIsSegmentsLoaded(false);
      setLoadingAudio(false);
      setMediaLoading(false);
      setPlaybackSrc(null);
      setDisplayedVisualAsset(null);
      setPrevVisualAsset(null);
      setCurrentImage(null);
      setRelatedPodcasts([]);
      setRelatedPage(0);
      setRelatedHasMore(false);
      setListenersList([]);
      setListenersPage(0);
      setListenersHasMore(false);
      setCreatorInfo(null);
      setShowTranscript(false);
      setShowControls(false);
    } catch (e) {
      // swallow any errors during cleanup
    }

    onClose();
  };

  // Fetch creator info
  useEffect(() => {
    if (!isOpen) return;
    const fetchCreatorInfo = async () => {
      if (!podcast?.user_id) return;
      
      try {
        const { data: socialUserData } = await supabase
          .from('social_users')
          .select('display_name, avatar_url, username')
          .eq('id', podcast.user_id)
          .single();

        if (socialUserData) {
          setCreatorInfo({
            full_name: socialUserData.display_name || 'Creator',
            avatar_url: socialUserData.avatar_url,
            username: socialUserData.username || ''
          });
        } else {
          const { data: socialFallback } = await supabase
              .from('social_users')
              .select('display_name, avatar_url, username')
              .eq('id', podcast.user_id)
              .single();

            if (socialFallback) {
              setCreatorInfo({
                full_name: socialFallback.display_name || 'Creator',
                avatar_url: socialFallback.avatar_url,
                username: socialFallback.username || ''
              });
            }
        }
      } catch (error) {
        ////console.error('Error fetching creator info:', error);
        setCreatorInfo({
          full_name: 'Creator',
          avatar_url: undefined,
          username: ''
        });
      }
    };

    fetchCreatorInfo();
  }, [isOpen, podcast?.user_id]);

  // Fetch related podcasts
  // Paginated fetch for related podcasts
  const RELATED_PAGE_SIZE = 6;
  const fetchRelatedPage = async (page: number) => {
    if (!podcast || relatedLoadingRef.current) return;
    relatedLoadingRef.current = true;
    setRelatedLoading(true);
    try {
      const start = page * RELATED_PAGE_SIZE;
      const end = start + RELATED_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('ai_podcasts')
        .select(`
          id,
          title,
          description,
          cover_image_url,
          listen_count,
          created_at,
          duration_minutes,
          user_id
        `)
        .eq('is_public', true)
        .eq('status', 'completed')
        .neq('id', podcast.id)
        .order('listen_count', { ascending: false })
        .range(start, end);

      if (error) throw error;
      const rows = data || [];
      setRelatedPodcasts(prev => {
        const merged = page === 0 ? rows : [...prev, ...rows];
        const byId = new Map<string, any>();
        merged.forEach(r => { if (r && r.id) byId.set(r.id, r); });
        return Array.from(byId.values());
      });
      setRelatedHasMore(rows.length === RELATED_PAGE_SIZE);
      setRelatedPage(page);
    } catch (err) {
      ////console.error('Error fetching related podcasts (page):', err);
      // stop further attempts on error to avoid flooding ////console
      setRelatedHasMore(false);
    } finally {
      relatedLoadingRef.current = false;
      setRelatedLoading(false);
    }
  };

  // Paginated fetch for listeners (users who listened to this podcast)
  const LISTENERS_PAGE_SIZE = 12;
  const fetchListenersPage = async (page: number) => {
    if (!podcast || listenersLoadingRef.current) return;
    listenersLoadingRef.current = true;
    setListenersLoading(true);
    try {
      const start = page * LISTENERS_PAGE_SIZE;
      const end = start + LISTENERS_PAGE_SIZE - 1;
      // Two-step safe fetch: 1) fetch paginated listener user_ids, 2) fetch users by id
      let rows: any[] = [];
      const { data: idsData, error: idsErr } = await supabase
        .from('podcast_listeners')
        .select('user_id')
        .eq('podcast_id', podcast.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (idsErr) throw idsErr;
      const userIds = (idsData || []).map((r: any) => r.user_id).filter(Boolean);

      if (userIds.length === 0) {
        // no listeners on this page
        rows = [];
        setListenersList(prev => page === 0 ? rows : [...prev, ...rows]);
        setListenersHasMore(false);
        setListenersPage(page);
        listenersLoadingRef.current = false;
        setListenersLoading(false);
        return;
      }

      const { data: usersData, error: usersErr } = await supabase
        .from('social_users')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (usersErr) throw usersErr;

      // preserve ordering based on userIds
      const usersById = new Map((usersData || []).map((u: any) => [u.id, u]));
      rows = userIds.map((id: any) => usersById.get(id)).filter(Boolean);
      setListenersList(prev => {
        const merged = page === 0 ? rows : [...prev, ...rows];
        // preserve order but dedupe by id
        const seen = new Set<any>();
        const unique = [] as any[];
        merged.forEach(u => {
          const id = u?.id || u;
          if (!id) return;
          if (!seen.has(id)) {
            seen.add(id);
            unique.push(u);
          }
        });
        return unique;
      });
      setListenersHasMore(rows.length === LISTENERS_PAGE_SIZE);
      setListenersPage(page);
    } catch (err) {
      ////console.error('Error fetching listeners page:', err);
      // stop further paging when errors occur
      setListenersHasMore(false);
    } finally {
      listenersLoadingRef.current = false;
      setListenersLoading(false);
    }
  };

  // Initialize pages when podcast changes
  useEffect(() => {
    if (!isOpen) return;
    if (!podcast) return;
    setRelatedPodcasts([]);
    setRelatedPage(0);
    setRelatedHasMore(true);
    fetchRelatedPage(0);

    setListenersList([]);
    setListenersPage(0);
    setListenersHasMore(true);
    fetchListenersPage(0);
  }, [podcast?.id, isOpen]);

  // IntersectionObserver to load more related podcasts when sentinel visible
  useEffect(() => {
    if (!isOpen) return;
    if (!relatedHasMore) return;
    const node = relatedSentinelRef.current;
    const rootEl = relatedContainerRef.current || null;
    if (!node) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !relatedLoadingRef.current) {
          fetchRelatedPage(relatedPage + 1);
        }
      });
    }, { root: rootEl, rootMargin: '200px', threshold: 0.1 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [isOpen, relatedSentinelRef.current, relatedPage, relatedHasMore]);

  // IntersectionObserver to load more listeners (observe inside the listeners scroll container)
  useEffect(() => {
    if (!isOpen) return;
    if (!listenersHasMore) return;
    const node = listenersSentinelRef.current;
    const rootEl = listenersContainerRef.current || null;
    if (!node) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !listenersLoadingRef.current) {
          fetchListenersPage(listenersPage + 1);
        }
      });
    }, { root: rootEl, rootMargin: '200px', threshold: 0.1 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [isOpen, listenersSentinelRef.current, listenersPage, listenersHasMore]);

  // Play single continuous audio
  const playFullAudio = useCallback(async () => {
    if (!derivedFullAudioUrl) {
      toast.error('No audio available');
      return;
    }
    setLoadingAudio(true);
    setMediaLoading(true);

    try {
      // Resolve signed URL if needed
      const resolveUrl = async (url?: string | null) => {
        if (!url) return undefined;
        try {
          const idx = url.indexOf('/podcasts/');
          if (idx === -1) return url;
          const path = url.substring(idx + '/podcasts/'.length);
          const cached = signedUrlCacheRef.current.get(path);
          if (cached) return cached;
          const { data, error } = await supabase.storage.from('podcasts').createSignedUrl(path, 3600);
          if (error) throw error;
          const signed = (data && (data.signedUrl || (data as any).signedURL || (data as any).signed_url));
          if (signed) {
            signedUrlCacheRef.current.set(path, signed);
            return signed;
          }
          return url;
        } catch (e) {
          //console.warn('[PodcastPanel] Signed URL resolution failed, falling back to original url', e);
          return url;
        }
      };

      const resolved = await resolveUrl(derivedFullAudioUrl as string);

      // If this podcast is video, use the visible video player
      if (podcast?.podcast_type === 'video') {
        setPlaybackSrc(resolved || null);
        // stop any existing audio
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch (e) {}
          audioRef.current = null;
        }

        // Configure video element (if present)
        const vid = videoRef.current;
        if (!vid) {
          throw new Error('Video element not available');
        }
        vid.src = resolved || '';
        vid.playbackRate = playbackSpeed;
        vid.muted = isMuted;

        vid.onloadedmetadata = () => {
          setFullAudioDuration(vid.duration || 0);
          setDuration(vid.duration || 0);
          setLoadingAudio(false);
          setMediaLoading(false);
        };

        vid.ontimeupdate = () => {
          const current = vid.currentTime;
          setCurrentTime(current);
          setFullAudioProgress(current);
          if (vid.duration > 0) {
            const progress = (current / vid.duration) * 100;
            setProgress(progress);
            if (podcast.audioSegments?.length > 0) {
              const segmentIndex = Math.floor((current / vid.duration) * podcast.audioSegments.length);
              setCurrentSegmentIndex(segmentIndex);
            }
          }
        };

        vid.onended = () => {
          setIsPlaying(false);
          setProgress(100);
          setCurrentTime(vid.duration || 0);
          setFullAudioProgress(vid.duration || 0);
          setReplay(true);
          if (podcast?.cover_image_url) {
            setCurrentImage({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
          }
        };

        vid.onerror = (e) => {
          if (!switchingPodcastRef.current.active) toast.error('Video unavailable – contact support');
          setLoadingAudio(false);
          setMediaLoading(false);
          setIsPlaying(false);
        };

        try {
          await vid.play();
        } catch (err) {
          // fetch fallback
          try {
            const resp = await fetch(resolved as string, { mode: 'cors' });
            if (!resp.ok) throw new Error('Fetch failed');
            const blob = await resp.blob();
            const objectUrl = URL.createObjectURL(blob);
            vid.src = objectUrl;
            (vid as any)._objectUrl = objectUrl;
            await vid.play();
          } catch (fetchErr) {
            throw fetchErr;
          }
        }

        setIsPlaying(true);
        return;
      }

      // AUDIO flow (fallback / default)
      // Use existing hidden audio element when available to avoid creating multiple
      // detached Audio() instances which can cause playback races in some browsers.
      let audioEl: HTMLAudioElement | HTMLAudioElement | null = null;
      if (audioRef.current && (audioRef.current instanceof HTMLAudioElement)) {
        audioEl = audioRef.current as HTMLAudioElement;
      } else if (audioRef.current && (audioRef.current as any).tagName === 'AUDIO') {
        audioEl = audioRef.current as HTMLAudioElement;
      } else {
        // If ref was replaced with a programmatic Audio, keep using it
        if (audioRef.current && (audioRef.current as any).src) {
          audioEl = audioRef.current as unknown as HTMLAudioElement;
        } else {
          // Fallback: create a new audio element and attach to ref
          const created = new Audio();
          audioRef.current = created as any;
          audioEl = created as HTMLAudioElement;
        }
      }

      // Assign source and configure
      try {
        audioEl.pause();
      } catch (e) {}
      audioEl.src = resolved as string;
      audioEl.playbackRate = playbackSpeed;
      audioEl.muted = isMuted;

      audioEl.onloadedmetadata = () => {
        setFullAudioDuration(audioEl!.duration);
        setDuration(audioEl!.duration);
        setLoadingAudio(false);
        setMediaLoading(false);
        if (audioLoadTimeoutRef.current) {
          window.clearTimeout(audioLoadTimeoutRef.current);
          audioLoadTimeoutRef.current = null;
        }
      };

      audioEl.ontimeupdate = () => {
        const current = audioEl!.currentTime;
        setCurrentTime(current);
        setFullAudioProgress(current);
        if (audioEl!.duration > 0) {
          const progress = (current / audioEl!.duration) * 100;
          setProgress(progress);
          if (podcast.audioSegments?.length > 0) {
            const segmentIndex = Math.floor((current / audioEl!.duration) * podcast.audioSegments.length);
            setCurrentSegmentIndex(segmentIndex);
          }
        }
      };

      audioEl.onended = () => {
        setIsPlaying(false);
        setProgress(100);
        setCurrentTime(audioEl!.duration);
        setFullAudioProgress(audioEl!.duration);
        setReplay(true);
        if (podcast?.cover_image_url) {
          setCurrentImage({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
        }
      };

      audioEl.onerror = (e) => {
        if (!switchingPodcastRef.current.active) toast.error('Failed to load audio');
        setLoadingAudio(false);
        setMediaLoading(false);
        if (audioLoadTimeoutRef.current) {
          window.clearTimeout(audioLoadTimeoutRef.current);
          audioLoadTimeoutRef.current = null;
        }
        setIsPlaying(false);
      };

      audioStaleRef.current = false;
      setReplay(false);

      try {
        await audioEl.play();
      } catch (err: any) {
        try {
          const resp = await fetch(resolved as string, { mode: 'cors' });
          if (!resp.ok) throw new Error('Fetch failed');
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          audioEl.src = objectUrl;
          (audioEl as any)._objectUrl = objectUrl;
          await audioEl.play();
        } catch (fetchErr: any) {
          throw fetchErr;
        }
      }

      if (audioLoadTimeoutRef.current) window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = window.setTimeout(() => {
        setLoadingAudio(false);
      }, 2000) as unknown as number;
      setIsPlaying(true);

    } catch (error: any) {
      if (!switchingPodcastRef.current.active) toast.error('Failed to play media: ' + (error.message || 'Unknown error'));
      setLoadingAudio(false);
      setMediaLoading(false);
      setIsPlaying(false);
    }
  }, [podcast, playbackSpeed, isMuted]);

  // Play segment (for segmented audio)
  const playSegment = useCallback(async (segmentIndex: number, opts?: { autoAdvance?: boolean }) => {
    // Check if segments are loaded
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (!podcast?.audioSegments[segmentIndex]) {
      toast.error('Segment not available');
      return;
    }

    // Only show loader for user-initiated segment changes. When auto-advancing
    // between segments we keep `isPlaying` true and avoid showing the loader
    // to provide a seamless transition.
    if (!opts?.autoAdvance) setLoadingAudio(true);
    // Reset playback timing state immediately when starting a new segment
    // to avoid briefly displaying leftover time from the previous segment.
    setCurrentTime(0);
    setProgress(0);
    setDuration(0);
    const segment = podcast.audioSegments[segmentIndex];

    try {
      let sourceUrl: string | undefined;

      // Prefer audio_url
      if (segment.audio_url) {
        sourceUrl = segment.audio_url;
      } else if (segment.audioContent) {
        const cleanedAudio = segment.audioContent.replace(/`/g, '').trim();
        sourceUrl = `data:audio/mp3;base64,${cleanedAudio}`;
      } else {
        toast.error('No audio source available for this segment');
        setLoadingAudio(false);
        return;
      }

      // Resolve signed url when possible
      const resolveUrl = async (url?: string) => {
        if (!url) return undefined;
        try {
          const idx = url.indexOf('/podcasts/');
          if (idx === -1) return url;
          const path = url.substring(idx + '/podcasts/'.length);
          const cached = signedUrlCacheRef.current.get(path);
          if (cached) return cached;
          const { data, error } = await supabase.storage.from('podcasts').createSignedUrl(path, 3600);
          if (error) throw error;
          const signed = (data && (data.signedUrl || (data as any).signedURL || (data as any).signed_url));
          if (signed) {
            signedUrlCacheRef.current.set(path, signed);
            return signed;
          }
          return url;
        } catch (e) {
          //console.warn('[PodcastPanel] Signed URL resolution failed for segment', e);
          return url;
        }
      };

      const resolved = await resolveUrl(sourceUrl as string);

      // If podcast is video, use video player
      if (podcast?.podcast_type === 'video') {
        const vid = videoRef.current;
        if (!vid) throw new Error('Video element not available');
        setPlaybackSrc(resolved || null);
        vid.src = resolved || '';
        vid.playbackRate = playbackSpeed;
        vid.muted = isMuted;

        vid.onloadedmetadata = () => {
          setDuration(vid.duration || 0);
          setLoadingAudio(false);
        };

        vid.ontimeupdate = () => {
          setCurrentTime(vid.currentTime);
          if (vid.duration > 0) setProgress((vid.currentTime / vid.duration) * 100);
        };

        vid.onended = () => {
          setProgress(100);
          setCurrentTime(vid.duration || 0);
          if (segmentIndex < (podcast.audioSegments?.length || 0) - 1) {
            autoAdvancingRef.current = true;
            setTimeout(() => {
              setCurrentSegmentIndex(segmentIndex + 1);
              playSegment(segmentIndex + 1, { autoAdvance: true }).catch(console.error).finally(() => {
                window.setTimeout(() => { autoAdvancingRef.current = false; }, 700);
              });
            }, 500);
          } else {
            setIsPlaying(false);
            setReplay(true);
            if (podcast?.cover_image_url) setCurrentImage({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
          }
        };

        vid.onerror = (e) => {
          if (!switchingPodcastRef.current.active) toast.error('Video unavailable – contact support');
          setLoadingAudio(false);
          setIsPlaying(false);
        };

        setCurrentSegmentIndex(segmentIndex);
        setReplay(false);
        try { await vid.play(); } catch (err) {
          try {
            const resp = await fetch(resolved as string, { mode: 'cors' });
            if (!resp.ok) throw new Error('Fetch failed');
            const blob = await resp.blob();
            const objectUrl = URL.createObjectURL(blob);
            vid.src = objectUrl;
            (vid as any)._objectUrl = objectUrl;
            await vid.play();
          } catch (fetchErr) { throw fetchErr; }
        }

        setIsPlaying(true);
        return;
      }

      // Audio flow — reuse hidden DOM audio element when possible to avoid races
      let audioEl: HTMLAudioElement | null = null;
      if (audioRef.current && (audioRef.current instanceof HTMLAudioElement)) {
        audioEl = audioRef.current as HTMLAudioElement;
      } else if (audioRef.current && (audioRef.current as any).src) {
        audioEl = audioRef.current as unknown as HTMLAudioElement;
      } else {
        // create fallback audio and attach to ref
        const created = new Audio();
        audioRef.current = created as any;
        audioEl = created as HTMLAudioElement;
      }

      try {
        audioEl.pause();
      } catch (e) {}
      audioEl.src = resolved as string;
      audioEl.playbackRate = playbackSpeed;
      audioEl.muted = isMuted;

      audioEl.onloadedmetadata = () => {
        setDuration(audioEl!.duration);
        setLoadingAudio(false);
        if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
      };

      audioEl.ontimeupdate = () => {
        setCurrentTime(audioEl!.currentTime);
        if (audioEl!.duration > 0) setProgress((audioEl!.currentTime / audioEl!.duration) * 100);
      };

      audioEl.onended = () => {
        setProgress(100);
        setCurrentTime(audioEl!.duration);
        if (segmentIndex < (podcast.audioSegments?.length || 0) - 1) {
          autoAdvancingRef.current = true;
          setTimeout(() => {
            setCurrentSegmentIndex(segmentIndex + 1);
            playSegment(segmentIndex + 1, { autoAdvance: true }).catch(console.error).finally(() => {
              window.setTimeout(() => { autoAdvancingRef.current = false; }, 700);
            });
          }, 500);
        } else {
          setIsPlaying(false);
          setReplay(true);
          if (podcast?.cover_image_url) setCurrentImage({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
        }
      };

      audioEl.onerror = (e) => {
        if (!switchingPodcastRef.current.active) toast.error('Failed to load audio segment');
        setLoadingAudio(false);
        if (audioLoadTimeoutRef.current) { window.clearTimeout(audioLoadTimeoutRef.current); audioLoadTimeoutRef.current = null; }
        setIsPlaying(false);
      };

      audioStaleRef.current = false;
      setCurrentSegmentIndex(segmentIndex);
      setReplay(false);

      try { await audioEl.play(); } catch (err) {
        try {
          const resp = await fetch(resolved as string, { mode: 'cors' });
          if (!resp.ok) throw new Error('Fetch failed');
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          audioEl.src = objectUrl;
          (audioEl as any)._objectUrl = objectUrl;
          await audioEl.play();
        } catch (fetchErr) { throw fetchErr; }
      }

      if (audioLoadTimeoutRef.current) window.clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = window.setTimeout(() => { setLoadingAudio(false); }, 2000) as unknown as number;
      setIsPlaying(true);

    } catch (error: any) {
      if (!switchingPodcastRef.current.active) toast.error('Failed to play media: ' + (error.message || 'Unknown error'));
      setLoadingAudio(false);
      setIsPlaying(false);
    }
  }, [podcast, playbackSpeed, isMuted, isSegmentsLoaded]);

  // Initialize playback on podcast load
  useEffect(() => {
    if (!isOpen) return;
    if (!isSegmentsLoaded) return;
    // If audio is already initialized or playing, avoid re-initializing
    // This prevents interrupting an in-progress segment when segments become available
    if ((audioRef.current && !audioStaleRef.current) || isPlaying) {
      return;
    }
    if (isSingleAudio && derivedFullAudioUrl) {
      playFullAudio().catch(console.error);
    } else if (podcast?.audioSegments?.length > 0) {
      playSegment(0).catch(console.error);
    }
  }, [isOpen, podcast?.id, isSegmentsLoaded, isSingleAudio]);

  // Handle play/pause
  const handlePlayPause = () => {
    // Check if segments are loaded
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (replay) {
      setReplay(false);
      if (isSingleAudio) {
        playFullAudio();
      } else {
        playSegment(0);
      }
      return;
    }

    if (!audioRef.current) {
      if (isSingleAudio) {
        playFullAudio();
      } else {
        playSegment(currentSegmentIndex);
      }
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

  // Handle next/previous segment
  const handleNextSegment = () => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segmentCount = podcast?.audioSegments?.length || 1;
        const segmentDuration = fullAudioDuration / segmentCount;
        const nextTime = audioRef.current.currentTime + segmentDuration;
        
        if (nextTime < fullAudioDuration) {
          audioRef.current.currentTime = nextTime;
        } else {
          audioRef.current.currentTime = fullAudioDuration - 0.1;
        }
      }
    } else if (podcast && currentSegmentIndex < podcast.audioSegments.length - 1) {
      playSegment(currentSegmentIndex + 1);
    } else {
      toast.info('This is the last segment');
    }
  };

  const handlePreviousSegment = () => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segmentCount = podcast?.audioSegments?.length || 1;
        const segmentDuration = fullAudioDuration / segmentCount;
        const prevTime = audioRef.current.currentTime - segmentDuration;
        
        if (prevTime > 0) {
          audioRef.current.currentTime = prevTime;
        } else {
          audioRef.current.currentTime = 0;
        }
      }
    } else if (currentSegmentIndex > 0) {
      playSegment(currentSegmentIndex - 1);
    } else {
      toast.info('This is the first segment');
    }
  };

  // Handle speed change
  const handleSpeedChange = () => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
    
    toast.info(`Playback speed: ${newSpeed}x`);
  };

  // Handle progress bar click (YouTube-style segmented navigation)
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    
    if (isSingleAudio) {
      // Single audio - jump to specific time
      const newTime = percentage * fullAudioDuration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setFullAudioProgress(newTime);
      setProgress(percentage * 100);
    } else {
      // Segmented audio - jump to specific segment
      const segmentCount = podcast?.audioSegments?.length || 1;
      const segmentIndex = Math.floor(percentage * segmentCount);
      if (segmentIndex < segmentCount) {
        playSegment(segmentIndex);
      }
    }
  };

  // Handle segment progress bar click (click on specific segment)
  const handleSegmentProgressClick = (segmentIndex: number) => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (isSingleAudio) {
      if (audioRef.current && fullAudioDuration > 0) {
        const segmentCount = podcast?.audioSegments?.length || 1;
        const segmentDuration = fullAudioDuration / segmentCount;
        const segmentStartTime = segmentIndex * segmentDuration;
        
        audioRef.current.currentTime = segmentStartTime;
        setCurrentTime(segmentStartTime);
        setFullAudioProgress(segmentStartTime);
        setProgress((segmentStartTime / fullAudioDuration) * 100);
      }
    } else {
      playSegment(segmentIndex);
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle share
  const handleShare = async () => {
    if (!podcast) return;

    try {
      const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: podcast.title,
          text: `Check out this podcast: ${podcast.title}`,
          url: podcastUrl,
        });
      } else {
        await navigator.clipboard.writeText(podcastUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      ////console.error('Error sharing:', error);
    }
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (!isSegmentsLoaded) {
      toast.error('Audio segments are still loading. Please wait.');
      return;
    }

    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Mobile compact controls with media type label
  const MobileControls = () => {
    // Determine media type label
    let mediaTypeLabel = '';
    if (podcast?.podcast_type === 'video') {
      mediaTypeLabel = podcast?.is_live ? 'Live Video' : 'Video';
    } else if (podcast?.podcast_type === 'audio') {
      mediaTypeLabel = podcast?.is_live ? 'Live Audio' : 'Audio';
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 dark:bg-gray-800 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousSegment}
              disabled={loadingAudio || !isSegmentsLoaded}
              className="h-8 w-8 text-dark dark:text-white"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              onClick={handlePlayPause}
              size="icon"
              className="h-12 w-12 bg-red-600 hover:bg-red-700 text-white rounded-full"
              disabled={loadingAudio || !isSegmentsLoaded}
            >
              {loadingAudio ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : replay ? (
                <RefreshCcw className="h-6 w-6" />
              ) : isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextSegment}
              disabled={!podcast || loadingAudio || !isSegmentsLoaded}
              className="h-8 w-8 text-dark dark:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            {/* Live Caption Button for mobile */}
            {podcast?.is_live && (
              <Button
                variant={showLiveCaptions ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowLiveCaptions(v => !v)}
                className={showLiveCaptions ? 'bg-blue-600 text-white' : ''}
                title={showLiveCaptions ? 'Hide Live Captions' : 'Show Live Captions'}
              >
                <Captions className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 min-w-[70px]">
          <span className="dark:text-white text-dark text-xs font-semibold leading-tight">
            {mediaTypeLabel}
          </span>
          <div className="flex items-center gap-2">
            <span className="dark:text-white text-dark text-sm">
              {currentSegmentIndex + 1}/{podcast?.audioSegments?.length || 0}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleMute}
              className="h-8 w-8 dark:text-white text-dark"
              disabled={!isSegmentsLoaded}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // YouTube-style segmented progress bar component
  const SegmentedProgressBar = () => {
    const segmentCount = podcast?.audioSegments?.length || 1;

    // Determine totalDuration for overall progress
    let totalDuration = 0;
    if (isSingleAudio) {
      totalDuration = fullAudioDuration || 0;
    } else if (segmentsProgress && segmentsProgress.length > 0) {
      // If segments have explicit times, use the max end value (handles absolute end times)
      const maxEnd = Math.max(...segmentsProgress.map(s => s.end || 0));
      if (maxEnd > 0) {
        totalDuration = maxEnd;
      } else {
        // Fallback: sum segment lengths or use podcast.duration/duration
        totalDuration = segmentsProgress.reduce((sum, s) => sum + (s.end - s.start), 0) || podcast?.duration || duration || 0;
      }
    } else {
      totalDuration = podcast?.duration || duration || 0;
    }

    // Compute overall current progress (in seconds)
    let overallCurrent = 0;
    if (isSingleAudio) {
      overallCurrent = fullAudioProgress;
    } else {
      const segIdx = Math.min(Math.max(currentSegmentIndex, 0), segmentsProgress.length - 1);
      const segStart = segmentsProgress[segIdx]?.start || 0;
      overallCurrent = segStart + (isFinite(currentTime) ? currentTime : 0);
    }

    // Ensure current never exceeds totalDuration to avoid overfilling the bar
    const clampedCurrent = totalDuration > 0 ? Math.min(overallCurrent, totalDuration) : 0;
    const pct = totalDuration > 0 ? (clampedCurrent / totalDuration) * 100 : 0;

    return (
      <div className="relative h-2 w-full bg-gray-600 rounded-full overflow-hidden">
        {/* Overall progress background - use left/right to avoid tiny rounding gaps */}
        <div
          className="absolute h-full bg-red-600 z-20"
          style={{ left: '0%', right: `${100 - pct}%` }}
        />

        {/* Segment markers - render underneath the fill so the fill covers them when passed */}
        {segmentsProgress.map((seg, index) => {
          if (!totalDuration) return null;
          const markerPosition = (seg.end / totalDuration) * 100;
          return (
            <div
              key={index}
              className="absolute top-0 h-full w-px bg-white/30 z-10 pointer-events-none"
              style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
            />
          );
        })}

        {/* Segment clickable areas - keep these on top for interactions */}
        {segmentsProgress.map((seg, index) => {
          if (!totalDuration) return null;
          const leftPct = (seg.start / totalDuration) * 100;
          const widthPct = ((seg.end - seg.start) / totalDuration) * 100;
          return (
            <button
              key={index}
              className="absolute top-0 h-full z-30"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
              }}
              onClick={() => handleSegmentProgressClick(index)}
              title={`Jump to segment ${index + 1}`}
            />
          );
        })}
      </div>
    );
  };

  // Compute display durations for UI (full podcast duration and overall current time)
  let displayTotalDuration = 0;
  let displayCurrent = 0;
  if (!isSingleAudio && segmentsProgress && segmentsProgress.length > 0) {
    const maxEnd = Math.max(...segmentsProgress.map(s => s.end || 0));
    // podcast.duration is stored in minutes; convert to seconds for UI calculations
    displayTotalDuration = maxEnd > 0 ? maxEnd : (segmentsProgress.reduce((sum, s) => sum + (s.end - s.start), 0) || (podcast?.duration ? podcast.duration * 60 : duration) || 0);
    const segIdx = Math.min(Math.max(currentSegmentIndex, 0), segmentsProgress.length - 1);
    const segStart = segmentsProgress[segIdx]?.start || 0;
    displayCurrent = segStart + (isFinite(currentTime) ? currentTime : 0);
    displayCurrent = Math.min(displayCurrent, displayTotalDuration);
  } else if (isSingleAudio) {
    displayTotalDuration = fullAudioDuration || 0;
    displayCurrent = fullAudioProgress || 0;
  } else {
    displayTotalDuration = podcast?.duration ? podcast.duration * 60 : (duration || 0);
    displayCurrent = Math.min(currentTime || 0, displayTotalDuration);
  }

  if (!isOpen || !podcast) return null;

  const audioSegments = podcast.audioSegments || [];
  // Normalize segments so the panel can render both AI-generated and live-recorded segment shapes
  const audioSegmentsNormalized = (() => {
    const mapped = (audioSegments || []).map((s: any, idx: number) => {
      const transcriptField = s?.transcript || s?.text || s?.summary || null;
      return {
        index: typeof s?.index === 'number' ? s.index : idx,
        speaker: s?.speaker || 'Speaker',
        text: typeof s?.text === 'string' && s.text.trim() ? s.text : (typeof transcriptField === 'string' ? transcriptField : ''),
        transcript: typeof s?.transcript === 'string' ? s.transcript : (typeof transcriptField === 'string' ? transcriptField : null),
        summary: s?.summary || null,
        audio_url: s?.audio_url || s?.audioUrl || null,
        audioContent: s?.audioContent || s?.audio_content || null,
        created_at: s?.created_at || s?.createdAt || null,
        raw: s
      } as AudioSegment;
    });

    // Deduplicate by `index` to avoid rendering duplicates if the source contains repeated segments
    const seen = new Set<number>();
    return mapped.filter(seg => {
      if (seen.has(seg.index)) return false;
      seen.add(seg.index);
      return true;
    });
  })();

  const [isReprocessing, setIsReprocessing] = useState(false);

  

  const reprocessAudio = async () => {
    if (!podcast) return;
    try {
      setIsReprocessing(true);
      // find an audio URL to fetch (guard when there are no segments)
      const seg = (audioSegmentsNormalized && audioSegmentsNormalized.length > 0)
        ? (audioSegmentsNormalized.find(s => s.audio_url) || audioSegmentsNormalized[0])
        : null;
      const url = (seg && seg.audio_url) || derivedFullAudioUrl;
      if (!url) {
        toast.error('No audio URL available to reprocess');
        setIsReprocessing(false);
        return;
      }
      //console.log('Reprocessing audio, fetched URL:', url);
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error('Failed to fetch audio');
      const blob = await resp.blob();
      const seconds = await getBlobDuration(blob);
      //console.log('Reprocessed audio duration (seconds):', seconds);
      const minutes = Math.ceil((seconds || 0) / 60);
      // update DB
      try {
        await supabase.from('ai_podcasts').update({ duration_minutes: minutes }).eq('id', podcast.id);
        //console.log('Updated duration_minutes to', minutes);
      } catch (dbErr) {
        //console.warn('Failed to update duration_minutes', dbErr);
      }
      // update local UI state
      setFullAudioDuration(seconds || 0);
      setDuration(seconds || 0);

      // If no script exists, run transcription (best-effort)
      if (!podcast.script) {
        try {
          const transcription = await transcribeLivePodcast(blob as Blob, podcast.title || 'Live Podcast', Math.floor(seconds || 0), url);
          if (transcription && transcription.transcript) {
            const { data } = await supabase.auth.getUser();
            const userId = data?.user?.id || null;
            await saveTranscriptionResult(podcast.id, url || '', transcription.transcript, transcription.summary, userId, transcription.script || null);
          }
        } catch (tErr) {
          //console.warn('Reprocess transcription failed', tErr);
        }
      }

      toast.success('Audio reprocessed');
    } catch (e: any) {
      //console.error('Reprocess audio failed', e);
      toast.error('Failed to reprocess audio');
    } finally {
      setIsReprocessing(false);
    }
  };
  const tags = podcast.tags || [];
  const currentVisualAsset = displayedVisualAsset;

  return (
  <div className="fixed inset-0 z-50 bg-white dark:bg-black overflow-hidden">

    {/* Main Content - Responsive Layout */}
    <div 
      ref={mainContainerRef}
      className={`h-full flex flex-col ${isFullScreen ? 'lg:flex-col' : 'lg:flex-row'}`}
    >
      {/* Video/Image Area - Takes full width on mobile, 70% on desktop */}
      <div 
        ref={videoAreaRef}
        className={`flex-1 relative bg-white dark:bg-black overflow-hidden ${isFullScreen ? 'w-full lg:w-full' : 'lg:w-[70%]'}`}
        onMouseMove={handleVideoAreaMouseMove}
        onTouchStart={handleTouchStart}
        onClick={() => setShowControls(true)}
      >
        {/* Top Navigation - Responsive (scoped to video area so it doesn't stretch full viewport) */}
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
                <h1 className="text-xs md:text-sm font-medium truncate">
                  {!isPodcastDataLoaded ? 'Loading podcast...' : podcast.title}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10"
                disabled={!isPodcastDataLoaded}
              >
                <Share2 className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              {/* Reprocess audio fallback when duration is zero */}
              {isPodcastDataLoaded && podcast?.duration === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reprocessAudio}
                  className="ml-2 text-white border-white/30"
                  disabled={isReprocessing}
                >
                  {isReprocessing ? 'Processing…' : 'Reprocess audio'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 hidden sm:flex"
                disabled={!isPodcastDataLoaded}
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4 md:h-5 md:w-5" /> : <Maximize2 className="h-4 w-4 md:h-5 md:w-5" />}
              </Button>
              
              {/* Mobile menu for related podcasts */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                  className="text-white hover:bg-white/20 h-8 w-8"
                  disabled={!isPodcastDataLoaded}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* Loading overlay for entire content area
        {!isPodcastDataLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-10">
            <Loader2 className="h-12 w-12 md:h-16 md:w-16 animate-spin text-blue-500 dark:text-blue-400 mb-4" />
            <p className="text-black dark:text-white text-sm md:text-base">Loading podcast data...</p>
          </div>
        )} */}

        {/* Video/Image Content */}
        <div className="w-full h-full flex items-center justify-center">
          {!isPodcastDataLoaded ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-black dark:text-white mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-sm">Loading podcast...</p>
              </div>
            </div>
          ) : currentVisualAsset ? (
            <div className="w-full h-full relative">
              {currentVisualAsset.type === 'video' || podcast?.podcast_type === 'video' ? (
                // If the overall podcast is a video podcast we render a controlled video
                <video
                  ref={videoRef}
                  src={podcast?.podcast_type === 'video' ? (playbackSrc || currentVisualAsset.url) : currentVisualAsset.url}
                  className="w-full h-full object-contain"
                  autoPlay={podcast?.podcast_type === 'video'}
                  loop={podcast?.podcast_type !== 'video'}
                  muted={isMuted}
                  playsInline
                  key={(podcast?.podcast_type === 'video' ? (playbackSrc || currentVisualAsset.url) : currentVisualAsset.url) || 'video'}
                />
              ) : (
                <div className="w-full h-full relative">
                  {prevVisualAsset && (
                    <img
                      src={prevVisualAsset.url}
                      alt={prevVisualAsset.concept}
                      loading="eager"
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-600 ease-out ${currentImageVisible ? 'opacity-0' : 'opacity-100'}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://placehold.co/1792x1024/333/white?text=${encodeURIComponent(prevVisualAsset.concept)}`;
                      }}
                    />
                  )}
                  {currentVisualAsset && (
                    <img
                      src={currentVisualAsset.url}
                      alt={currentVisualAsset.concept}
                      loading="eager"
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-600 ease-out ${currentImageVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://placehold.co/1792x1024/333/white?text=${encodeURIComponent(currentVisualAsset.concept)}`;
                      }}
                      key={currentVisualAsset.url}
                    />
                  )}
                </div>
              )}
            </div>
            ) : podcast.cover_image_url ? (
              <img
                src={podcast.cover_image_url}
                alt={podcast.title}
                loading="eager"
                decoding="async"
                className="w-full h-full object-contain"
                key={podcast.cover_image_url}
              />
            ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-black">
              <Radio className="h-24 w-24 md:h-32 md:w-32 text-gray-400 dark:text-gray-700" />
            </div>
          )}
            {/* Unified loading / live overlay: show big overlay when podcast data or segments not yet available
                If podcast is live but has no recorded segments, show a Live banner and Join control. */}
            {!isPodcastDataLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/70 z-20">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 md:h-16 md:w-16 animate-spin text-black dark:text-white mx-auto mb-4" />
                  <p className="text-black dark:text-white text-sm">Loading podcast...</p>
                </div>
              </div>
            )}

            {/* Live-but-not-recorded state: show clear banner and a Join button (mobile-friendly) */}
            {isPodcastDataLoaded && podcast?.is_live && !isSegmentsLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 p-4">
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs mb-3">LIVE</div>
                <h3 className="text-white text-lg font-semibold mb-2">{podcast.title}</h3>
                <p className="text-white/90 text-sm mb-4">This session is live but not being recorded. Listeners can join live, but no recording will be saved.</p>
                <div className="flex items-center gap-3">
                  <Button
                    className="bg-red-600"
                    onClick={() => {
                      onClose();
                      if (onPodcastSelect) {
                        onPodcastSelect(podcast.id);
                      }
                    }}
                  >
                    Join Live
                  </Button>
                  <Button variant="ghost" onClick={() => { /* refresh listeners or open chat */ }}>
                    <Users className="h-4 w-4 mr-2 inline" />
                    {((podcast as any)?.live_listeners ?? (podcast as any)?.member_count ?? podcast?.listen_count ?? 0)} listeners
                  </Button>
                </div>
              </div>
            )}

            {/* Loading audio segments when podcast data is ready but segments are not live/available */}
            {isPodcastDataLoaded && !isSegmentsLoaded && !podcast?.is_live && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/70 z-20">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 md:h-16 md:w-16 animate-spin text-black dark:text-white mx-auto mb-4" />
                  <p className="text-black dark:text-white text-sm">Loading audio segments...</p>
                </div>
              </div>
            )}

          {/* Hidden audio/video elements used for playback when podcast includes media */}
          <audio ref={audioRef} className="hidden" />

          {/* YouTube-style Center Play Button (Desktop only) */}
          {(!isPodcastDataLoaded || !isSegmentsLoaded) ? null : (
            // Full-screen center CTA when not playing or when controls are visible
            ((!isPlaying || showControls) && !loadingAudio && !autoAdvancingRef.current) ? (
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 hidden md:flex items-center justify-center group"
                disabled={!isSegmentsLoaded}
              >
                <div className="bg-black/50 group-hover:bg-black/70 rounded-full p-6 md:p-8 transition-all transform group-hover:scale-110">
                  {replay ? (
                    <RefreshCcw className="h-12 w-12 md:h-20 md:w-20 text-white" />
                  ) : isPlaying ? (
                    <Pause className="h-12 w-12 md:h-20 md:w-20 text-white" />
                  ) : (
                    <Play className="h-12 w-12 md:h-20 md:w-20 text-white ml-2 md:ml-3" />
                  )}
                </div>
              </button>
            ) : null
          )}

          {/* Desktop YouTube-style Bottom Controls Overlay */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 md:p-4 transition-all duration-300 hidden md:block ${showControls && isSegmentsLoaded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
          >
            {/* Segmented Progress Bar */}
            <div className="mb-3 md:mb-4">
              <SegmentedProgressBar />
              <div className="flex justify-between text-xs text-gray-300 mt-1 md:mt-2">
                <span>{formatTime(displayCurrent)}</span>
                <span>{formatTime(displayTotalDuration)}</span>
              </div>
            </div>

            {/* Control Buttons - Desktop */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePreviousSegment}
                  disabled={loadingAudio || !isSegmentsLoaded}
                  className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"
                >
                  <SkipBack className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10"
                  disabled={loadingAudio || !isSegmentsLoaded}
                >
                  {loadingAudio ? (
                      <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : replay ? (
                      <RefreshCcw className="h-4 w-4 md:h-5 md:w-5" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4 md:h-5 md:w-5" />
                    ) : (
                      <Play className="h-4 w-4 md:h-5 md:w-5 ml-0.5" />
                    )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextSegment}
                  disabled={!podcast || loadingAudio || !isSegmentsLoaded}
                  className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"
                >
                  <SkipForward className="h-3 w-3 md:h-4 md:w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMute}
                  className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"
                  disabled={!isSegmentsLoaded}
                >
                  {isMuted ? <VolumeX className="h-3 w-3 md:h-4 md:w-4" /> : <Volume2 className="h-3 w-3 md:h-4 md:w-4" />}
                </Button>

                <div className="text-white text-xs md:text-sm ml-1 md:ml-2">
                  {isSegmentsLoaded ? `${currentSegmentIndex + 1} / ${audioSegments.length}` : 'Loading...'}
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className={`text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8 ${showTranscript ? 'bg-white/20' : ''}`}
                  disabled={!isSegmentsLoaded}
                >
                  <Captions className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
                {/* Live Caption Button for desktop */}
                {podcast?.is_live && (
                  <Button
                    variant={showLiveCaptions ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setShowLiveCaptions(v => !v)}
                    className={showLiveCaptions ? 'bg-blue-600 text-white' : ''}
                    title={showLiveCaptions ? 'Hide Live Captions' : 'Show Live Captions'}
                  >
                    <Captions className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSpeedChange}
                  className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"
                  disabled={!isSegmentsLoaded}
                >
                  <span className="text-xs">{playbackSpeed}x</span>
                </Button>
              </div>
              {/* Live Captions Overlay */}
              {showLiveCaptions && podcast?.is_live && (
                <div className="pointer-events-none fixed left-0 right-0 bottom-24 md:bottom-12 z-[100] flex flex-col items-center px-2 md:px-0">
                  <div className="max-w-2xl w-full bg-black/80 text-white rounded-xl p-3 text-base md:text-lg shadow-xl animate-fade-in-up" style={{ wordBreak: 'break-word', minHeight: 40 }}>
                    {liveCaptions.length === 0 ? (
                      <span className="opacity-60">Waiting for live captions...</span>
                    ) : (
                      <span>{liveCaptions[liveCaptions.length - 1]}</span>
                    )}
                  </div>
                  {/* Optionally show recent lines above */}
                  {liveCaptions.length > 1 && (
                    <div className="max-w-2xl w-full mt-1 text-xs text-gray-200 text-center opacity-70">
                      {liveCaptions.slice(-4, -1).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Segment indicator */}
          {isSegmentsLoaded && audioSegments.length > 1 && (
            <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm">
              Segment {currentSegmentIndex + 1} of {audioSegments.length}
            </div>
          )}

          {/* Loading indicator for segments */}
          {!isSegmentsLoaded && (
            <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm">
              <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />
              Loading segments...
            </div>
          )}

          {/* Mobile Progress Bar (always visible) */}
          {isSegmentsLoaded && (
            <div className="absolute bottom-16 left-0 right-0 px-4 md:hidden">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                <span>{formatTime(isSingleAudio ? fullAudioProgress : displayCurrent)}</span>
                <span>{formatTime(isSingleAudio ? fullAudioDuration : displayTotalDuration)}</span>
              </div>
              <SegmentedProgressBar />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Controls Bar */}
      <div className="md:hidden">
        <MobileControls />
      </div>

      {/* Right Sidebar - Desktop (30% width) */}
      <div className={`${isFullScreen ? 'hidden' : 'hidden lg:block w-[30%]'} bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 overflow-y-auto`}>
        <div className="p-4">
          {/* Podcast Info */}
          <div className="mb-6">
            <h1 className="text-black dark:text-white font-bold text-lg mb-2">
              {!isPodcastDataLoaded ? 'Loading...' : podcast.title}
            </h1>
            
            {isPodcastDataLoaded ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{podcast.listen_count || 0} listens</span>
                  <span className="text-gray-600 dark:text-gray-400">•</span>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{podcast.duration || 0}m</span>
                  <span className="text-gray-600 dark:text-gray-400">•</span>
                  <span className="text-gray-600 dark:text-gray-400 text-sm">{new Date(podcast.created_at).toLocaleDateString()}</span>
                </div>
                
                {/* Creator Info */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={creatorInfo?.avatar_url} />
                    <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {creatorInfo?.full_name?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-black dark:text-white">
                      {creatorInfo?.full_name || 'Creator'}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <Button
                        onClick={() => setLiked(!liked)}
                        variant="ghost"
                        size="sm"
                        className={`gap-2 px-0 ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
                        disabled={!isPodcastDataLoaded}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Like
                      </Button>
                      <Button
                        onClick={handleShare}
                        variant="ghost"
                        size="sm"
                        className="gap-2 px-0 text-gray-600 dark:text-gray-400"
                        disabled={!isPodcastDataLoaded}
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {podcast.description && (
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 mb-4">
                    <h3 className="font-semibold text-black dark:text-white mb-2">Description</h3>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{podcast.description}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-24"></div>
                    <div className="flex gap-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-12"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-12"></div>
                    </div>
                  </div>
                </div>
                <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              </div>
            )}

            {/* Transcript Toggle */}
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full justify-between text-black dark:text-white border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                disabled={!isSegmentsLoaded}
              >
                <span className="flex items-center gap-2">
                  {!isSegmentsLoaded ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  {!isSegmentsLoaded ? 'Loading transcript...' : 'Transcript'}
                </span>
                {isSegmentsLoaded && (showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </Button>
              
              {showTranscript && isSegmentsLoaded && (
                <div
                  ref={transcriptContainerRef}
                  className="mt-3 max-h-60 overflow-y-auto"
                >
                  {audioSegmentsNormalized.map((segment, index) => (
                    <div
                      key={index}
                      ref={(el) => { segmentRefs.current[index] = el; }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${index === currentSegmentIndex
                        ? 'bg-gray-200 dark:bg-gray-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                      onClick={() => isSingleAudio ? handleSegmentProgressClick(index) : playSegment(index)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${index === currentSegmentIndex
                          ? 'bg-red-500'
                          : 'bg-gray-300 dark:bg-gray-700'
                        }`}>
                          <Play className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-black dark:text-white">
                              {segment.speaker}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">{segment.text}</p>
                            {segment.transcript && segment.transcript !== segment.text && (
                              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">{segment.transcript}</p>
                            )}
                            {segment.summary && !segment.transcript && (
                              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{segment.summary}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              {segment.audio_url && (
                                <a href={segment.audio_url} target="_blank" rel="noreferrer" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600">
                                  <Download className="inline-block mr-1 h-4 w-4 align-middle" />
                                  Download
                                </a>
                              )}
                              {segment.transcript && (
                                <button
                                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 flex items-center gap-1"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(segment.transcript || '');
                                      toast.success('Transcript copied');
                                    } catch (err) {
                                      toast.error('Copy failed');
                                    }
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4" /> Copy
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Listeners (infinite scroll) */}
          <h3 className="text-black dark:text-white font-semibold mb-2 text-lg">Listeners</h3>
          <div className="mb-4">
            <div ref={listenersContainerRef} className="max-h-40 overflow-y-auto space-y-2 p-2">
              {listenersList.length === 0 && !listenersLoading ? (
                <div className="text-sm text-gray-500">No listeners yet</div>
              ) : (
                listenersList.map((u, idx) => (
                  <div key={u?.id || idx} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u?.avatar_url} />
                      <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{(u?.display_name || 'U').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-black dark:text-white truncate">{u?.display_name || u?.id}</div>
                    </div>
                  </div>
                ))
              )}
              {listenersLoading && (
                <div className="py-2 text-center text-sm text-gray-500">Loading listeners...</div>
              )}
              <div ref={listenersSentinelRef} />
            </div>
          </div>

                {/* Related Podcasts (infinite scroll) */}
          <h3 className="text-black dark:text-white font-semibold mb-4 text-lg">More Podcasts</h3>
          <div ref={relatedContainerRef} className="space-y-2 overflow-y-auto max-h-96 p-2">
            {relatedPodcasts.map((relatedPodcast) => (
              <div 
                key={relatedPodcast.id} 
                className="flex gap-3 cursor-pointer group"
                onClick={() => onPodcastSelect?.(relatedPodcast.id)}
              >
                <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {relatedPodcast.cover_image_url ? (
                    <img
                      src={relatedPodcast.cover_image_url}
                      alt={relatedPodcast.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1.5 py-0.5">
                    <span className="text-white text-xs">{relatedPodcast.duration_minutes || 0}m</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-blue-600">
                    {relatedPodcast.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <Eye className="h-3 w-3" />
                    <span>{relatedPodcast.listen_count || 0} listens</span>
                  </div>
                </div>
              </div>
            ))}

            {relatedLoading && (
              <div className="py-2 text-center text-sm text-gray-500">Loading more podcasts...</div>
            )}
            <div ref={relatedSentinelRef} />
          </div>
        </div>
      </div>

      {/* Mobile Info Area - Below video on mobile */}
      <div className="md:hidden bg-white dark:bg-black border-t border-gray-300 dark:border-gray-800 overflow-y-auto">
        <div className="p-4">
          {/* Podcast Title and Stats */}
          <div className="mb-4">
            <h1 className="text-black dark:text-white font-bold text-lg mb-2">
              {!isPodcastDataLoaded ? 'Loading...' : podcast.title}
            </h1>
            
            {isPodcastDataLoaded ? (
              <>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-3">
                  <span>{podcast.listen_count || 0} listens</span>
                  <span>•</span>
                  <span>{podcast.duration || 0}m</span>
                  <span>•</span>
                  <span>{new Date(podcast.created_at).toLocaleDateString()}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={creatorInfo?.avatar_url} />
                      <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {creatorInfo?.full_name?.charAt(0) || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-black dark:text-white text-sm">
                        {creatorInfo?.full_name || 'Creator'}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setLiked(!liked)}
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
                      disabled={!isPodcastDataLoaded}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleShare}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-600 dark:text-gray-400"
                      disabled={!isPodcastDataLoaded}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-1"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-16"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-24"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Description Toggle */}
            {podcast.description && (
              <div className="mb-4">
                <Button
                  variant="ghost"
                  className="w-full justify-between text-black dark:text-white px-0"
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
                  disabled={!isPodcastDataLoaded}
                >
                  <span className="text-sm">Description</span>
                  {isPodcastDataLoaded && (showMoreInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </Button>
                {showMoreInfo && isPodcastDataLoaded && (
                  <div className="mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{podcast.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Toggle (Mobile) */}
            <div className="mb-4">
              <Button
                variant="ghost"
                className="w-full justify-between text-black dark:text-white px-0"
                onClick={() => setShowTranscript(!showTranscript)}
                disabled={!isSegmentsLoaded}
              >
                <span className="flex items-center gap-2 text-sm">
                  {!isSegmentsLoaded ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  {!isSegmentsLoaded ? 'Loading transcript...' : 'Transcript'}
                </span>
                {isSegmentsLoaded && (showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </Button>
              
              {showTranscript && isSegmentsLoaded && (
                <div className="mt-3 max-h-60 overflow-y-auto">
                  {audioSegments.map((segment, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${index === currentSegmentIndex
                        ? 'bg-gray-200 dark:bg-gray-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                      onClick={() => isSingleAudio ? handleSegmentProgressClick(index) : playSegment(index)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${index === currentSegmentIndex
                          ? 'bg-red-500'
                          : 'bg-gray-300 dark:bg-gray-700'
                        }`}>
                          <Play className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-black dark:text-white">
                              {segment.speaker}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">#{index + 1}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 text-sm">{segment.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mb-4 overflow-y-auto max-h-[500px]">
                
          {/* Mobile: Listeners (below transcript) */}
          <div className="mb-4">
            <Button
              variant="ghost"
              className="w-full justify-between text-black dark:text-white px-0"
              onClick={() => setShowMobileListeners(!showMobileListeners)}
              disabled={!isPodcastDataLoaded}
            >
              <span className="flex items-center gap-2 text-sm">Listeners</span>
              {showMobileListeners ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showMobileListeners && (
              <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-2">
                {listenersList.length === 0 && !listenersLoading ? (
                  <div className="text-sm text-gray-500">No listeners yet</div>
                ) : (
                  listenersList.map((u, idx) => (
                    <div key={u?.id || idx} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u?.avatar_url} />
                        <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{(u?.display_name || 'U').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-black dark:text-white truncate">{u?.display_name || u?.id}</div>
                      </div>
                    </div>
                  ))
                )}
                {listenersLoading && (
                  <div className="py-2 text-center text-sm text-gray-500">Loading listeners...</div>
                )}
                <div ref={listenersSentinelRef} />
              </div>
            )}
          </div>

          {/* Mobile: Related Podcasts (below listeners) */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="w-full justify-between text-black dark:text-white px-0"
              onClick={() => setShowMobileRelated(!showMobileRelated)}
              disabled={!isPodcastDataLoaded}
            >
              <span className="flex items-center gap-2 text-sm">More Podcasts</span>
              {showMobileRelated ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showMobileRelated && (
              <div className="mt-3 space-y-4">
                {relatedPodcasts.map((relatedPodcast) => (
                  <div 
                    key={relatedPodcast.id} 
                    className="flex gap-3 cursor-pointer group"
                    onClick={() => onPodcastSelect?.(relatedPodcast.id)}
                  >
                    <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      {relatedPodcast.cover_image_url ? (
                        <img
                          src={relatedPodcast.cover_image_url}
                          alt={relatedPodcast.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1 py-0.5">
                        <span className="text-white text-xs">{relatedPodcast.duration_minutes || 0}m</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-blue-600">
                        {relatedPodcast.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                        <Eye className="h-3 w-3" />
                        <span>{relatedPodcast.listen_count || 0} listens</span>
                      </div>
                    </div>
                  </div>
                ))}

                {relatedLoading && (
                  <div className="py-2 text-center text-sm text-gray-500">Loading more podcasts...</div>
                )}
                <div ref={relatedSentinelRef} />
              </div>
            )}
            </div>
          </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    {/* Mobile Sidebar Sheet for Related Podcasts */}
    <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
      <SheetContent side="right" className="w-full sm:w-96 bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 p-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-black dark:text-white font-semibold text-lg">More Podcasts</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSidebar(false)}
              className="text-black dark:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="space-y-4">
            {relatedPodcasts.map((relatedPodcast) => (
              <div 
                key={relatedPodcast.id} 
                className="flex gap-3 cursor-pointer group"
                onClick={() => {
                  onPodcastSelect?.(relatedPodcast.id);
                  setShowMobileSidebar(false);
                }}
              >
                <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                  {relatedPodcast.cover_image_url ? (
                    <img
                      src={relatedPodcast.cover_image_url}
                      alt={relatedPodcast.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1 py-0.5">
                    <span className="text-white text-xs">{relatedPodcast.duration_minutes || 0}m</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-red-500">
                    {relatedPodcast.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <Eye className="h-3 w-3" />
                    <span>{relatedPodcast.listen_count || 0} listens</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
);
});

PodcastPanel.displayName = 'PodcastPanel';