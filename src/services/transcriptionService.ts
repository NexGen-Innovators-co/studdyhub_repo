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
    // Call dedicated podcast transcription function
    const { data, error } = await supabase.functions.invoke('podcast-transcribe', {
      body: {
        file_url: audioUrl,
        title: title,
        duration: duration
      }
    });

    if (error) {
      //console.error('Transcription error:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data received from transcription service');
    }

    if (!data.success) {
      throw new Error(data.error || 'Transcription failed');
    }

    if (!data.transcript) {
      throw new Error('No transcript in response');
    }

    return {
      transcript: data.transcript,
      script: data.transcript, // Use transcript as script
      summary: data.summary || 'Live podcast recording'
    };
  } catch (error: any) {
    //console.error('Error in live podcast transcription:', error);
    throw new Error(`Transcription failed: ${error.message || 'Unknown error'}`);
  }
};
