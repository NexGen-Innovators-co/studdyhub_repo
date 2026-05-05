// supabase/functions/create-ai-chat-session/index.ts
// Edge function for creating an AI chat session with subscription/limit validation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  SubscriptionValidator,
  extractUserIdFromAuth,
  createErrorResponse,
} from '../utils/subscription-validator.ts';
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
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // make sure user is allowed to chat at all
    const canChat = await validator.canChat(userId);
    if (!canChat.allowed) {
      return createErrorResponse(canChat.message || 'Not allowed to create chat sessions', 403);
    }

    // check quota for number of sessions
    const limitCheck = await validator.checkChatSessionLimit(userId);
    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'Chat session limit reached', 403);
    }

    // parse any optional document ids or metadata
    const body = await req.json().catch(() => ({}));
    const document_ids = body.document_ids || [];

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // if there is an existing empty session return it
    const { data: existing, error: existingErr } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('message_count', 0)
      .limit(1)
      .single();

    if (existingErr == null && existing && existing.id) {
      return new Response(JSON.stringify({ id: existing.id, existing: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // insert new session
    const { data, error: insertErr } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: 'New Chat',
        document_ids,
        message_count: 0,
      })
      .select('id')
      .single();

    if (insertErr || !data) {
      // console.error('create-ai-chat-session insert error', insertErr);
      return createErrorResponse('Failed to create chat session', 500);
    }

    return new Response(JSON.stringify({ id: data.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    logSystemError(createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), {
      severity: 'error',
      source: 'create-ai-chat-session',
      message: err?.message || String(err),
      details: { stack: err?.stack },
    }).catch(() => {});
    console.error('create-ai-chat-session error:', err);
    return createErrorResponse('Internal server error', 500);
  }
});