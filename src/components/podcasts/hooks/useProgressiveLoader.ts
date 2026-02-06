// useProgressiveLoader.ts - YouTube-style progressive/lazy loading for segments & transcripts
import { useState, useRef, useEffect, useCallback } from 'react';
import { resolveSignedUrl } from '../podcastUtils';
import type { PodcastData, SegmentLoadState } from '../podcastTypes';

export interface UseProgressiveLoaderOptions {
  podcast: PodcastData | null;
  isOpen: boolean;
}

export interface UseProgressiveLoaderReturn {
  /** Per-segment load state (loaded / loading / error) */
  segmentLoadStates: SegmentLoadState[];
  /** True once ALL segments have been loaded */
  isSegmentsLoaded: boolean;
  /** How many segments are loaded so far */
  loadedCount: number;
  /** Request the next batch to load (called on scroll or manually) */
  loadNextBatch: () => void;
  /** Whether a batch is currently loading */
  isBatchLoading: boolean;
  /** Per-transcript visibility (set true when IntersectionObserver fires) */
  transcriptVisible: Map<number, boolean>;
  /** Callback to mark a transcript segment as visible */
  onTranscriptVisible: (index: number) => void;
  /** Ref to attach to the "load more" sentinel at the bottom of loaded segments */
  batchSentinelRef: React.RefObject<HTMLDivElement | null>;
}

const BATCH_SIZE = 5;

export function useProgressiveLoader({ podcast, isOpen }: UseProgressiveLoaderOptions): UseProgressiveLoaderReturn {
  const [segmentLoadStates, setSegmentLoadStates] = useState<SegmentLoadState[]>([]);
  const [nextBatchStart, setNextBatchStart] = useState(0);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [isSegmentsLoaded, setIsSegmentsLoaded] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState<Map<number, boolean>>(new Map());
  const signedUrlCacheRef = useRef<Map<string, string>>(new Map());
  const batchSentinelRef = useRef<HTMLDivElement | null>(null);

  const loadedCount = segmentLoadStates.filter(s => s.loaded).length;

  // ──── Load a batch of segments starting at `startIdx` ────
  const loadBatchInternal = useCallback(async (startIdx: number) => {
    if (!podcast?.audioSegments || podcast.audioSegments.length === 0) return;
    const segments = podcast.audioSegments;
    const endIdx = Math.min(startIdx + BATCH_SIZE, segments.length);
    if (startIdx >= segments.length) {
      setIsSegmentsLoaded(true);
      return;
    }

    setIsBatchLoading(true);

    // Mark batch as loading
    setSegmentLoadStates(prev => {
      const next = [...prev];
      for (let i = startIdx; i < endIdx; i++) {
        next[i] = { index: i, loaded: false, loading: true, error: false };
      }
      return next;
    });

    // Resolve signed URLs for each segment (parallelised with stagger for visual effect)
    const batchPromises = segments.slice(startIdx, endIdx).map(async (seg, relIdx) => {
      const i = startIdx + relIdx;
      // Resolve signed URL as an optional enhancement — never block segment loading
      if (seg.audio_url) {
        try { await resolveSignedUrl(seg.audio_url, signedUrlCacheRef.current); } catch (_) { /* non-fatal */ }
      }
      // Stagger slightly for a visible progressive pop-in
      await new Promise(r => setTimeout(r, 60 + relIdx * 80));
      // Always mark as loaded — the segment data is available regardless of URL resolution
      setSegmentLoadStates(prev => {
        const next = [...prev];
        next[i] = { index: i, loaded: true, loading: false, error: false, data: seg };
        return next;
      });
    });

    await Promise.allSettled(batchPromises);
    setIsBatchLoading(false);

    const newNextStart = endIdx;
    setNextBatchStart(newNextStart);
    if (newNextStart >= segments.length) {
      setIsSegmentsLoaded(true);
    } else {
      // Auto-load next batch after a short pause (no sentinel needed)
      setTimeout(() => { loadBatchInternal(newNextStart); }, 150);
    }
  }, [podcast?.audioSegments]);

  // ──── Public: trigger loading the next batch ────
  const loadNextBatch = useCallback(() => {
    if (isBatchLoading || isSegmentsLoaded) return;
    loadBatchInternal(nextBatchStart);
  }, [isBatchLoading, isSegmentsLoaded, nextBatchStart, loadBatchInternal]);

  // ──── Mark a transcript segment as visible (lazy content reveal) ────
  const onTranscriptVisible = useCallback((index: number) => {
    setTranscriptVisible(prev => {
      if (prev.get(index)) return prev;
      const next = new Map(prev);
      next.set(index, true);
      return next;
    });
  }, []);

  // ──── Initialize when podcast changes ────
  // IMPORTANT: We depend on `podcast?.audioSegments?.length` in addition to
  // `podcast?.id` so that the loader re-initialises when Index.tsx transitions
  // from lightweight data (no audioSegments) to full data (with audioSegments).
  const segmentCount = podcast?.audioSegments?.length ?? 0;

  useEffect(() => {
    if (!isOpen || !podcast) return;
    const segments = podcast.audioSegments;
    if (!segments || segments.length === 0) {
      // No segments (e.g. single-audio podcast or lightweight data) → mark as loaded immediately
      setIsSegmentsLoaded(true);
      setSegmentLoadStates([]);
      setNextBatchStart(0);
      return;
    }

    // Reset everything for the new podcast / when segments arrive
    setIsSegmentsLoaded(false);
    setIsBatchLoading(false);
    setTranscriptVisible(new Map());
    signedUrlCacheRef.current.clear();
    setSegmentLoadStates(segments.map((_s, i) => ({ index: i, loaded: false, loading: false, error: false })));
    setNextBatchStart(0);

    // Kick off the first batch immediately
    loadBatchInternal(0);
  }, [podcast?.id, segmentCount, isOpen]);

  // ──── Handle podcasts with only audio_url (no segments) ────
  useEffect(() => {
    if (!isOpen || !podcast) return;
    const segments = podcast.audioSegments;
    if (segments && segments.length > 0) return;
    const rawAudioUrl = podcast.audio_url || (podcast as any).audioUrl;
    if (rawAudioUrl) {
      setIsSegmentsLoaded(true);
    }
  }, [podcast?.audioSegments, podcast?.audio_url, isOpen]);

  // ──── IntersectionObserver on the batch sentinel ────
  // When the sentinel at the bottom of the loaded segments becomes visible, load next batch
  useEffect(() => {
    if (!isOpen || isSegmentsLoaded || isBatchLoading) return;
    const sentinel = batchSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextBatch();
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [isOpen, isSegmentsLoaded, isBatchLoading, nextBatchStart, loadNextBatch]);

  return {
    segmentLoadStates,
    isSegmentsLoaded,
    loadedCount,
    loadNextBatch,
    isBatchLoading,
    transcriptVisible,
    onTranscriptVisible,
    batchSentinelRef,
  };
}
