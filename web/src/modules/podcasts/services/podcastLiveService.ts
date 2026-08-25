import { supabase } from '@/integrations/supabase/client';

export const addPodcastListener = async (podcastId: string, userId: string | null) => {
  if (!userId) return null;
  const now = new Date().toISOString();

  // Check if listener row already exists to avoid duplicates
  const { data: existing } = await supabase
    .from('podcast_listeners')
    .select('id')
    .eq('podcast_id', podcastId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Reactivate existing row
    const { data, error } = await supabase
      .from('podcast_listeners')
      .update({ is_active: true, joined_at: now })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('podcast_listeners').insert({ podcast_id: podcastId, user_id: userId, joined_at: now, is_active: true }).select().single();
  if (error) throw error;
  return data;
};

export const removePodcastListener = async (podcastId: string, userId: string | null) => {
  if (!userId) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('podcast_listeners').update({ is_active: false, left_at: now }).eq('podcast_id', podcastId).eq('user_id', userId).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const createParticipationRequest = async (podcastId: string, userId: string | null, requestType: 'speak' | 'cohost') => {
  if (!userId) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('podcast_participation_requests').insert({ podcast_id: podcastId, user_id: userId, request_type: requestType, status: 'pending', created_at: now }).select().single();
  if (error) throw error;
  return data;
};

export const saveTranscriptionResult = async (podcastId: string, fileUrl: string, transcript: string, summary?: string, userId?: string | null, script?: string | null) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('audio_processing_results').insert({ file_url: fileUrl, transcript, summary, status: 'completed', created_at: now, user_id: userId || null }).select().single();
  if (error) throw error;

  // Update podcast visual_assets with transcript metadata (preserve existing)
  try {
    const { data: podcastData } = await supabase.from('ai_podcasts').select('visual_assets').eq('id', podcastId).maybeSingle();
    let visual = podcastData?.visual_assets || {};
    if (typeof visual === 'string') {
      try { visual = JSON.parse(visual); } catch (e) { visual = {}; }
    }
    visual = { ...(visual || {}), transcript: { file_url: fileUrl, summary, length: transcript?.length || 0 } };
    // Also attempt to attach the transcript to the podcast's audio_segments
    try {
      const { data: podcastRow } = await supabase.from('ai_podcasts').select('audio_segments').eq('id', podcastId).maybeSingle();
      let segments: any[] = [];
      if (podcastRow && podcastRow.audio_segments) {
        try { segments = typeof podcastRow.audio_segments === 'string' ? JSON.parse(podcastRow.audio_segments) : podcastRow.audio_segments; } catch (e) { segments = []; }
      }

      let matched = false;
      if (fileUrl) {
        for (let i = 0; i < segments.length; i++) {
          if (segments[i] && segments[i].audio_url && segments[i].audio_url === fileUrl) {
            segments[i] = { ...segments[i], transcript, summary };
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        // Append a new lightweight segment referencing the uploaded file and transcript
        const newSeg = {
          audioContent: null,
          audio_url: fileUrl || null,
          transcript,
          summary,
          index: segments.length,
          created_at: new Date().toISOString()
        };
        segments.push(newSeg);
      }

      // Update visual_assets, audio_segments and top-level script (if provided) in one call
      const updatePayload: any = { visual_assets: visual, audio_segments: segments };
      if (script) updatePayload.script = script;
      await supabase.from('ai_podcasts').update(updatePayload).eq('id', podcastId);
    } catch (attachErr) {
      // If attaching to audio_segments fails, at least persist the visual_assets metadata
      try { 
        await supabase.from('ai_podcasts').update({ visual_assets: visual }).eq('id', podcastId); 
      } catch (vErr) { 
        // console.warn('Failed to update visual_assets', vErr); 
      }
    }
  } catch (e) {
    // best-effort
    // console.warn('Failed to attach transcript metadata to podcast', e);
  }

  return data;
};

export const uploadTempChunk = async (blob: Blob) => {
  try {
    const filename = `live-podcasts/temp-transcription/${Date.now()}_${Math.random().toString(36).slice(2,8)}.webm`;
    const contentType = (blob && (blob as any).type) ? (blob as any).type : 'audio/webm';
    let { error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, blob as any, { contentType });
    // Retry with a permissive content type if the bucket rejects the mime type
    if (uploadErr && uploadErr.message && /mime type/i.test(uploadErr.message)) {
      try {
        ({ error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, blob as any, { contentType: 'application/octet-stream' }));
      } catch (e) { uploadErr = e as any; }
    }
    if (uploadErr) throw uploadErr;
    const res = supabase.storage.from('podcasts').getPublicUrl(filename) as any;
    const publicUrl = res?.data?.publicUrl || res?.publicUrl;
    return publicUrl;
  } catch (e) {
    // console.warn('uploadTempChunk failed', e);
    throw e;
  }
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const result = fr.result as string;
      // Properly extract base64 data after the comma
      // Handle data URLs like "data:audio/webm;codecs=opus;base64,ACTUALBASE64DATA"
      const commaIndex = result.indexOf(',');
      if (commaIndex !== -1) {
        const base64 = result.substring(commaIndex + 1);
        resolve(base64);
      } else {
        // Fallback if no comma found (shouldn't happen with readAsDataURL)
        resolve(result);
      }
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
};

export const invokeRealtimeTranscription = async (fileUrl?: string, inlineBase64?: string, mimeType?: string) => {
  try {
    if (!fileUrl && !inlineBase64) throw new Error('invokeRealtimeTranscription: fileUrl or inlineBase64 is required');

    const payload: any = {};
    if (fileUrl) payload.file_url = fileUrl;
    if (inlineBase64) {
      // Ensure we're sending clean base64 without data URL prefix
      let cleanBase64 = inlineBase64;
      if (cleanBase64.startsWith('data:')) {
        const commaIndex = cleanBase64.indexOf(',');
        if (commaIndex !== -1) {
          cleanBase64 = cleanBase64.substring(commaIndex + 1);
        }
      }
      payload.inline_base64 = cleanBase64;
    }
    
    // Normalize mime type: remove codec parameters for Gemini compatibility
    if (mimeType) {
      payload.mime_type = mimeType.split(';')[0].trim();
    }

    // Log payload minimally for debugging
    try { 
      // // console.debug('[podcastLiveService] invokeRealtimeTranscription payload:', {
      //   hasFileUrl: !!payload.file_url,
      //   inlineBase64Length: payload.inline_base64 ? payload.inline_base64.length : 0,
      //   mimeType: payload.mime_type || null
      // }); 
    } catch (e) { }

    const { data, error } = await supabase.functions.invoke('realtime-transcribe', {
      body: payload
    } as any);

    if (error) throw error;
    return data;
  } catch (e) {
    // console.warn('invokeRealtimeTranscription failed', e);
    throw e;
  }
};

export const saveRecordingAsSegment = async (podcastId: string, blob: Blob) => {
  try {
    // Convert blob to base64 data URL
    const readAsDataURL = (b: Blob) => new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(b);
    });

    const dataUrl = await readAsDataURL(blob);
    const base64 = dataUrl.split(',')[1] || dataUrl;

    // Attempt to upload the blob to storage first to avoid sending large base64 JSON payloads
    let publicUrl: string | null = null;
    try {
      const filename = `live-podcasts/${podcastId}_${Date.now()}.webm`;
      const contentType = (blob && (blob as any).type) ? (blob as any).type : 'audio/webm';
      const { error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, blob as any, { contentType, upsert: false });
      if (!uploadErr) {
        const res = supabase.storage.from('podcasts').getPublicUrl(filename) as any;
        publicUrl = res?.data?.publicUrl || res?.publicUrl || null;
      } else {
        // console.warn('saveRecordingAsSegment: storage upload error', uploadErr);
      }
    } catch (e) {
      // console.warn('saveRecordingAsSegment: storage upload failed', e);
    }

    // fetch existing audio_segments (maybeSingle to avoid PGRST116 when 0 rows)
    const { data: existing, error: selErr } = await supabase.from('ai_podcasts').select('audio_segments').eq('id', podcastId).maybeSingle();
    if (selErr) throw selErr;

    let segments: any[] = [];
    if (existing && existing.audio_segments) {
      try {
        segments = typeof existing.audio_segments === 'string' ? JSON.parse(existing.audio_segments) : existing.audio_segments;
      } catch (e) {
        segments = [];
      }
    }

    const newSegment: any = {
      audioContent: null,
      audio_url: null,
      index: segments.length,
      created_at: new Date().toISOString()
    };

    if (publicUrl) {
      newSegment.audio_url = publicUrl;
    } else {
      // Fallback to embedding base64 if upload failed
      newSegment.audioContent = base64;
    }

    segments.push(newSegment);

    const payload = { audio_segments: segments };
    const { error: upErr } = await supabase.from('ai_podcasts').update(payload).eq('id', podcastId);
    if (upErr) throw upErr;

    return newSegment;
  } catch (e) {
    // console.warn('saveRecordingAsSegment failed', e);
    throw e;
  }
};

  export const getBlobDuration = async (blob: Blob): Promise<number> => {
    // Prefer WebAudio decode (more reliable); fall back to HTMLAudioElement
    try {
      const arrayBuffer = await blob.arrayBuffer();
      // Try WebAudio API
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const duration = audioBuffer?.duration || 0;
          try { ctx.close && ctx.close(); } catch (e) {}
          if (duration && isFinite(duration)) return duration;
        } catch (e) {
          // decode failed, fall through to audio element
        }
      }
      // Fallback: use HTMLAudioElement
      return await new Promise<number>((resolve) => {
        try {
          const url = URL.createObjectURL(new Blob([arrayBuffer] as any, { type: blob.type }));
          const audio = new Audio(url);
          const cleanup = () => {
            try { URL.revokeObjectURL(url); } catch (e) {}
          };
          const onLoaded = () => {
            const d = isFinite(audio.duration) ? audio.duration : 0;
            cleanup();
            resolve(d);
          };
          const onError = () => {
            cleanup();
            resolve(0);
          };
          audio.addEventListener('loadedmetadata', onLoaded);
          audio.addEventListener('error', onError);
          audio.load();
          // safety timeout
          setTimeout(() => { onError(); }, 2500);
        } catch (e) {
          resolve(0);
        }
      });
    } catch (e) {
      return 0;
    }
  };

