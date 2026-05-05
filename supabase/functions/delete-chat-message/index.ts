// supabase/functions/delete-chat-message/index.ts
// Consolidates: delete media, resources, and message in one call
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
    const { message_id } = body;

    if (!message_id) {
      return createErrorResponse('message_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the message belongs to the user
    const { data: message } = await supabase
      .from('social_chat_messages')
      .select('id, sender_id')
      .eq('id', message_id)
      .single();

    if (!message) {
      return createErrorResponse('Message not found', 404);
    }

    if (message.sender_id !== userId) {
      return createErrorResponse('You can only delete your own messages', 403);
    }

    // Cascade delete: media, resources, then message
    await Promise.all([
      supabase.from('social_chat_message_media').delete().eq('message_id', message_id),
      supabase.from('social_chat_message_resources').delete().eq('message_id', message_id),
    ]);

    const { error } = await supabase
      .from('social_chat_messages')
      .delete()
      .eq('id', message_id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'delete-chat-message',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[delete-chat-message] Error logging failed:', _logErr); }
    console.error('delete-chat-message error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
