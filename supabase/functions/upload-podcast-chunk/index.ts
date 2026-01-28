// Edge Function: upload-podcast-chunk
// Accepts a chunk upload (multipart/form-data or JSON with base64) and saves to storage and DB.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeJwtSub(token: string | null) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded).sub || null;
  } catch (e) {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    // determine uploader user from Authorization header (JWT) if present
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const uploaderUserId = decodeJwtSub(token);

    // Accept form-data uploads (preferred) or JSON with base64
    const contentType = req.headers.get('content-type') || '';
    let podcastId: string | null = null;
    let uploadSessionId: string | null = null;
    let chunkIndex: number | null = null;
    let totalChunks: number | null = null;
    let fileBlob: Blob | null = null;
    let mimeType: string | null = null;

    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();
      podcastId = String(form.get('podcast_id') || '') || null;
      uploadSessionId = String(form.get('upload_session_id') || '') || null;
      chunkIndex = form.get('chunk_index') ? Number(form.get('chunk_index')) : null;
      totalChunks = form.get('total_chunks') ? Number(form.get('total_chunks')) : null;
      const file = form.get('file') as File | null;
      if (file) {
        fileBlob = file;
        mimeType = file.type || null;
      }
    } else {
      // JSON body: expect base64 payload
      const body = await req.json().catch(() => ({}));
      podcastId = body.podcast_id || null;
      uploadSessionId = body.upload_session_id || null;
      chunkIndex = typeof body.chunk_index === 'number' ? body.chunk_index : (body.chunk_index ? Number(body.chunk_index) : null);
      totalChunks = typeof body.total_chunks === 'number' ? body.total_chunks : null;
      const base64 = body.base64 || body.inline_base64 || null;
      mimeType = body.mime_type || 'audio/webm';
      if (base64) {
        // strip data url prefix if present
        let cleaned = base64;
        if (cleaned.startsWith('data:')) {
          const idx = cleaned.lastIndexOf(',');
          if (idx !== -1) cleaned = cleaned.substring(idx + 1);
        }
        const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
        fileBlob = new Blob([bytes], { type: mimeType });
      }
    }

    if (!podcastId || !uploadSessionId || chunkIndex === null || !fileBlob) {
      return new Response(JSON.stringify({ error: 'podcast_id, upload_session_id, chunk_index and file are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build filename and upload to storage
    const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
    const filename = `live-podcasts/${podcastId}/${uploadSessionId}/chunk_${chunkIndex}_${Date.now()}.${ext}`;

    // Attempt upload and retry with application/octet-stream if mime rejected
    let { error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, fileBlob as any, { contentType: mimeType || 'application/octet-stream', upsert: false });
    if (uploadErr && uploadErr.message && /mime type/i.test(uploadErr.message)) {
      ({ error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, fileBlob as any, { contentType: 'application/octet-stream', upsert: false }));
    }
    if (uploadErr) throw uploadErr;

    // get public url
    const publicRes: any = supabase.storage.from('podcasts').getPublicUrl(filename) as any;
    const publicUrl = publicRes?.data?.publicUrl || publicRes?.publicUrl || null;

    // Insert metadata into podcast_chunks
    const insertPayload: any = {
      podcast_id: podcastId,
      upload_session_id: uploadSessionId,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
      storage_path: filename,
      file_size: (fileBlob as Blob).size,
      mime_type: mimeType,
      checksum: null,
      status: 'uploaded',
      uploader_user_id: uploaderUserId,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('podcast_chunks').insert(insertPayload).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, chunk: data, publicUrl }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('upload-podcast-chunk error', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
