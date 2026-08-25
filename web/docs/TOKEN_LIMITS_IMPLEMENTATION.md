# Token Counting & File Limits Implementation

## Overview
This implementation adds comprehensive token counting and file limits to the Gemini AI chat system to prevent "token limit exceeded" errors and improve user experience.

## What Was Implemented

### 1. Token Counter Utility (`src/utils/tokenCounter.ts`)
A comprehensive utility for estimating token counts across different content types:

**Key Functions:**
- `estimateTokenCount(text)` - Estimates tokens for text (1 token ≈ 4 characters)
- `estimateImageTokens(base64Data, mimeType)` - Estimates tokens for images (~1000 tokens/MB)
- `estimateChatRequestTokens(params)` - Estimates total tokens for entire chat request
- `truncateToTokenLimit(text, maxTokens)` - Truncates content to fit within token limit
- `formatTokenCount(tokens)` - Formats token count for display (e.g., "1.5K tokens", "2.1M tokens")

**Token Limits Defined:**
```typescript
GEMINI_MAX_INPUT: 2M tokens        // Gemini 2.0 Flash absolute max
MAX_MESSAGE_CONTEXT: 500K tokens   // Safe limit for single message + context
MAX_SINGLE_FILE: 100K tokens       // Maximum per file
MAX_TOTAL_FILES: 10                // Maximum 10 files per request
MAX_DOCUMENTS_CONTEXT: 200K tokens // All attached documents
MAX_NOTES_CONTEXT: 100K tokens     // All attached notes
MAX_CONVERSATION_HISTORY: 300K tokens
WARNING_THRESHOLD: 80%             // Warn users at 80% of limit
```

**TokenEstimate Interface:**
Returns detailed breakdown:
- `messageTokens` - Tokens in user's message
- `filesTokens` - Tokens in attached files
- `documentsTokens` - Tokens in attached documents
- `notesTokens` - Tokens in attached notes
- `historyTokens` - Tokens in conversation history
- `totalTokens` - Sum of all tokens
- `isWithinLimit` - Boolean check
- `exceedsLimit` - Boolean check
- `warnings[]` - Array of warning messages

### 2. Client-Side Validation (`src/hooks/useMessageHandlers.tsx`)

**File Count Limit:**
- Added check for maximum 10 files per message
- Shows error toast if user exceeds limit
- Prevents submission until files are reduced

**Token Count Validation:**
- Estimates tokens BEFORE sending to backend
- Calculates total from:
  - Message content
  - Attached files (text + images)
  - Documents context
  - Notes context
  - Recent conversation history (last 20 messages)
- **Hard Stop:** Blocks submission if exceeding `GEMINI_MAX_INPUT` (2M tokens)
- **Warning:** Shows toast if approaching limit (>80% or specific warnings)

**User Experience:**
```typescript
// Error if exceeding absolute limit
toast.error('Content too large to process', {
  description: `Total: 2.1M tokens. Maximum is 2M tokens. 
                Please reduce attachments or message length.`
});

// Warning if approaching limit
toast.warning('Large context detected', {
  description: `Approaching token limit. Total: 1.8M tokens`
});
```

### 3. Backend Validation (`supabase/functions/gemini-chat/index.ts`)

**File Count & Size Limits:**
- Maximum 10 files per request (server-side enforcement)
- Maximum 20MB per file
- Returns descriptive error if limits exceeded:
  ```json
  {
    "error": "Too many files attached. Maximum is 10 files per request.",
    "details": "You attached 15 files. Please reduce the number of files and try again."
  }
  ```

**Token Count Validation:**
- Estimates tokens after building conversation context
- Checks total tokens from:
  - Conversation contents (all parts)
  - System instructions
  - Inline data (images)
- Uses 90% of max (1.8M tokens) as safe threshold
- Returns error with detailed breakdown if exceeding:
  ```json
  {
    "error": "Content too large to process",
    "details": "The total content (message + attachments + context) is too large. 
                Estimated: 2,100,000 tokens, Maximum: 1,800,000 tokens. 
                Please reduce the number of attachments or message length.",
    "estimatedTokens": 2100000,
    "maxTokens": 1800000
  }
  ```

**Logging:**
- Console logs token estimates for monitoring
- Example: `[TokenValidation] Estimated input tokens: 450000 (within safe limit: 1800000)`

### 4. UI Component (`src/components/aiChat/TokenUsageIndicator.tsx`)

A visual indicator component to show token usage (optional integration):

**Features:**
- Color-coded display (green/yellow/red based on usage %)
- Shows breakdown by category (message, files, documents, notes, history)
- Progress bar visualization
- Warning messages
- Compact mode for inline display

