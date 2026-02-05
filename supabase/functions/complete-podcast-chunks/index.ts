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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    let detectedMime: string | null = null;
    for (const c of chunks) {
      try {
        console.log(`Downloading chunk ${c.chunk_index}: ${c.storage_path}`);
        // Use download() instead of fetch(publicUrl) to avoid access issues and ensure we use the service role key permissions
        const { data: fileBlob, error: downloadErr } = await supabase.storage.from('podcasts').download(c.storage_path);
        
        if (downloadErr) {
             console.error(`Download error for ${c.storage_path}:`, downloadErr);
             throw new Error(`Failed to download chunk ${c.chunk_index}: ${downloadErr.message}`);
        }
        
        if (!fileBlob) throw new Error(`Empty file blob for ${c.storage_path}`);
        
        const ab = new Uint8Array(await fileBlob.arrayBuffer());
        buffers.push(ab);
        if (!detectedMime && c.mime_type) detectedMime = c.mime_type;
      } catch (e) {
        console.error('Failed to fetch chunk for assembly:', e);
        throw e;
      }
    }
    
    // Default if not detected
    if (!detectedMime) detectedMime = 'audio/webm';

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

    // Determine extension based on mime
    let ext = 'webm';
    if (detectedMime) {
        if (detectedMime.includes('mp4')) ext = 'mp4';
        else if (detectedMime.includes('mpeg')) ext = 'mp3';
        else if (detectedMime.includes('wav')) ext = 'wav';
    }

    // Determine final storage path
    const finalPath = assemblePathProvided || `live-podcasts/${podcastId}/assembled_${uploadSessionId || Date.now()}.${ext}`;

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

    // Sync to ai_podcasts JSON column (Backwards Compatibility)
    try {
        const { data: podcastRow, error: fetchErr } = await supabase.from('ai_podcasts').select('audio_segments').eq('id', podcastId).single();
        if (!fetchErr && podcastRow) {
            let jsonSegments: any[] = [];
            try {
                if (typeof podcastRow.audio_segments === 'string') {
                    jsonSegments = JSON.parse(podcastRow.audio_segments);
                } else if (Array.isArray(podcastRow.audio_segments)) {
                    jsonSegments = podcastRow.audio_segments;
                }
            } catch (e) { /* ignore */ }
            
            // Construct JSON segment representation
            const newJsonSeg = {
                segment_index: nextIndex,
                audio_url: finalPublicUrl,
                audioContent: null, // No inline content for internal assembled files
                transcript: null,
                summary: null,
                duration: null,
                mime_type: detectedMime,
                created_at: new Date().toISOString()
            };
            
            jsonSegments.push(newJsonSeg);
            
            await supabase.from('ai_podcasts').update({ 
                audio_segments: jsonSegments,
                updated_at: new Date().toISOString()
            }).eq('id', podcastId);
        }
    } catch (syncErr) {
        console.warn('Failed to sync audio_segments JSON column:', syncErr);
    }

    // Update podcast_recordings row
    try {
      const { data: updatedRows, error: updateErr } = await supabase.from('podcast_recordings').update({ 
            status: 'finalized', 
            final_audio_url: finalPublicUrl, 
            storage_path: finalPath, 
            ended_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
        })
        .eq('session_id', uploadSessionId)
        .eq('podcast_id', podcastId)
        .select();

      if (updateErr) {
          console.error('Failed to update podcast_recordings status:', updateErr);
      } else if (!updatedRows || updatedRows.length === 0) {
          // Row missing? Create it now (fallback for missing session start)
          console.warn('Podcast recording session not found. Creating finalized entry now.');
          // Estimate start time as 1 minute ago per chunk roughly, or just now
          const { error: insertErr } = await supabase.from('podcast_recordings').insert({
              podcast_id: podcastId,
              session_id: uploadSessionId,
              status: 'finalized',
              final_audio_url: finalPublicUrl,
              storage_path: finalPath,
              started_at: new Date().toISOString(), 
              ended_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
          });
          if (insertErr) console.error('Failed to insert fallback podcast_recordings:', insertErr);
      }

    } catch (e) { 
        console.error('Exception updating podcast_recordings:', e);
    }

    // Optionally trigger transcription via process-audio
    let jobResp = null;
    if (triggerTranscription && finalPublicUrl) {
      try {
        // Note: getUser() with service role key returns no user unless context set.
        // We accept that userId might be null.
        let userId: string | null = null;
        try {
             // Try to parse user from authorization header if forwarded, but we are using empty client options
             const authHeader = req.headers.get('Authorization');
             if (authHeader) {
                 const token = authHeader.replace('Bearer ', '');
                 const { data: userData } = await supabase.auth.getUser(token);
                 userId = userData.user?.id || null;
             }
        } catch (uErr) { /* ignore */ }
        
        const { data: procData, error: procErr } = await supabase.functions.invoke('process-audio', { body: { file_url: finalPublicUrl, user_id: userId, podcast_id: podcastId } as any } as any);
        if (procErr) console.warn('process-audio invocation error', procErr);
        jobResp = procData || null;
      } catch (e) {
        console.warn('Failed to invoke process-audio', e);
      }
    }

    return new Response(JSON.stringify({ success: true, assembled_file_url: finalPublicUrl, segment: segData, job: jobResp }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('complete-podcast-chunks error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e), stack: e?.stack }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});

