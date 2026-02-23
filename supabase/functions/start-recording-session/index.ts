// Edge Function: start-recording-session
// Creates a new podcast_recordings entry with Service Role to bypass RLS
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    const body = await req.json();
    const { podcast_id, user_id, session_id } = body;

    if (!podcast_id) {
       return new Response(JSON.stringify({ error: 'podcast_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Explicit session ID is preferred if provided (e.g. for idempotency or client-gen UUID)
    const sessionId = session_id || crypto.randomUUID(); 

    const now = new Date().toISOString();
    const payload: any = {
      podcast_id,
      session_id: sessionId,
      status: 'in_progress',
      started_at: now,
      created_at: now,
      updated_at: now
    };
    
    if (user_id) payload.user_id = user_id;

    const { data, error } = await supabase.from('podcast_recordings').insert(payload).select().single();

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'start-recording-session',
        message: e?.message || String(e),
        details: { stack: e?.stack },
      });
    } catch (_logErr) { console.error('[start-recording-session] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
