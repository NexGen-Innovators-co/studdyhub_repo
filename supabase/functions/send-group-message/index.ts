// supabase/functions/send-group-message/index.ts
// Consolidates: insert group chat message (1 query → 1 call, server-validated)
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

    const { group_id, content } = await req.json();

    if (!group_id || !content?.trim()) {
      return createErrorResponse('group_id and content are required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is a member of the group
    const { data: membership } = await supabase
      .from('social_group_members')
      .select('id, status')
      .eq('group_id', group_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!membership) {
      return createErrorResponse('You must be an active member of this group to send messages', 403);
    }

    const { data: message, error } = await supabase
      .from('social_chat_messages')
      .insert({
        group_id,
        sender_id: userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'send-group-message',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[send-group-message] Error logging failed:', _logErr); }
    console.error('Error in send-group-message:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
