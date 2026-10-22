import { useState } from 'react';
import { Activity, CheckCircle2, ChevronDown, X, AlertCircle, Loader2, FileUp } from 'lucide-react';
import { useAppContext } from '../../../hooks/useAppContext';
import type { UploadJob } from '../../../contexts/UploadActivityContext';

// ============================================================================
// UploadActivityTray — floating bottom-right panel that keeps every document
// upload/processing job visible across the whole app, so users can navigate
// away and keep working ("background mode") without losing progress.
// ============================================================================

const CHIPS: Record<UploadJob['stage'], { label: string; className: string }> = {
  uploading: { label: 'Uploading', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200' },
  registering: { label: 'Saving', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200' },
  extracting: { label: 'Analyzing', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200' },
  completed: { label: 'Done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200' },
};

const StageIcon = ({ stage }: { stage: UploadJob['stage'] }) => {
  switch (stage) {
    case 'uploading':
      return <FileUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300 shrink-0" />;
    case 'extracting':
      return <Loader2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 animate-spin shrink-0" />;
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-300 shrink-0" />;
    default:
      return <FileUp className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300 shrink-0" />;
  }
};

interface UploadActivityTrayProps {
  jobs: UploadJob[];
  onDismiss: (id: string) => void;
}

export function UploadActivityTray({ jobs, onDismiss }: UploadActivityTrayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { setActiveTab } = useAppContext();

  if (jobs.length === 0) return null;

  const inProgress = jobs.filter(
    j => j.stage === 'uploading' || j.stage === 'registering' || j.stage === 'extracting',
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[19.5rem] max-w-[calc(100vw-2rem)] print:hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-2 rounded-full bg-slate-900/95 dark:bg-slate-700/95 text-white px-4 py-2 shadow-lg backdrop-blur cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          {inProgress > 0
            ? `${inProgress} file${inProgress > 1 ? 's' : ''} in progress`
            : `${jobs.length} recent upload${jobs.length > 1 ? 's' : ''}`}
        </span>
        <span className="flex items-center gap-1.5">
          {inProgress > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </span>
      </button>

      {!collapsed && (
        <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 shadow-xl backdrop-blur overflow-hidden">
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {jobs.map(job => {
              const chip = CHIPS[job.stage];
              const pct = Math.min(100, Math.max(0, Math.round(job.percent)));
              const terminal = job.stage === 'completed' || job.stage === 'failed';
              const canOpen = Boolean(job.docId);
              return (
                <div
                  key={job.id}
                  role={canOpen ? 'button' : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  onClick={canOpen ? () => { setActiveTab('documents'); setCollapsed(true); } : undefined}
                  onKeyDown={canOpen ? (e) => { if (e.key === 'Enter') { setActiveTab('documents'); setCollapsed(true); } } : undefined}
                  className={`p-3 space-y-1.5 ${canOpen ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <StageIcon stage={job.stage} />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1 min-w-0" title={job.fileName}>
                      {job.fileName}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${chip.className}`}>
                      {chip.label}
                    </span>
                    {terminal && (
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={e => { e.stopPropagation(); onDismiss(job.id); }}
                        className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {(job.stage === 'uploading' || job.stage === 'extracting') && (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${
                          job.stage === 'uploading'
                            ? pct > 0 ? 'bg-blue-500' : 'bg-blue-300 w-1/3 animate-pulse'
                            : pct > 0 ? 'bg-amber-500' : 'bg-amber-300 w-1/3 animate-pulse'
                        }`}
                        style={pct > 0 ? { width: `${pct}%` } : undefined}
                      />
                    </div>
                  )}

                  <p
                    className={`text-[11px] leading-snug truncate ${
                      job.stage === 'failed'
                        ? 'text-red-600 dark:text-red-300'
                        : job.stage === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                    title={job.stage === 'failed' ? job.error ?? '' : job.detail ?? ''}
                  >
                    {job.stage === 'failed'
                      ? job.error ?? 'Processing failed'
                      : job.stage === 'completed'
                        ? 'Done'
                        : job.detail ??
                          (job.stage === 'uploading'
                            ? 'Uploading…'
                            : job.stage === 'registering'
                              ? 'Saving…'
                              : 'Working…')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}