// --- Chunked recording orchestration helpers ---

export const createRecordingSession = async (podcastId: string, userId?: string | null) => {
  try {
    // Attempt to invoke Edge Function for secure session creation
    try {
      const { data, error } = await supabase.functions.invoke('start-recording-session', {
        body: { podcast_id: podcastId, user_id: userId }
      });
      if (!error && data && !data.error) {
        return data;
      }
      if (error) {} // console.warn('start-recording-session invoke error', error);
    } catch (edgeErr) {
       // console.warn('start-recording-session skipped', edgeErr);
    }

    // Fallback (Client-side insert)
    const now = new Date().toISOString();
    const payload: any = { podcast_id: podcastId, status: 'in_progress', started_at: now };
    if (userId) payload.user_id = userId;
    const { data, error } = await supabase.from('podcast_recordings').insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    // console.warn('createRecordingSession failed', e);
    throw e;
  }
};

export const uploadChunk = async (podcastId: string, uploadSessionId: string, chunkIndex: number, blob: Blob, options?: { mimeType?: string }) => {
    try {
      const mimeType = options?.mimeType || (blob && (blob as any).type) || 'audio/webm';
      
      // Determine extension from mimeType
      let ext = 'webm';
      if (mimeType.includes('mp4')) ext = 'mp4';
      else if (mimeType.includes('wav')) ext = 'wav';
      else if (mimeType.includes('ogg')) ext = 'ogg';
      
      const filename = `live-podcasts/${podcastId}/${uploadSessionId}/${chunkIndex}_${Date.now()}.${ext}`;
      // upload to storage
      let { error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, blob as any, { contentType: mimeType, upsert: false });
      if (uploadErr && uploadErr.message && /mime type/i.test(uploadErr.message)) {
        // retry with permissive content type
        ({ error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, blob as any, { contentType: 'application/octet-stream', upsert: false }));
      }
      if (uploadErr) throw uploadErr;

      const res = supabase.storage.from('podcasts').getPublicUrl(filename) as any;
      const publicUrl = res?.data?.publicUrl || res?.publicUrl || null;

      // Register chunk via Edge Function (to bypass RLS on podcast_chunks table)
      const { data, error } = await supabase.functions.invoke('upload-podcast-chunk', {
        body: {
            podcast_id: podcastId,
            upload_session_id: uploadSessionId,
            chunk_index: chunkIndex,
            storage_path: filename,
            file_size: blob.size,
            mime_type: mimeType
        }
      });

      if (error) {
         // console.error('upload-podcast-chunk invoke error:', error);
         throw error;
      }
      
      // Edge function returns { success: true, chunk: ... }
      if (!data?.success) {
         throw new Error(data?.error || 'Unknown error registering chunk');
      }

      return { chunk: data.chunk, publicUrl };
    } catch (e) {
      // console.warn('uploadChunk failed', e);
      throw e;
    }
};

