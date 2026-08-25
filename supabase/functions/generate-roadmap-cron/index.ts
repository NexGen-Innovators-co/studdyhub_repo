// supabase/functions/generate-roadmap-cron/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// CRON-triggered roadmap generation for active Explorer users.
//
// Runs on a pg_cron schedule (e.g., every 6 hours).
// Only generates the NEXT week for users who:
//   1. Have completed ≥1 step in their current latest week
//   2. Don't already have the next week generated
//
// This ensures we ONLY spend tokens on engaged users, never on inactive ones.
// ═══════════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const BATCH_SIZE = 20;  // Process users in batches to avoid overwhelming

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 1: Find active users who need the next week
    // ══════════════════════════════════════════════════════════════════════
    // Active = has completed ≥1 step AND doesn't have the next week yet
    const { data: activeUsers, error: findError } = await supabase.rpc(
      'find_users_needing_next_week'
    );

    if (findError) {
      console.error('[cron] Error finding active users:', findError.message);
      return new Response(JSON.stringify({ error: findError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('[cron] No active users need a new week. Done.');
      return new Response(JSON.stringify({ processed: 0, message: 'No active users need a new week' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[cron] Found ${activeUsers.length} active users needing next week generation.`);

    // ══════════════════════════════════════════════════════════════════════
    // STEP 2: Generate next week for each active user (batched)
    // ══════════════════════════════════════════════════════════════════════
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
      const batch = activeUsers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (user: any) => {
          const { user_id, next_week } = user;

          try {
            // Call generate-roadmap with the specific week
            const response = await fetch(`${supabaseUrl}/functions/v1/generate-roadmap`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'apikey': serviceKey,
              },
              body: JSON.stringify({
                user_id: user_id,
                week: next_week,
                weeks: next_week,  // Not used when week is specified, but required
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const stepCount = data.steps?.length || 0;
              console.log(`[cron] User ${user_id}: week ${next_week} generated (${stepCount} steps)`);
              return { success: true, user_id, week: next_week, steps: stepCount };
            } else {
              const err = await response.text();
              console.warn(`[cron] User ${user_id}: week ${next_week} failed (${response.status}): ${err.substring(0, 200)}`);
              return { success: false, user_id, week: next_week, error: err.substring(0, 200) };
            }
          } catch (err: any) {
            console.error(`[cron] User ${user_id}: week ${next_week} exception:`, err.message);
            return { success: false, user_id, week: next_week, error: err.message };
          }
        })
      );

      for (const r of results) {
        processed++;
        if (r.status === 'fulfilled' && r.value.success) {
          succeeded++;
        } else {
          failed++;
        }
      }

      // Small delay between batches to be nice to AI providers
      if (i + BATCH_SIZE < activeUsers.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`[cron] Done: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({
      processed,
      succeeded,
      failed,
      total_active: activeUsers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[cron] Unhandled error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
