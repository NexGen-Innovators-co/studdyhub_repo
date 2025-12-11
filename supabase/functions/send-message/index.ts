// supabase/functions/send-message/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SubscriptionValidator, 
  createErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';

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
    const { chat_session_id, message_content, attachments = null } = body;

    // Validate inputs
    if (!chat_session_id) {
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

    // Verify user is part of this chat session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', chat_session_id)
      .single();

    if (sessionError || !session) {
      return createErrorResponse('Chat session not found', 404);
    }

    if (session.user_id !== userId) {
      return createErrorResponse('Unauthorized: You do not have access to this chat session', 403);
    }

    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        chat_session_id,
        user_id: userId,
        message_content,
        attachments: attachments || null,
        created_at: new Date().toISOString(),
        is_read: false
      })
      .select('*')
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return createErrorResponse('Failed to send message', 500);
    }

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
    console.error('Error in send-message:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
