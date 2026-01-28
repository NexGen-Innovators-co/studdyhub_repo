// Edge Function: complete-podcast-chunks
// Validates uploaded chunks for a session, assembles into a final file, and triggers transcription.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const podcastId: string | undefined = body.podcast_id;
    const uploadSessionId: string | undefined = body.upload_session_id;
    const assemblePathProvided: string | undefined = body.assemble_path;
    const triggerTranscription: boolean = body.trigger_transcription !== undefined ? Boolean(body.trigger_transcription) : true;

    if (!podcastId || !uploadSessionId) {
      return new Response(JSON.stringify({ error: 'podcast_id and upload_session_id are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch chunks for the session ordered by chunk_index
    const { data: chunks, error: chunksErr } = await supabase.from('podcast_chunks').select('*').eq('podcast_id', podcastId).eq('upload_session_id', uploadSessionId).order('chunk_index', { ascending: true });
    if (chunksErr) throw chunksErr;
    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ error: 'No chunks found for session' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate sequence integrity if total_chunks present
    const totalDeclared = chunks[0].total_chunks || null;
    if (totalDeclared && chunks.length !== totalDeclared) {
      // Not all chunks uploaded yet
      return new Response(JSON.stringify({ error: 'Not all chunks uploaded yet', uploaded: chunks.length, expected: totalDeclared }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Attempt to assemble chunks by downloading each chunk and concatenating
    // WARNING: This approach buffers contents in memory and may not be suitable for very large files.
    const buffers: Uint8Array[] = [];
    let detectedMime = 'audio/webm';
    for (const c of chunks) {
      try {
        // get public url (storage path should be present)
        const publicRes: any = supabase.storage.from('podcasts').getPublicUrl(c.storage_path) as any;
        const publicUrl = publicRes?.data?.publicUrl || publicRes?.publicUrl || null;
        if (!publicUrl) throw new Error('Failed to obtain public url for chunk ' + c.id);

        const resp = await fetch(publicUrl);
        if (!resp.ok) throw new Error('Failed to download chunk: ' + resp.statusText);
        const ab = new Uint8Array(await resp.arrayBuffer());
        buffers.push(ab);
        if (!detectedMime && c.mime_type) detectedMime = c.mime_type;
      } catch (e) {
        console.error('Failed to fetch chunk for assembly:', e);
        throw e;
      }
    }

    // Concatenate buffers
    let totalLen = 0;
    for (const b of buffers) totalLen += b.length;
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      combined.set(b, offset);
      offset += b.length;
    }

    const assembledBlob = new Blob([combined], { type: detectedMime || 'audio/webm' });

    // Determine final storage path
    const finalPath = assemblePathProvided || `live-podcasts/${podcastId}/assembled_${uploadSessionId || Date.now()}.webm`;

    // Upload assembled blob
    let { error: uploadErr } = await supabase.storage.from('podcasts').upload(finalPath, assembledBlob as any, { contentType: detectedMime || 'application/octet-stream', upsert: false });
    if (uploadErr && uploadErr.message && /mime type/i.test(uploadErr.message)) {
      ({ error: uploadErr } = await supabase.storage.from('podcasts').upload(finalPath, assembledBlob as any, { contentType: 'application/octet-stream', upsert: false }));
    }
    if (uploadErr) throw uploadErr;

    const pub: any = supabase.storage.from('podcasts').getPublicUrl(finalPath) as any;
    const finalPublicUrl = pub?.data?.publicUrl || pub?.publicUrl || null;

    // Insert audio_segments row pointing to assembled file
    // Determine next segment index
    const { data: existingSegs } = await supabase.from('audio_segments').select('segment_index').eq('podcast_id', podcastId);
    const nextIndex = Array.isArray(existingSegs) ? existingSegs.length : 0;
    const segPayload: any = {
      podcast_id: podcastId,
      segment_index: nextIndex,
      audio_url: finalPublicUrl,
      storage_path: finalPath,
      transcript: null,
      summary: null,
      mime_type: detectedMime,
      duration_seconds: null,
      created_at: new Date().toISOString()
    };

    const { data: segData, error: segErr } = await supabase.from('audio_segments').insert(segPayload).select().single();
    if (segErr) throw segErr;

    // Update podcast_recordings row
    try {
      await supabase.from('podcast_recordings').update({ status: 'finalized', final_audio_url: finalPublicUrl, storage_path: finalPath, ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('upload_session_id', uploadSessionId).eq('podcast_id', podcastId);
    } catch (e) { /* best-effort */ }

    // Optionally trigger transcription via process-audio
    let jobResp = null;
    if (triggerTranscription && finalPublicUrl) {
      try {
        const { data: userInfo } = await supabase.auth.getUser();
        const userId = userInfo?.user?.id || null;
        const { data: procData, error: procErr } = await supabase.functions.invoke('process-audio', { body: { file_url: finalPublicUrl, user_id: userId } as any } as any);
        if (procErr) console.warn('process-audio invocation error', procErr);
        jobResp = procData || null;
      } catch (e) {
        console.warn('Failed to invoke process-audio', e);
      }
    }

    return new Response(JSON.stringify({ success: true, assembled_file_url: finalPublicUrl, segment: segData, job: jobResp }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('complete-podcast-chunks error', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
