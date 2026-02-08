// supabase/functions/get-chat-messages/index.ts
// Consolidates: messages + media + resources in one call
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const canDisplayDocumentInline = (doc: any): boolean => {
  if (!doc?.content_extracted) return false;
  return (
    doc.file_type === 'text/plain' ||
    doc.file_type?.includes('text/') ||
    doc.file_type === 'application/pdf' ||
    doc.file_type === 'application/json'
  );
};

const extractStorageDetails = (fileUrl: string) => {
  try {
    if (fileUrl.startsWith('http')) {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const publicIndex = pathParts.indexOf('public');
      if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
        const bucket = pathParts[publicIndex + 1];
        const path = pathParts.slice(publicIndex + 2).join('/');
        return { bucket, path };
      }
    }
    if (fileUrl.includes('/documents/')) {
      return { bucket: 'documents', path: fileUrl.split('/documents/')[1] };
    }
    return { bucket: 'documents', path: fileUrl };
  } catch {
    return { bucket: 'documents', path: fileUrl };
  }
};

async function enrichResource(supabase: any, res: any) {
  let fullResource: any = { ...res };
  let signedFileUrl: string | null = null;

  if (res.resource_type === 'note') {
    const { data: note, error } = await supabase
      .from('notes')
      .select('id, title, content, category, tags, created_at, updated_at, ai_summary, document_id')
      .eq('id', res.resource_id)
      .maybeSingle();

    if (error || !note) return { ...res, error: 'Note not found or access denied' };
    fullResource = { ...res, ...note };

    if (note.document_id) {
      const { data: doc } = await supabase
        .from('documents')
        .select('id, title, file_name, file_type, file_size, file_url, content_extracted, processing_status')
        .eq('id', note.document_id)
        .maybeSingle();

      if (doc?.file_url && !canDisplayDocumentInline(doc)) {
        const { bucket, path } = extractStorageDetails(doc.file_url);
        if (path && !path.startsWith('http')) {
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          signedFileUrl = signed?.signedUrl || null;
        }
      }
      fullResource.associatedDocument = doc || null;
      fullResource.signedFileUrl = signedFileUrl;
      fullResource.displayAsText = doc ? canDisplayDocumentInline(doc) : false;
      fullResource.previewContent = doc?.content_extracted || null;
    }
  } else if (res.resource_type === 'document') {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, title, file_name, file_type, file_size, file_url, content_extracted, processing_status')
      .eq('id', res.resource_id)
      .maybeSingle();

    if (error || !doc) return { ...res, error: 'Document not found or access denied' };
    fullResource = { ...res, ...doc };

    if (doc.file_url && !canDisplayDocumentInline(doc)) {
      const { bucket, path } = extractStorageDetails(doc.file_url);
      if (path && !path.startsWith('http')) {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        signedFileUrl = signed?.signedUrl || null;
      }
    }
    fullResource.signedFileUrl = signedFileUrl;
    fullResource.displayAsText = canDisplayDocumentInline(doc);
    fullResource.previewContent = doc.content_extracted || null;
  } else if (res.resource_type === 'class_recording') {
    const { data: recording, error } = await supabase
      .from('class_recordings')
      .select('id, title, subject, audio_url, duration, date, summary, transcript')
      .eq('id', res.resource_id)
      .maybeSingle();

    if (error || !recording) return { ...res, error: 'Recording not found or access denied' };
    fullResource = { ...res, ...recording };

    if (recording.audio_url) {
      const { bucket, path } = extractStorageDetails(recording.audio_url);
      if (path && !path.startsWith('http')) {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 7200);
        signedFileUrl = signed?.signedUrl || null;
      }
    }
    fullResource.signedFileUrl = signedFileUrl;
  }

  return fullResource;
}

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
    const { session_id } = body;

    if (!session_id) {
      return createErrorResponse('session_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch messages with sender details
    const { data: messages, error } = await supabase
      .from('social_chat_messages')
      .select('*, sender:social_users(*)')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!messages || messages.length === 0) {
      // Also mark as read
      await supabase.rpc('mark_session_messages_read', {
        p_session_id: session_id,
        p_user_id: userId,
      }).then(null, () => {});

      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageIds = messages.map((m: any) => m.id);

    // Batch fetch media and resources
    const [{ data: allMedia }, { data: allResources }] = await Promise.all([
      supabase.from('social_chat_message_media').select('*').in('message_id', messageIds),
      supabase.from('social_chat_message_resources').select('*').in('message_id', messageIds),
    ]);

    // Group by message_id
    const mediaByMsg: Record<string, any[]> = {};
    for (const m of (allMedia || [])) {
      if (!mediaByMsg[m.message_id]) mediaByMsg[m.message_id] = [];
      mediaByMsg[m.message_id].push(m);
    }

    const resourcesByMsg: Record<string, any[]> = {};
    for (const r of (allResources || [])) {
      if (!resourcesByMsg[r.message_id]) resourcesByMsg[r.message_id] = [];
      resourcesByMsg[r.message_id].push(r);
    }

    // Enrich resources
    const messagesWithDetails = await Promise.all(
      messages.map(async (msg: any) => {
        const enrichedResources = await Promise.all(
          (resourcesByMsg[msg.id] || []).map((r: any) => enrichResource(supabase, r))
        );

        return {
          ...msg,
          sender: msg.sender,
          media: mediaByMsg[msg.id] || [],
          resources: enrichedResources,
        };
      })
    );

    // Mark as read in background
    await supabase.rpc('mark_session_messages_read', {
      p_session_id: session_id,
      p_user_id: userId,
    }).then(null, () => {});

    return new Response(
      JSON.stringify(messagesWithDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-chat-messages error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
