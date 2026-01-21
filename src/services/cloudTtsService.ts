import { supabase } from '@/integrations/supabase/client';

export interface CloudTtsOptions {
  text: string;
  voice?: 'male' | 'female';
  rate?: number;
  pitch?: number;
}

export interface CloudTtsResponse {
  audioContent: string;
  error?: string;
}

/**
 * Generate speech audio using Google Cloud Text-to-Speech API
 * @param options TTS options including text, voice, rate, and pitch
 * @returns Base64 encoded audio content
 */
export async function generateSpeech(options: CloudTtsOptions): Promise<CloudTtsResponse> {
  try {
    const { text, voice = 'female', rate = 1.0, pitch = 0 } = options;

    const response = await supabase.functions.invoke('cloud-tts', {
      body: {
        text,
        voice,
        rate,
        pitch
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to generate speech');
    }

    if (!response.data?.success || !response.data?.audioContent) {
      throw new Error('Invalid response from TTS service');
    }

    return {
      audioContent: response.data.audioContent
    };
  } catch (error: any) {
    //console.error('[CloudTTS] Error:', error);
    return {
      audioContent: '',
      error: error.message || 'Failed to generate speech'
    };
  }
}

/**
 * Play audio from base64 encoded content
 * @param audioContent Base64 encoded audio (can include data URL prefix)
 * @returns Audio element that is playing
 */
export function playAudioContent(audioContent: string): HTMLAudioElement {
  // Sanitize base64 string
  const cleanedAudio = audioContent
    .trim()
    .replace(/^data:audio\/[a-z]+;base64,/, '')
    .replace(/\s/g, '');

  const audio = new Audio(`data:audio/mp3;base64,${cleanedAudio}`);
  audio.play().catch(err => {
    //console.error('[CloudTTS] Playback error:', err);
    throw new Error('Failed to play audio');
  });

  return audio;
}

/**
 * Generate and play speech in one call
 * @param options TTS options
 * @returns Audio element that is playing, or null if generation failed
 */
export async function speakText(options: CloudTtsOptions): Promise<HTMLAudioElement | null> {
  const { audioContent, error } = await generateSpeech(options);

  if (error || !audioContent) {
    //console.error('[CloudTTS] Speech generation failed:', error);
    return null;
  }

  return playAudioContent(audioContent);
}
