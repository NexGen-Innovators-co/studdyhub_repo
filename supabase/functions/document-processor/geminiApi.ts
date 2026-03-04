import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';
import { ENHANCED_PROCESSING_CONFIG } from './config.ts';
import { findOverlapLength, mergeProcessedChunks } from './utils.ts';

// ============================================================================
// MODEL CHAIN
// ============================================================================

const DOC_MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
];

// ============================================================================
// CORE API CALLER
// ============================================================================

export async function callEnhancedGeminiAPI(
  contents: any[],
  geminiApiKey: string,
): Promise<{ success: boolean; content?: string; finishReason?: string; error?: string }> {
  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: ENHANCED_PROCESSING_CONFIG.MAX_OUTPUT_TOKENS,
      topK: 20,
      topP: 0.8,
    },
  };

  for (let attempt = 0; attempt < DOC_MODEL_CHAIN.length; attempt++) {
    const model = DOC_MODEL_CHAIN[attempt];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const candidate      = data.candidates?.[0];
        const extractedContent = candidate?.content?.parts?.[0]?.text;
        // finishReason values: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER"
        const finishReason   = candidate?.finishReason ?? 'UNKNOWN';

        if (extractedContent) {
          return { success: true, content: extractedContent, finishReason };
        }
        console.warn(`[geminiApi] No content from ${model} (finishReason=${finishReason})`);
        continue;
      }

      const errorText = await response.text();

      if (response.status === 429 || response.status === 503) {
        console.warn(`[geminiApi] ${response.status} from ${model}, switching to next model...`);
        const delay =
          Math.pow(2, attempt) * ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY +
          Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (response.status === 400 || response.status === 404) {
        console.error(`[geminiApi] ${response.status} from ${model}: ${errorText.substring(0, 200)}`);
        continue;
      }

      return { success: false, error: `API error ${response.status}: ${errorText}` };
    } catch (error: any) {
      console.error(`[geminiApi] Network error with ${model}:`, error.message);
      if (attempt < DOC_MODEL_CHAIN.length - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }

  // OpenRouter fallback
  const orResult = await callOpenRouterFallback(contents, { source: 'document-processor' });
  if (orResult.success && orResult.content) {
    return { success: true, content: orResult.content, finishReason: 'OPENROUTER' };
  }

  return { success: false, error: 'All AI models failed (Gemini + OpenRouter)' };
}

// ============================================================================
// CHUNKED PROCESSING
// ============================================================================

/** Process multiple text chunks through Gemini and merge results.
 *  Each chunk automatically continues if Gemini returns MAX_TOKENS. */
export async function processChunkedContent(
  chunks: string[],
  prompt: string,
  geminiApiKey: string,
): Promise<string> {
  const processedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `${prompt}

CHUNK PROCESSING INSTRUCTIONS:
- This is chunk ${i + 1} of ${chunks.length} total chunks
- Extract ALL content from this chunk with complete fidelity
${i === 0 ? '- This is the first chunk of the document' : '- Continue from previous chunk context'}
${i === chunks.length - 1 ? '- This is the final chunk of the document' : '- More chunks will follow'}
When you reach the end of this chunk write: [END OF CHUNK]

CHUNK CONTENT:
${chunks[i]}`;

    // Initial call for this chunk
    let response = await callEnhancedGeminiAPI(
      [{ role: 'user', parts: [{ text: chunkPrompt }] }],
      geminiApiKey,
    );

    let chunkResult     = response.success ? (response.content ?? '') : `[ERROR CHUNK ${i + 1}: ${response.error}]`;
    let finishReason    = response.finishReason ?? 'STOP';
    let contCount       = 0;
    const maxContPerChunk = 10;

    // Continue the chunk if Gemini hit its token limit
    while (finishReason === 'MAX_TOKENS' && contCount < maxContPerChunk) {
      contCount++;
      const tail = chunkResult.slice(-300);

      const contPrompt = `Continue extracting from chunk ${i + 1} of ${chunks.length}.
Previous extraction ended with:
"""
${tail}
"""
Continue from EXACTLY where it ended without repeating. Write [END OF CHUNK] when done.`;

      const contResp = await callEnhancedGeminiAPI(
        [{ role: 'user', parts: [{ text: contPrompt }] }],
        geminiApiKey,
      );

      if (!contResp.success || !contResp.content) break;

      const newPart       = contResp.content;
      finishReason        = contResp.finishReason ?? 'STOP';
      const reachedEnd    = newPart.includes('[END OF CHUNK]');
      const cleanPart     = newPart.replace('[END OF CHUNK]', '').trim();

      const overlap       = findOverlapLength(chunkResult.slice(-200), cleanPart.slice(0, 200));
      chunkResult        += '\n' + (overlap > 20 ? cleanPart.slice(overlap) : cleanPart);

      if (reachedEnd || finishReason === 'STOP') break;
      await new Promise((r) => setTimeout(r, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
    }

    // Strip [END OF CHUNK] marker before storing
    processedChunks.push(chunkResult.replace('[END OF CHUNK]', '').trim());

    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, ENHANCED_PROCESSING_CONFIG.RATE_LIMIT_DELAY));
    }
  }

  return mergeProcessedChunks(processedChunks);
}