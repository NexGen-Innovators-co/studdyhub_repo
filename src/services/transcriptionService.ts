// transcriptionService.ts - Service for audio transcription using Gemini
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionResult {
  transcript: string;
  summary?: string;
  duration?: number;
}

/**
 * Transcribe audio using Gemini AI
 * @param audioBlob - The audio blob to transcribe
 * @param audioUrl - Optional public URL if already uploaded
 * @returns Transcript and summary
 */
export const transcribeAudio = async (
  audioBlob: Blob,
  audioUrl?: string
): Promise<TranscriptionResult> => {
  try {
    let fileUrl = audioUrl;

    // If no URL provided, upload to storage first
    if (!fileUrl) {
      const fileName = `temp-transcription/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('podcasts')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('podcasts')
        .getPublicUrl(fileName);

      fileUrl = publicUrl;
    }

    // Call Gemini audio processor
    const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
      body: {
        file_url: fileUrl,
        target_language: 'en',
        include_summary: true
      }
    });

    if (error) throw error;

    if (!data || !data.transcript) {
      throw new Error('Invalid response from audio processor: Missing transcript');
    }

    return {
      transcript: data.transcript,
      summary: data.summary,
      duration: data.duration
    };
  } catch (error: any) {
    //console.error('Error transcribing audio:', error);
    throw new Error(`Transcription failed: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Generate a structured podcast script from transcript
 * @param transcript - The raw transcript
 * @param title - Podcast title
 * @param duration - Duration in seconds
 * @returns Formatted script with timestamps
 */
export const generatePodcastScript = async (
  transcript: string,
  title: string,
  duration: number
): Promise<string> => {
  // Sanitize the transcript to remove unwanted characters
  const sanitizedTranscript = transcript.replace(/`/g, '');

  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: {
        messages: [{
          role: 'user',
          content: `Generate a well-formatted podcast script from this transcript. Add clear speaker labels, timestamps, and structure it professionally.

Title: ${title}
Duration: ${Math.floor(duration / 60)} minutes

Transcript: ${sanitizedTranscript}

Format the script with:
- Clear speaker labels (Host, Guest, etc.)
- Approximate timestamps
- Paragraph breaks for readability
- Key topics/sections highlighted`
        }],
        options: {
          temperature: 0.3,
          max_tokens: 8000
        }
      }
    });

    if (error) throw error;

    return data?.response || transcript;
  } catch (error) {
    //console.error('Error generating script:', error);
    // Return original transcript if formatting fails
    return transcript;
  }
};

/**
 * Transcribe and format a live podcast recording
 * @param audioBlob - The recorded audio
 * @param title - Podcast title
 * @param duration - Duration in seconds
 * @param audioUrl - Pre-uploaded audio URL
 * @returns Complete transcription result
 */
export const transcribeLivePodcast = async (
  audioBlob: Blob,
  title: string,
  duration: number,
  audioUrl: string
): Promise<{
  transcript: string;
  script: string;
  summary: string;
}> => {
  try {
    // Ensure we have a public file URL – upload the blob if needed
    let fileUrl = audioUrl;
    if (!fileUrl && audioBlob) {
      try {
        const filename = `live-podcasts/${Date.now()}_${Math.random().toString(36).slice(2,8)}.webm`;
        const contentType = (audioBlob && (audioBlob as any).type) ? (audioBlob as any).type : 'audio/webm';
        const { error: uploadErr } = await supabase.storage.from('podcasts').upload(filename, audioBlob as any, { contentType, upsert: true });
        if (!uploadErr) {
          const res = supabase.storage.from('podcasts').getPublicUrl(filename) as any;
          fileUrl = res?.data?.publicUrl || res?.publicUrl || fileUrl;
        } else {
          // console.warn('transcribeLivePodcast: upload error', uploadErr);
        }
      } catch (e) {
        // console.warn('transcribeLivePodcast: failed to upload blob for transcription', e);
      }
    }

    // Helper to convert blob to base64 - ENSURES CLEAN BASE64 OUTPUT
    const blobToBase64 = async (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // CRITICAL: Extract ONLY the base64 part, removing ALL prefixes
          // Handle formats like: "data:video/webm;codecs=vp9,opus;base64,ACTUALDATA"
          
          // First, find the last comma (after all mime type and codec info)
          const lastCommaIndex = dataUrl.lastIndexOf(',');
          let base64 = lastCommaIndex !== -1 ? dataUrl.substring(lastCommaIndex + 1) : dataUrl;
          
          // Double-check: remove any remaining mime type prefix patterns
          // (in case the data URL format is unusual)
          const patterns = [
            /^data:[^,]*,/,           // data:type,
            /^[^;]+;base64,/,         // type;base64,
            /^[^,]*;codecs=[^,]*,/   // type;codecs=list,
          ];
          
          for (const pattern of patterns) {
            base64 = base64.replace(pattern, '');
          }
          
          // Ensure we have actual base64 data (should only contain A-Z, a-z, 0-9, +, /, =)
          base64 = base64.trim();
          
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    };

    // Normalize mime type - strip codec parameters
    const normalizeMimeType = (mimeType: string): string => {
      return mimeType.split(';')[0].trim();
    };

    // Call dedicated podcast transcription function
    let attemptBody: any = { file_url: fileUrl, title: title, duration: duration };
    let resp: any;
    
    try {
      // First attempt: try with file URL if available
      if (fileUrl) {
        const { data, error } = await supabase.functions.invoke('podcast-transcribe', { 
          body: { 
            file_url: fileUrl, 
            title, 
            duration 
          } 
        } as any);
        if (error) throw error;
        resp = data;
      } else {
        throw new Error('No file URL, using inline base64');
      }
    } catch (primaryErr: any) {
      // console.warn('transcribeLivePodcast: primary invocation failed, trying inline base64', primaryErr);

      // Fallback to inline base64 of the blob
      const base64 = await blobToBase64(audioBlob);
      
      // CRITICAL: Ensure clean mime type (no codecs)
      const rawMimeType = (audioBlob as any).type || 'audio/webm';
      const normalizedMime = rawMimeType.split(';')[0].trim();
      
      // console.log('Sending inline base64:', {
      //   base64Length: base64.length,
      //   base64Preview: base64.substring(0, 50),
      //   mime: normalizedMime
      // });

      const { data: data2, error: err2 } = await supabase.functions.invoke('podcast-transcribe', {
        body: { 
          inline_base64: base64, 
          mime_type: normalizedMime, 
          title, 
          duration 
        }
      } as any);
      
      if (err2) throw err2;
      resp = data2;
    }

    if (!resp) throw new Error('No data received from transcription service');
    if (!resp.success) throw new Error(resp.error || 'Transcription failed');
    if (!resp.transcript) throw new Error('No transcript in response');

    return { 
      transcript: resp.transcript, 
      script: resp.transcript, 
      summary: resp.summary || 'Live podcast recording' 
    };
  } catch (error: any) {
    // console.error('Error in live podcast transcription:', error);
    throw new Error(`Transcription failed: ${error.message || 'Unknown error'}`);
  }
};

