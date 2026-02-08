// supabase/functions/create-chat-session/index.ts
// Consolidates: search existing P2P session + create new one (2 queries → 1 call)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

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
    const { other_user_id } = body;

    if (!other_user_id) {
      return createErrorResponse('other_user_id is required', 400);
    }

    if (other_user_id === userId) {
      return createErrorResponse('Cannot create a chat session with yourself', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing P2P session (both directions)
    const { data: existing, error: searchError } = await supabase
      .from('social_chat_sessions')
      .select('id')
      .eq('chat_type', 'p2p')
      .or(
        `and(user_id1.eq.${userId},user_id2.eq.${other_user_id}),and(user_id1.eq.${other_user_id},user_id2.eq.${userId})`
      )
      .maybeSingle();

    if (searchError && searchError.code !== 'PGRST116') {
      throw searchError;
    }

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, session_id: existing.id, created: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new session
    const { data: newSession, error: createError } = await supabase
      .from('social_chat_sessions')
      .insert({
        chat_type: 'p2p',
        user_id1: userId,
        user_id2: other_user_id,
      })
      .select()
      .single();

    if (createError) throw createError;

    return new Response(
      JSON.stringify({ success: true, session_id: newSession.id, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('create-chat-session error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
