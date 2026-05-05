import { EXTRACTION_PROMPTS } from '../prompts.ts';
import { callEnhancedGeminiAPI } from '../geminiApi.ts';

// ============================================================================
// IMAGE
// ============================================================================

export async function processImageWithVision(file: any, geminiApiKey: string): Promise<void> {
  const response = await callEnhancedGeminiAPI(
    [
      {
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPTS.image },
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ],
      },
    ],
    geminiApiKey,
  );

  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error ?? 'Failed to analyze image');
  }
}

// ============================================================================
// AUDIO
// ============================================================================

export async function processAudioWithTranscription(file: any, geminiApiKey: string): Promise<void> {
  const response = await callEnhancedGeminiAPI(
    [
      {
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPTS.audio },
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ],
      },
    ],
    geminiApiKey,
  );

  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error ?? 'Failed to transcribe audio');
  }
}

// ============================================================================
// VIDEO
// ============================================================================

export async function processVideoWithFrameAnalysis(file: any, geminiApiKey: string): Promise<void> {
  const response = await callEnhancedGeminiAPI(
    [
      {
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPTS.video },
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ],
      },
    ],
    geminiApiKey,
  );

  if (response.success && response.content) {
    file.content = response.content;
  } else {
    throw new Error(response.error ?? 'Failed to analyze video');
  }
}

// ============================================================================
// ARCHIVE
// ============================================================================

export function processArchiveWithMetadata(file: any): void {
  file.content = `[Archive File: ${file.name}]
Type: ${file.type.toUpperCase()}
Size: ${Math.round((file.size / 1024 / 1024) * 100) / 100} MB
MIME Type: ${file.mimeType}

This is an archive file that contains compressed data. Without extraction capabilities, only basic metadata can be provided. The archive may contain multiple files and directories that would need to be extracted to analyze their individual contents.`;
}
