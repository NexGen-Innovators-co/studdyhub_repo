// supabase/functions/get-user-resources/index.ts
// Consolidates: fetch user notes + documents + class_recordings (3 parallel queries → 1 call)
// Supports pagination via offset/limit
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const {
      resource_type,
      offset = 0,
      limit = 20
    } = body;

    // resource_type: 'all' | 'notes' | 'documents' | 'class_recordings'
    const validTypes = ['all', 'notes', 'documents', 'class_recordings'];
    if (resource_type && !validTypes.includes(resource_type)) {
      return createErrorResponse('resource_type must be "all", "notes", "documents", or "class_recordings"', 400);
    }

    const type = resource_type || 'all';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: Record<string, any> = {};

    if (type === 'all' || type === 'notes') {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      result.notes = data || [];
      result.has_more_notes = (data?.length || 0) === limit;
      if (error) console.error('Error fetching notes:', error);
    }

    if (type === 'all' || type === 'documents') {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      result.documents = data || [];
      result.has_more_documents = (data?.length || 0) === limit;
      if (error) console.error('Error fetching documents:', error);
    }

    if (type === 'all' || type === 'class_recordings') {
      const { data, error } = await supabase
        .from('class_recordings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      result.class_recordings = data || [];
      result.has_more_recordings = (data?.length || 0) === limit;
      if (error) console.error('Error fetching recordings:', error);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'get-user-resources',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[get-user-resources] Error logging failed:', _logErr); }
    console.error('Error in get-user-resources:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
