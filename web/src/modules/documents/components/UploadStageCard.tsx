import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { useUploadActivity } from '../../../contexts/UploadActivityContext';

// ============================================================================
// UploadStageCard — real staged progress for the document upload screen.
// No simulated bars: upload % is bytes on the wire, analysis % comes from the
// server's own resume cursor (pages/rounds), and failures surface verbatim.
// ============================================================================

const fmtMB = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
};

const fmtEta = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '…';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r.toString().padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const STAGE_TITLES: Record<string, string> = {
  uploading: 'Uploading…',
  registering: 'Saving & registering…',
  extracting: 'Analyzing content…',
  completed: 'Processing complete',
  failed: 'Processing failed',
};

interface UploadStageCardProps {
  jobId: string | null;
}

export function UploadStageCard({ jobId }: UploadStageCardProps) {
  const { jobs } = useUploadActivity();
  const job = jobId ? jobs.find(j => j.id === jobId) : undefined;

  // Re-render every second while uploading so speed/ETA stay fresh.
  const [, setTickState] = useState(0);
  useEffect(() => {
    if (!job || job.stage !== 'uploading') return;
    const timer = window.setInterval(() => setTickState(t => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [job?.stage]);

  if (!job) return null;

  const pct = Math.min(100, Math.max(0, Math.round(job.percent)));
  const elapsedSec = Math.max(1, (Date.now() - job.startedAt) / 1000);
  const speedBps = job.uploadedBytes / elapsedSec;
  const etaSec = speedBps > 0 ? (job.fileSize - job.uploadedBytes) / speedBps : NaN;

  const isUploading = job.stage === 'uploading';
  const isRegistering = job.stage === 'registering';
  const isExtracting = job.stage === 'extracting';
  const isDone = job.stage === 'completed';
  const isFailed = job.stage === 'failed';

  const titleIcon = isUploading ? (
    <FileUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
  ) : isDone ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
  ) : isFailed ? (
    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
  ) : (
    <Loader2 className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-spin" />
  );

  const detailLine = isUploading
    ? `${fmtMB(job.uploadedBytes)} / ${fmtMB(job.fileSize)} · ${pct}%` +
      (job.partsTotal > 1 ? ` · part ${Math.min(job.partsDone + 1, job.partsTotal)} of ${job.partsTotal}` : '') +
      (speedBps > 0 ? ` · ${fmtMB(speedBps)}/s · ETA ${fmtEta(etaSec)}` : '')
    : isRegistering
      ? job.detail ?? 'Payload sent — creating your document record…'
      : isExtracting
        ? job.detail ?? 'AI analysis in progress…'
        : isDone
          ? job.detail ?? 'All done — your document is ready.'
          : job.error ?? 'Processing failed.';

  return (
    <div className="w-full max-w-md mx-auto bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm backdrop-blur text-left space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {titleIcon}
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold truncate ${
                isFailed
                  ? 'text-red-700 dark:text-red-300'
                  : isDone
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {STAGE_TITLES[job.stage]}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={job.fileName}>
              {job.fileName}
            </p>
          </div>
        </div>
        {(isUploading || isExtracting) && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            {pct}%
          </span>
        )}
      </div>

      {/* Bar: determinate for upload/extract when we have a real number,
          animated pulse while the server works without a known total. */}
      {(isUploading || isExtracting) && pct > 0 ? (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isUploading
                ? 'bg-blue-500'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : isUploading || isRegistering || isExtracting ? (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div className="h-2 w-1/3 rounded-full bg-blue-400/80 dark:bg-blue-500/70 animate-pulse" />
        </div>
      ) : null}

      {/* Part strip: one tick per storage chunk (770MB → 39 ticks) */}
      {isUploading && job.partsTotal > 1 && (
        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: job.partsTotal }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < job.partsDone
                  ? 'bg-blue-500'
                  : i === job.partsDone
                    ? 'bg-blue-300 dark:bg-blue-600 animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}

      <p
        className={`text-xs leading-relaxed ${
          isFailed
            ? 'text-red-600 dark:text-red-300'
            : isDone
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {detailLine}
      </p>

      {isExtracting && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Runs in the background — you can keep working; progress stays in the activity tray.
        </p>
      )}
    </div>
  );
}