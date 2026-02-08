// supabase/functions/send-chat-message/index.ts
// Consolidates: fetch sender + insert message + attach resource (3 queries → 1 call)
// File uploads remain client-side; media records are attached via media_items param
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
    const { session_id, content, media_items, resource } = body;
    // media_items: optional array of { type, url, filename, size_bytes, mime_type }
    // resource: optional { resource_id, resource_type }

    if (!session_id || !content?.trim()) {
      return createErrorResponse('session_id and content are required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sender info and insert message in parallel
    const [senderResult, messageResult] = await Promise.all([
      supabase
        .from('social_users')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('social_chat_messages')
        .insert({
          session_id,
          sender_id: userId,
          content: content.trim(),
          group_id: null,
        })
        .select()
        .single(),
    ]);

    if (senderResult.error || !senderResult.data) {
      throw new Error('Sender not found');
    }

    if (messageResult.error) {
      throw messageResult.error;
    }

    const sender = senderResult.data;
    const newMessage = messageResult.data;

    // Insert media records if provided (already uploaded by client)
    const mediaRecords = [];
    if (media_items && media_items.length > 0) {
      for (const item of media_items) {
        const { data: mediaRecord } = await supabase
          .from('social_chat_message_media')
          .insert({
            message_id: newMessage.id,
            type: item.type,
            url: item.url,
            filename: item.filename,
            size_bytes: item.size_bytes,
            mime_type: item.mime_type,
          })
          .select()
          .single();

        if (mediaRecord) mediaRecords.push(mediaRecord);
      }
    }

    // Attach resource if provided
    let resourceRecord = null;
    if (resource?.resource_id && resource?.resource_type) {
      const { data: resData } = await supabase
        .from('social_chat_message_resources')
        .insert({
          message_id: newMessage.id,
          resource_id: resource.resource_id,
          resource_type: resource.resource_type,
        })
        .select()
        .single();

      resourceRecord = resData;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: {
          ...newMessage,
          sender,
          media: mediaRecords,
          resources: resourceRecord ? [resourceRecord] : [],
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-chat-message error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
