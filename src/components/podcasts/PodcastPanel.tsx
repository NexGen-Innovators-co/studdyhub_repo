// PodcastPanel.tsx – Thin orchestrator (refactored)
// All heavy logic lives in hooks/usePodcastAudio, hooks/usePodcastData, hooks/useProgressiveLoader
// Shared types are in podcastTypes.ts and utilities in podcastUtils.ts
import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  X, Play, Pause, Download, Maximize2, Minimize2,
  Volume2, VolumeX, SkipForward, SkipBack, Loader2,
  Share2, Users, Clock, Radio, RefreshCcw,
  ThumbsUp, ThumbsDown, MoreVertical, MessageSquare,
  List, Eye, Flag, ChevronLeft, ChevronRight, Menu, ChevronDown, ChevronUp,
  Captions, Pencil, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { getBlobDuration } from '@/services/podcastLiveService';
import { transcribeLivePodcast } from '@/services/transcriptionService';
import { saveTranscriptionResult } from '@/services/podcastLiveService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { PodcastData } from './PodcastGenerator';

// Hooks
import { usePodcastAudio } from './hooks/usePodcastAudio';
import { usePodcastData } from './hooks/usePodcastData';
import { useProgressiveLoader } from './hooks/useProgressiveLoader';

// Utils
import { formatTime, deriveFullAudioUrl, normalizeAudioSegments } from './podcastUtils';

// Types
import type { AudioSegment, VisualAsset, PodcastPanelRef } from './podcastTypes';
export type { PodcastPanelRef };

interface PodcastPanelProps {
  podcast: PodcastData | null;
  onClose: () => void;
  isOpen: boolean;
  onPodcastSelect?: (podcastId: string) => void;
  panelWidth?: number;
  setPanelWidth?: React.Dispatch<React.SetStateAction<number>>;
}

