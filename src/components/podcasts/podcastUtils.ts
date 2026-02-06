// podcastUtils.ts - Shared utility functions for PodcastPanel
import { supabase } from '../../integrations/supabase/client';
import type { AudioSegment, NormalizedSegment, PodcastData } from './podcastTypes';

/** Format seconds into m:ss display string */
export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Derive a single full-audio URL from the podcast data (if available) */
export const deriveFullAudioUrl = (podcast: PodcastData | null): string | undefined => {
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
    } catch (_e) {
      // ignore
    }
  }
  return undefined;
};

/** Resolve a Supabase storage URL into a signed URL */
export const resolveSignedUrl = async (
  url: string | undefined | null,
  cache: Map<string, string>
): Promise<string | undefined> => {
  if (!url) return undefined;
  try {
    const idx = url.indexOf('/podcasts/');
    if (idx === -1) return url;
    const path = url.substring(idx + '/podcasts/'.length);
    const cached = cache.get(path);
    if (cached) return cached;
    const { data, error } = await Promise.race([
      supabase.storage.from('podcasts').createSignedUrl(path, 3600),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Signed URL timeout') }), 8000)
      ),
    ]);
    if (error) {
      // console.error('[Podcast] Signed URL generation failed:', error);
      throw error;
    }
    const signed = data && (data.signedUrl || (data as any).signedURL || (data as any).signed_url);
    if (signed) {
      cache.set(path, signed);
      return signed;
    }
    return url;
  } catch (_e) {
    return url;
  }
};

/**
 * Normalize raw audio segments so the panel can render both AI-generated
 * and live-recorded segment shapes consistently.
 */
export const normalizeAudioSegments = (audioSegments: any[]): NormalizedSegment[] => {
  const mapped = (audioSegments || []).map((s: any, idx: number) => {
    const transcriptField = s?.transcript || s?.text || s?.summary || null;
    return {
      index: idx, // Always use sequential index for uniqueness
      speaker: s?.speaker || 'Speaker',
      text: typeof s?.text === 'string' && s.text.trim() ? s.text : (typeof transcriptField === 'string' ? transcriptField : ''),
      transcript: typeof s?.transcript === 'string' ? s.transcript : (typeof transcriptField === 'string' ? transcriptField : null),
      summary: s?.summary || null,
      audio_url: s?.audio_url || s?.audioUrl || null,
      audioContent: s?.audioContent || s?.audio_content || null,
      created_at: s?.created_at || s?.createdAt || null,
      raw: s
    } as NormalizedSegment;
  });

  // Deduplicate true DB duplicates by content signature (audio_url + speaker + text)
  const seen = new Set<string>();
  const deduped = mapped.filter(seg => {
    const key = `${seg.audio_url || ''}|${seg.speaker}|${seg.text || ''}`;
    if (key.length <= 2) return true; // Don't dedup empty/minimal segments
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Re-index after dedup to keep indices sequential
  return deduped.map((seg, i) => ({ ...seg, index: i }));
};
