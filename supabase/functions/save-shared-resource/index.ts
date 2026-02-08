// supabase/functions/save-shared-resource/index.ts
// Consolidates: save shared notes/documents/recordings from chat, with subscription limit checks
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
    const { resource_type, resource_data } = body;

    if (!resource_type || !resource_data) {
      return createErrorResponse('resource_type and resource_data are required', 400);
    }

    if (!['note', 'document', 'class_recording'].includes(resource_type)) {
      return createErrorResponse('resource_type must be "note", "document", or "class_recording"', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin (admins have unlimited access)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const isAdmin = !!adminUser;

    // ─── SAVE NOTE ────────────────────────────────────────
    if (resource_type === 'note') {
      const { title, content } = resource_data;
      if (!title && !content) {
        return createErrorResponse('Note title or content is required', 400);
      }

      if (!isAdmin) {
        const [countResult, subResult] = await Promise.all([
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('subscriptions').select('subscription_tier, maxNotes').eq('user_id', userId).single()
        ]);

        const maxNotes = subResult.data?.maxNotes || 50;
        const currentCount = countResult.count || 0;

        if (subResult.data?.subscription_tier === 'free' && currentCount >= maxNotes) {
          return createErrorResponse(`Note limit reached (${maxNotes}). Upgrade to add more notes.`, 403);
        }
      }

      const { error } = await supabase.from('notes').insert({
        user_id: userId,
        title: title || 'Untitled Note',
        content: content || '',
      });

      if (error) throw new Error(`Failed to save note: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, resource_type: 'note' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SAVE DOCUMENT ────────────────────────────────────
    if (resource_type === 'document') {
      const { title, file_name, file_url, file_type, file_size } = resource_data;

      if (!file_url) {
        return createErrorResponse('file_url is required for documents', 400);
      }

      if (!isAdmin) {
        const [countResult, subResult] = await Promise.all([
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('subscriptions').select('subscription_tier, maxDocUploads').eq('user_id', userId).single()
        ]);

        const maxDocs = subResult.data?.maxDocUploads || 50;
        const currentCount = countResult.count || 0;

        if (subResult.data?.subscription_tier === 'free' && currentCount >= maxDocs) {
          return createErrorResponse(`Document limit reached (${maxDocs}). Upgrade to add more documents.`, 403);
        }
      }

      const { error } = await supabase.from('documents').insert({
        user_id: userId,
        title: title || file_name,
        file_name: file_name,
        file_url: file_url,
        file_type: file_type,
        file_size: file_size,
        type: 'uploaded',
      });

      if (error) throw new Error(`Failed to save document: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, resource_type: 'document' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SAVE CLASS RECORDING ─────────────────────────────
    if (resource_type === 'class_recording') {
      const { source_recording_id, title, summary, audio_url, duration, subject, date } = resource_data;

      if (!audio_url) {
        return createErrorResponse('audio_url is required for recordings', 400);
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('class_recordings')
        .select('id')
        .eq('user_id', userId)
        .eq('audio_url', audio_url)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, duplicate: true, message: 'You already have this recording' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase.from('class_recordings').insert({
        user_id: userId,
        title,
        summary,
        audio_url,
        duration,
        subject,
        date,
      });

      if (error) throw new Error(`Failed to save recording: ${error.message}`);

      return new Response(
        JSON.stringify({ success: true, resource_type: 'class_recording' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in save-shared-resource:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