export const PodcastPanel = forwardRef<PodcastPanelRef, PodcastPanelProps>(({
  podcast,
  onClose,
  isOpen,
  onPodcastSelect
}, ref) => {
  const isOnline = useOnlineStatus();
  const { user: currentUser } = useAuth();
  const isOwner = !!(currentUser && podcast && podcast.user_id === currentUser.id);

  // ──── Inline title editing ────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const startEditingTitle = useCallback(() => {
    if (!isOwner || !podcast) return;
    setEditTitle(podcast.title || '');
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }, [isOwner, podcast]);

  const saveTitle = useCallback(async () => {
    if (!podcast || !editTitle.trim() || editTitle.trim() === podcast.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from('ai_podcasts')
        .update({ title: editTitle.trim() })
        .eq('id', podcast.id)
        .eq('user_id', currentUser!.id);
      if (error) throw error;
      // Update local podcast object
      (podcast as any).title = editTitle.trim();
      toast.success('Title updated');
    } catch (err: any) {
      toast.error('Failed to update title');
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  }, [podcast, editTitle, currentUser]);

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditTitle('');
  }, []);

  // ──── Progressive loader ────
  const loader = useProgressiveLoader({ podcast, isOpen });

  // ──── Audio playback ────
  const audio = usePodcastAudio({ podcast, isOpen, isSegmentsLoaded: loader.isSegmentsLoaded, loadedCount: loader.loadedCount });

  // ──── Data fetching (creator, related, listeners) ────
  const data = usePodcastData({ podcast, isOpen });

  // ──── Local UI state (not worth extracting – pure view concerns) ────
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLiveCaptions, setShowLiveCaptions] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState<string[]>([]);
  const liveCaptionSubRef = useRef<any>(null);
  const [showMobileListeners, setShowMobileListeners] = useState(false);
  const [showMobileRelated, setShowMobileRelated] = useState(false);
  const [liked, setLiked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isPodcastDataLoaded, setIsPodcastDataLoaded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentImage, setCurrentImage] = useState<VisualAsset | null>(null);
  const [displayedVisualAsset, setDisplayedVisualAsset] = useState<VisualAsset | null>(null);
  const [prevVisualAsset, setPrevVisualAsset] = useState<VisualAsset | null>(null);
  const [currentImageVisible, setCurrentImageVisible] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Gapless preloading: hidden <video> element for next clip
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);
  // Gapless preloading: hidden <audio> element for next audio segment
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  // Transcript auto-scroll
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const userInteractingRef = useRef(false);
  const userInteractTimeoutRef = useRef<number | null>(null);
  const markUserInteraction = useCallback(() => {
    userInteractingRef.current = true;
    if (userInteractTimeoutRef.current) window.clearTimeout(userInteractTimeoutRef.current);
    userInteractTimeoutRef.current = window.setTimeout(() => { userInteractingRef.current = false; userInteractTimeoutRef.current = null; }, 2000) as unknown as number;
  }, []);

  // Expose audioRef to parent
  useImperativeHandle(ref, () => ({ audioRef: audio.audioRef }));

  // ──── Shortcuts from hooks ────
  const {
    isPlaying, isMuted, progress, currentTime, duration,
    loadingAudio, mediaLoading, replay, playbackSpeed, playbackSrc,
    currentSegmentIndex, isSingleAudio, fullAudioDuration, fullAudioProgress,
    segmentsProgress, derivedFullAudioUrl: derivedUrl,
    audioRef, videoRef, autoAdvancingRef,
    handlePlayPause, handleNextSegment, handlePreviousSegment,
    handleSpeedChange, handleToggleMute, handleProgressClick,
    handleSegmentProgressClick, handleShare, playSegment, playFullAudio,
    cleanupAudio,
    setFullAudioDuration, setDuration,
    isVideoFlow, videoClips, videoTotalDuration,
  } = audio;

  const {
    isSegmentsLoaded,
    segmentLoadStates,
    isBatchLoading,
    loadNextBatch,
    batchSentinelRef,
    loadedCount,
  } = loader;

  const {
    creatorInfo, relatedPodcasts, relatedLoading, relatedHasMore,
    relatedSentinelRef, listenersList, listenersLoading, listenersHasMore,
    listenersSentinelRef, displayListenCount,
  } = data;

  // ──── isPodcastDataLoaded simulation (matches original) ────
  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    if (podcast) {
      setIsPodcastDataLoaded(false);
      const timer = setTimeout(() => { setIsPodcastDataLoaded(true); }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsPodcastDataLoaded(false);
    }
  }, [isOpen, podcast?.id]);

  // ──── Visual asset effects ────
  // Set initial image when podcast loads
  useEffect(() => {
    if (!isOpen || !podcast) return;
    if (podcast.visual_assets && podcast.visual_assets.length > 0) {
      const firstImage = podcast.visual_assets.find(asset =>
        asset.type === 'image' && (
          (Array.isArray(asset.segmentIndices) && asset.segmentIndices.includes(0)) ||
          asset.segmentIndex === 0
        )
      ) || podcast.visual_assets[0];
      setCurrentImage(firstImage);
      setDisplayedVisualAsset(firstImage);
    } else if (podcast.cover_image_url && !displayedVisualAsset) {
      // Only fall back to cover image if nothing is displayed yet (avoids flash on light→full transition)
      setCurrentImage({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
      setDisplayedVisualAsset({ type: 'image', url: podcast.cover_image_url, concept: podcast.title });
    } else if (!podcast.cover_image_url && !podcast.visual_assets?.length) {
      setCurrentImage(null);
      setDisplayedVisualAsset(null);
      setPrevVisualAsset(null);
    }
  }, [isOpen, podcast?.id, podcast?.visual_assets]);

  // Update visual on segment change (segmented audio) — handles both image and video assets
  useEffect(() => {
    if (!isOpen) return;

    // VIDEO FLOW: hook drives videoRef.src — only update metadata state (no displayedVisualAsset/key changes)
    // The hook already set vid.src before changing currentSegmentIndex, so we must NOT
    // touch displayedVisualAsset (which would change the <video> key and destroy the element).
    if (isVideoFlow && videoClips.length > 0) {
      // Just update currentImage for transcript highlighting (doesn't affect videoRef)
      const clip = videoClips[currentSegmentIndex];
      if (clip) {
        setCurrentImage(clip);
        setImageReady(true);
      }
      return;
    }

    // AUDIO FLOW (original): match visual assets by segment index
    if (!isSingleAudio && podcast?.visual_assets && podcast.visual_assets.length > 0) {
      // Find any asset (image or video) matching the current segment
      const allMapped = podcast.visual_assets.filter(a => a.segmentIndex !== undefined || Array.isArray(a.segmentIndices));
      // Prefer video assets for video podcast type, then fall back to images
      const matching = allMapped.find(a =>
        (a.type === 'video') &&
        ((Array.isArray(a.segmentIndices) && a.segmentIndices.includes(currentSegmentIndex)) || a.segmentIndex === currentSegmentIndex)
      ) || allMapped.find(a =>
        (Array.isArray(a.segmentIndices) && a.segmentIndices.includes(currentSegmentIndex)) ||
        a.segmentIndex === currentSegmentIndex
      );

      // Fallback: use the imageUrl from the audio segment if no visual asset matches
      const fallbackAsset = !matching && podcast.audioSegments?.[currentSegmentIndex]?.imageUrl
        ? { type: 'image' as const, url: podcast.audioSegments[currentSegmentIndex].imageUrl, concept: '' }
        : null;

      const assetToShow = matching || fallbackAsset;
      if (assetToShow) {
        const currentUrl = currentImage?.url;
        if (assetToShow.url && assetToShow.url !== currentUrl) {
          setPrevVisualAsset(displayedVisualAsset);
          setDisplayedVisualAsset(assetToShow);
          setCurrentImage(assetToShow);
          setCurrentImageVisible(false);
          setImageReady(false);
          window.setTimeout(() => setPrevVisualAsset(null), 650);
        }
      }
    }
  }, [isOpen, currentSegmentIndex, podcast?.visual_assets, isSingleAudio, isVideoFlow, videoClips]);

  // Preload all visual images
  useEffect(() => {
    if (!isOpen || !podcast) return;
    const imageUrls = Array.isArray(podcast.visual_assets)
      ? podcast.visual_assets.filter(a => a?.type === 'image' && !!a?.url).map(a => a.url)
      : [];
    if (imageUrls.length === 0) return;
    imageUrls.forEach(url => {
      if (preloadedImagesRef.current.has(url)) return;
      const img = new Image();
      img.onload = () => preloadedImagesRef.current.add(url);
      img.onerror = () => preloadedImagesRef.current.add(url);
      img.src = url;
    });
  }, [isOpen, podcast?.id, podcast?.visual_assets]);

  // Reset audio/image ready on segment change
  useEffect(() => {
    setAudioReady(false);
    const url = displayedVisualAsset?.url;
    if (url && preloadedImagesRef.current.has(url)) setImageReady(true);
    // For video assets, mark imageReady immediately (no preload needed)
    else if (displayedVisualAsset?.type === 'video') setImageReady(true);
    else setImageReady(false);
  }, [currentSegmentIndex, displayedVisualAsset?.url]);

  // Sync video clip play/pause with audio playback (non-video-flow only — hook handles video flow)
  useEffect(() => {
    if (isVideoFlow) return; // Hook manages videoRef for video flow
    const vid = videoRef.current;
    if (!vid || displayedVisualAsset?.type !== 'video') return;
    if (isPlaying) { vid.play().catch(() => {}); }
    else { vid.pause(); }
  }, [isPlaying, displayedVisualAsset?.type, isVideoFlow]);

  // Progressive play: only play when both audio and image are ready
  useEffect(() => {
    if (isVideoFlow) return; // Video flow handles its own play
    if (audioReady && imageReady && audioRef.current && audioRef.current.paused && !isPlaying) {
      audioRef.current.play();
      audio.setIsPlaying(true);
    }
  }, [audioReady, imageReady, isVideoFlow]);

  // ── Gapless preload: preload NEXT video clip while current plays ──
  useEffect(() => {
    if (!isOpen || !isVideoFlow || videoClips.length === 0) return;
    const nextIdx = currentSegmentIndex + 1;
    if (nextIdx >= videoClips.length) return;
    const nextClip = videoClips[nextIdx];
    if (!nextClip?.url) return;
    // Create or reuse hidden video element for preloading
    if (!preloadVideoRef.current) {
      preloadVideoRef.current = document.createElement('video');
      preloadVideoRef.current.preload = 'auto';
      preloadVideoRef.current.muted = true;
      preloadVideoRef.current.style.display = 'none';
    }
    if (preloadVideoRef.current.src !== nextClip.url) {
      preloadVideoRef.current.src = nextClip.url;
      preloadVideoRef.current.load();
    }
    return () => {
      // Cleanup on unmount
      if (preloadVideoRef.current) {
        try { preloadVideoRef.current.src = ''; } catch (_e) {}
      }
    };
  }, [isOpen, isVideoFlow, currentSegmentIndex, videoClips]);

  // ── Gapless preload: preload NEXT audio segment while current plays (image-audio flow) ──
  useEffect(() => {
    if (!isOpen || isVideoFlow || isSingleAudio) return;
    if (!podcast?.audioSegments || podcast.audioSegments.length === 0) return;
    const nextIdx = currentSegmentIndex + 1;
    if (nextIdx >= podcast.audioSegments.length) return;
    const nextSeg = podcast.audioSegments[nextIdx];
    if (!nextSeg) return;
    const nextUrl = nextSeg.audio_url || (nextSeg.audioContent ? `data:audio/mp3;base64,${nextSeg.audioContent.replace(/\`/g, '').trim()}` : null);
    if (!nextUrl) return;
    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.preload = 'auto';
    }
    if (preloadAudioRef.current.src !== nextUrl) {
      preloadAudioRef.current.src = nextUrl;
      preloadAudioRef.current.load();
    }
    // Also preload next image if present
    const nextImg = nextSeg.imageUrl || podcast.visual_assets?.find(a =>
      a.type === 'image' && (Array.isArray(a.segmentIndices) ? a.segmentIndices.includes(nextIdx) : a.segmentIndex === nextIdx)
    )?.url;
    if (nextImg && !preloadedImagesRef.current.has(nextImg)) {
      const img = new Image();
      img.onload = () => preloadedImagesRef.current.add(nextImg);
      img.src = nextImg;
    }
  }, [isOpen, isVideoFlow, isSingleAudio, currentSegmentIndex, podcast?.audioSegments, podcast?.visual_assets]);

  // ──── Transcript scroll listeners ────
  useEffect(() => {
    if (!isOpen) return;
    const el = transcriptContainerRef.current;
    if (!el) return;
    const onInteract = () => markUserInteraction();
    el.addEventListener('wheel', onInteract, { passive: true });
    el.addEventListener('touchstart', onInteract, { passive: true });
    el.addEventListener('pointerdown', onInteract, { passive: true });
    el.addEventListener('scroll', onInteract, { passive: true });
    return () => {
      el.removeEventListener('wheel', onInteract);
      el.removeEventListener('touchstart', onInteract);
      el.removeEventListener('pointerdown', onInteract);
      el.removeEventListener('scroll', onInteract);
      if (userInteractTimeoutRef.current) { window.clearTimeout(userInteractTimeoutRef.current); userInteractTimeoutRef.current = null; }
    };
  }, [isOpen, showTranscript, isSegmentsLoaded, markUserInteraction]);

  // Auto-scroll active transcript segment
  useEffect(() => {
    if (!isOpen || !showTranscript || !isSegmentsLoaded) return;
    const container = transcriptContainerRef.current;
    const active = segmentRefs.current[currentSegmentIndex];
    if (!container || !active) return;
    if (userInteractingRef.current) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    if (aRect.top >= cRect.top + 8 && aRect.bottom <= cRect.bottom - 8) return;
    try { active.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) {
      const offset = active.offsetTop - (container.clientHeight / 2) + (active.clientHeight / 2);
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [currentSegmentIndex, showTranscript, isSegmentsLoaded]);

  // ──── Controls show/hide ────
  const handleVideoAreaMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { if (isPlaying) setShowControls(false); controlsTimeoutRef.current = null; }, 3000) as unknown as number;
  };
  const handleTouchStart = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { setShowControls(false); controlsTimeoutRef.current = null; }, 3000) as unknown as number;
  };
  const handleControlsMouseEnter = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) { window.clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = null; }
  };
  const handleControlsMouseLeave = () => {
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { if (isPlaying) setShowControls(false); controlsTimeoutRef.current = null; }, 3000) as unknown as number;
  };

  // ──── handleClose ────
  const handleClose = () => {
    try {
      setIsClosing(true);
      cleanupAudio();
      // Cleanup preload elements
      if (preloadVideoRef.current) { try { preloadVideoRef.current.src = ''; } catch (_e) {} preloadVideoRef.current = null; }
      if (preloadAudioRef.current) { try { preloadAudioRef.current.src = ''; } catch (_e) {} preloadAudioRef.current = null; }
      if (controlsTimeoutRef.current) { window.clearTimeout(controlsTimeoutRef.current); controlsTimeoutRef.current = null; }
      if (userInteractTimeoutRef.current) { window.clearTimeout(userInteractTimeoutRef.current); userInteractTimeoutRef.current = null; }
      // NOTE: Do NOT reset isPodcastDataLoaded here — the component is about to unmount.
      // Resetting it causes a flash of the loading overlay before navigation completes.
      preloadedImagesRef.current.clear();
      setShowTranscript(false);
      setShowControls(false);
    } catch (_e) {}
    onClose();
  };

  // ──── Reprocess audio ────
  const [isReprocessing, setIsReprocessing] = useState(false);
  const audioSegmentsNormalized = useMemo(() => normalizeAudioSegments(podcast?.audioSegments || []), [podcast?.audioSegments]);

  const reprocessAudio = async () => {
    if (!isOnline) { toast.error('No internet connection'); return; }
    if (!podcast) return;
    try {
      setIsReprocessing(true);
      const seg = audioSegmentsNormalized.length > 0
        ? (audioSegmentsNormalized.find(s => s.audio_url) || audioSegmentsNormalized[0])
        : null;
      const url = (seg && seg.audio_url) || derivedUrl;
      if (!url) { toast.error('No audio URL available to reprocess'); setIsReprocessing(false); return; }
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) throw new Error('Failed to fetch audio');
      const blob = await resp.blob();
      const seconds = await getBlobDuration(blob);
      const minutes = Math.ceil((seconds || 0) / 60);
      try { await supabase.from('ai_podcasts').update({ duration_minutes: minutes }).eq('id', podcast.id); } catch (_e) {}
      setFullAudioDuration(seconds || 0);
      setDuration(seconds || 0);
      if (!podcast.script) {
        try {
          const transcription = await transcribeLivePodcast(blob, podcast.title || 'Live Podcast', Math.floor(seconds || 0), url);
          if (transcription?.transcript) {
            const { data: authData } = await supabase.auth.getUser();
            await saveTranscriptionResult(podcast.id, url, transcription.transcript, transcription.summary, authData?.user?.id || null, transcription.script || null);
          }
        } catch (_e) {}
      }
      toast.success('Audio reprocessed');
    } catch (_e) { toast.error('Failed to reprocess audio'); }
    finally { setIsReprocessing(false); }
  };

  // ──── Derived display values ────
  const audioSegments = podcast?.audioSegments || [];

  // Effective segment count & loaded count for video flow (video clips are always "loaded")
  const effectiveSegmentCount = isVideoFlow ? videoClips.length : audioSegments.length;
  const effectiveLoadedCount = isVideoFlow ? videoClips.length : loadedCount;

  const hasSegmentImages = Array.isArray(podcast?.visual_assets)
    ? podcast!.visual_assets.some(a => a?.type === 'image')
    : false;
  const hasParsedAudioSegments = Array.isArray(podcast?.audioSegments)
    ? podcast!.audioSegments.some(s => !!s?.audio_url || (s?.audioContent && s.audioContent.length > 0))
    : false;
  const hasRawAudioSegments = useMemo(() => {
    const raw = (podcast as any)?.audio_segments;
    if (!raw) return false;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) && parsed.some((s: any) => !!s?.audio_url || (s?.audioContent && s.audioContent.length > 0));
    } catch (_e) { return false; }
  }, [(podcast as any)?.audio_segments]);
  const hasAudioSource = !!derivedUrl || !!podcast?.audio_url || hasParsedAudioSegments || hasRawAudioSegments;

  const mediaTypeLabel = podcast?.podcast_type === 'video' ? 'Video' : 'Audio';
  const currentVisualAsset = displayedVisualAsset;

  // Compute display durations
  let displayTotalDuration = 0;
  let displayCurrent = 0;
  if (isVideoFlow && videoClips.length > 0) {
    // VIDEO FLOW: compute total from clip durations or fallback to podcast metadata
    displayTotalDuration = videoTotalDuration > 0 ? videoTotalDuration : (podcast?.duration ? podcast.duration * 60 : duration || 0);
    // Current position = sum of previous clip durations + current time in active clip
    const prevClipsDuration = videoClips.slice(0, currentSegmentIndex).reduce((sum, c) => sum + (c.duration || 0), 0);
    displayCurrent = prevClipsDuration + (isFinite(currentTime) ? currentTime : 0);
    displayCurrent = Math.min(displayCurrent, displayTotalDuration);
  } else if (!isSingleAudio && segmentsProgress && segmentsProgress.length > 0) {
    const maxEnd = Math.max(...segmentsProgress.map(s => s.end || 0));
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

  // ──── Inline sub-components ────
  const MobileControls = () => (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-black border-t border-gray-300 dark:border-gray-800">
      <div className="flex flex-col items-start gap-1 min-w-[70px]">
        <Button variant="ghost" size="icon" onClick={handleSpeedChange} className="h-8 w-8 dark:text-white text-dark" disabled={effectiveLoadedCount === 0}>
          <span className="text-xs font-semibold">{playbackSpeed}x</span>
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handlePreviousSegment} disabled={!podcast || loadingAudio || effectiveLoadedCount === 0} className="h-8 w-8 text-dark dark:text-white">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handlePlayPause} className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 text-dark dark:text-white" disabled={loadingAudio || effectiveLoadedCount === 0}>
          {loadingAudio ? <Loader2 className="h-6 w-6 animate-spin" /> : replay ? <RefreshCcw className="h-6 w-6" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNextSegment} disabled={!podcast || loadingAudio || effectiveLoadedCount === 0} className="h-8 w-8 text-dark dark:text-white">
          <SkipForward className="h-4 w-4" />
        </Button>
        {podcast?.is_live && (
          <Button variant={showLiveCaptions ? 'secondary' : 'ghost'} size="icon" onClick={() => setShowLiveCaptions(v => !v)} className={showLiveCaptions ? 'bg-blue-600 text-white' : ''} title={showLiveCaptions ? 'Hide Live Captions' : 'Show Live Captions'}>
            <Captions className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 min-w-[70px]">
        <span className="dark:text-white text-dark text-xs font-semibold leading-tight">{mediaTypeLabel}</span>
        <div className="flex items-center gap-2">
          <span className="dark:text-white text-dark text-sm">{currentSegmentIndex + 1}/{effectiveSegmentCount || 0}</span>
          <Button variant="ghost" size="icon" onClick={handleToggleMute} className="h-8 w-8 dark:text-white text-dark" disabled={effectiveLoadedCount === 0}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  const SegmentedProgressBar = () => {
    const segmentCount = effectiveSegmentCount || 1;

    // VIDEO FLOW: compute segments from video clips
    if (isVideoFlow && videoClips.length > 0) {
      const total = videoTotalDuration > 0 ? videoTotalDuration : (podcast?.duration ? podcast.duration * 60 : duration || 0);
      const prevClipsDuration = videoClips.slice(0, currentSegmentIndex).reduce((sum, c) => sum + (c.duration || 0), 0);
      const overallCurrent = prevClipsDuration + (isFinite(currentTime) ? currentTime : 0);
      const pct = total > 0 ? (Math.min(overallCurrent, total) / total) * 100 : 0;

      // Build segment boundaries from clip durations
      let cumulative = 0;
      const clipSegments = videoClips.map(c => {
        const start = cumulative;
        cumulative += (c.duration || 0);
        return { start, end: cumulative };
      });

      return (
        <div className="relative h-2 w-full bg-gray-600 rounded-full overflow-hidden">
          <div className="absolute h-full bg-red-600 z-20" style={{ left: '0%', right: `${100 - pct}%` }} />
          {clipSegments.map((seg, index) => {
            if (!total) return null;
            const markerPosition = (seg.end / total) * 100;
            return <div key={index} className="absolute top-0 h-full w-px bg-white/30 z-10 pointer-events-none" style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }} />;
          })}
          {clipSegments.map((seg, index) => {
            if (!total) return null;
            const leftPct = (seg.start / total) * 100;
            const widthPct = ((seg.end - seg.start) / total) * 100;
            return <button key={index} className="absolute top-0 h-full z-30" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} onClick={() => handleSegmentProgressClick(index)} title={`Jump to clip ${index + 1}`} />;
          })}
        </div>
      );
    }

    // AUDIO FLOW (original)
    let totalDuration = 0;
    if (isSingleAudio) { totalDuration = fullAudioDuration || 0; }
    else if (segmentsProgress && segmentsProgress.length > 0) {
      const maxEnd = Math.max(...segmentsProgress.map(s => s.end || 0));
      totalDuration = maxEnd > 0 ? maxEnd : (segmentsProgress.reduce((sum, s) => sum + (s.end - s.start), 0) || podcast?.duration || duration || 0);
    } else { totalDuration = podcast?.duration || duration || 0; }

    let overallCurrent = 0;
    if (isSingleAudio) { overallCurrent = fullAudioProgress; }
    else {
      const segIdx = Math.min(Math.max(currentSegmentIndex, 0), segmentsProgress.length - 1);
      overallCurrent = (segmentsProgress[segIdx]?.start || 0) + (isFinite(currentTime) ? currentTime : 0);
    }
    const clampedCurrent = totalDuration > 0 ? Math.min(overallCurrent, totalDuration) : 0;
    const pct = totalDuration > 0 ? (clampedCurrent / totalDuration) * 100 : 0;

    return (
      <div className="relative h-2 w-full bg-gray-600 rounded-full overflow-hidden">
        <div className="absolute h-full bg-red-600 z-20" style={{ left: '0%', right: `${100 - pct}%` }} />
        {segmentsProgress.map((seg, index) => {
          if (!totalDuration) return null;
          const markerPosition = (seg.end / totalDuration) * 100;
          return <div key={index} className="absolute top-0 h-full w-px bg-white/30 z-10 pointer-events-none" style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }} />;
        })}
        {segmentsProgress.map((seg, index) => {
          if (!totalDuration) return null;
          const leftPct = (seg.start / totalDuration) * 100;
          const widthPct = ((seg.end - seg.start) / totalDuration) * 100;
          return <button key={index} className="absolute top-0 h-full z-30" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} onClick={() => handleSegmentProgressClick(index)} title={`Jump to segment ${index + 1}`} />;
        })}
      </div>
    );
  };

  // ──── Render ────
  if (!isOpen || !podcast) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black overflow-hidden">
      <div ref={mainContainerRef} className={`h-full flex flex-col ${isFullScreen ? 'lg:flex-col' : 'lg:flex-row'}`}>

        {/* ── Video/Image Area ── */}
        <div
          ref={videoAreaRef}
          className={`flex-1 relative bg-white dark:bg-black overflow-hidden ${isFullScreen ? 'w-full lg:w-full' : 'lg:w-[70%]'}`}
          onMouseMove={handleVideoAreaMouseMove}
          onTouchStart={handleTouchStart}
          onClick={() => setShowControls(true)}
        >
          {/* Top Navigation */}
          <div className={`absolute top-0 left-0 right-0 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                <Button onClick={handleClose} variant="ghost" size="icon" className="text-white hover:bg-white/20"><X className="h-5 w-5 md:h-6 md:w-6" /></Button>
                <div className="text-white max-w-[60vw] md:max-w-lg"><h1 className="text-xs md:text-sm font-medium truncate">{!isPodcastDataLoaded ? 'Loading podcast...' : podcast.title}</h1></div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <Button variant="ghost" size="icon" onClick={handleShare} className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10" disabled={!isPodcastDataLoaded}><Share2 className="h-4 w-4 md:h-5 md:w-5" /></Button>
                {isPodcastDataLoaded && podcast?.duration === 0 && (
                  <Button variant="outline" size="sm" onClick={reprocessAudio} className="ml-2 text-white border-white/30" disabled={isReprocessing}>{isReprocessing ? 'Processing…' : 'Reprocess audio'}</Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 hidden sm:flex" disabled={!isPodcastDataLoaded}>
                  {isFullScreen ? <Minimize2 className="h-4 w-4 md:h-5 md:w-5" /> : <Maximize2 className="h-4 w-4 md:h-5 md:w-5" />}
                </Button>
                <div className="md:hidden">
                  <Button variant="ghost" size="icon" onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="text-white hover:bg-white/20 h-8 w-8" disabled={!isPodcastDataLoaded}><Menu className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </div>

          {/* Video/Image Content */}
          <div className="w-full h-full flex items-center justify-center">
            {currentVisualAsset ? (
              <div className="w-full h-full relative">
                {(isVideoFlow || currentVisualAsset.type === 'video') ? (
                  <video
                    ref={videoRef}
                    {...(isVideoFlow ? {} : { src: currentVisualAsset.url })}
                    className="w-full h-full object-contain"
                    loop={!isVideoFlow}
                    {...(isVideoFlow ? {} : { muted: true })}
                    playsInline
                    key={isVideoFlow ? 'videoflow-player' : (currentVisualAsset.url || 'video')}
                    autoPlay={!isVideoFlow && isPlaying}
                    onCanPlay={() => { if (!isVideoFlow && videoRef.current && isPlaying) { videoRef.current.play().catch(() => {}); } }}
                  />
                ) : (
                  <div className="w-full h-full relative bg-black">
                    {prevVisualAsset && (
                      <img src={prevVisualAsset.url} alt={prevVisualAsset.concept} loading="eager" decoding="async"
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-600 ease-out ${currentImageVisible ? 'opacity-0' : 'opacity-100'}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/1792x1024/333/white?text=${encodeURIComponent(prevVisualAsset.concept)}`; }}
                      />
                    )}
                    {currentVisualAsset && (
                      <img src={currentVisualAsset.url} alt={currentVisualAsset.concept} loading="eager" decoding="async"
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-600 ease-out ${currentImageVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                        onLoad={() => { setImageReady(true); setCurrentImageVisible(true); }}
                        onError={(e) => { setImageReady(true); setCurrentImageVisible(true); (e.target as HTMLImageElement).src = `https://placehold.co/1792x1024/333/white?text=${encodeURIComponent(currentVisualAsset.concept)}`; if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); audio.setIsPlaying(false); } toast.error('Image failed to load. Audio has been paused.'); }}
                        key={currentVisualAsset.url}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : podcast?.cover_image_url ? (
              <img src={podcast.cover_image_url} alt={podcast.title || 'Podcast cover'} loading="eager" decoding="async" className="w-full h-full object-contain" key={podcast.cover_image_url} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-black">
                <Radio className="h-24 w-24 md:h-32 md:w-32 text-gray-400 dark:text-gray-700" />
              </div>
            )}

            {/* Loading overlays */}
            {!isPodcastDataLoaded && !isClosing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-black/70 z-20">
                <div className="text-center"><Loader2 className="h-12 w-12 md:h-16 md:w-16 animate-spin text-black dark:text-white mx-auto mb-4" /><p className="text-black dark:text-white text-sm">Loading podcast...</p></div>
              </div>
            )}
            {isPodcastDataLoaded && !isClosing && (loadingAudio || mediaLoading || (hasAudioSource && effectiveLoadedCount === 0 && isBatchLoading && !podcast?.is_live) || (!isVideoFlow && hasSegmentImages && !!currentVisualAsset && !imageReady)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                <div className="text-center"><Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-white mx-auto mb-2" /><p className="text-white text-sm">Loading segments...</p></div>
              </div>
            )}
            {isPodcastDataLoaded && podcast?.is_live && !isSegmentsLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 p-4">
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs mb-3">LIVE</div>
                <h3 className="text-white text-lg font-semibold mb-2">{podcast.title}</h3>
                <p className="text-white/90 text-sm mb-4">This session is live but not being recorded.</p>
                <div className="flex items-center gap-3">
                  <Button className="bg-red-600" onClick={() => { onClose(); onPodcastSelect?.(podcast.id); }}>Join Live</Button>
                  <Button variant="ghost" onClick={() => {}}>
                    <Users className="h-4 w-4 mr-2 inline" />
                    {((podcast as any)?.live_listeners ?? (podcast as any)?.member_count ?? podcast?.listen_count ?? 0)} participants
                  </Button>
                </div>
              </div>
            )}
            {isPodcastDataLoaded && effectiveLoadedCount === 0 && !podcast?.is_live && mediaLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 dark:bg-black/70 z-20">
                <div className="text-center">
                  {!isOnline ? (
                    <>
                      <Radio className="h-12 w-12 md:h-16 md:w-16 text-red-500 mx-auto mb-4" />
                      <p className="text-red-600 dark:text-red-400 text-base font-semibold mb-2">No internet connection</p>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition" onClick={() => window.location.reload()}>Retry</button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-12 w-12 md:h-16 md:w-16 animate-spin text-black dark:text-white mx-auto mb-4" />
                      <p className="text-black dark:text-white text-sm mb-2">Loading audio segments...</p>
                      {!loadingAudio && <div className="mt-2 text-red-600 dark:text-red-400 font-semibold">This podcast was not recorded or the recording is unavailable.</div>}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Hidden audio element – no src here; playSegment / playFullAudio set it after resolving signed URLs */}
            {!isVideoFlow && <audio ref={audioRef} className="hidden" onCanPlay={() => setAudioReady(true)} />}

            {/* Center Play Button (Desktop) */}
            {(!isPodcastDataLoaded || effectiveLoadedCount === 0) ? null : (
              (!isPlaying || showControls) && !loadingAudio && !autoAdvancingRef.current ? (
                <button onClick={handlePlayPause} className="absolute inset-0 hidden md:flex items-center justify-center group" disabled={effectiveLoadedCount === 0}>
                  <div className="bg-black/50 group-hover:bg-black/70 rounded-full p-6 md:p-8 transition-all transform group-hover:scale-110">
                    {replay ? <RefreshCcw className="h-12 w-12 md:h-20 md:w-20 text-white" /> : isPlaying ? <Pause className="h-12 w-12 md:h-20 md:w-20 text-white" /> : <Play className="h-12 w-12 md:h-20 md:w-20 text-white ml-2 md:ml-3" />}
                  </div>
                </button>
              ) : null
            )}

            {/* Desktop Bottom Controls */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 md:p-4 transition-all duration-300 hidden md:block ${showControls && effectiveLoadedCount > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={handleControlsMouseEnter}
              onMouseLeave={handleControlsMouseLeave}
            >
              <div className="mb-3 md:mb-4">
                <SegmentedProgressBar />
                <div className="flex justify-between text-xs text-gray-300 mt-1 md:mt-2">
                  <span>{formatTime(displayCurrent)}</span>
                  <span>{formatTime(displayTotalDuration)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-4">
                  <Button variant="ghost" size="icon" onClick={handlePreviousSegment} disabled={loadingAudio || effectiveLoadedCount === 0} className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"><SkipBack className="h-3 w-3 md:h-4 md:w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10" disabled={loadingAudio || effectiveLoadedCount === 0}>
                    {loadingAudio ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> : replay ? <RefreshCcw className="h-4 w-4 md:h-5 md:w-5" /> : isPlaying ? <Pause className="h-4 w-4 md:h-5 md:w-5" /> : <Play className="h-4 w-4 md:h-5 md:w-5 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNextSegment} disabled={!podcast || loadingAudio || effectiveLoadedCount === 0} className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8"><SkipForward className="h-3 w-3 md:h-4 md:w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={handleToggleMute} className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8" disabled={effectiveLoadedCount === 0}>{isMuted ? <VolumeX className="h-3 w-3 md:h-4 md:w-4" /> : <Volume2 className="h-3 w-3 md:h-4 md:w-4" />}</Button>
                  <div className="text-white text-xs md:text-sm ml-1 md:ml-2">{effectiveLoadedCount > 0 ? `${currentSegmentIndex + 1} / ${effectiveSegmentCount}` : (isBatchLoading ? 'Loading...' : '')}</div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowTranscript(!showTranscript)} className={`text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8 ${showTranscript ? 'bg-white/20' : ''}`} disabled={effectiveLoadedCount === 0}><Captions className="h-3 w-3 md:h-4 md:w-4" /></Button>
                  {podcast?.is_live && (
                    <Button variant={showLiveCaptions ? 'secondary' : 'ghost'} size="icon" onClick={() => setShowLiveCaptions(v => !v)} className={showLiveCaptions ? 'bg-blue-600 text-white' : ''} title={showLiveCaptions ? 'Hide Live Captions' : 'Show Live Captions'}><Captions className="h-3 w-3 md:h-4 md:w-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={handleSpeedChange} className="text-white hover:bg-white/20 h-7 w-7 md:h-8 md:w-8" disabled={effectiveLoadedCount === 0}><span className="text-xs">{playbackSpeed}x</span></Button>
                </div>
                {showLiveCaptions && podcast?.is_live && (
                  <div className="pointer-events-none fixed left-0 right-0 bottom-24 md:bottom-12 z-[100] flex flex-col items-center px-2 md:px-0">
                    <div className="max-w-2xl w-full bg-black/80 text-white rounded-xl p-3 text-base md:text-lg shadow-xl animate-fade-in-up" style={{ wordBreak: 'break-word', minHeight: 40 }}>
                      {liveCaptions.length === 0 ? <span className="opacity-60">Waiting for live captions...</span> : <span>{liveCaptions[liveCaptions.length - 1]}</span>}
                    </div>
                    {liveCaptions.length > 1 && (
                      <div className="max-w-2xl w-full mt-1 text-xs text-gray-200 text-center opacity-70">
                        {liveCaptions.slice(-4, -1).map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Segment indicator */}
            {effectiveLoadedCount > 0 && effectiveSegmentCount > 1 && (
              <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm">{isVideoFlow ? 'Clip' : 'Segment'} {currentSegmentIndex + 1} of {effectiveSegmentCount}</div>
            )}
            {effectiveLoadedCount === 0 && isBatchLoading && (
              <div className="absolute top-3 left-3 bg-black/80 text-white px-2 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm"><Loader2 className="h-3 w-3 inline mr-1 animate-spin" />Loading segments...</div>
            )}

            {/* Mobile Progress Bar */}
            {effectiveLoadedCount > 0 && (
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

        {/* Mobile Controls */}
        <div className="md:hidden"><MobileControls /></div>

        {/* ── Desktop Sidebar (30%) ── */}
        <div className={`${isFullScreen ? 'hidden' : 'hidden lg:block w-[30%]'} bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 overflow-y-auto`}>
          <div className="p-4">
            <div className="mb-6">
              <h1 className="text-black dark:text-white font-bold text-lg mb-2">{!isPodcastDataLoaded ? 'Loading...' : (
                isEditingTitle ? (
                  <span className="flex items-center gap-2">
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelEditingTitle(); }}
                      className="text-lg font-bold h-8 px-2"
                      maxLength={150}
                      disabled={isSavingTitle}
                    />
                    <Button variant="ghost" size="icon" onClick={saveTitle} disabled={isSavingTitle} className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={cancelEditingTitle} className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></Button>
                  </span>
                ) : (
                  <span className="group flex items-center gap-1">
                    {podcast.title}
                    {isOwner && <button onClick={startEditingTitle} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Edit title"><Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" /></button>}
                  </span>
                )
              )}</h1>
              {isPodcastDataLoaded ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{displayListenCount !== null ? displayListenCount : podcast.listen_count || 0} listens</span>
                    <span className="text-gray-600 dark:text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{podcast.duration || 0}m</span>
                    <span className="text-gray-600 dark:text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{new Date(podcast.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10"><AvatarImage src={creatorInfo?.avatar_url || undefined} /><AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{creatorInfo?.display_name?.charAt(0) || 'C'}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-black dark:text-white">{creatorInfo?.display_name || 'Creator'}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <Button onClick={() => setLiked(!liked)} variant="ghost" size="sm" className={`gap-2 px-0 ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`} disabled={!isPodcastDataLoaded}><ThumbsUp className="h-4 w-4" />Like</Button>
                        <Button onClick={handleShare} variant="ghost" size="sm" className="gap-2 px-0 text-gray-600 dark:text-gray-400" disabled={!isPodcastDataLoaded}><Share2 className="h-4 w-4" />Share</Button>
                      </div>
                    </div>
                  </div>
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
                  <div className="flex items-center gap-3"><div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-24"></div><div className="flex gap-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-12"></div><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-12"></div></div></div></div>
                  <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                </div>
              )}

              {/* Transcript Toggle */}
              <div className="mb-4">
                <Button variant="outline" size="sm" onClick={() => setShowTranscript(!showTranscript)} className="w-full justify-between text-black dark:text-white border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" disabled={!isPodcastDataLoaded}>
                  <span className="flex items-center gap-2">{isBatchLoading && loadedCount === 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}{isBatchLoading && loadedCount === 0 ? 'Loading transcript...' : 'Transcript'}</span>
                  {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showTranscript && (
                  <div ref={transcriptContainerRef} className="mt-3 max-h-60 overflow-y-auto">
                    {/* Progressive transcript: render loaded segments + skeletons for loading ones */}
                    {audioSegmentsNormalized.map((segment, index) => {
                      const state = segmentLoadStates[index];
                      const isLoaded = state?.loaded;
                      const isLoading = state?.loading;

                      // In video flow, all transcript segments are always "loaded" (audio is embedded in video)
                      // Skeleton placeholder for not-yet-loaded segments (audio flow only)
                      if (!isLoaded && !isVideoFlow) {
                        return (
                          <div key={index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 mb-2 animate-pulse">
                            <div className="flex items-start gap-2">
                              <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-700 flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-full bg-gray-300 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-5/6 bg-gray-300 dark:bg-gray-700 rounded" />
                              </div>
                            </div>
                            {isLoading && <div className="mt-1 text-xs text-gray-400">Loading segment {index + 1}...</div>}
                          </div>
                        );
                      }

                      // Loaded segment — full content
                      return (
                        <div
                          key={index}
                          ref={(el) => { segmentRefs.current[index] = el; }}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-300 mb-2 ${
                            (isVideoFlow && videoClips.length > 0
                              ? Array.isArray(videoClips[currentSegmentIndex]?.segmentIndices) && videoClips[currentSegmentIndex].segmentIndices!.includes(index)
                              : index === currentSegmentIndex)
                              ? 'bg-gray-200 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-900'}`}
                          onClick={() => {
                            if (isVideoFlow && videoClips.length > 0) {
                              const clipIdx = videoClips.findIndex(c => Array.isArray(c.segmentIndices) && c.segmentIndices.includes(index));
                              playSegment(clipIdx >= 0 ? clipIdx : 0);
                            } else if (isSingleAudio) {
                              handleSegmentProgressClick(index);
                            } else {
                              playSegment(index);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${(isVideoFlow && videoClips.length > 0 ? Array.isArray(videoClips[currentSegmentIndex]?.segmentIndices) && videoClips[currentSegmentIndex].segmentIndices!.includes(index) : index === currentSegmentIndex) ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}><Play className="h-3 w-3 text-white" /></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1"><span className="text-sm font-medium text-black dark:text-white">{segment.speaker}</span><span className="text-xs text-gray-600 dark:text-gray-400">#{index + 1}</span></div>
                              <div>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">{segment.text}</p>
                                {segment.transcript && segment.transcript !== segment.text && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">{segment.transcript}</p>}
                                {segment.summary && !segment.transcript && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{segment.summary}</p>}
                                <div className="mt-2 flex items-center gap-2">
                                  {segment.audio_url && <a href={segment.audio_url} target="_blank" rel="noreferrer" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600"><Download className="inline-block mr-1 h-4 w-4 align-middle" />Download</a>}
                                  {segment.transcript && (
                                    <button className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 flex items-center gap-1" onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(segment.transcript || ''); toast.success('Transcript copied'); } catch (_) { toast.error('Copy failed'); } }}><MessageSquare className="h-4 w-4" /> Copy</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Batch loading sentinel + indicator */}
                    {!isSegmentsLoaded && (
                      <div ref={batchSentinelRef} className="py-3 text-center">
                        {isBatchLoading ? (
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading more segments ({loadedCount}/{audioSegmentsNormalized.length})...
                          </div>
                        ) : (
                          <button onClick={loadNextBatch} className="text-sm text-blue-500 hover:text-blue-600">
                            Load more segments
                          </button>
                        )}
                      </div>
                    )}

                    {isSegmentsLoaded && audioSegmentsNormalized.length === 0 && !loadingAudio && <div className="text-sm text-gray-500">Transcript not available.</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Listeners */}
            <h3 className="text-black dark:text-white font-semibold mb-2 text-lg">Listeners</h3>
            <div className="mb-4">
              <div className="max-h-40 overflow-y-auto space-y-2 p-2">
                {listenersList.length === 0 && !listenersLoading ? <div className="text-sm text-gray-500">No listeners yet</div> : listenersList.map((u, idx) => (
                  <div key={u?.id || idx} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900">
                    <Avatar className="h-8 w-8"><AvatarImage src={u?.avatar_url} /><AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{(u?.display_name || 'U').charAt(0)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-black dark:text-white truncate">{u?.display_name || u?.id}</div></div>
                  </div>
                ))}
                {listenersLoading && <div className="py-2 text-center text-sm text-gray-500">Loading listeners...</div>}
                <div ref={listenersSentinelRef} />
              </div>
            </div>

            {/* Related Podcasts */}
            <h3 className="text-black dark:text-white font-semibold mb-4 text-lg">Related Content</h3>
            <div className="space-y-2 overflow-y-auto max-h-96 p-2">
              {relatedPodcasts.map((rp, rpIdx) => (
                <div key={`${rp.id}_${rpIdx}`} className="flex gap-3 cursor-pointer group" onClick={() => onPodcastSelect?.(rp.id)}>
                  <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    {rp.cover_image_url ? <img src={rp.cover_image_url} alt={rp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />}
                    <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1.5 py-0.5"><span className="text-white text-xs">{rp.duration_minutes || 0}m</span></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-blue-600">{rp.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400"><Eye className="h-3 w-3" /><span>{rp.listen_count || 0} views</span></div>
                  </div>
                </div>
              ))}
              {relatedLoading && <div className="py-2 text-center text-sm text-gray-500">Loading more content...</div>}
              <div ref={relatedSentinelRef} />
            </div>
          </div>
        </div>

        {/* ── Mobile Info Area ── */}
        <div className="md:hidden bg-white dark:bg-black border-t border-gray-300 dark:border-gray-800 overflow-y-auto">
          <div className="p-4">
            <div className="mb-4">
              <h1 className="text-black dark:text-white font-bold text-lg mb-2">{!isPodcastDataLoaded ? 'Loading...' : (
                isEditingTitle ? (
                  <span className="flex items-center gap-2">
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelEditingTitle(); }}
                      className="text-lg font-bold h-8 px-2"
                      maxLength={150}
                      disabled={isSavingTitle}
                    />
                    <Button variant="ghost" size="icon" onClick={saveTitle} disabled={isSavingTitle} className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={cancelEditingTitle} className="h-7 w-7 shrink-0 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></Button>
                  </span>
                ) : (
                  <span className="group flex items-center gap-1">
                    {podcast.title}
                    {isOwner && <button onClick={startEditingTitle} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Edit title"><Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" /></button>}
                  </span>
                )
              )}</h1>
              {isPodcastDataLoaded ? (
                <>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-3">
                    <span>{displayListenCount !== null ? displayListenCount : podcast.listen_count || 0} listens</span><span>•</span><span>{podcast.duration || 0}m</span><span>•</span><span>{new Date(podcast.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10"><AvatarImage src={creatorInfo?.avatar_url || undefined} /><AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{creatorInfo?.display_name?.charAt(0) || 'C'}</AvatarFallback></Avatar>
                      <div><h3 className="font-semibold text-black dark:text-white text-sm">{creatorInfo?.display_name || 'Creator'}</h3></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => setLiked(!liked)} variant="ghost" size="icon" className={`h-8 w-8 ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`} disabled={!isPodcastDataLoaded}><ThumbsUp className="h-4 w-4" /></Button>
                      <Button onClick={handleShare} variant="ghost" size="icon" className="h-8 w-8 text-gray-600 dark:text-gray-400" disabled={!isPodcastDataLoaded}><Share2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse flex-1"></div><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-16"></div></div>
                  <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-24"></div></div><div className="flex gap-2"><div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div><div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div></div></div>
                </div>
              )}
              {podcast.description && (
                <div className="mb-4">
                  <Button variant="ghost" className="w-full justify-between text-black dark:text-white px-0" onClick={() => setShowMoreInfo(!showMoreInfo)} disabled={!isPodcastDataLoaded}>
                    <span className="text-sm">Description</span>{isPodcastDataLoaded && (showMoreInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </Button>
                  {showMoreInfo && isPodcastDataLoaded && <div className="mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-3"><p className="text-gray-700 dark:text-gray-300 text-sm">{podcast.description}</p></div>}
                </div>
              )}

              {/* Mobile Transcript */}
              <div className="mb-4">
                <Button variant="ghost" className="w-full justify-between text-black dark:text-white px-0" onClick={() => setShowTranscript(!showTranscript)} disabled={!isPodcastDataLoaded}>
                  <span className="flex items-center gap-2 text-sm">{isBatchLoading && loadedCount === 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}{isBatchLoading && loadedCount === 0 ? 'Loading transcript...' : 'Transcript'}</span>
                  {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showTranscript && (
                  <div className="mt-3 max-h-60 overflow-y-auto">
                    {/* Mobile progressive transcript */}
                    {audioSegmentsNormalized.map((segment, index) => {
                      const state = segmentLoadStates[index];
                      const isLoaded = state?.loaded;
                      const isLoadingSeg = state?.loading;

                      // In video flow, all transcript segments are always "loaded" (audio is embedded in video)
                      if (!isLoaded && !isVideoFlow) {
                        return (
                          <div key={index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 mb-2 animate-pulse">
                            <div className="flex items-start gap-2">
                              <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-700 flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-full bg-gray-300 dark:bg-gray-700 rounded" />
                                <div className="h-3 w-5/6 bg-gray-300 dark:bg-gray-700 rounded" />
                              </div>
                            </div>
                            {isLoadingSeg && <div className="mt-1 text-xs text-gray-400">Loading segment {index + 1}...</div>}
                          </div>
                        );
                      }

                      return (
                        <div key={index} className={`p-3 rounded-lg cursor-pointer transition-all duration-300 mb-2 ${
                          (isVideoFlow && videoClips.length > 0
                            ? Array.isArray(videoClips[currentSegmentIndex]?.segmentIndices) && videoClips[currentSegmentIndex].segmentIndices!.includes(index)
                            : index === currentSegmentIndex)
                            ? 'bg-gray-200 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-900'}`}
                          onClick={() => {
                            if (isVideoFlow && videoClips.length > 0) {
                              const clipIdx = videoClips.findIndex(c => Array.isArray(c.segmentIndices) && c.segmentIndices.includes(index));
                              playSegment(clipIdx >= 0 ? clipIdx : 0);
                            } else if (isSingleAudio) {
                              handleSegmentProgressClick(index);
                            } else {
                              playSegment(index);
                            }
                          }}>
                          <div className="flex items-start gap-2">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${(isVideoFlow && videoClips.length > 0 ? Array.isArray(videoClips[currentSegmentIndex]?.segmentIndices) && videoClips[currentSegmentIndex].segmentIndices!.includes(index) : index === currentSegmentIndex) ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}><Play className="h-3 w-3 text-white" /></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1"><span className="text-sm font-medium text-black dark:text-white">{segment.speaker}</span><span className="text-xs text-gray-600 dark:text-gray-400">#{index + 1}</span></div>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">{segment.text}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Mobile batch sentinel */}
                    {!isSegmentsLoaded && (
                      <div ref={batchSentinelRef} className="py-3 text-center">
                        {isBatchLoading ? (
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading segments ({loadedCount}/{audioSegmentsNormalized.length})...
                          </div>
                        ) : (
                          <button onClick={loadNextBatch} className="text-sm text-blue-500 hover:text-blue-600">Load more</button>
                        )}
                      </div>
                    )}

                    {isSegmentsLoaded && audioSegmentsNormalized.length === 0 && !loadingAudio && <div className="text-sm text-gray-500">Transcript not available.</div>}
                  </div>
                )}
                <div className="mb-4 overflow-y-auto max-h-[500px]">
                  {/* Mobile Listeners */}
                  <div className="mb-4">
                    <Button variant="ghost" className="w-full justify-between text-black dark:text-white px-0" onClick={() => setShowMobileListeners(!showMobileListeners)} disabled={!isPodcastDataLoaded}>
                      <span className="flex items-center gap-2 text-sm">Listeners</span>{showMobileListeners ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {showMobileListeners && (
                      <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-2">
                        {listenersList.length === 0 && !listenersLoading ? <div className="text-sm text-gray-500">No listeners yet</div> : listenersList.map((u, idx) => (
                          <div key={u?.id || idx} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900">
                            <Avatar className="h-8 w-8"><AvatarImage src={u?.avatar_url} /><AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{(u?.display_name || 'U').charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0"><div className="text-sm font-medium text-black dark:text-white truncate">{u?.display_name || u?.id}</div></div>
                          </div>
                        ))}
                        {listenersLoading && <div className="py-2 text-center text-sm text-gray-500">Loading listeners...</div>}
                        <div ref={listenersSentinelRef} />
                      </div>
                    )}
                  </div>
                  {/* Mobile Related */}
                  <div className="mb-6">
                    <Button variant="ghost" className="w-full justify-between text-black dark:text-white px-0" onClick={() => setShowMobileRelated(!showMobileRelated)} disabled={!isPodcastDataLoaded}>
                      <span className="flex items-center gap-2 text-sm">Related Content</span>{showMobileRelated ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {showMobileRelated && (
                      <div className="mt-3 space-y-4">
                        {relatedPodcasts.map((rp, rpIdx) => (
                          <div key={`${rp.id}_${rpIdx}`} className="flex gap-3 cursor-pointer group" onClick={() => onPodcastSelect?.(rp.id)}>
                            <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                              {rp.cover_image_url ? <img src={rp.cover_image_url} alt={rp.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />}
                              <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1 py-0.5"><span className="text-white text-xs">{rp.duration_minutes || 0}m</span></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-blue-600">{rp.title}</h4>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400"><Eye className="h-3 w-3" /><span>{rp.listen_count || 0} listens</span></div>
                            </div>
                          </div>
                        ))}
                        {relatedLoading && <div className="py-2 text-center text-sm text-gray-500">Loading more content...</div>}
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

      {/* Mobile Sidebar Sheet */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="right" className="w-full sm:w-96 bg-white dark:bg-black border-l border-gray-300 dark:border-gray-800 p-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-black dark:text-white font-semibold text-lg">Related Content</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowMobileSidebar(false)} className="text-black dark:text-white"><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-4">
              {relatedPodcasts.map((rp, rpIdx) => (
                <div key={`${rp.id}_${rpIdx}`} className="flex gap-3 cursor-pointer group" onClick={() => { onPodcastSelect?.(rp.id); setShowMobileSidebar(false); }}>
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    {rp.cover_image_url ? <img src={rp.cover_image_url} alt={rp.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-black" />}
                    <div className="absolute bottom-1 right-1 bg-black/90 rounded px-1 py-0.5"><span className="text-white text-xs">{rp.duration_minutes || 0}m</span></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-black dark:text-white text-sm font-medium line-clamp-2 group-hover:text-red-500">{rp.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400"><Eye className="h-3 w-3" /><span>{rp.listen_count || 0} listens</span></div>
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
