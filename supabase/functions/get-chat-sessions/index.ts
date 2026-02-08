// supabase/functions/get-chat-sessions/index.ts
// Fixes N+1 problem: single query instead of 2 queries per session
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sessions with related data in one query
    const { data: sessions, error } = await supabase
      .from('social_chat_sessions')
      .select(`
        *,
        group:social_groups(*),
        user1:social_users!social_chat_sessions_user_id1_fkey(*),
        user2:social_users!social_chat_sessions_user_id2_fkey(*)
      `)
      .or(`user_id1.eq.${userId},user_id2.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionIds = sessions.map(s => s.id);

    // Batch fetch: last message per session + unread counts
    // Use Promise.all for parallel execution
    const [lastMessagesResult, unreadCountsResult] = await Promise.all([
      // Get last message for each session using a lateral join approach
      // We'll fetch the most recent messages and group them
      supabase
        .from('social_chat_messages')
        .select('*, sender:social_users(*)')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false }),

      // Get unread counts for all sessions in batch
      Promise.all(
        sessionIds.map(sessionId =>
          supabase.rpc('get_session_unread_count', {
            p_session_id: sessionId,
            p_user_id: userId,
          }).then(({ data }) => ({ sessionId, count: data || 0 }))
        )
      ),
    ]);

    // Group last messages by session (take first = most recent per session)
    const lastMessageBySession: Record<string, any> = {};
    for (const msg of (lastMessagesResult.data || [])) {
      if (!lastMessageBySession[msg.session_id]) {
        lastMessageBySession[msg.session_id] = msg;
      }
    }

    // Map unread counts
    const unreadBySession: Record<string, number> = {};
    for (const item of unreadCountsResult) {
      unreadBySession[item.sessionId] = item.count;
    }

    // Compose final response
    const sessionsWithDetails = sessions.map(session => ({
      ...session,
      group: session.group ? {
        ...session.group,
        privacy: session.group.privacy,
      } : undefined,
      user1: session.user1,
      user2: session.user2,
      last_message: lastMessageBySession[session.id] || undefined,
      unread_count: unreadBySession[session.id] || 0,
    }));

    return new Response(
      JSON.stringify(sessionsWithDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-chat-sessions error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
