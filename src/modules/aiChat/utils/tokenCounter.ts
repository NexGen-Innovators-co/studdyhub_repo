// src/utils/tokenCounter.ts
// Utility for estimating token counts to prevent exceeding AI model limits

/**
 * Estimates token count for text content
 * Rule of thumb: 1 token ≈ 4 characters for English text
 */
export function estimateTokenCount(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates token count for base64 encoded images
 * Images consume significantly more tokens
 */
export function estimateImageTokens(base64Data: string, mimeType: string): number {
  // Base64 images are roughly 1.33x the original size
  // Images use approximately 85 tokens per 512x512 tile for vision models
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  // Rough estimate: ~1000 tokens per MB for images
  return Math.ceil(sizeInMB * 1000);
}

/**
 * Token limits for different contexts
 */
export const TOKEN_LIMITS = {
  // Gemini 2.0 Flash limits
  GEMINI_MAX_INPUT: 2 * 1024 * 1024, // 2M tokens
  GEMINI_MAX_OUTPUT: 65530, // ~64K tokens
  
  // Conservative limits for context safety
  MAX_MESSAGE_CONTEXT: 500000, // 500K tokens for message + context
  MAX_SINGLE_FILE: 100000, // 100K tokens per file
  MAX_TOTAL_FILES: 10, // Maximum 10 files per request
  MAX_DOCUMENTS_CONTEXT: 200000, // 200K tokens for all attached documents
  MAX_NOTES_CONTEXT: 100000, // 100K tokens for all attached notes
  MAX_CONVERSATION_HISTORY: 300000, // 300K tokens for history
  
  // Warning thresholds
  WARNING_THRESHOLD: 0.8, // Warn at 80% of limit
};

export interface TokenEstimate {
  messageTokens: number;
  filesTokens: number;
  documentsTokens: number;
  notesTokens: number;
  historyTokens: number;
  totalTokens: number;
  isWithinLimit: boolean;
  exceedsLimit: boolean;
  warnings: string[];
}

/**
 * Estimates total token count for a chat request
 */
export function estimateChatRequestTokens(params: {
  message?: string;
  files?: Array<{ content?: string; data?: string; mimeType?: string; type?: string }>;
  documentsContext?: string;
  notesContext?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): TokenEstimate {
  const warnings: string[] = [];
  
  // Message tokens
  const messageTokens = estimateTokenCount(params.message);
  
  // Files tokens
  let filesTokens = 0;
  if (params.files) {
    for (const file of params.files) {
      if (file.type === 'image' && file.data) {
        filesTokens += estimateImageTokens(file.data, file.mimeType || 'image/jpeg');
      } else if (file.content) {
        const fileTokens = estimateTokenCount(file.content);
        if (fileTokens > TOKEN_LIMITS.MAX_SINGLE_FILE) {
          warnings.push(`File "${file.content.substring(0, 30)}..." exceeds single file limit`);
        }
        filesTokens += fileTokens;
      }
    }
  }
  
  // Documents context tokens
  const documentsTokens = estimateTokenCount(params.documentsContext);
  if (documentsTokens > TOKEN_LIMITS.MAX_DOCUMENTS_CONTEXT) {
    warnings.push('Attached documents context is very large');
  }
  
  // Notes context tokens
  const notesTokens = estimateTokenCount(params.notesContext);
  if (notesTokens > TOKEN_LIMITS.MAX_NOTES_CONTEXT) {
    warnings.push('Attached notes context is very large');
  }
  
  // Conversation history tokens
  let historyTokens = 0;
  if (params.conversationHistory) {
    for (const msg of params.conversationHistory) {
      historyTokens += estimateTokenCount(msg.content);
    }
  }
  
  const totalTokens = messageTokens + filesTokens + documentsTokens + notesTokens + historyTokens;
  
  // Check limits
  const isWithinLimit = totalTokens <= TOKEN_LIMITS.MAX_MESSAGE_CONTEXT;
  const exceedsLimit = totalTokens > TOKEN_LIMITS.GEMINI_MAX_INPUT;
  
  if (totalTokens > TOKEN_LIMITS.MAX_MESSAGE_CONTEXT * TOKEN_LIMITS.WARNING_THRESHOLD) {
    warnings.push('Approaching token limit - consider reducing context');
  }
  
  if (params.files && params.files.length > TOKEN_LIMITS.MAX_TOTAL_FILES) {
    warnings.push(`Too many files (${params.files.length}). Maximum is ${TOKEN_LIMITS.MAX_TOTAL_FILES}`);
  }
  
  return {
    messageTokens,
    filesTokens,
    documentsTokens,
    notesTokens,
    historyTokens,
    totalTokens,
    isWithinLimit,
    exceedsLimit,
    warnings,
  };
}

/**
 * Truncates content to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Calculate approximate character limit (tokens * 4)
  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars) + '\n\n[Content truncated due to length...]';
}

/**
 * Formats token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  } else {
    return `${(tokens / 1000000).toFixed(2)}M tokens`;
  }
}
