import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/modules/ui/components/button';
import { cn } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';

export interface ClipPlayerProps {
  audioUrl?: string | null;
  title?: string;
  currentTime?: number | null;
  duration?: number | null;
  onSeek?: (time: number) => void;
  onPlayPause?: (playing: boolean) => void;
  onClose?: () => void;
}

export const ClipPlayer = ({
  audioUrl,
  title,
  currentTime = 0,
  duration = 0,
  onSeek,
  onPlayPause,
  onClose,
}: ClipPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);

  const trackTime = currentTime ?? localTime;
  const trackDuration = duration ?? localDuration;

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!audioUrl) return;

    // Reuse or create a single shared HTMLAudioElement.
    let a: HTMLAudioElement | null = null;
    if (audioRef.current) {
      a = audioRef.current;
    } else {
      a = new Audio(audioUrl);
      audioRef.current = a;

      const onEnded = () => {
        setPlaying(false);
        onPlayPause?.(false);
      };
      a.addEventListener('timeupdate', () => setLocalTime(a!.currentTime));
      a.addEventListener('loadedmetadata', () => setLocalDuration(a!.duration));
      a.addEventListener('ended', onEnded);
    }

    if (playing && !a.paused) {
      a.play().catch(() => setPlaying(false));
    } else if (!playing && a) {
      a.pause();
    }

    return () => {
      // keep ref reusable across mounts (parent may swap audioUrl)
    };
  }, [audioUrl]);

  // Sync internal playing state with the shared audio element.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing && a.paused) {
      a.play().catch(() => setPlaying(false));
    } else if (!playing && !a.paused) {
      a.pause();
    }
  }, [playing]);

  const togglePlay = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    onPlayPause?.(next);
  }, [playing, onPlayPause]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setLocalTime(t);
    onSeek?.(t);
    const a = audioRef.current;
    if (a) {
      a.currentTime = t;
    }
  };

  const jump = (delta: number) => {
    const next = Math.max(0, Math.min(trackDuration, trackTime + delta));
    setLocalTime(next);
    onSeek?.(next);
    const a = audioRef.current;
    if (a) {
      a.currentTime = next;
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  // Release resources on unmount.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
    };
  }, []);

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-4 shadow-sm',
        'w-full max-w-[480px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {title && (
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {title}
          </h4>
        )}
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded p-1 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Waveform placeholder */}
      <div className="h-12 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-gray-700 mb-4 relative flex items-center justify-center">
        <div className="flex items-end gap-0.5 w-full px-2">
          {Array.from({ length: 40 }).map((_, i) => {
            const barHeight = 16 + Math.sin(i * 0.7) * 14;
            return (
              <div
                key={i}
                className={cn(
                  'w-1 rounded-full bg-primary-500 transition-[height] duration-200',
                  playing && 'opacity-70',
                )}
                style={{
                  height: `${barHeight}px`,
                  opacity: playing ? undefined : 0.25,
                  animation: playing
                    ? 'pulse 1.2s ease-in-out infinite'
                    : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.7 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          className="bg-secondary-50 text-secondary-700 border-secondary-200 hover:bg-secondary-100 dark:bg-secondary-950/50 dark:text-secondary-300 dark:border-secondary-800"
          disabled={!audioUrl}
        >
          {playing ? (
            <>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" /> Play
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => jump(-5)}
          disabled={!audioUrl}
          className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            <polygon points="19 20 9 12 19 4 19 20" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </svg>
          Rewind
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => jump(5)}
          disabled={!audioUrl}
          className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
          Forward
        </Button>
      </div>

      {/* Seek bar */}
      <div className="mb-2">
        <input
          type="range"
          min={0}
          max={trackDuration || 100}
          step={0.1}
          value={trackTime}
          onChange={handleSeekChange}
          className="w-full h-2 appearance-none cursor-pointer rounded-full bg-slate-200 dark:bg-gray-700 accent-primary-500"
          aria-label="Seek"
        />
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-3">
        <span>{formatTime(trackTime)}</span>
        <span>{formatTime(trackDuration)}</span>
      </div>

      {/* Status */}
      <div className="flex justify-center">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
            playing
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300'
              : trackTime > 0 || trackDuration > 0
              ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
          )}
        >
          {playing
            ? 'Playing'
            : trackTime > 0 || trackDuration > 0
            ? 'Paused'
            : 'Not started'}
        </span>
      </div>
    </div>
  );
};
