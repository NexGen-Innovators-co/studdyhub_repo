import { supabase } from '@/integrations/supabase/client';

export interface CloudTtsOptions {
  text: string;
  // voice can be 'male'|'female' or a specific voice name like 'en-US-Neural2-D'
  voice?: 'male' | 'female' | string;
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

    // Notify UI that generation is starting
    try {
      window.dispatchEvent(new CustomEvent('cloud-tts:generating', { detail: { length: text.length, voice } }));
    } catch (e) {
      // ignore - window may not exist in some runtimes
    }

    const response = await supabase.functions.invoke('cloud-tts', {
      body: {
        text,
        voice,
        rate,
        pitch
      }
    });

    // Supabase sets response.error for non-2xx but response.data may still have the body
    const data = response.data;

    if (response.error) {
      // Check if the response body has a specific error message from our edge function
      const serverMsg = data?.error;
      throw new Error(serverMsg || response.error.message || 'Failed to generate speech');
    }

    if (!data?.success || !data?.audioContent) {
      throw new Error(data?.error || 'Invalid response from TTS service');
    }

    try {
      window.dispatchEvent(new CustomEvent('cloud-tts:generated', { detail: { size: response.data.audioContent.length } }));
    } catch (e) {
      // ignore
    }

    return {
      audioContent: response.data.audioContent
    };
  } catch (error: any) {
    try {
      window.dispatchEvent(new CustomEvent('cloud-tts:error', { detail: { message: error?.message || String(error) } }));
    } catch (e) {
      // ignore
    }
    return {
      audioContent: '',
      error: error.message || 'Failed to generate speech'
    };
  }
}

/** Google Cloud TTS byte limit for plain text input */
const TTS_CHUNK_BYTE_LIMIT = 4800; // leave headroom under 5000

/**
 * Split text into chunks that fit within the TTS byte limit, breaking at sentence
 * boundaries when possible, otherwise at word boundaries.
 */
function splitTextIntoChunks(text: string): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= TTS_CHUNK_BYTE_LIMIT) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (encoder.encode(remaining).length <= TTS_CHUNK_BYTE_LIMIT) {
      chunks.push(remaining);
      break;
    }

    // Binary-search for the longest prefix that fits
    let lo = 0;
    let hi = remaining.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (encoder.encode(remaining.slice(0, mid)).length <= TTS_CHUNK_BYTE_LIMIT) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    let splitAt = lo;

    // Try to break at a sentence boundary (.!?) within the last 20% of the chunk
    const searchFrom = Math.floor(splitAt * 0.8);
    const window = remaining.slice(searchFrom, splitAt);
    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? ')
    );
    if (sentenceEnd !== -1) {
      splitAt = searchFrom + sentenceEnd + 2; // include the punctuation + space
    } else {
      // Fall back to word boundary
      const lastSpace = remaining.lastIndexOf(' ', splitAt);
      if (lastSpace > splitAt * 0.5) {
        splitAt = lastSpace + 1;
      }
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Play audio from base64 encoded content
 * @param audioContent Base64 encoded audio (can include data URL prefix)
 * @returns Audio element that is playing
 */
export async function playAudioContent(audioContent: string): Promise<HTMLAudioElement> {
  // Sanitize base64 string
  const cleanedAudio = audioContent
    .trim()
    .replace(/^data:audio\/[a-z]+;base64,/, '')
    .replace(/\s/g, '');

  const audio = new Audio(`data:audio/mp3;base64,${cleanedAudio}`);

  // Attach playback events for UI
  try {
    audio.addEventListener('playing', () => {
      try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-start')); } catch (e) {}
    });
    audio.addEventListener('ended', () => {
      try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-ended')); } catch (e) {}
    });
    audio.addEventListener('error', (err) => {
      try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-error', { detail: { error: err } })); } catch (e) {}
    });
  } catch (e) {
    // ignore
  }

  try {
    await audio.play();
  } catch (err) {
    try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-error', { detail: { error: err } })); } catch (e) {}
    throw new Error('Failed to play audio');
  }

  return audio;
}

/**
 * Get available voices, waiting for them to load on mobile browsers where
 * getVoices() initially returns an empty array.
 */
function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Mobile Chrome/Android loads voices asynchronously
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    // Don't wait forever if voiceschanged never fires
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1500);
  });
}

/**
 * Pick the best voice from a list based on the requested gender.
 */
function pickVoice(voices: SpeechSynthesisVoice[], wantMale: boolean): SpeechSynthesisVoice | undefined {
  const enVoices = voices.filter(v => /^en/i.test(v.lang));
  const pool = enVoices.length > 0 ? enVoices : voices;

  const femalePatterns = /female|samantha|victoria|karen|zira|google.*female|fiona|moira|tessa|allison/i;
  const malePatterns = /\bmale\b|daniel|david|james|google.*male|alex|tom|fred|aaron/i;

  if (wantMale) {
    return pool.find(v => malePatterns.test(v.name) && !femalePatterns.test(v.name)) || pool[0];
  }
  return pool.find(v => femalePatterns.test(v.name))
    || pool.find(v => !malePatterns.test(v.name))
    || pool[0];
}

