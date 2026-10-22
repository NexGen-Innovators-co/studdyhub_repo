import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { useAppContext } from '../hooks/useAppContext';
import { UploadActivityTray } from '../modules/documents/components/UploadActivityTray';

// ============================================================================
// Upload activity — one global source of truth for every document upload so
// stages stay visible (and keep progressing) even when the user navigates
// away from the documents screen. This is what turns "a bar that fills and
// refills" into: Uploading (real bytes) → Registering → Analyzing (real
// server rounds) → Done | Failed.
// ============================================================================

export type UploadStage = 'uploading' | 'registering' | 'extracting' | 'completed' | 'failed';

export interface UploadJob {
  id: string;
  fileName: string;
  fileSize: number;
  userId: string;
  stage: UploadStage;
  /** Real uploaded bytes — never simulated. */
  uploadedBytes: number;
  partsTotal: number;
  partsDone: number;
  /** 0-100 within the current stage; never regresses within a stage. */
  percent: number;
  /** Human-readable current stage line (pages, rounds, chars, ETA extras…). */
  detail: string | null;
  docId: string | null;
  error: string | null;
  startedAt: number;
  completedAt?: number;
}

interface CreateJobInput {
  fileName: string;
  fileSize: number;
  userId: string;
  partsTotal?: number;
}

interface UploadActivityValue {
  jobs: UploadJob[];
  createJob: (input: CreateJobInput) => string;
  updateJob: (id: string, patch: Partial<UploadJob>) => void;
  dismissJob: (id: string) => void;
}

const UploadActivityContext = createContext<UploadActivityValue | undefined>(undefined);

export function useUploadActivity(): UploadActivityValue {
  const ctx = useContext(UploadActivityContext);
  if (!ctx) throw new Error('useUploadActivity must be used within an UploadActivityProvider');
  return ctx;
}

const POLL_INTERVAL_MS = 4000;
const AUTO_DISMISS_MS = 12_000;
const MAX_RESUME_FAILURES = 3;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