**Usage Example:**
```tsx
import { TokenUsageIndicator } from './TokenUsageIndicator';
import { estimateChatRequestTokens } from '../../utils/tokenCounter';

// Estimate tokens
const estimate = estimateChatRequestTokens({
  message: userMessage,
  files: attachedFiles,
  documentsContext: docsContext,
  notesContext: notesContext,
  conversationHistory: history
});

// Display indicator
<TokenUsageIndicator estimate={estimate} />
```

## Validation Flow

### Client-Side (Before Sending):
1. ✅ Check file count <= 10
2. ✅ Estimate total tokens from all sources
3. ✅ If exceeds 2M tokens → Block & show error
4. ✅ If >80% of 500K context limit → Show warning
5. ✅ If specific warnings (large files, etc.) → Show warning
6. ✅ Send request to backend

### Backend (Server-Side):
1. ✅ Verify subscription/AI message limits
2. ✅ Check file count <= 10
3. ✅ Check individual file sizes <= 20MB
4. ✅ Build conversation context
5. ✅ Estimate total tokens (conversation + system + images)
6. ✅ If exceeds 1.8M tokens (90% of 2M) → Return error
7. ✅ Log token estimate
8. ✅ Send to Gemini API

## Benefits

### 1. **Prevents Token Limit Errors**
- Proactive validation before API calls
- Users know immediately if content is too large
- No wasted API calls or failed requests

### 2. **Better User Experience**
- Clear error messages explaining the issue
- Guidance on how to fix (reduce attachments, etc.)
- Visual feedback on token usage
- Warnings before hitting hard limits

### 3. **Cost Optimization**
- Prevents sending oversized requests to Gemini
- Reduces wasted API quota
- Encourages efficient context usage

### 4. **Security & Stability**
- Backend validation prevents malicious large requests
- File size limits prevent memory issues
- File count limits prevent DoS attacks
- Dual validation (client + server) ensures robustness

## Testing Recommendations

### Test Cases:

1. **File Count Limit:**
   - Try attaching 11+ files → Should show error and block
   - Exactly 10 files → Should proceed

2. **Token Size Limit:**
   - Attach large documents (>200K tokens) → Should warn
   - Attach multiple large files totaling >2M tokens → Should block
   - Normal usage (<500K tokens) → Should proceed smoothly

3. **Backend File Size:**
   - Upload file >20MB → Should return error
   - Upload file exactly 20MB → Should proceed

4. **Token Estimation Accuracy:**
   - Test with various content types (text, images, mixed)
   - Verify estimates are reasonable
   - Check logs for actual vs estimated tokens

5. **Error Messages:**
   - Verify clear, actionable error messages
   - Check toast notifications appear correctly
   - Ensure errors guide users to fix the issue

## Configuration

### Adjusting Limits:

**Client-Side** (`src/utils/tokenCounter.ts`):
```typescript
export const TOKEN_LIMITS = {
  MAX_MESSAGE_CONTEXT: 500000,  // Increase/decrease based on usage
  MAX_TOTAL_FILES: 10,          // Adjust file count limit
  WARNING_THRESHOLD: 0.8,       // Change warning percentage
};
```

**Backend** (`supabase/functions/gemini-chat/index.ts`):
```typescript
const MAX_FILES_PER_REQUEST = 10;      // Must match client
const MAX_FILE_SIZE_MB = 20;           // Adjust file size limit
const MAX_SAFE_INPUT_TOKENS = 
  ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS * 0.9; // Adjust safety margin
```

## Future Enhancements

1. **Dynamic Token Counting:**
   - Use actual Gemini token counting API for accuracy
   - Real-time token updates as user types

2. **Smart Context Trimming:**
   - Automatically truncate less important context
   - Prioritize recent messages over old history
   - Compress document summaries

3. **Token Usage Analytics:**
   - Track average token usage per user
   - Identify heavy users
   - Optimize prompts based on usage patterns

4. **Subscription Tiers:**
   - Free: 100K tokens/request
   - Scholar: 500K tokens/request
   - Genius: 1M tokens/request

5. **File Type Optimization:**
   - Better token estimation for PDFs, code files
   - Automatic compression for large text files
   - Image resolution optimization

## Summary

This implementation provides a robust, multi-layered approach to preventing token limit errors:
- ✅ **Client-side validation** for immediate user feedback
- ✅ **Backend validation** for security and accuracy
- ✅ **Clear error messages** for better UX
- ✅ **File count limits** (max 10 files)
- ✅ **File size limits** (max 20MB per file)
- ✅ **Token estimation** for all content types
- ✅ **Visual feedback** component (optional)
- ✅ **Logging** for monitoring and debugging

Users can now confidently use the AI chat with large contexts while staying within limits.