/**
 * Fall back to the browser's built-in Web Speech API when cloud TTS is unavailable.
 * Returns a dummy HTMLAudioElement-like wrapper so callers can still call .pause() / listen to 'ended'.
 */
async function speakWithNativeTts(options: CloudTtsOptions): Promise<HTMLAudioElement | null> {
  if (!('speechSynthesis' in window)) {
    console.warn('[TTS] Native speechSynthesis not available on this device');
    return null;
  }

  // Cancel any ongoing utterance first
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(options.text);
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch != null ? options.pitch + 1 : 1; // Cloud pitch 0 = neutral → native 1
  utterance.lang = 'en-US';

  // Wait for voices to load (critical on mobile)
  const voices = await getVoicesAsync();
  if (voices.length > 0) {
    const picked = pickVoice(voices, options.voice === 'male');
    if (picked) utterance.voice = picked;
  }

  // Create a thin wrapper so callers can treat this like an HTMLAudioElement
  const fakeAudio = new Audio(); // silent audio element acting as event proxy
  utterance.onend = () => fakeAudio.dispatchEvent(new Event('ended'));
  utterance.onerror = (e) => fakeAudio.dispatchEvent(new ErrorEvent('error', { message: e.error }));

  // Allow callers to pause / stop via the proxy
  const origPause = fakeAudio.pause.bind(fakeAudio);
  fakeAudio.pause = () => {
    window.speechSynthesis.cancel();
    origPause();
  };

  window.speechSynthesis.speak(utterance);

  try {
    window.dispatchEvent(new CustomEvent('cloud-tts:playback-start'));
  } catch (_) {}

  utterance.onend = () => {
    try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-ended')); } catch (_) {}
    fakeAudio.dispatchEvent(new Event('ended'));
  };

  return fakeAudio;
}

/**
 * Generate and play speech in one call.
 * Long texts are split into chunks and played sequentially.
 * Automatically falls back to the device's native TTS when cloud generation fails.
 * @param options TTS options
 * @returns Audio element proxy that fires 'ended' when all chunks finish.
 *          Calling .pause() stops the entire chain. Returns null if everything failed.
 */
export async function speakText(options: CloudTtsOptions): Promise<HTMLAudioElement | null> {
  const chunks = splitTextIntoChunks(options.text);

  // Try cloud TTS first with the first chunk to see if it works
  const firstResult = await generateSpeech({ ...options, text: chunks[0] });

  if (firstResult.error || !firstResult.audioContent) {
    console.warn('[CloudTTS] Cloud speech failed, falling back to native TTS:', firstResult.error);
    return speakWithNativeTts(options);
  }

  // Cloud works — set up sequential chunk playback
  let cancelled = false;

  // Proxy element that callers interact with — lets them .pause() and listen for 'ended'/'error'
  const proxy = new Audio();
  const origPause = proxy.pause.bind(proxy);
  proxy.pause = () => {
    cancelled = true;
    if (currentChunkAudio) {
      currentChunkAudio.pause();
      currentChunkAudio = null;
    }
    origPause();
  };

  let currentChunkAudio: HTMLAudioElement | null = null;

  const playChunks = async () => {
    for (let i = 0; i < chunks.length; i++) {
      if (cancelled) return;

      try {
        let audioContent: string;
        if (i === 0) {
          // Already generated the first chunk
          audioContent = firstResult.audioContent;
        } else {
          const result = await generateSpeech({ ...options, text: chunks[i] });
          if (cancelled) return;
          if (result.error || !result.audioContent) {
            console.warn(`[CloudTTS] Chunk ${i + 1}/${chunks.length} failed:`, result.error);
            continue; // Skip failed chunks rather than stopping entirely
          }
          audioContent = result.audioContent;
        }

        if (cancelled) return;

        // Play this chunk and wait for it to finish
        const audio = await playAudioContent(audioContent);
        currentChunkAudio = audio;

        // Dispatch start event only for the first chunk
        if (i === 0) {
          try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-start')); } catch (_) {}
        }

        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('ended', () => resolve(), { once: true });
          audio.addEventListener('error', () => reject(new Error('Chunk playback error')), { once: true });
        });

        currentChunkAudio = null;
      } catch (chunkErr) {
        if (cancelled) return;
        console.warn(`[CloudTTS] Chunk ${i + 1}/${chunks.length} playback error:`, chunkErr);
        // Continue with next chunk
      }
    }

    // All chunks done
    if (!cancelled) {
      try { window.dispatchEvent(new CustomEvent('cloud-tts:playback-ended')); } catch (_) {}
      proxy.dispatchEvent(new Event('ended'));
    }
  };

  // Start the chain (don't await — let it run in background)
  playChunks().catch(() => {
    if (!cancelled) {
      proxy.dispatchEvent(new ErrorEvent('error', { message: 'TTS playback chain failed' }));
    }
  });

  return proxy;
}
