/**
 * document-processor-watchdog/index.ts
 *
 * Scheduled cleanup function — rescues documents stuck in 'processing' or 'partial'.
 *
 * Invoke via:
 *   - Supabase cron: every 5 minutes  →  POST /document-processor-watchdog
 *   - Manual admin call for ad-hoc rescue
 *
 * Logic:
 *   1. Stuck 'processing' (> STUCK_MINUTES old)
 *      → continuation_attempt < MAX  →  flip to 'partial' + set resume cursor
 *      → continuation_attempt >= MAX →  flip to 'failed'
 *   2. Idle 'partial' (> STUCK_MINUTES old, has file_url)
 *      → continuation_attempt < MAX  →  call /resume-processing for each
 *      → continuation_attempt >= MAX →  flip to 'failed'
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

// ============================================================================
// CONFIG
// ============================================================================

const STUCK_MINUTES       = 10;   // minutes before a doc is considered stuck
const MAX_AUTO_ATTEMPTS   = 3;    // max watchdog-triggered resumes before giving up

// ============================================================================
// CORS
// ============================================================================

const getCorsHeaders = (origin = '*') => ({
  'Access-Control-Allow-Origin':  origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

// ============================================================================
// SERVER
// ============================================================================

const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const supabase  = createClient(supabaseUrl, supabaseServiceKey);
  const startTime = Date.now();
  const results   = { stuck_rescued: 0, partial_resumed: 0, gave_up: 0, errors: 0 };

  try {
    const stuckCutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();

    // ── 1. Rescue docs stuck in 'processing' ──────────────────────────────────
    // These are docs where the Edge Function crashed or timed out after the
    // early DB write but before the final saveFileToDatabase() write.
    const { data: stuckDocs, error: stuckErr } = await supabase
      .from('documents')
      .select('id, user_id, file_url, file_type, continuation_attempt, processing_metadata')
      .eq('processing_status', 'processing')
      .lt('updated_at', stuckCutoff);

    if (stuckErr) throw new Error(`Stuck query failed: ${stuckErr.message}`);

    for (const doc of (stuckDocs ?? [])) {
      const attempts = doc.continuation_attempt ?? 0;

      try {
        if (attempts >= MAX_AUTO_ATTEMPTS) {
          // Exhausted retries — give up cleanly
          await supabase.from('documents').update({
            processing_status: 'failed',
            processing_error:  `Watchdog: stuck in 'processing' after ${attempts} auto-rescue attempts. Use the retry button to try again.`,
            updated_at:        new Date().toISOString(),
          }).eq('id', doc.id);
          results.gave_up++;
          console.log(`[watchdog] Gave up on stuck doc ${doc.id} after ${attempts} attempts`);
        } else {
          // Flip to 'partial' so /resume-processing can continue it
          const existingCursor = doc.processing_metadata?.resume_cursor;
          const resumeCursor = existingCursor ?? (
            doc.file_type === 'application/pdf'
              ? { type: 'pdf_pages', lastPage: 0, totalPages: null, windowsProcessed: 0 }
              : null
          );

          if (!resumeCursor && !doc.file_url) {
            // Cannot resume without a cursor or file_url — fail it immediately
            await supabase.from('documents').update({
              processing_status: 'failed',
              processing_error:  'Watchdog: stuck in processing with no resume cursor or file URL. Cannot recover.',
              updated_at:        new Date().toISOString(),
            }).eq('id', doc.id);
            results.gave_up++;
            continue;
          }

          await supabase.from('documents').update({
            processing_status:  'partial',
            processing_error:   `Watchdog: rescued from stuck 'processing'. Auto-resume attempt ${attempts + 1}/${MAX_AUTO_ATTEMPTS}.`,
            continuation_attempt: attempts + 1,
            processing_metadata: {
              ...(doc.processing_metadata ?? {}),
              resume_cursor:        resumeCursor,
              watchdog_rescued_at:  new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq('id', doc.id);
          results.stuck_rescued++;
          console.log(`[watchdog] Rescued stuck doc ${doc.id} (attempt ${attempts + 1})`);
        }
      } catch (err: any) {
        results.errors++;
        console.error(`[watchdog] Error handling stuck doc ${doc.id}:`, err.message);
      }
    }

    // ── 2. Auto-resume idle 'partial' docs ────────────────────────────────────
    // These docs have a resume_cursor and a file_url but nobody has called
    // /resume-processing for them (client disconnected, session expired, etc.).
    const { data: partialDocs, error: partialErr } = await supabase
      .from('documents')
      .select('id, user_id, file_url, continuation_attempt, processing_metadata')
      .eq('processing_status', 'partial')
      .lt('updated_at', stuckCutoff)
      .not('file_url', 'is', null)
      .neq('file_url', '');

    if (partialErr) throw new Error(`Partial query failed: ${partialErr.message}`);

    for (const doc of (partialDocs ?? [])) {
      const attempts = doc.continuation_attempt ?? 0;

      try {
        if (attempts >= MAX_AUTO_ATTEMPTS) {
          await supabase.from('documents').update({
            processing_status: 'failed',
            processing_error:  `Watchdog: max auto-resume attempts (${MAX_AUTO_ATTEMPTS}) reached. Use the retry button to try again.`,
            updated_at:        new Date().toISOString(),
          }).eq('id', doc.id);
          results.gave_up++;
          console.log(`[watchdog] Gave up on partial doc ${doc.id} after ${attempts} attempts`);
          continue;
        }

        // Kick off a resume call server-side (uses service role — no user session needed)
        const resumeUrl = `${supabaseUrl}/functions/v1/resume-processing`;
        const resp = await fetch(resumeUrl, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey':        supabaseServiceKey,
          },
          body: JSON.stringify({ userId: doc.user_id, documentId: doc.id }),
        });

        if (resp.ok) {
          results.partial_resumed++;
          console.log(`[watchdog] Triggered resume for partial doc ${doc.id}`);
        } else {
          const errBody = await resp.json().catch(() => ({}));
          console.error(`[watchdog] resume-processing returned ${resp.status} for doc ${doc.id}:`, errBody);
          results.errors++;
        }
      } catch (err: any) {
        results.errors++;
        console.error(`[watchdog] Error resuming partial doc ${doc.id}:`, err.message);
      }
    }

    // ── 3. Retry idle 'failed' docs ─────────────────────────────────────────
    // Documents stuck in 'failed' (e.g. Gemini 429 on all models). Re-invoke
    // document-processor so its model-fallback chain gets another shot.
    const { data: failedDocs, error: failedErr } = await supabase
      .from('documents')
      .select('id, user_id, file_url, file_type, continuation_attempt')
      .eq('processing_status', 'failed')
      .lt('updated_at', stuckCutoff)
      .not('file_url', 'is', null)
      .neq('file_url', '');

    if (failedErr) throw new Error(`Failed query failed: ${failedErr.message}`);

    const results2 = { failed_retried: 0, ...results };

    for (const doc of (failedDocs ?? [])) {
      const attempts = doc.continuation_attempt ?? 0;

      try {
        if (attempts >= MAX_AUTO_ATTEMPTS) {
          // Already retried too many times — leave as 'failed'
          console.log(`[watchdog] Skipping failed doc ${doc.id} — max attempts (${attempts}) reached`);
          continue;
        }

        // Flip to 'processing' so the edge function knows to re-extract
        await supabase.from('documents').update({
          processing_status:  'processing',
          continuation_attempt: attempts + 1,
          updated_at:         new Date().toISOString(),
        }).eq('id', doc.id);

        // Re-invoke document-processor with service role
        const dpUrl = `${supabaseUrl}/functions/v1/document-processor`;
        const resp = await fetch(dpUrl, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey':        supabaseServiceKey,
          },
          body: JSON.stringify({
            userId:   doc.user_id,
            documentId: doc.id,
            files: [{
              id:         doc.id,
              file_url:   doc.file_url,
              file_type:  doc.file_type,
            }],
          }),
        });

        if (resp.ok) {
          results2.failed_retried++;
          console.log(`[watchdog] Retried failed doc ${doc.id} (attempt ${attempts + 1}/${MAX_AUTO_ATTEMPTS})`);
        } else {
          const errBody = await resp.json().catch(() => ({}));
          console.error(`[watchdog] document-processor returned ${resp.status} for failed doc ${doc.id}:`, errBody);
          // Flip back to 'failed' so we don't keep trying
          await supabase.from('documents').update({
            processing_status: 'failed',
            processing_error:  `Watchdog retry failed: HTTP ${resp.status}`,
            updated_at:        new Date().toISOString(),
          }).eq('id', doc.id);
          results2.errors++;
        }
      } catch (err: any) {
        results2.errors++;
        console.error(`[watchdog] Error retrying failed doc ${doc.id}:`, err.message);
        // Flip back to 'failed' on network error too
        await supabase.from('documents').update({
          processing_status: 'failed',
          processing_error:  `Watchdog retry error: ${err.message}`,
          updated_at:        new Date().toISOString(),
        }).eq('id', doc.id);
      }
    }

    const summary = {
      success:          true,
      processingTimeMs: Date.now() - startTime,
      stuckDocsFound:   (stuckDocs ?? []).length,
      partialDocsFound: (partialDocs ?? []).length,
      failedDocsFound:  (failedDocs ?? []).length,
      ...results2,
    };

    console.log('[watchdog] Run complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });

  } catch (err: any) {
    try {
      await logSystemError(createClient(supabaseUrl, supabaseServiceKey), {
        severity: 'error',
        source:   'document-processor-watchdog',
        message:  err?.message ?? String(err),
        details:  { stack: err?.stack },
      });
    } catch { /* ignore logging failure */ }

    return new Response(JSON.stringify({ error: err.message ?? 'Internal Server Error' }), {
      status:  500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }
});