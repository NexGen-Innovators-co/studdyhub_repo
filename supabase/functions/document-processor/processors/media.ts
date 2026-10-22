import { EXTRACTION_PROMPTS } from '../prompts.ts';
import { callEnhancedGeminiAPI } from '../geminiApi.ts';

function withCustomInstruction(prompt: string, instruction?: string | null): string {
  return instruction
    ? `${prompt}\n\nCUSTOM USER INSTRUCTION:\n${instruction}\n\nFollow this instruction while preserving the required extraction output.`
    : prompt;
}

// ============================================================================
// IMAGE
// ============================================================================

export async function processImageWithVision(file: any, geminiApiKey: string): Promise<void> {
  const response = await callEnhancedGeminiAPI(
    [
      {
        role: 'user',
        parts: [
          { text: withCustomInstruction(EXTRACTION_PROMPTS.image, file.customInstruction) },
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
          { text: withCustomInstruction(EXTRACTION_PROMPTS.audio, file.customInstruction) },
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
          { text: withCustomInstruction(EXTRACTION_PROMPTS.video, file.customInstruction) },
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
