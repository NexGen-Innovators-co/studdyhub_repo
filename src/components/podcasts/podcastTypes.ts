// podcastTypes.ts - Shared types for PodcastPanel and sub-components
import { PodcastData } from './PodcastGenerator';

// Types matching database schema exactly
export interface AudioSegment {
  speaker: string;
  text: string;
  audioContent?: string;
  audio_url?: string;
  transcript?: string | null;
  summary?: string | null;
  index: number;
  start_time?: number;
  end_time?: number;
  imageUrl?: string | null;
}

// Progressive loading segment state
export interface SegmentLoadState {
  index: number;
  loaded: boolean;
  loading: boolean;
  error: boolean;
  data?: AudioSegment;
}

export interface VisualAsset {
  type: 'image' | 'video';
  url: string;
  concept: string;
  segmentIndex?: number; // legacy support
  segmentIndices?: number[]; // NEW: supports multiple segments
  // Video clip fields (from Veo generation)
  transcript?: string;
  description?: string;
  hasAudio?: boolean;
  order?: number;
  duration?: number;
}

export interface PodcastPanelProps {
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

// Normalized segment shape used for rendering
export interface NormalizedSegment extends AudioSegment {
  created_at?: string | null;
  raw?: any;
}

export type { PodcastData };
