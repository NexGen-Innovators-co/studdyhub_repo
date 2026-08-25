// supabase/functions/send-message/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SubscriptionValidator, 
  createErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user ID from auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // Check subscription for messaging
    const canChat = await validator.canChat(userId);
    if (!canChat.allowed) {
      return createErrorResponse(canChat.message || 'Not allowed to send messages', 403);
    }

    // Parse request body
    const body = await req.json();
    const { session_id, message_content } = body;

    // Validate inputs
    if (!session_id) {
      return createErrorResponse('Chat session ID is required', 400);
    }

    if (!message_content || message_content.trim().length === 0) {
      return createErrorResponse('Message content cannot be empty', 400);
    }

    if (message_content.length > 3000) {
      return createErrorResponse('Message is too long (max 3000 characters)', 400);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is a participant of this social chat session
    // (real schema: social_chat_sessions holds user_id1/user_id2 for 1:1 chats)
    const { data: session, error: sessionError } = await supabase
      .from('social_chat_sessions')
      .select('id, user_id1, user_id2, group_id')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return createErrorResponse('Chat session not found', 404);
    }

    const isParticipant =
      session.user_id1 === userId ||
      session.user_id2 === userId ||
      !!session.group_id; // group membership validated below via social_group_members

    if (!isParticipant) {
      return createErrorResponse('Unauthorized: You do not have access to this chat session', 403);
    }

    // For group chats, confirm the sender is a group member.
    // (real schema: social_group_members.status defaults to 'active'; join-leave-group
    // inserts members without setting status, so membership is the check that matters)
    if (session.group_id) {
      const { data: member } = await supabase
        .from('social_group_members')
        .select('id')
        .eq('group_id', session.group_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!member) {
        return createErrorResponse('Unauthorized: You are not a member of this group', 403);
      }
    }

    // Create the message (real schema: social_chat_messages)
    const { data: message, error: messageError } = await supabase
      .from('social_chat_messages')
      .insert({
        session_id,
        group_id: session.group_id || null,
        sender_id: userId,
        content: message_content.trim(),
        is_read: false
      })
      .select('*')
      .single();

    if (messageError) {
      // console.error('Error creating message:', messageError);
      return createErrorResponse('Failed to send message', 500);
    }

    // Notify other participants (Fire and Forget)
    (async () => {
      try {
        let recipientIds: string[] = [];
        if (session.group_id) {
          // Group chat: notify all group members except sender
          const { data: members } = await supabase
            .from('social_group_members')
            .select('user_id')
            .eq('group_id', session.group_id)
            .neq('user_id', userId);
          recipientIds = (members || []).map((m: any) => m.user_id);
        } else {
          // 1:1 chat: the other participant
          const otherId = session.user_id1 === userId ? session.user_id2 : session.user_id1;
          if (otherId) recipientIds = [otherId];
        }

        if (recipientIds.length > 0) {
           // Get sender name
           const { data: sender } = await supabase.from('social_users').select('display_name').eq('id', userId).single();
           const senderName = sender?.display_name || 'Someone';
           
           // Truncate message
           const preview = message_content.length > 50 ? message_content.substring(0, 50) + '...' : message_content;

           await supabase.functions.invoke('send-notification', {
              body: {
                  user_ids: recipientIds,
                  type: 'message',
                  title: `Message from ${senderName}`,
                  message: preview,
                  // Deep link directly into chat session
                  data: {
                    chat_session_id: session_id,
                    actor_id: userId,
                  },
                  action_url: `/chat/${session_id}`
              }
           });
        }
      } catch (e) {
        // console.error('Failed to notify chat participants:', e);
      }
    })();

    return new Response(JSON.stringify({
      success: true,
      message
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'send-message',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[send-message] Error logging failed:', _logErr); }
    // console.error('Error in send-message:', error);
    return createErrorResponse('Internal server error', 500);
  }
});