export function UploadActivityProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const { forceRefreshDocuments } = useAppContext();

  // Live mirror of jobs for the polling loop (so the effect is keyed only on
  // the set of extracted doc ids, not on every byte update).
  const jobsRef = useRef<UploadJob[]>(jobs);
  jobsRef.current = jobs;

  const inFlightRef = useRef<Set<string>>(new Set());
  const failCountsRef = useRef<Map<string, number>>(new Map());
  /** Last observed row signature (status|cursor|error) per doc id. */
  const lastRowSigRef = useRef<Map<string, string>>(new Map());
  /** Consecutive rounds that came back without advancing the cursor. */
  const noProgressRef = useRef<Map<string, number>>(new Map());

  const createJob = useCallback((input: CreateJobInput): string => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job: UploadJob = {
      id,
      fileName: input.fileName,
      fileSize: input.fileSize,
      userId: input.userId,
      stage: 'uploading',
      uploadedBytes: 0,
      partsTotal: Math.max(1, input.partsTotal ?? 1),
      partsDone: 0,
      percent: 0,
      detail: null,
      docId: null,
      error: null,
      startedAt: Date.now(),
    };
    setJobs(prev => [...prev, job]);
    return id;
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs(prev =>
      prev.map(job => {
        if (job.id !== id) return job;
        const stageChanged = patch.stage !== undefined && patch.stage !== job.stage;
        const percent =
          patch.percent !== undefined
            ? stageChanged
              ? patch.percent
              : Math.max(job.percent, patch.percent) // never regress within a stage
            : job.percent;
        const completedAt =
          patch.stage === 'completed' && job.completedAt === undefined
            ? patch.completedAt ?? Date.now()
            : patch.completedAt ?? job.completedAt;
        return { ...job, ...patch, percent, completedAt };
      }),
    );
  }, []);

  const dismissJob = useCallback((id: string) => {
    inFlightRef.current.delete(id);
    const docId = jobsRef.current.find(j => j.id === id)?.docId;
    if (docId) {
      lastRowSigRef.current.delete(docId);
      noProgressRef.current.delete(docId);
    }
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  // ── Self-clean finished jobs so the tray does not pile up ──────────────────
  useEffect(() => {
    const timer = window.setInterval(() => {
      setJobs(prev => {
        const now = Date.now();
        const remaining = prev.filter(
          j => !(j.stage === 'completed' && j.completedAt && now - j.completedAt > AUTO_DISMISS_MS),
        );
        return remaining.length === prev.length ? prev : remaining;
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Observe AND drive server-side extraction for attached documents ────────
  // Reads the document row every few seconds to render honest stages/percent,
  // and fires /resume-processing rounds when the row is partial (or a
  // 'processing' row went stale because the edge function died mid-window).
  const extractingSig = jobs
    .filter(j => j.stage === 'extracting' && j.docId)
    .map(j => j.docId)
    .join(',');

  useEffect(() => {
    if (!extractingSig) return;
    let cancelled = false;

    const runResumeRound = async (job: UploadJob) => {
      const docId = job.docId as string;
      if (inFlightRef.current.has(docId)) return;
      inFlightRef.current.add(docId);
      const sigBefore = lastRowSigRef.current.get(docId) ?? null;
      let roundResult: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('session expired');
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-processing`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId: job.userId, documentId: docId }),
          },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const roundBody = await resp.json().catch(() => null);
        // Server nests the round result inside documents[]
        roundResult = Array.isArray(roundBody?.documents) ? roundBody.documents[0] : roundBody;
        failCountsRef.current.delete(docId);
      } catch (err: any) {
        const fails = (failCountsRef.current.get(docId) ?? 0) + 1;
        failCountsRef.current.set(docId, fails);
        if (fails >= MAX_RESUME_FAILURES) {
          updateJob(job.id, {
            stage: 'failed',
            error: `Extraction rounds failed: ${err?.message ?? 'unknown error'}`,
          });
          toast.error(`Processing of "${job.fileName}" failed after ${fails} rounds.`);
        }
      } finally {
        inFlightRef.current.delete(docId);
        // Did the round actually advance the document? A round that comes back
        // with an unchanged cursor and the same error would be re-fired by the
        // next tick forever — count those and fail the job instead of
        // hammering the same part round after round. A busy-skip (the server's
        // round lock let another in-flight round keep the document) makes no
        // judgment either way — the real round still owns progress.
        if (roundResult && roundResult.skippedBusy !== true) {
        try {
          const { data: row } = await supabase
            .from('documents')
            .select('processing_status, processing_metadata, processing_error')
            .eq('id', docId)
            .single();
          if (row) {
            const raw: any = row.processing_metadata;
            const m: any =
              typeof raw === 'string'
                ? (() => { try { return JSON.parse(raw); } catch { return {}; } })()
                : (raw ?? {});
            const sigAfter = `${row.processing_status}|${m?.audio_cursor?.nextPart ?? m?.resume_cursor?.lastPage ?? 0}|${row.processing_error ?? ''}`;
            if (sigAfter === sigBefore) {
              const np = (noProgressRef.current.get(docId) ?? 0) + 1;
              noProgressRef.current.set(docId, np);
              if (np >= MAX_RESUME_FAILURES) {
                updateJob(job.id, {
                  stage: 'failed',
                  error: row.processing_error || `Extraction stalled — no progress after ${np} rounds`,
                });
                toast.error(`Processing of "${job.fileName}" stalled with no progress.`);
              }
            } else {
              noProgressRef.current.delete(docId);
            }
          }
        } catch {
          // observation is best-effort — the tick loop still owns recovery
        }
        }
      }
    };

    const tick = async () => {
      const active = jobsRef.current.filter(j => j.stage === 'extracting' && j.docId);
      if (active.length === 0) return;
      const ids = active.map(j => j.docId as string);

      try {
        const { data: rows, error } = await supabase
          .from('documents')
          .select('id, processing_status, processing_metadata, processing_error, updated_at')
          .in('id', ids);
        if (cancelled || error || !rows) return;

        for (const job of active) {
          const row: any = rows.find((r: any) => r.id === job.docId);
          if (!row) {
            updateJob(job.id, { stage: 'failed', error: 'Document record not found' });
            continue;
          }

          const status: string = row.processing_status;
          const rawMeta: any = row.processing_metadata;
          const meta: any =
            typeof rawMeta === 'string'
              ? (() => { try { return JSON.parse(rawMeta); } catch { return {}; } })()
              : (rawMeta ?? {});

          if (status === 'completed') {
            lastRowSigRef.current.delete(job.docId as string);
            noProgressRef.current.delete(job.docId as string);
            updateJob(job.id, { stage: 'completed', percent: 100, detail: 'Finished' });
            toast.success(`"${job.fileName}" finished processing!`);
            void forceRefreshDocuments();
            continue;
          }

          if (status === 'failed') {
            lastRowSigRef.current.delete(job.docId as string);
            noProgressRef.current.delete(job.docId as string);
            const msg = row.processing_error || 'Processing failed';
            updateJob(job.id, { stage: 'failed', error: msg });
            toast.error(`Processing of "${job.fileName}" failed: ${msg}`);
            continue;
          }

          // status: processing | partial — render honest server state
          const rc = meta.resume_cursor ?? null;
          const round = meta.processing_attempts ?? rc?.windowsProcessed ?? 1;
          const percent =
            rc && rc.totalPages
              ? Math.max(3, Math.min(99, Math.round((rc.lastPage / rc.totalPages) * 100)))
              : job.percent;
          const chars =
            typeof meta.contentLength === 'number' && meta.contentLength > 0
              ? ` · ${Math.round(meta.contentLength / 1000)}k chars captured`
              : '';
          const ac = meta.audio_cursor;
          lastRowSigRef.current.set(
            job.docId as string,
            `${status}|${ac?.nextPart ?? rc?.lastPage ?? 0}|${row.processing_error ?? ''}`,
          );
          const detail =
            ac && ac.totalParts
              ? `Transcribing part ${ac.nextPart}/${ac.totalParts} · round ${round}`
              : rc && rc.totalPages
                ? `Analyzing pages ${rc.lastPage}/${rc.totalPages} · round ${round}`
                : `Extracting content · round ${round}${chars}`;
          updateJob(job.id, { percent, detail });

          // Drive continuation: rounds for partial rows, and for 'processing'
          // rows whose updated_at shows the original function died mid-run.
          const staleProcessing =
            status === 'processing' &&
            row.updated_at &&
            Date.now() - Date.parse(row.updated_at) > STALE_PROCESSING_MS;
          if (status === 'partial' || staleProcessing) {
            void runResumeRound(job);
          }
        }
      } catch {
        // network hiccup — next tick retries
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [extractingSig, updateJob, forceRefreshDocuments]);

  const value: UploadActivityValue = { jobs, createJob, updateJob, dismissJob };

  return (
    <UploadActivityContext.Provider value={value}>
      {children}
      <UploadActivityTray jobs={jobs} onDismiss={dismissJob} />
    </UploadActivityContext.Provider>
  );
}