export const finalizeRecording = async (podcastId: string, uploadSessionId: string, assemblePath?: string, triggerTranscription = true) => {
  try {
    // mark recording as assembling in DB (best-effort)
    try {
      await supabase.from('podcast_recordings').update({ status: 'assembling', updated_at: new Date().toISOString() }).eq('session_id', uploadSessionId).eq('podcast_id', podcastId);
    } catch (e) { /* best-effort */ }

    // invoke edge function to assemble chunks
    const payload: any = { podcast_id: podcastId, upload_session_id: uploadSessionId };
    if (assemblePath) payload.assemble_path = assemblePath;
    if (triggerTranscription !== undefined) payload.trigger_transcription = triggerTranscription;

    // console.log('finalizeRecording payload:', payload);

    const { data, error } = await supabase.functions.invoke('complete-podcast-chunks', { body: payload } as any);
    if (error) {
        // console.error('complete-podcast-chunks invoke error details:', error);
        throw error;
    }
    return data;
  } catch (e) {
    // console.warn('finalizeRecording exception:', e);
    throw e;
  }
};

export const triggerChunkTranscription = async (fileUrl: string, podcastId?: string, metadata?: any) => {
  try {
    const payload: any = { file_url: fileUrl };
    if (podcastId) payload.podcast_id = podcastId;
    if (metadata) payload.metadata = metadata;

    // use process-audio to create an async job and avoid inline base64
    const { data, error } = await supabase.functions.invoke('process-audio', { body: payload } as any);
    if (error) throw error;
    return data;
  } catch (e) {
    // console.warn('triggerChunkTranscription failed', e);
    throw e;
  }
};

