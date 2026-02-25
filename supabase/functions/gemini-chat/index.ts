import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.92.0';
import { UserContextService } from './context-service.ts';
import { EnhancedPromptEngine } from './prompt-engine.ts';
import { StuddyHubActionsService } from './actions-service.ts';
import { AgenticCore, type UserIntent, type EntityMention } from './agentic-core.ts';
import { createStreamResponse, StreamingHandler } from './streaming-handler.ts';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';
import { executeParsedActions, runAction, AI_ACTION_SCHEMA, getFriendlyActionLabel } from './actions_helper.ts';
import { DB_SCHEMA_DEFINITION } from './db_schema.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Enhanced Processing Configuration - Optimized for QUALITY and ACCURACY
const ENHANCED_PROCESSING_CONFIG = {
  MAX_INPUT_TOKENS: 2 * 1024 * 1024,  // Full 2M context window
  MAX_OUTPUT_TOKENS: 8192,  // Optimal for quality responses
  MAX_CONVERSATION_HISTORY: 500,  // Full history for better understanding
  SUMMARY_THRESHOLD: 30,  // Generate summary after this many messages
  RETRY_ATTEMPTS: 3,  // More retries for reliability
  ACTION_FIX_ATTEMPTS: 3,
  ACTION_FIX_BACKOFF_MS: 1000
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const contextService = new UserContextService(supabaseUrl, supabaseServiceKey);
const promptEngine = new EnhancedPromptEngine();
const actionsService = new StuddyHubActionsService(supabaseUrl, supabaseServiceKey);

// Initialize Agentic Core for advanced understanding
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
if (!geminiApiKey) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}
const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY') || '';
const agenticCore = new AgenticCore(supabaseUrl, supabaseServiceKey, geminiApiKey);

// LIGHTWEIGHT token estimation - no heavy tokenizer library
function estimateTokenCount(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

async function calculateTokenCount(text: string): Promise<number> {
  return estimateTokenCount(text);
}

async function truncateToTokenLimit(text: string, maxTokens: number): Promise<string> {
  const estimatedTokens = estimateTokenCount(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars) + " [TRUNCATED]";
}

function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// Slim down action results for Gemini context injection.
// Keeps structure but truncates large data arrays and long string values
// so we don't blow up the context window with raw DB records.
const ACTION_RESULT_MAX_RECORDS = 20;  // Show at most 20 records in context
const ACTION_RESULT_MAX_STR = 300;     // Truncate individual strings

function truncateActionResults(actions: any[]): any[] {
  return actions.map((action: any) => {
    const slim: any = { type: action.type, success: action.success };
    if (action.error) slim.error = action.error;

    if (action.data) {
      // If data contains a result array, slim it
      const rawData = action.data.data || action.data;
      if (Array.isArray(rawData)) {
        const total = rawData.length;
        const sliced = rawData.slice(0, ACTION_RESULT_MAX_RECORDS).map((row: any) => {
          if (typeof row !== 'object' || row === null) return row;
          const slimRow: any = {};
          for (const [key, val] of Object.entries(row)) {
            if (typeof val === 'string' && val.length > ACTION_RESULT_MAX_STR) {
              slimRow[key] = val.substring(0, ACTION_RESULT_MAX_STR) + `... [${val.length} chars]`;
            } else {
              slimRow[key] = val;
            }
          }
          return slimRow;
        });
        slim.data = { records: sliced, count: total };
        // Forward pagination info if available
        if (action.data.total_count) slim.data.total_count = action.data.total_count;
        if (action.data.note) slim.data.note = action.data.note;
        if (total > ACTION_RESULT_MAX_RECORDS) {
          slim.data.truncated_note = `Showing ${ACTION_RESULT_MAX_RECORDS} of ${total} returned records in context.`;
        }
      } else {
        slim.data = rawData;
      }
    }
    return slim;
  });
}
// ========== ACTION EXECUTION FUNCTION ==========
async function executeAIActions(userId: string, sessionId: string, aiResponse: string): Promise<{
  executedActions: any[];
  modifiedResponse: string;
}> {
  const executedActions: any[] = [];
  let modifiedResponse = aiResponse;

  console.log(`[ActionExecution] Processing AI response for actions...`);

  // 1. Parse actions from the text
  const actionsRaw = actionsService.parseActionFromText(aiResponse);
  // Ensure array
  const actionList = Array.isArray(actionsRaw) ? actionsRaw : (actionsRaw ? [actionsRaw] : []);

  // 2. Execute parsed action if found
  if (actionList.length > 0) {
    console.log(`[ActionExecution] Found ${actionList.length} actions.`);

    // First pass: Cleanup text for ALL actions
    for (const action of actionList) {
      if (action.matchedString) {
        // Escape special regex chars
        const escaped = action.matchedString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Remove the matched action string and any trailing text on the same line
        modifiedResponse = modifiedResponse.replace(new RegExp(escaped, 'g'), '').trim();
      }
    }
    // Fallback cleanup
    modifiedResponse = modifiedResponse.replace(/ACTION:\s*[A-Z_]+(?:\|.*)?(?:\n+|$)/g, '').trim();

    // 3. Actually execute them using the standardized runAction helper
    for (const action of actionList) {
      try {
        console.log(`[ActionExecution] Executing action: ${action.action}`);
        const result = await runAction(actionsService, userId, sessionId, action.action, action.params);

        executedActions.push({
          type: action.action,
          success: result?.success || false,
          data: result,
          timestamp: new Date().toISOString()
        });

        console.log(`[ActionExecution] ${action.action}: ${result?.success ? 'SUCCESS' : 'FAILED'}`);
      } catch (err: any) {
        console.error(`[ActionExecution] Error executing ${action.action}:`, err);
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'action-execution',
          error_code: 'ACTION_EXEC_FAILED',
          message: `Action '${action.action}' failed: ${err.message}`,
          details: { action: action.action, params: action.params, error: String(err) },
        });
        executedActions.push({
          type: action.action,
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  return {
    executedActions,
    modifiedResponse
  };
}

// Sanitize assistant output before sending/saving to the user.
// Removes embedded action JSON/code blocks and stray ACTION: markers.
function sanitizeAssistantOutput(text: string | null | undefined): string {
  if (!text) return '';
  let out = text;

  // 1) Remove code blocks that contain action-related keywords
  // Match ```json, ```action, or generic ``` with action content
  out = out.replace(/```(?:json|action)?\s*[\s\S]*?(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL|"type"\s*:\s*"(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL)")[\s\S]*?```/gi, '');
  
  // 2) Remove single-line JSON objects with action types
  // Example: { "type": "DB_ACTION", "params": {...} }
  out = out.replace(/\{[^}]*"type"\s*:\s*"(?:DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL)"[^}]*\}/gi, '');
  
  // 3) Remove multi-line JSON objects with "actions" arrays
  // This catches the full action plan format: { "thought_process": "...", "actions": [...] }
  out = out.replace(/\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/gi, '');
  
  // 4) Remove explicit ACTION: lines (legacy format)
  out = out.replace(/^ACTION:\s*.*$/gim, '');
  
  // 5) Remove standalone "thought_process" entries
  out = out.replace(/"thought_process"\s*:\s*"[^"]*"/gi, '');
  
  // 6) Remove "params" objects that look like action parameters
  out = out.replace(/"params"\s*:\s*\{[\s\S]*?"table"\s*:[\s\S]*?\}/gi, '');

  // 7) Remove standalone braces, brackets that were left behind
  out = out.replace(/^[{}\[\],]\s*$/gm, '');
  
  // 8) Remove lines that start with common action-related JSON keys
  out = out.replace(/^\s*"(?:type|params|table|operation|data|filters)"\s*:.*$/gm, '');

  // 9) Clean up excessive whitespace left behind
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  
  // 10) Remove empty parentheses or brackets
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/\[\s*\]/g, '');

  return out;
}

// ========== HELPER FUNCTIONS ==========
async function updateSessionTokenCount(sessionId: string, userId: string, messageContent: string, operation = 'add'): Promise<{ success: boolean, tokenCount: number }> {
  try {
    const messageTokens = await calculateTokenCount(messageContent);
    console.log(`[updateSessionTokenCount] Message tokens: ${messageTokens}`);

    if (operation === 'add') {
      const { data: sessionData, error: fetchError } = await supabase
        .from('chat_sessions')
        .select('token_count')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[updateSessionTokenCount] Error fetching current token count:', fetchError);
        return {
          success: false,
          tokenCount: 0
        };
      }

      if (!sessionData) {
        console.log(`[updateSessionTokenCount] Session not found yet, creating session token_count: ${messageTokens}`);
        try {
          const { error: insertError } = await supabase
            .from('chat_sessions')
            .upsert({
              id: sessionId,
              user_id: userId,
              token_count: messageTokens,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('[updateSessionTokenCount] Error inserting initial token count:', insertError);
            return { success: false, tokenCount: messageTokens };
          }

          return { success: true, tokenCount: messageTokens };
        } catch (err) {
          console.error('[updateSessionTokenCount] Exception inserting session token_count:', err);
          return { success: false, tokenCount: messageTokens };
        }
      }

      const currentTokenCount = sessionData?.token_count || 0;
      const newTokenCount = currentTokenCount + messageTokens;

      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          token_count: newTokenCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[updateSessionTokenCount] Error updating token count:', updateError);
        return {
          success: false,
          tokenCount: currentTokenCount
        };
      }

      console.log(`[updateSessionTokenCount] Updated token count: ${currentTokenCount} -> ${newTokenCount}`);
      return {
        success: true,
        tokenCount: newTokenCount
      };
    } else {
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          token_count: messageTokens,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[updateSessionTokenCount] Error setting token count:', updateError);
        return {
          success: false,
          tokenCount: 0
        };
      }

      console.log(`[updateSessionTokenCount] Set token count to: ${messageTokens}`);
      return {
        success: true,
        tokenCount: messageTokens
      };
    }
  } catch (error) {
    console.error('[updateSessionTokenCount] Exception:', error);
    return {
      success: false,
      tokenCount: 0
    };
  }
}

async function getSessionTokenCount(sessionId: string, userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('token_count')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[getSessionTokenCount] Error fetching token count:', error);
      return 0;
    }

    if (!data) {
      console.log(`[getSessionTokenCount] Session ${sessionId} not found yet`);
      return 0;
    }

    const tokenCount = data?.token_count || 0;
    console.log(`[getSessionTokenCount] Session ${sessionId} token count: ${tokenCount}`);
    return tokenCount;
  } catch (error) {
    console.error('[getSessionTokenCount] Exception:', error);
    return 0;
  }
}

async function updateConversationSummary(sessionId: string, userId: string, recentMessages: any[]): Promise<string | null> {
  if (recentMessages.length < ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) return null;

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) return null;

    const conversationText = recentMessages.map((msg: any) =>
      `${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
    ).join('\n');

    const summaryPrompt = `Summarize this conversation in 2-3 sentences, focusing on main topics and user interests: ${conversationText}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: summaryPrompt
          }
        ]
      }
    ];

    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);

    if (response.success && response.content) {
      const summary = response.content.trim();
      await supabase
        .from('chat_sessions')
        .update({
          context_summary: summary,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      console.log(`[updateConversationSummary] Updated summary for session ${sessionId}`);
      return summary;
    }
  } catch (error) {
    console.error('Error updating conversation summary:', error);
  }

  return null;
}

async function buildIntelligentContext(
  userId: string,
  sessionId: string,
  currentMessage: string,
  attachedDocumentIds: string[] = [],
  attachedNoteIds: string[] = [],
  initialContextWindow: number = 100
): Promise<{
  recentMessages: any[];
  relevantOlderMessages: any[];
  conversationSummary: string | null;
  totalMessages: number;
  summarizedMessages: number;
  storedTokenCount: number;
}> {
  const logPrefix = `[buildIntelligentContext][Session:${sessionId}]`;
  const storedTokenCount = await getSessionTokenCount(sessionId, userId);
  console.log(`${logPrefix} Retrieved stored token count: ${storedTokenCount}`);

  const conversationHistory = await getConversationHistory(userId, sessionId);

  let conversationSummary = null;
  try {
    const { data: sessionData } = await supabase
      .from('chat_sessions')
      .select('context_summary, title, last_message_at')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionData?.context_summary) {
      conversationSummary = `Session "${sessionData.title}" (last active: ${new Date(sessionData.last_message_at).toLocaleDateString()}): ${sessionData.context_summary}`;
      console.log(`${logPrefix} Using enhanced summary with session info`);
    }
  } catch (error) {
    console.error(`${logPrefix} Error fetching summary:`, error);
  }
  const MAX_HISTORY_TOKENS = ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS - 8192; // Leave 8192 buffer for system prompt/files
  let currentTokens = 0;

  // Always include the summary if available
  if (conversationSummary) {
    currentTokens += estimateTokenCount(conversationSummary);
  }

  const selectedMessages: any[] = [];

  // Iterate backwards through history to fill context window
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    const msgTokens = estimateTokenCount(msg.content) + 20; // +20 for role/metadata overhead

    if (currentTokens + msgTokens > MAX_HISTORY_TOKENS) {
      console.log(`${logPrefix} Reached token limit at message ${i} (${currentTokens} tokens)`);
      break;
    }

    currentTokens += msgTokens;
    selectedMessages.unshift(msg);
  }

  console.log(`${logPrefix} dynamic context: ${selectedMessages.length} messages selected (${currentTokens} estimated tokens)`);

  return {
    recentMessages: selectedMessages,
    relevantOlderMessages: [], // No need for RAG on chat history if we include it all
    conversationSummary,
    totalMessages: conversationHistory.length,
    summarizedMessages: conversationHistory.length - selectedMessages.length,
    storedTokenCount
  };
}

async function getConversationHistory(userId: string, sessionId: string, maxMessages = ENHANCED_PROCESSING_CONFIG.MAX_CONVERSATION_HISTORY): Promise<any[]> {
  try {
    console.log(`Retrieving conversation history for session ${sessionId}`);

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, content, role, timestamp')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('is_error', false)
      .order('timestamp', {
        ascending: true
      })
      .limit(maxMessages);

    if (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      console.log('No conversation history found');
      return [];
    }

    console.log(`Retrieved ${messages.length} messages`);
    return messages;
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}

async function buildAttachedContext(documentIds: string[], noteIds: string[], userId: string): Promise<string> {
  let context = '';
  const MAX_CONTENT_LENGTH = 300000;  // Truncate long content for speed

  if (documentIds.length > 0) {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, title, file_name, file_type, content_extracted, type, processing_status')
      .eq('user_id', userId)
      .in('id', documentIds);

    if (error) {
      console.error('Error fetching documents:', error);
    } else if (documents) {
      context += 'DOCUMENTS:\n';
      for (const doc of documents) {
        context += `Title: ${doc.title}\n`;
        context += `File: ${doc.file_name}\n`;
        context += `Type: ${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}\n`;

        if (doc.content_extracted) {
          // Truncate long content
          const truncatedContent = doc.content_extracted.length > MAX_CONTENT_LENGTH
            ? doc.content_extracted.substring(0, MAX_CONTENT_LENGTH) + '... [Content truncated for performance]'
            : doc.content_extracted;
          context += `Content: ${truncatedContent}\n`;
        } else {
          if (doc.type === 'image' && doc.processing_status !== 'completed') {
            context += `Content: Image processing ${doc.processing_status || 'pending'}. No extracted text yet.\n`;
          } else if (doc.type === 'image' && doc.processing_status === 'completed' && !doc.content_extracted) {
            context += `Content: Image analysis completed, but no text or detailed description was extracted.\n`;
          } else {
            context += `Content: No content extracted or available.\n`;
          }
        }
        context += '\n';
      }
    }
  }

  if (noteIds.length > 0) {
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, title, category, content, ai_summary, tags')
      .eq('user_id', userId)
      .in('id', noteIds);

    if (error) {
      console.error('Error fetching notes:', error);
    } else if (notes) {
      context += 'NOTES:\n';
      for (const note of notes) {
        context += `Title: ${note.title}\n`;
        context += `Category: ${note.category}\n`;

        if (note.content) {
          // Truncate long note content
          const truncatedContent = note.content.length > MAX_CONTENT_LENGTH
            ? note.content.substring(0, MAX_CONTENT_LENGTH) + '... [Content truncated for performance]'
            : note.content;
          context += `Content: ${truncatedContent}\n`;
        }

        if (note.ai_summary) {
          context += `AI Summary: ${note.ai_summary}\n`;
        }

        if (note.tags && note.tags.length > 0) {
          context += `Tags: ${note.tags.join(', ')}\n`;
        }
        context += '\n';
      }
    }
  }

  return context;
}

async function saveChatMessage({
  userId,
  sessionId,
  content,
  role,
  attachedDocumentIds = null,
  attachedNoteIds = null,
  isError = false,
  imageUrl = null,
  imageMimeType = null,
  conversationContext = null,
  filesMetadata = null
}: {
  userId: string;
  sessionId: string;
  content: string;
  role: string;
  attachedDocumentIds?: string[] | null;
  attachedNoteIds?: string[] | null;
  isError?: boolean;
  imageUrl?: string | null;
  imageMimeType?: string | null;
  conversationContext?: any;
  filesMetadata?: any[] | null;
}): Promise<{ id: string, timestamp: string } | null> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        session_id: sessionId,
        content,
        role,
        attached_document_ids: attachedDocumentIds,
        attached_note_ids: attachedNoteIds,
        is_error: isError,
        image_url: imageUrl,
        image_mime_type: imageMimeType,
        conversation_context: conversationContext,
        timestamp: new Date().toISOString(),
        files_metadata: filesMetadata,
        has_been_displayed: role === 'user'
      })
      .select('id, timestamp')
      .single();

    if (error) {
      console.error('Error saving chat message:', error);
      return null;
    }

    return {
      id: data.id,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Database error when saving chat message:', error);
    logSystemError(supabase, {
      severity: 'warning',
      source: 'gemini-chat',
      component: 'save-message',
      error_code: 'MESSAGE_SAVE_FAILED',
      message: `Failed to save chat message: ${String(error)}`,
      details: { error: String(error), role: params?.role, sessionId: params?.sessionId },
      user_id: params?.userId,
    });
    return null;
  }
}

const generateChatTitle = async (sessionId: string, userId: string, initialMessage: string, messageCount: number = 1): Promise<string> => {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) return 'New Chat';

  try {
    // Get recent conversation context for better title generation
    let contextMessages = '';
    if (messageCount > 1) {
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('content, role')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(6);

      if (recentMessages && recentMessages.length > 0) {
        contextMessages = recentMessages
          .reverse()
          .map(m => `${m.role}: ${m.content.substring(0, 100)}`)
          .join('\n');
      }
    }

    const contentToAnalyze = contextMessages || initialMessage.substring(0, 300);
    const titlePrompt = `Analyze this conversation and create a concise, descriptive title (4-6 words max):\n\n${contentToAnalyze}\n\nTitle should capture the main topic/purpose. Return ONLY the title, no quotes or explanation.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: titlePrompt }]
      }
    ];

    const response = await callEnhancedGeminiAPI(contents, geminiApiKey);
    if (response.success && response.content) {
      let generatedTitle = response.content.trim();
      // Remove quotes and clean up
      generatedTitle = generatedTitle.replace(/^["'`]|["'`]$/g, '');
      generatedTitle = generatedTitle.replace(/^(Title:|Chat:|Session:)\s*/i, '');
      generatedTitle = generatedTitle.charAt(0).toUpperCase() + generatedTitle.slice(1);

      if (generatedTitle.length > 50) {
        generatedTitle = generatedTitle.substring(0, 47) + '...';
      }

      console.log(`📝 Generated title: "${generatedTitle}" (message count: ${messageCount})`);
      return generatedTitle;
    } else {
      const words = initialMessage.split(' ');
      return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
    }
  } catch (error) {
    console.error('Error generating chat title:', error);
    const words = initialMessage.split(' ');
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }
};

// Update session title based on conversation growth
const maybeUpdateSessionTitle = async (sessionId: string, userId: string, messageCount: number, latestMessage: string): Promise<void> => {
  try {
    // Update title on message 1, 4, and 8 to refine based on conversation context
    const shouldUpdateTitle = messageCount === 1 || messageCount === 4 || messageCount === 8;

    if (!shouldUpdateTitle) return;

    console.log(`🔄 Updating session title (message ${messageCount})...`);

    const newTitle = await generateChatTitle(sessionId, userId, latestMessage, messageCount);

    const { error } = await supabase
      .from('chat_sessions')
      .update({ title: newTitle })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error updating session title:', error);
    } else {
      console.log(`✅ Session title updated: "${newTitle}"`);
    }
  } catch (error) {
    console.error('❌ Error in maybeUpdateSessionTitle:', error);
  }
};

async function ensureChatSession(userId: string, sessionId: string, newDocumentIds: string[] = [], initialMessage = ''): Promise<void> {
  try {
    const { data: existingSession, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('id, document_ids, message_count, context_summary, title')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching chat session:', fetchError);
      return;
    }

    if (existingSession) {
      const newMessageCount = (existingSession.message_count || 0) + 1;
      const updates: any = {
        document_ids: newDocumentIds,
        message_count: newMessageCount
      };

      if (newDocumentIds.length > 0) {
        const currentDocIds = existingSession.document_ids || [];
        const updatedDocIds = [
          ...new Set([
            ...currentDocIds,
            ...newDocumentIds
          ])
        ];
        updates.document_ids = updatedDocIds;
      }

      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating chat session:', updateError);
      }

      // Update title if needed based on message count
      if (initialMessage) {
        maybeUpdateSessionTitle(sessionId, userId, newMessageCount, initialMessage).catch(err =>
          console.error('Error updating title:', err)
        );
      }
    } else {
      const newTitle = initialMessage ? await generateChatTitle(sessionId, userId, initialMessage, 1) : 'New Chat';

      const { error: insertError } = await supabase
        .from('chat_sessions')
        .insert({
          id: sessionId,
          user_id: userId,
          title: newTitle,
          document_ids: newDocumentIds,
          message_count: 1,
          token_count: 0,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating chat session:', insertError);
      } else {
        console.log(`✅ New session created with title: "${newTitle}"`);
      }
    }
  } catch (error) {
    console.error('Database error when ensuring chat session:', error);
    logSystemError(supabase, {
      severity: 'warning',
      source: 'gemini-chat',
      component: 'ensure-session',
      error_code: 'SESSION_ENSURE_FAILED',
      message: `Failed to ensure chat session: ${String(error)}`,
      details: { error: String(error), sessionId },
      user_id: userId,
    });
  }
}

async function updateSessionLastMessage(sessionId: string, contextSummary: string | null = null, title: string | null = null): Promise<void> {
  try {
    const update: any = {
      last_message_at: new Date().toISOString(),
      ...(contextSummary && {
        context_summary: contextSummary
      }),
      ...(title && {
        title: title
      })
    };

    const { error } = await supabase
      .from('chat_sessions')
      .update(update)
      .eq('id', sessionId);

    if (error) console.error('Error updating session last message time:', error);
  } catch (error) {
    console.error('Database error when updating session:', error);
  }
}

function classifyUserQuery(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'general-knowledge';
  }

  const messageLower = message.toLowerCase().trim();
  const appKeywords = [
    'studdyhub',
    'dashboard',
    'notes',
    'recordings',
    'schedule',
    'upload',
    'create note',
    'save document',
    'document',
    'file upload',
    'settings',
    'profile',
    'preferences',
    'learning style',
    'how do i',
    'how to use',
    'can you help me with the app',
    'create new',
    'delete',
    'edit',
    'organize',
    'category',
    'ai chat',
    'social feed',
    'authentication',
    'supabase',
    'react component',
    'tailwind',
    'framer motion'
  ];

  const studyHelpKeywords = [
    'help me understand',
    'explain how to',
    'study tips',
    'learn about',
    'homework help',
    'assignment',
    'practice problems',
    'quiz me',
    'test preparation',
    'review',
    'summarize',
    'breakdown',
    'solve this',
    'work through',
    'step by step',
    'tutorial',
    'concept explanation',
    'example of',
    'demonstrate'
  ];

  const appPatterns = [
    /how (do|can) i (create|make|add|upload|delete|edit)/,
    /where (is|can i find) the/,
    /how to (use|access|navigate)/,
    /(create|make|add) (a |an |new )?note/,
    /upload (a |an )?file/,
    /(schedule|calendar|timetable)/
  ];

  const studyPatterns = [
    /help me (with|understand|learn)/,
    /explain (this|how|what|why)/,
    /(solve|work through|show me)/,
    /what (is|are|does|means?)/,
    /how (does|do|is|are)/
  ];

  if (appKeywords.some((keyword) => messageLower.includes(keyword)) ||
    appPatterns.some((pattern) => pattern.test(messageLower))) {
    return 'app-specific';
  }

  if (studyHelpKeywords.some((keyword) => messageLower.includes(keyword)) ||
    studyPatterns.some((pattern) => pattern.test(messageLower))) {
    return 'study-help';
  }

  return 'general-knowledge';
}

function buildUserMemoryContext(userContext: any): string | null {
  const sections: string[] = [];

  const interests = userContext.userMemory?.filter((fact: any) =>
    fact.fact_type === 'interest' && fact.confidence_score > 0.7
  );

  if (interests?.length > 0) {
    const interestList = interests.map((interest: any) => interest.fact_value).join(', ');
    sections.push(`KNOWN INTERESTS: ${interestList}`);
  }

  const learningPrefs = userContext.userMemory?.filter((fact: any) =>
    fact.fact_type === 'learning_style' || fact.fact_type === 'preference'
  );

  if (learningPrefs?.length > 0) {
    const prefs = learningPrefs.map((pref: any) => `${pref.fact_key}: ${pref.fact_value}`).join(', ');
    sections.push(`LEARNING PREFERENCES: ${prefs}`);
  }

  const challenges = userContext.userMemory?.filter((fact: any) =>
    fact.fact_type === 'skill_level' && fact.fact_key === 'challenging_areas'
  );

  if (challenges?.length > 0) {
    const challengeList = challenges.map((challenge: any) => challenge.fact_value).join(', ');
    sections.push(`AREAS FOR IMPROVEMENT: ${challengeList}`);
  }

  return sections.length > 0 ? sections.join('\n') : null;
}

function buildActionableContextText(actionableContext: any): string {
  const sections: string[] = [];

  if (actionableContext.notes?.length > 0) {
    sections.push(`📝 Available Notes: ${actionableContext.notes.map((n: any) => n.title).join(', ')}`);
  }

  if (actionableContext.documents?.length > 0) {
    sections.push(`📄 Available Documents: ${actionableContext.documents.map((d: any) => d.title).join(', ')}`);
  }

  if (actionableContext.folders?.length > 0) {
    sections.push(`📁 Available Folders: ${actionableContext.folders.map((f: any) => f.name).join(', ')}`);
  }

  if (actionableContext.goals?.length > 0) {
    sections.push(`🎯 Active Goals: ${actionableContext.goals.map((g: any) => g.goal_text).join(', ')}`);
  }

  return sections.join('\n');
}

async function buildEnhancedGeminiConversation(
  userId: string,
  sessionId: string,
  currentMessage: string,
  files: any[],
  attachedContext: string,
  systemPrompt: string
): Promise<{
  contents: any[];
  systemInstruction: any;
  contextInfo: any;
  queryType: string;
}> {
  const logPrefix = `[buildEnhancedGeminiConversation][Session:${sessionId}]`;
  console.log(`${logPrefix} Starting enhanced conversation build`);

  try {
    // Get comprehensive user context
    const userContext = await contextService.getUserContext(userId);
    const crossSessionContext = await contextService.getCrossSessionContext(userId, sessionId, currentMessage);
    const actionableContext = await contextService.getActionableContext(userId);
    const actionableContextText = buildActionableContextText(actionableContext);



    // Build a full user context summary for the system prompt
    const uc = userContext;
    const studyHabits = uc.studyHabits;
    const learningPatterns = uc.learningPatterns;
    const topicMastery = uc.topicMastery;
    const totalCounts = uc.totalCounts;
    const userContextSummary = `\n\nUSER CONTEXT SUMMARY:\n- Notes: ${uc.allNotes?.length ?? 0}\n- Documents: ${uc.allDocuments?.length ?? 0}\n- Recent Quizzes: ${uc.recentQuizzes?.length ?? 0}\n- Learning Schedule: ${uc.learningSchedule?.length ?? 0}\n- Learning Goals: ${uc.learningGoals?.length ?? 0}\n- User Memory: ${uc.userMemory?.length ?? 0}\n- Achievements: ${uc.achievements?.length ?? 0}\n- Flashcards: ${uc.flashcards?.length ?? 0}\n- Social Profile: ${uc.socialProfile ? 'Yes' : 'No'}\n- Recent Recordings: ${uc.recentRecordings?.length ?? 0}\n- Document Folders: ${uc.documentFolders?.length ?? 0}\n- Note Title Index: ${uc.noteTitleIndex?.size ?? 0}\n- Document Title Index: ${uc.documentTitleIndex?.size ?? 0}\n- Total Counts: ${JSON.stringify(totalCounts)}\n\nLEARNING PATTERNS:\n- Strong Subjects: ${Array.from(learningPatterns?.strongSubjects?.keys() ?? []).join(', ') || 'None'}\n- Weak Subjects: ${Array.from(learningPatterns?.weakSubjects?.keys() ?? []).join(', ') || 'None'}\n- Study Times: ${Array.from(learningPatterns?.studyTimes?.entries() ?? []).map(([k,v])=>`${k}: ${v}`).join(', ') || 'None'}\n- Preferred Note Categories: ${Array.from(learningPatterns?.preferredNoteCategories?.keys() ?? []).join(', ') || 'None'}\n- Frequent Topics: ${Array.from(learningPatterns?.frequentTopics?.keys() ?? []).join(', ') || 'None'}\n- Study Consistency: ${learningPatterns?.studyConsistency ?? 'N/A'}\n- Average Study Duration: ${learningPatterns?.averageStudyDuration ?? 'N/A'} min\n- Preferred Quiz Types: ${Array.from(learningPatterns?.preferredQuizTypes?.keys() ?? []).join(', ') || 'None'}\n- Top Tags: ${Array.from(learningPatterns?.topTags?.keys() ?? []).join(', ') || 'None'}\n- Recent Topics: ${learningPatterns?.recentTopics?.map(t=>t.content).join(', ') || 'None'}\n\nSTUDY HABITS:\n- Most Active Day: ${studyHabits?.mostActiveDay ?? 'N/A'}\n- Most Active Hour: ${studyHabits?.mostActiveHour ?? 'N/A'}\n- Average Sessions/Week: ${studyHabits?.averageSessionsPerWeek ?? 'N/A'}\n- Average Quizzes/Week: ${studyHabits?.averageQuizzesPerWeek ?? 'N/A'}\n- Average Notes/Week: ${studyHabits?.averageNotesPerWeek ?? 'N/A'}\n\nTOPIC MASTERY:\n${topicMastery && typeof topicMastery.forEach === 'function' && topicMastery.size > 0 ? Array.from(topicMastery.entries()).map(([topic, data]) => `- ${topic}: ${JSON.stringify(data)}`).join('\n') : 'No topic mastery data.'}`;

    const userProfile = userContext.profile;
    let userName = 'User';
    if (userProfile) {
      userName = userProfile.full_name || 'User';
    }

    const queryType = classifyUserQuery(currentMessage);

    // Get conversation history
    let conversationData = await buildIntelligentContext(userId, sessionId, currentMessage, [], []);
    let geminiContents: any[] = [];
    let systemInstruction = null;

    if (systemPrompt) {
      const queryGuidance: Record<string, string> = {
        'general-knowledge': 'Provide accurate information. Only mention StuddyHub if directly relevant.',
        'study-help': 'Provide educational support tailored to user\'s learning patterns and history.',
        'app-specific': 'Focus on StuddyHub features and usage instructions based on user activity.'
      };

      let crossSessionText = '';
      if (crossSessionContext) {
        crossSessionText = crossSessionContext.map((session: any) => {
          let sessionInfo = `Previous session "${session.sessionTitle}" (${new Date(session.lastActive).toLocaleDateString()}): `;
          if (session.summary) {
            sessionInfo += session.summary;
          } else if (session.recentTopics?.length) {
            sessionInfo += `Discussed: ${session.recentTopics.map((t: any) => t.content).join('; ')}`;
          }
          return sessionInfo;
        }).join('\n');
      }


      const enhancedSystemPrompt = `${systemPrompt}

    **ACTIONABLE CONTEXT:**
    ${actionableContextText}

    ${userContextSummary}

    **USE THIS CONTEXT TO:**
    1. Reference specific notes/documents by their exact titles when creating related content
    2. Link items that already exist in the user's database
    3. Update existing goals, notes, or schedule items
    4. Avoid creating duplicate content

    **MEMORY & RECALL INSTRUCTIONS:**
    - When you recall previous conversations, mention specific topics and details
    - Use phrases like "I remember we discussed..." or "Based on our previous conversation about..."
    - Connect current questions to past learning topics explicitly
    - Reference specific interests the user has shown before
    - If you have summary information, use it to show continuity
    - NEVER say "I don't have specific details memorized" - instead use the context provided`;

      // Add current date and time context
      const currentDateTime = new Date();
      const dateTimeString = currentDateTime.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      systemInstruction = {
        parts: [
          {
            text: `${enhancedSystemPrompt}\n\nCURRENT DATE AND TIME: ${dateTimeString}\n\nQuery type: ${queryType}\n${queryGuidance[queryType]}\n\nCross-session context:\n${crossSessionText}\n\nYou are the AI Assistant for ${userName} on StuddyHub. Use the memory and context provided to give personalized, continuous responses.`
          }
        ]
      };
    }

    if (conversationData.conversationSummary) {
      geminiContents.push({
        role: 'user',
        parts: [
          {
            text: `CONTEXT RECALL (from this ongoing conversation): ${conversationData.conversationSummary}\n` +
              `Use this to stay consistent with what we have already discussed. ` +
              `Do not repeat or acknowledge this context block verbatim in your reply unless the user explicitly asks about it.` +
              `\nIMPORTANT: Never start your reply by acknowledging or repeating any "RECALL THIS CONVERSATION CONTEXT" or "CONTEXT RECALL" blocks. Jump straight into answering the user's current request.`
          }
        ]
      });
    }

    let recentMessages = conversationData.recentMessages;
    // We rely on buildIntelligentContext to provide the correct number of messages (token-based)
    // No further truncation needed.


    if (recentMessages && recentMessages.length > 0) {
      for (const msg of recentMessages) {
        if (msg.role === 'user') {
          geminiContents.push({
            role: 'user',
            parts: [
              {
                text: msg.content || ''
              }
            ]
          });
        } else if (msg.role === 'assistant' || msg.role === 'model') {
          geminiContents.push({
            role: 'model',
            parts: [
              {
                text: msg.content || ''
              }
            ]
          });
        }
      }
    }

    if (currentMessage || files.length > 0 || attachedContext) {
      const currentMessageParts: any[] = [];

      if (currentMessage) {
        currentMessageParts.push({
          text: currentMessage
        });
      }

      if (attachedContext) {
        currentMessageParts.push({
          text: `\n\nAttached Context:\n${attachedContext}`
        });
      }

      const userMemoryContext = buildUserMemoryContext(userContext);
      if (userMemoryContext) {
        currentMessageParts.push({
          text: `\n\nUSER MEMORY & INTERESTS:\n${userMemoryContext}`
        });
      }

      if (files.length > 0) {
        for (const file of files) {
          if (file.type === 'image' && file.data) {
            currentMessageParts.push({
              inlineData: {
                mimeType: file.mimeType,
                data: file.data
              }
            });
          } else if (file.content) {
            currentMessageParts.push({
              text: `\n\n[File: ${file.name}]\n${file.content}`
            });
          }
        }
      }

      if (currentMessageParts.length > 0) {
        geminiContents.push({
          role: 'user',
          parts: currentMessageParts
        });
      }
    }

    console.log(`${logPrefix} Built enhanced conversation with ${geminiContents.length} parts`);

    return {
      contents: geminiContents,
      systemInstruction: systemInstruction,
      contextInfo: {
        ...conversationData,
        userContext,
        crossSessionContext
      },
      queryType: queryType
    };
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    throw error;
  }
}

async function callEnhancedGeminiAPI(contents: any[], geminiApiKey: string, configOverrides: any = {}, tierModelChain?: string[]): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  userMessage?: string;
  modelUsed?: string;
}> {
  // 1. Define the Fallback Chain (Priority Order) — use tier-based chain if provided
  const MODEL_CHAIN = tierModelChain || [
    'gemini-2.5-flash',
    'gemini-3-pro-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro',
  ];

  // Extract systemInstruction from configOverrides
  const { systemInstruction, ...generationConfig } = configOverrides;

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 40,
      topP: 0.95,
      ...generationConfig
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  // 2. Retry Loop with Model Switching
  for (let attempt = 0; attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS; attempt++) {
    const currentModel = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
    console.log(`[GeminiAPI] Attempt ${attempt + 1}/${ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS} using model: ${currentModel}`);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const extractedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (extractedContent) {
          return { success: true, content: extractedContent, modelUsed: currentModel };
        } else {
          console.warn(`[GeminiAPI] Model ${currentModel} returned no content.`);
        }
      } else {
        const errorText = await response.text();
        const status = response.status;
        console.error(`[GeminiAPI] Error ${status} with ${currentModel}: ${errorText.substring(0, 200)}...`);
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'gemini-api',
          error_code: `GEMINI_HTTP_${status}`,
          message: `Gemini ${currentModel} returned HTTP ${status}`,
          details: { model: currentModel, status, errorSnippet: errorText.substring(0, 500), attempt },
        });

        if (status === 429 || status === 503) {
          console.warn(`[GeminiAPI] Quota/Load limit hit for ${currentModel}. Switching to next model...`);
          if (attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS - 1) {
            await sleep(1000);
            continue;
          }
        }

        if (status === 400) {
          return { success: false, error: `BAD_REQUEST: ${errorText}`, userMessage: "I couldn't process that request format." };
        }
      }
    } catch (error) {
      console.error(`[GeminiAPI] Network error with ${currentModel}:`, error);
      logSystemError(supabase, {
        severity: 'error',
        source: 'gemini-chat',
        component: 'gemini-api',
        error_code: 'GEMINI_NETWORK_ERROR',
        message: `Gemini ${currentModel} network error: ${String(error)}`,
        details: { model: currentModel, attempt, error: String(error) },
      });
      if (attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS - 1) {
        await sleep(1000);
      }
    }
  }

  // ── OpenRouter Fallback ──
  if (openRouterApiKey) {
    console.log('[OpenRouter] All Gemini models failed. Falling back to OpenRouter...');
    try {
      const openRouterMessages = convertGeminiToOpenRouterMessages(contents, systemInstruction);
      const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: openRouterMessages,
          max_tokens: Math.min(generationConfig.maxOutputTokens || 4096, 4096),
          temperature: generationConfig.temperature ?? 0.7,
          top_p: generationConfig.topP ?? 0.95,
          transforms: ['middle-out'], // Auto-compress if still over limit
        }),
      });

      if (orResponse.ok) {
        const orData = await orResponse.json();
        const orContent = orData.choices?.[0]?.message?.content;
        if (orContent) {
          console.log('[OpenRouter] Fallback succeeded, chars:', orContent.length);
          return { success: true, content: orContent };
        }
        console.warn('[OpenRouter] Response had no content');
      } else {
        const errText = await orResponse.text();
        console.error('[OpenRouter] Error', orResponse.status, errText.substring(0, 300));
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'openrouter-api',
          error_code: `OPENROUTER_HTTP_${orResponse.status}`,
          message: `OpenRouter fallback returned HTTP ${orResponse.status}`,
          details: { status: orResponse.status, errorSnippet: errText.substring(0, 500) },
        });
      }
    } catch (orErr) {
      console.error('[OpenRouter] Network error:', orErr);
      logSystemError(supabase, {
        severity: 'error',
        source: 'gemini-chat',
        component: 'openrouter-api',
        error_code: 'OPENROUTER_NETWORK_ERROR',
        message: `OpenRouter fallback network error: ${String(orErr)}`,
        details: { error: String(orErr) },
      });
    }
  }

  return {
    success: false,
    error: 'ALL_MODELS_FAILED',
    userMessage: 'I am currently experiencing heavy load across all AI services. Please try again in a minute.'
  };
}

// ── Helpers to convert Gemini format ↔ OpenRouter (OpenAI-compatible) format ──
// OpenRouter free tier has a 262k token context limit. We aggressively truncate
// to stay well within that budget (~200k tokens ≈ 800k chars to leave headroom).
const OPENROUTER_MAX_CHARS = 800_000; // ~200k tokens at 4 chars/token
const OPENROUTER_MAX_MSG_CHARS = 30_000; // Truncate individual messages beyond this

function convertGeminiToOpenRouterMessages(contents: any[], systemInstruction?: any): Array<{role: string; content: string}> {
  const messages: Array<{role: string; content: string}> = [];

  // Add system instruction as a system message (truncated if huge)
  if (systemInstruction) {
    let sysText = '';
    if (typeof systemInstruction === 'string') {
      sysText = systemInstruction;
    } else if (systemInstruction.parts) {
      sysText = systemInstruction.parts.map((p: any) => p.text || '').join('\n');
    }
    if (sysText) {
      // Keep system prompt but cap it
      if (sysText.length > OPENROUTER_MAX_MSG_CHARS * 2) {
        sysText = sysText.substring(0, OPENROUTER_MAX_MSG_CHARS * 2) + '\n... [system prompt truncated for context limit]';
      }
      messages.push({ role: 'system', content: sysText });
    }
  }

  // Convert each Gemini content entry, truncating individual messages
  const allConverted: Array<{role: string; content: string}> = [];
  for (const entry of contents) {
    const role = entry.role === 'model' ? 'assistant' : (entry.role || 'user');
    const textParts = (entry.parts || []).map((p: any) => p.text || '').filter(Boolean);
    if (textParts.length > 0) {
      let content = textParts.join('\n');
      if (content.length > OPENROUTER_MAX_MSG_CHARS) {
        content = content.substring(0, OPENROUTER_MAX_MSG_CHARS) + '\n... [truncated]';
      }
      allConverted.push({ role, content });
    }
  }

  // Budget check: keep system message chars, then fit conversation from the END
  // (most recent messages are most important for the response)
  const systemChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  let remainingBudget = OPENROUTER_MAX_CHARS - systemChars;

  // Always keep the last message (the current user request)
  const selectedFromEnd: Array<{role: string; content: string}> = [];
  for (let i = allConverted.length - 1; i >= 0; i--) {
    const msgLen = allConverted[i].content.length;
    if (remainingBudget - msgLen < 0 && selectedFromEnd.length > 0) {
      // No more budget — stop adding older messages
      break;
    }
    remainingBudget -= msgLen;
    selectedFromEnd.unshift(allConverted[i]);
  }

  const dropped = allConverted.length - selectedFromEnd.length;
  if (dropped > 0) {
    console.log(`[OpenRouter] Truncated conversation: dropped ${dropped} older messages to fit context window`);
    // Add a note so the model knows context was trimmed
    messages.push({ role: 'system', content: `[Note: ${dropped} earlier conversation messages were omitted to fit the context window. Focus on the recent messages below.]` });
  }

  messages.push(...selectedFromEnd);
  console.log(`[OpenRouter] Final message count: ${messages.length}, estimated chars: ${messages.reduce((s, m) => s + m.content.length, 0)}`);
  return messages;
}

// Streaming variant: forward incremental chunks to `onChunk` callback while
// accumulating the full text. Falls back to non-streaming behaviour if the
// API does not stream.
async function callEnhancedGeminiAPIStream(contents: any[], geminiApiKey: string, onChunk: (chunk: string) => Promise<void>, configOverrides: any = {}, tierModelChain?: string[]): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  modelUsed?: string;
}> {
  const MODEL_CHAIN = tierModelChain || [
    'gemini-2.5-flash',
    'gemini-3-pro-preview',
    'gemini-2.0-flash'
  ];

  const { systemInstruction, ...generationConfig } = configOverrides;

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      ...generationConfig
    }
  };

  if (systemInstruction) requestBody.systemInstruction = systemInstruction;

  // Try each model in chain until success
  for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
    const currentModel = MODEL_CHAIN[attempt];
    console.log(`[GeminiAPI-Stream] Using model: ${currentModel}`);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error('[GeminiAPI-Stream] HTTP error:', resp.status, txt.substring(0, 300));
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'gemini-stream',
          error_code: `GEMINI_STREAM_HTTP_${resp.status}`,
          message: `Gemini streaming ${currentModel} HTTP ${resp.status}`,
          details: { model: currentModel, status: resp.status, errorSnippet: txt.substring(0, 500) },
        });
        continue;
      }

      // If response body is a stream, read incremental chunks and forward
      const reader = resp.body?.getReader();
      if (!reader) {
        // Fallback: parse full JSON
        const data = await resp.json();
        const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) {
          await onChunk(extracted);
          return { success: true, content: extracted, modelUsed: currentModel };
        }
        continue;
      }

      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: rdone } = await reader.read();
        done = rdone;
        if (value) {
          const chunkText = decoder.decode(value, { stream: !done });
          // Forward chunk to caller (UI)
          try { await onChunk(chunkText); } catch (e) { console.warn('[GeminiAPI-Stream] onChunk handler failed', e); }
          accumulated += chunkText;
        }
      }

      // Attempt to extract meaningful text from accumulated response
      try {
        const parsed = JSON.parse(accumulated);
        const extracted = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (extracted) return { success: true, content: extracted, modelUsed: currentModel };
      } catch (e) {
        // Not JSON — return raw accumulated stream
        return { success: true, content: accumulated, modelUsed: currentModel };
      }
    } catch (err) {
      console.error('[GeminiAPI-Stream] Network/stream error:', err);
      logSystemError(supabase, {
        severity: 'error',
        source: 'gemini-chat',
        component: 'gemini-stream',
        error_code: 'GEMINI_STREAM_NETWORK_ERROR',
        message: `Gemini streaming network error: ${String(err)}`,
        details: { model: currentModel, error: String(err) },
      });
      continue;
    }
  }

  // ── OpenRouter Streaming Fallback ──
  if (openRouterApiKey) {
    console.log('[OpenRouter-Stream] All Gemini models failed. Falling back to OpenRouter...');
    const { systemInstruction: sysInstr, ...genConfig } = configOverrides;
    try {
      const openRouterMessages = convertGeminiToOpenRouterMessages(contents, sysInstr);
      const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: openRouterMessages,
          max_tokens: Math.min(genConfig.maxOutputTokens || 4096, 4096),
          temperature: genConfig.temperature ?? 0.7,
          stream: true,
          transforms: ['middle-out'], // Auto-compress if still over limit
        }),
      });

      if (!orResp.ok) {
        const errText = await orResp.text();
        console.error('[OpenRouter-Stream] HTTP error:', orResp.status, errText.substring(0, 300));
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'openrouter-stream',
          error_code: `OPENROUTER_STREAM_HTTP_${orResp.status}`,
          message: `OpenRouter streaming HTTP ${orResp.status}`,
          details: { status: orResp.status, errorSnippet: errText.substring(0, 500) },
        });
      } else {
        const reader = orResp.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let accumulated = '';
          let done = false;
          let buffer = '';

          while (!done) {
            const { value, done: rdone } = await reader.read();
            done = rdone;
            if (value) {
              buffer += decoder.decode(value, { stream: !done });
              // Process SSE lines
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // keep incomplete line in buffer

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                      accumulated += delta;
                      try { await onChunk(delta); } catch (e) { console.warn('[OpenRouter-Stream] onChunk failed', e); }
                    }
                  } catch (_) { /* skip non-JSON lines */ }
                }
              }
            }
          }

          if (accumulated) {
            console.log('[OpenRouter-Stream] Fallback stream succeeded, chars:', accumulated.length);
            return { success: true, content: accumulated };
          }
        } else {
          // Non-streaming fallback
          const orData = await orResp.json();
          const orContent = orData.choices?.[0]?.message?.content;
          if (orContent) {
            await onChunk(orContent);
            console.log('[OpenRouter-Stream] Fallback non-stream succeeded, chars:', orContent.length);
            return { success: true, content: orContent };
          }
        }
      }
    } catch (orErr) {
      console.error('[OpenRouter-Stream] Error:', orErr);
      logSystemError(supabase, {
        severity: 'error',
        source: 'gemini-chat',
        component: 'openrouter-stream',
        error_code: 'OPENROUTER_STREAM_ERROR',
        message: `OpenRouter streaming error: ${String(orErr)}`,
        details: { error: String(orErr) },
      });
    }
  }

  return { success: false, error: 'ALL_STREAM_MODELS_FAILED' };
}

async function extractUserFacts(userMessage: string, aiResponse: string, userId: string, sessionId: string): Promise<any[]> {
  const facts: any[] = [];

  const preferencePatterns = [
    {
      pattern: /(I prefer|I like|I enjoy|I love).*?(visual|auditory|kinesthetic|reading|writing|diagrams|examples|videos|hands.on)/gi,
      type: 'learning_style',
      key: 'learning_preference'
    },
    {
      pattern: /(I (?:am|become) (?:interested|fascinated) (?:in|with)|I want to learn (?:more )?about|I'd? like to know (?:more )?about).*?([^.!?]+)/gi,
      type: 'interest',
      key: 'learning_interests'
    },
    {
      pattern: /(I (?:struggle|have difficulty|need help|find it hard) (?:with|to)).*?([^.!?]+)/gi,
      type: 'skill_level',
      key: 'challenging_areas'
    },
    {
      pattern: /(My (?:favorite|preferred) (?:subject|topic|area) (?:is|are)).*?([^.!?]+)/gi,
      type: 'interest',
      key: 'favorite_subjects'
    },
    {
      pattern: /(I (?:am|'m) (?:good|great|excellent) (?:at|with)).*?([^.!?]+)/gi,
      type: 'skill_level',
      key: 'strong_areas'
    }
  ];

  // Helper to extract facts from any text (user or AI)
  function extractFromText(text: string, source: string) {
    for (const { pattern, type, key } of preferencePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          const value = match[2].trim();
          if (value.length > 3 && value.length < 100) {
            facts.push({
              fact_type: type,
              fact_key: key,
              fact_value: value,
              confidence_score: 0.8,
              source_session_id: sessionId
            });
            console.log(`[extractUserFacts] Matched fact from ${source}: type=${type}, key=${key}, value=${value}`);
          }
        }
      }
    }
    for (const pattern of topicPatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        if (match && !facts.some((f) => f.fact_value.toLowerCase() === match.toLowerCase())) {
          facts.push({
            fact_type: 'interest',
            fact_key: 'discussed_topics',
            fact_value: match.toLowerCase(),
            confidence_score: 0.7,
            source_session_id: sessionId
          });
          console.log(`[extractUserFacts] Matched topic from ${source}: ${match.toLowerCase()}`);
        }
      }
    }
  }

  extractFromText(userMessage, 'user');
  extractFromText(aiResponse, 'ai');

  const topicPatterns = [
    /(genetics|biology|aviation|flight|birds|science|math|history|literature|programming|technology)/gi
  ];

  for (const pattern of topicPatterns) {
    const matches = userMessage.match(pattern) || [];
    for (const match of matches) {
      if (match && !facts.some((f) => f.fact_value.toLowerCase() === match.toLowerCase())) {
        facts.push({
          fact_type: 'interest',
          fact_key: 'discussed_topics',
          fact_value: match.toLowerCase(),
          confidence_score: 0.7,
          source_session_id: sessionId
        });
        console.log(`[extractUserFacts] Matched topic: ${match.toLowerCase()}`);
      }
    }
  }

  console.log(`[extractUserFacts] Extracted facts:`, facts);

  // If the AI response contains a section like "Here are the key 'learning facts' I know about you:", try to parse bullet points as facts
  const aiFactSectionMatch = aiResponse.match(/Here are the key ["']?learning facts["']?[^\n]*\n([\s\S]+?)(?:\n\n|$)/i);
  if (aiFactSectionMatch) {
    const lines = aiFactSectionMatch[1].split(/\n|\*/).map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      // Try to extract a key-value pair from the line
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        if (value.length > 3 && value.length < 200) {
          facts.push({
            fact_type: 'ai_inferred',
            fact_key: key,
            fact_value: value,
            confidence_score: 0.6,
            source_session_id: sessionId
          });
          console.log(`[extractUserFacts] Inferred from AI summary: key=${key}, value=${value}`);
        }
      }
    }
  }

  return facts;
}

// ========== STREAMING HANDLER FUNCTION ==========
async function handleStreamingResponse(
  userId: string,
  sessionId: string,
  message: string,
  allDocumentIds: string[],
  attachedNoteIds: string[],
  learningStyle: string,
  learningPreferences: any,
  userMessageImageUrl: string | null,
  imageMimeType: string | null,
  filesMetadata: any[],
  userMessageId: string | null,
  userMessageTimestamp: string | null,
  aiMessageIdToUpdate: string | null,
  courseMaterialsContext?: string,
  courseContext?: { id: string; code?: string; title?: string } | null
): Promise<Response> {
  const { stream, handler } = createStreamResponse();

  // Start automatic heartbeat to prevent client timeout during long operations
  handler.startHeartbeat(15_000);

  // Get tier-based AI model configuration for this user
  const aiModelConfig = await (async () => {
    try {
      const validator = createSubscriptionValidator();
      return await validator.getAiModelConfig(userId);
    } catch (e) {
      console.warn('[Streaming] Failed to get AI model config, using default chain:', e);
      return {
        tier: 'free' as const,
        modelChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
        streamingChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
        displayLabel: 'Gemini Flash',
      };
    }
  })();
  console.log(`[Streaming] AI model tier: ${aiModelConfig.tier}, primary model: ${aiModelConfig.modelChain[0]}, label: ${aiModelConfig.displayLabel}`);

  // Start async processing
  (async () => {
    try {
      console.log('🚀 Starting streaming response for message:', message.substring(0, 50));

      // Step 1: Understanding Phase
      handler.sendThinkingStep(
        'understanding',
        'Analyzing your request',
        'Interpreting message intent and key entities...',
        'in-progress'
      );
      console.log('✅ Sent understanding step (in-progress)');

      console.log('📚 Getting conversation history...');
      const conversationHistory = await getConversationHistory(userId, sessionId);
      console.log('✅ Retrieved conversation history:', conversationHistory.length, 'messages');

      let userIntent: UserIntent;
      try {
        console.log('🧠 Understanding query...');
        userIntent = await agenticCore.understandQuery(message, userId, conversationHistory);
        console.log('✅ Query understood:', userIntent.primary);
      } catch (error: any) {
        console.error('❌ Error in understandQuery:', error.message, error.stack);
        logSystemError(supabase, {
          severity: 'warning',
          source: 'gemini-chat',
          component: 'understand-query',
          error_code: 'QUERY_UNDERSTANDING_FAILED',
          message: `understandQuery failed: ${error.message}`,
          details: { stack: error.stack },
          user_id: userId,
        });
        // Fallback intent if query understanding fails
        userIntent = {
          primary: 'general_query',
          secondary: [],
          entities: [],
          complexity: 'simple' as const,
          requiresContext: false,
          requiresAction: false,
          confidence: 0.5
        };
        console.log('⚠️ Using fallback intent');
      }

      console.log('📤 Sending understanding complete step...');
      const entitiesPreview = (userIntent.entities || []).length > 0
        ? ` (Entities: ${(userIntent.entities || []).map(e => e.value).join(', ')})`
        : '';
      handler.sendThinkingStep(
        'understanding',
        'Query understood',
        `Recognized intent: ${userIntent.primary}${entitiesPreview}. Complexity: ${userIntent.complexity}`,
        'completed',
        { intent: userIntent.primary, entities: (userIntent.entities || []).map((e: EntityMention) => `${e.type}:${e.value}`) }
      );
      console.log('✅ Understanding phase complete');

      // Step 2: Retrieval Phase
      console.log('🔍 Starting retrieval phase...');
      const retrievalDetail = userIntent.entities?.length > 0
        ? `Searching for relevant data about ${userIntent.entities.map(e => e.value).join(', ')}...`
        : 'Searching through your notes, documents, and past conversations...';

      handler.sendThinkingStep(
        'retrieval',
        'Gathering relevant information',
        retrievalDetail,
        'in-progress'
      );

      let relevantContext: any[] = [];
      try {
        console.log('📥 Retrieving relevant context...');
        relevantContext = await agenticCore.retrieveRelevantContext(userIntent, userId, sessionId);
        console.log('✅ Retrieved context:', relevantContext?.length || 0, 'items');
      } catch (error: any) {
        console.error('❌ Error in retrieveRelevantContext:', error.message, error.stack);
        logSystemError(supabase, {
          severity: 'warning',
          source: 'gemini-chat',
          component: 'retrieve-context',
          error_code: 'CONTEXT_RETRIEVAL_FAILED',
          message: `retrieveRelevantContext failed: ${error.message}`,
          details: { stack: error.stack },
          user_id: userId,
        });
        // Continue with empty context
      }

      console.log('📤 Sending retrieval complete step...');
      handler.sendThinkingStep(
        'retrieval',
        'Context retrieved',
        `Found ${relevantContext?.length || 0} relevant items (${(relevantContext || []).filter(c => c.type === 'note').length} notes, ${(relevantContext || []).filter(c => c.type === 'document').length} documents)`,
        'completed',
        { contextCount: relevantContext?.length || 0, topItems: (relevantContext || []).slice(0, 3).map(c => c.title) }
      );
      console.log('✅ Retrieval phase complete');

      // Step 3: Reasoning Phase
      console.log('🤔 Starting reasoning phase...');
      handler.sendThinkingStep(
        'reasoning',
        'Building reasoning chain',
        'Analyzing what we know and determining the best approach...',
        'in-progress'
      );

      let reasoningChain: string[] = [];
      try {
        console.log('⚙️ Building reasoning chain...');
        reasoningChain = await agenticCore.buildReasoningChain(userIntent, relevantContext, message);
        console.log('✅ Built reasoning chain:', reasoningChain?.length || 0, 'steps');
      } catch (error: any) {
        console.error('❌ Error in buildReasoningChain:', error.message, error.stack);
        logSystemError(supabase, {
          severity: 'warning',
          source: 'gemini-chat',
          component: 'reasoning-chain',
          error_code: 'REASONING_CHAIN_FAILED',
          message: `buildReasoningChain failed: ${error.message}`,
          details: { stack: error.stack },
          user_id: userId,
        });
        // Continue with empty reasoning chain
      }

      console.log('📤 Sending reasoning complete step...');
      handler.sendThinkingStep(
        'reasoning',
        'Reasoning complete',
        `Built ${reasoningChain?.length || 0} reasoning steps`,
        'completed',
        { reasoningSteps: reasoningChain || [] }
      );
      console.log('✅ Reasoning phase complete');

      // Step 4: Memory Loading Phase
      console.log('🧠 Starting memory loading phase...');
      handler.sendThinkingStep(
        'memory',
        'Loading memory systems',
        'Accessing working memory, long-term patterns, and past interactions...',
        'in-progress'
      );

      console.log('💾 Loading memory systems...');
      const [workingMemory, longTermMemory, episodicMemory] = await Promise.all([
        agenticCore.getWorkingMemory(sessionId, userId),
        agenticCore.getLongTermMemory(userId),
        agenticCore.getEpisodicMemory(userId, message)
      ]);
      console.log('✅ Memory systems loaded');

      console.log('📤 Sending memory complete step...');
      handler.sendThinkingStep(
        'memory',
        'Memory loaded',
        `Loaded ${workingMemory.recentMessages?.length || 0} recent messages, ${longTermMemory.facts?.length || 0} learned facts`,
        'completed',
        { msgCount: workingMemory.recentMessages?.length || 0, factCount: longTermMemory.facts?.length || 0 }
      );
      console.log('✅ Memory phase complete');

      // Build context
      console.log('📝 Building context...');
      let attachedContext = '';
      if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
        console.log('📎 Building attached context from', allDocumentIds.length, 'documents and', attachedNoteIds.length, 'notes');
        attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
        console.log('✅ Attached context built:', attachedContext.length, 'characters');
      }

      // Merge any course materials context we fetched earlier
      if (courseMaterialsContext && courseMaterialsContext.length > 0) {
        attachedContext = `${courseMaterialsContext}\n\n${attachedContext}`;
      }

      // Add semantically retrieved context
      if (relevantContext && relevantContext.length > 0) {
        console.log('🔗 Adding semantic context...');
        attachedContext += '\n\n=== SEMANTICALLY RELEVANT CONTEXT ===\n';
        relevantContext.slice(0, 10).forEach(ctx => {
          attachedContext += `\n[${ctx.type.toUpperCase()}] ${ctx.title} (Relevance: ${(ctx.relevanceScore * 100).toFixed(0)}%)\n`;
          if (ctx.content) {
            const preview = ctx.content.substring(0, 500);
            attachedContext += `${preview}${ctx.content.length > 500 ? '...' : ''}\n`;
          }
        });
        console.log('✅ Semantic context added');
      }

      attachedContext += '\n\n=== REASONING CHAIN ===\n';
      attachedContext += (reasoningChain || []).join('\n');

      if (episodicMemory.relevantSessions?.length > 0) {
        console.log('📋 Adding episodic memory...');
        attachedContext += '\n\n=== RELEVANT PAST DISCUSSIONS ===\n';
        episodicMemory.relevantSessions.forEach((sess: any) => {
          attachedContext += `- ${sess.title}: ${sess.context_summary || 'No summary'}\n`;
        });
      }

      console.log('🎯 Building enhanced prompt...');
      const userContext = await contextService.getUserContext(userId);
      let systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');

      // If streaming path provided a courseContext, instruct the model to adopt a learning-first tone
      if (typeof courseContext !== 'undefined' && courseContext && (courseContext.title || courseContext.id)) {
        const courseLabel = courseContext.title ? `${courseContext.title}${courseContext.code ? ` (${courseContext.code})` : ''}` : courseContext.id;
        const courseInstr = `COURSE CONTEXT: The user is studying ${courseLabel}. Assume their intent is to learn and master this course. Prioritize educational explanations, step-by-step walkthroughs, examples, practice problems, and short quizzes. When appropriate, suggest next study actions and summarize key takeaways.`;
        systemPrompt = `${systemPrompt}\n\n${courseInstr}`;
      }
      const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);
      console.log('✅ Prompt built with', conversationData.contents.length, 'conversation parts');

      // =========================================================================
      // STEP 5: ACTION PLANNING (JSON) - UPDATED WITH CLEARER INSTRUCTIONS
      // =========================================================================
      console.log('⚙️ Starting Action Planning phase...');
      handler.sendThinkingStep(
        'action',
        'Planning actions',
        'Determining necessary operations based on your request...',
        'in-progress'
      );

      // Define supported action types clearly
      const SUPPORTED_ACTION_TYPES = ['DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL'];
      const ACTION_TYPE_DESCRIPTION = `
ONLY these action types are supported by the system:
1. DB_ACTION - Database operations (INSERT, SELECT, UPDATE, DELETE)
2. GENERATE_IMAGE - AI image generation using diffusion models
3. ENGAGE_SOCIAL - Social media interactions and posts

ANY OTHER ACTION TYPE WILL BE IGNORED AND SKIPPED.
If you think you need a different action type, DON'T include it. Only use the three types above.
`;

      const actionSystemPrompt = `
═══════════════════════════════════════════════════════════
YOU ARE NOW IN: ACTION PLANNING PHASE
═══════════════════════════════════════════════════════════

Your ONLY job is to return valid JSON representing the actions needed.

${ACTION_TYPE_DESCRIPTION}

REQUIRED JSON FORMAT:
{
  "thought_process": "Brief machine-readable explanation",
  "actions": [
    {
      "type": "DB_ACTION|GENERATE_IMAGE|ENGAGE_SOCIAL",
      "params": { ... }
    }
  ]
}

CRITICAL RULES:
1. Return ONLY the JSON object above - absolutely no other text
2. Use ONLY the 3 action types listed (DB_ACTION, GENERATE_IMAGE, ENGAGE_SOCIAL)
3. If you need any other action type, DO NOT include it (it will be skipped anyway)
4. If no actions are needed, return: { "thought_process": "No actions required", "actions": [] }
5. When referring to the current user ID, use the literal string "auth.uid()"
6. For DELETE/UPDATE operations, include proper filters to avoid accidental data loss
7. DO NOT add conversational text, explanations, or markdown
8. DO NOT wrap the JSON in code blocks

FOR DB_ACTION FORMATTING (Follow exactly):
- params must include: table (string), operation (INSERT|UPDATE|DELETE|SELECT)
- For UPDATE/DELETE, include filters object with specific conditions
- For INSERT, include data object with row values
- For schedule_items INSERT: "type" MUST be one of: 'class', 'study', 'assignment', 'exam', 'other'. "subject" is REQUIRED (non-null text).
- Date/time range filters use comparison objects:
  "filters": { "start_time": { "gte": "2026-01-26T12:00:00Z", "lte": "2026-01-26T19:30:00Z" } }
- Array-valued fields (like recurrence_days) must be actual JSON arrays:
  "recurrence_days": [1,2,3]  ✓ CORRECT
  "recurrence_days": ["1","2"]  ✗ WRONG
- Use filters with in for matching multiple values:
  "filters": { "title": { "in": ["Note 1", "Note 2"] } }

EXAMPLES (follow these patterns):

Example 1 - Simple SELECT:
{
  "thought_process": "User wants to see their schedules",
  "actions": [
    {
      "type": "DB_ACTION",
      "params": {
        "table": "schedule_items",
        "operation": "SELECT",
        "filters": { "user_id": "auth.uid()" },
        "limit": 50
      }
    }
  ]
}

Example 2 - DELETE with specific filters:
{
  "thought_process": "Remove Monday items in time range",
  "actions": [
    {
      "type": "DB_ACTION",
      "params": {
        "table": "schedule_items",
        "operation": "DELETE",
        "filters": {
          "user_id": "auth.uid()",
          "is_recurring": true,
          "recurrence_days": [1],
          "start_time": { "gte": "2026-01-26T12:00:00Z", "lte": "2026-01-26T19:30:00Z" }
        }
      }
    }
  ]
}

Example 3 - INSERT with proper data:
{
  "thought_process": "Create new note",
  "actions": [
    {
      "type": "DB_ACTION",
      "params": {
        "table": "notes",
        "operation": "INSERT",
        "data": {
          "user_id": "auth.uid()",
          "title": "Study Notes",
          "content": "Content here...",
          "category": "general",
          "tags": ["study"]
        }
      }
    }
  ]
}

Example 4 - No actions needed:
{
  "thought_process": "This is a question that doesn't require database operations",
  "actions": []
}

DATABASE SCHEMA:
${typeof DB_SCHEMA_DEFINITION === 'string' ? DB_SCHEMA_DEFINITION : JSON.stringify(DB_SCHEMA_DEFINITION, null, 2)}

USER'S REQUEST:
See the conversation history above.

NOW: Return ONLY the JSON action plan (nothing else, no markdown, no explanation):
`;

      // Build action planning conversation
      const actionContents = [...conversationData.contents];

      // Initialize tracking
      let executedActions: any[] = [];
      let finalResponseContext = '';
      let planningAttempt = 0;

      try {
        // Action planning loop with retry and self-correction
        while (planningAttempt < ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS) {
          console.log(`[ActionPlanningLoop] Attempt ${planningAttempt + 1}/${ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS}`);

          console.log('🤖 Calling Gemini API for Action Plan...');
          const actionResponse = await callEnhancedGeminiAPI(actionContents, geminiApiKey, {
            responseMimeType: 'application/json',
            systemInstruction: { parts: [{ text: actionSystemPrompt }] }
          });

          if (!actionResponse.success || !actionResponse.content) {
            console.error('[ActionPlanningLoop] Failed to get action plan from API');
            handler.sendThinkingStep('action', 'Planning skipped', 'Could not generate action plan', 'completed');
            break;
          }

          console.log('[ActionPlanningLoop][RAW_PLAN]', actionResponse.content);

          // Parse the action plan
          let parsed: any = null;
          try {
            parsed = JSON.parse(actionResponse.content);
          } catch (e) {
            // Try to extract JSON from response
            const jsonMatch = actionResponse.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                parsed = JSON.parse(jsonMatch[0]);
              } catch (e2) {
                console.warn('[ActionPlanningLoop] Could not parse JSON from response');
              }
            }
          }

          if (!parsed) {
            console.error('[ActionPlanningLoop] Failed to parse action plan JSON');
            handler.sendThinkingStep('action', 'Action Planning Warning', 'Could not parse model action plan JSON; continuing...', 'completed');
            break;
          }

          // Normalize to actions array
          let actionsToExecute: any[] = [];
          if (Array.isArray(parsed)) actionsToExecute = parsed;
          else if (parsed && Array.isArray(parsed.actions)) actionsToExecute = parsed.actions;
          else if (parsed && parsed.type) actionsToExecute = [parsed];

          if (!actionsToExecute || actionsToExecute.length === 0) {
            console.log('[ActionPlanningLoop] No actions planned.');
            handler.sendThinkingStep('action', 'No actions needed', 'Proceeding to response...', 'completed', { actionCount: 0 });
            break;
          }

          // Filter to supported action types and record skipped actions
          const filteredActions: any[] = [];
          for (const a of actionsToExecute) {
            if (SUPPORTED_ACTION_TYPES.includes(a.type)) {
              filteredActions.push(a);
            } else {
              console.warn(`[ActionPlanningLoop] Skipping unsupported action type: ${a.type}`);
              executedActions.push({
                type: a.type,
                success: false,
                error: `Unsupported action type '${a.type}' - Only DB_ACTION, GENERATE_IMAGE, ENGAGE_SOCIAL are supported`,
                timestamp: new Date().toISOString()
              });
              handler.sendThinkingStep('action', `Skipped unsupported action`, `Action type '${a.type}' is not supported`, 'completed', { action: a });
            }
          }

          // Execute planned actions (only supported ones)
          if (filteredActions.length > 0) {
            const execResults = await executeParsedActions(
              actionsService,
              userId,
              sessionId,
              filteredActions,
              (action, index, total) => {
                const actionLabel = getFriendlyActionLabel(action.type, action.params);
                handler.sendThinkingStep('action', `Action ${index + 1}/${total}`, `${actionLabel}...`, 'in-progress', { action, index, total });
              }
            );

            executedActions = executedActions.concat(execResults);
          }

          // Check if actions require confirmation
          const needsConfirmation = executedActions.filter((a: any) => a.data && a.data.needsConfirmation);
          if (needsConfirmation.length > 0) {
            handler.sendThinkingStep('action', 'Awaiting confirmation', `One or more actions require confirmation before proceeding.`, 'completed');
            finalResponseContext += '\n\n=== ACTIONS REQUIRING CONFIRMATION ===\n';
            finalResponseContext += JSON.stringify(needsConfirmation, null, 2);
            break;
          }

          // Check for failures
          const failures = executedActions.filter((a: any) => !a.success);
          if (failures.length === 0) {
            finalResponseContext += '\n\n=== EXECUTED ACTIONS RESULTS ===\n';
            finalResponseContext += JSON.stringify(truncateActionResults(executedActions), null, 2);
            handler.sendThinkingStep('action', 'Actions executed', `Successfully executed ${executedActions.length} actions.`, 'completed');
            break;
          }

          // If failures and not at max attempts, try to fix
          planningAttempt += 1;
          if (planningAttempt >= ENHANCED_PROCESSING_CONFIG.ACTION_FIX_ATTEMPTS) {
            console.error('[ActionPlanningLoop] Reached max fix attempts');
            handler.sendThinkingStep('action', 'Action Fix Failed', `Some actions failed after ${planningAttempt} attempts.`, 'completed');
            finalResponseContext += '\n\n=== EXECUTED ACTIONS RESULTS (WITH FAILURES) ===\n';
            finalResponseContext += JSON.stringify(truncateActionResults(executedActions), null, 2);
            break;
          }

          // Prepare repair prompt with schema hints so the AI learns from errors
          const repairInstruction = `The previous action plan produced failures. Here are the results:

PLAN:
${actionResponse.content}

EXECUTION_RESULTS:
${JSON.stringify(truncateActionResults(executedActions), null, 2)}

COMMON FIXES:
- schedule_items.type MUST be one of: 'class', 'study', 'assignment', 'exam', 'other' (NOT 'personal', 'event', etc.)
- schedule_items.subject is REQUIRED (non-null text)
- Always include all NOT NULL columns

Please provide a corrected JSON action plan that ONLY re-does the FAILED actions (do not repeat actions that already succeeded). Return JSON ONLY.`;

          actionContents.push({ role: 'user', parts: [{ text: repairInstruction }] });
          await sleep(ENHANCED_PROCESSING_CONFIG.ACTION_FIX_BACKOFF_MS * planningAttempt);
        }
      } catch (actionError: any) {
        console.error('Error during action planning:', actionError);
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'action-planning',
          error_code: 'ACTION_PLANNING_FAILED',
          message: `Action planning loop failed: ${actionError.message}`,
          details: { stack: actionError.stack, sessionId: requestData?.sessionId },
          user_id: requestData?.userId,
        });
        handler.sendThinkingStep('action', 'Action Planning Error', 'Continuing to response generation...', 'completed');
      }

      // =========================================================================
      // STEP 6: FINAL RESPONSE GENERATION (Text)
      // =========================================================================
      console.log('🏁 Generating Final Response...');

      const finalContents = [...conversationData.contents];
      if (executedActions.length > 0) {
        const slimResults = truncateActionResults(executedActions);

        // Collect image URLs from successful GENERATE_IMAGE actions to include in the instruction
        const generatedImageUrls: string[] = [];
        for (const ea of executedActions) {
          if (ea.type === 'GENERATE_IMAGE' && ea.success && ea.data) {
            const imgUrl = ea.data.imageUrl || ea.data.image_url || ea.data.url;
            if (imgUrl) generatedImageUrls.push(imgUrl);
          }
        }

        let imageInstruction = '';
        if (generatedImageUrls.length > 0) {
          imageInstruction = `\n          5. For generated images, include them in your response using markdown image syntax: ![description](url). Here are the generated image URLs:\n`;
          for (const url of generatedImageUrls) {
            imageInstruction += `             - ${url}\n`;
          }
          imageInstruction += `          You MUST include each image URL in your response using ![description](url) format so the user can see them.`;
        }

        finalContents.push({
          role: 'user',
          parts: [{ text: `System Update: The following actions were executed successfully.
          
          Results: ${JSON.stringify(slimResults)}
          
          CRITICAL INSTRUCTION FOR FINAL RESPONSE:
          1. The actions are DONE. Do NOT output any raw JSON action objects, "DB_ACTION", or action code blocks.
          2. Just confirm to the user naturally (e.g., "I've created your note." or "Here's the image you requested.").
          3. If the results show a total_count higher than the records shown, tell the user how many total exist.
          4. Keep the response concise.${imageInstruction}` }]
        });
      }

      console.log('🤖 Calling Gemini API for Final Response...');

      let generatedText = '';
      let modelUsed = aiModelConfig.displayLabel;
      // Stream tokens to the client as they arrive. This handler is only invoked
      // when the outer request enabled streaming, so we always attempt streaming.
      const streamResult = await callEnhancedGeminiAPIStream(finalContents, geminiApiKey, async (chunk: string) => {
        try {
          handler.sendContentChunk(chunk);
        } catch (e) {
          console.warn('[Streaming] Failed to send content chunk:', e);
        }
      }, { systemInstruction: conversationData.systemInstruction }, aiModelConfig.streamingChain);

      if (!streamResult.success || !streamResult.content) {
        // Fallback to synchronous generation if streaming failed
        const finalResponse = await callEnhancedGeminiAPI(finalContents, geminiApiKey, {
          systemInstruction: conversationData.systemInstruction
        }, aiModelConfig.modelChain);
        if (!finalResponse.success || !finalResponse.content) {
          throw new Error('Failed to generate final response');
        }
        generatedText = finalResponse.content;
        if (finalResponse.modelUsed) modelUsed = finalResponse.modelUsed;
        handler.sendContentChunk(generatedText);
        console.log('[Streaming] Fallback full response sent; chars:', generatedText.length);
      } else {
        generatedText = streamResult.content;
        if (streamResult.modelUsed) modelUsed = streamResult.modelUsed;
        console.log('[Streaming] Completed streaming final response; total chars:', generatedText.length);
      }
      // Skip finalize-check to conserve API quota — the response is already streamed to the user
      handler.sendThinkingStep('action', 'Response generated', 'Successfully generated response', 'completed');
      console.log('✅ Action phase complete');

      console.log('✅ Actions executed (summary):', executedActions.length, 'actions');

      // Detect embedded image code blocks like ```image\n{ "url": "...", "alt": "..." }\n```
      function extractImageBlocks(text: string): { cleaned: string; images: Array<{ url: string; alt?: string }> } {
        const imageRegex = /```image\s*\n([\s\S]*?)\n```/g;
        const images: Array<{ url: string; alt?: string }> = [];
        let cleaned = text;
        let match: RegExpExecArray | null;
        while ((match = imageRegex.exec(text)) !== null) {
          try {
            const jsonText = match[1].trim();
            const parsed = JSON.parse(jsonText);
            if (parsed && parsed.url) {
              images.push({ url: parsed.url, alt: parsed.alt || parsed.description || '' });
              // Replace the code block in cleaned output with a markdown image tag
              cleaned = cleaned.replace(match[0], `![${(parsed.alt || '').replace(/\]|\(/g,'')}](${parsed.url})`);
            }
          } catch (err) {
            console.warn('[extractImageBlocks] Failed to parse image block JSON:', err);
          }
        }
        return { cleaned, images };
      }

      console.log('💾 Saving AI message...');
      const { cleaned, images } = extractImageBlocks(generatedText);

      // Also collect images from successfully executed GENERATE_IMAGE actions
      // (the model may not embed ```image blocks, so we extract them directly)
      for (const ea of executedActions) {
        if (ea.type === 'GENERATE_IMAGE' && ea.success && ea.data) {
          const imgUrl = ea.data.imageUrl || ea.data.image_url || ea.data.url;
          if (imgUrl && !images.some(img => img.url === imgUrl)) {
            images.push({ url: imgUrl, alt: ea.data.prompt || ea.data.message || 'Generated image' });
            console.log(`[ImageExtraction] Added image from GENERATE_IMAGE action: ${imgUrl}`);
          }
        }
      }

      // Sanitize assistant output to remove any embedded action JSON/code blocks
      let sanitizedCleaned = sanitizeAssistantOutput(cleaned);

      // If we have generated images but the response text doesn't reference them,
      // append markdown image tags so the user sees them inline
      if (images.length > 0) {
        const hasImageRef = images.some(img => sanitizedCleaned.includes(img.url));
        if (!hasImageRef) {
          const imageMd = images.map(img => `\n\n![${(img.alt || 'Generated image').replace(/[[\]()]/g, '')}](${img.url})`).join('');
          sanitizedCleaned = sanitizedCleaned.trimEnd() + imageMd;
          console.log(`[ImageExtraction] Appended ${images.length} image(s) as markdown to response`);
        }
      }

      const aiMessageData: any = {
        userId,
        sessionId,
        content: sanitizedCleaned,
        role: 'assistant',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        isError: false,
        filesMetadata: images.length > 0 ? images.map(img => ({ type: 'image', url: img.url, alt: img.alt })) : null,
        imageUrl: images.length > 0 ? images[0].url : null,
        imageMimeType: images.length > 0 ? (images[0].url.endsWith('.png') ? 'image/png' : images[0].url.endsWith('.jpg') || images[0].url.endsWith('.jpeg') ? 'image/jpeg' : null) : null
      };

      const savedAiMessage = await saveChatMessage(aiMessageData);
      console.log('✅ AI message saved:', savedAiMessage?.id);

      try {
        if (generatedText) {
          await updateSessionTokenCount(sessionId, userId, generatedText, 'add');
        }
      } catch (err) {
        console.error('[Streaming] Failed to update token count after saving AI message:', err);
      }

      // Send final response (include image metadata so client can render inline)
      console.log('🏁 Sending final response...');

      // Prepare top-level convenience fields
      const topLevelImageUrl = images.length > 0 ? images[0].url : undefined;
      const filesMetadata = images.length > 0 ? JSON.stringify(images) : undefined;

      // Sanitize final outgoing response to avoid leaking action JSON/code
      // Use sanitizedCleaned which already has image markdown appended
      const finalResponseText = sanitizedCleaned;

      try {
        // Log a compact summary instead of the full payload to avoid bloating logs
        const donePayloadSummary = {
          response: finalResponseText.substring(0, 200) + (finalResponseText.length > 200 ? '...' : ''),
          responseLength: finalResponseText.length,
          aiMessageId: savedAiMessage?.id,
          userMessageId,
          sessionId,
          userId,
          actionCount: executedActions.length,
          imageCount: images.length,
        };
        console.log('SENT_DONE_PAYLOAD', JSON.stringify(donePayloadSummary));
      } catch (err) {
        console.error('Failed to serialize SENT_DONE_PAYLOAD', err);
      }

      handler.sendDone({
        response: finalResponseText,
        aiMessageId: savedAiMessage?.id,
        aiMessageTimestamp: savedAiMessage?.timestamp,
        userMessageId,
        userMessageTimestamp,
        sessionId,
        userId,
        executedActions: truncateActionResults(executedActions),
        images: images.length > 0 ? images : null,
        imageUrl: topLevelImageUrl,
        files_metadata: filesMetadata,
        modelUsed,
        modelLabel: aiModelConfig.displayLabel,
        modelTier: aiModelConfig.tier,
      });
      console.log('✅ Final response sent, closing stream');

      handler.close();
      console.log('✅✅✅ Streaming response completed successfully! ✅✅✅');

      // Fire-and-forget: generate conversation summary if enough messages
      if (conversationData.contextInfo.recentMessages.length >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
        updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages).catch(err =>
          console.error('[Streaming] Error updating conversation summary:', err)
        );
      }
    } catch (error: any) {
      console.error('❌ FATAL ERROR in streaming handler:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      logSystemError(supabase, {
        severity: 'critical',
        source: 'gemini-chat',
        component: 'streaming-handler',
        error_code: 'STREAMING_FATAL',
        message: `Fatal streaming error: ${error.message}`,
        details: { stack: error.stack, sessionId: requestData?.sessionId },
        user_id: requestData?.userId,
      });
      if (!handler.isClosed) {
        handler.sendError(error.message || 'An error occurred');
      }
      handler.close();
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders
    }
  });
}

// MAIN SERVER HANDLER
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  const startTime = Date.now();
  let requestData: any = null;
  let rawFiles: File[] = [];
  let jsonFiles: any[] = [];
  let uploadedDocumentIds: string[] = [];
  let userMessageImageUrl: string | null = null;
  let userMessageImageMimeType: string | null = null;
  let processingResults: any[] = [];

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      requestData = {
        userId: formData.get('userId'),
        sessionId: formData.get('sessionId'),
        learningStyle: formData.get('learningStyle'),
        learningPreferences: formData.get('learningPreferences') ? JSON.parse(formData.get('learningPreferences') as string) : {},
        chatHistory: formData.get('chatHistory') ? JSON.parse(formData.get('chatHistory') as string) : [],
        message: formData.get('message') || '',
        attachedDocumentIds: formData.get('attachedDocumentIds') ? JSON.parse(formData.get('attachedDocumentIds') as string) : [],
        attachedNoteIds: formData.get('attachedNoteIds') ? JSON.parse(formData.get('attachedNoteIds') as string) : [],
        imageUrl: formData.get('imageUrl'),
        imageMimeType: formData.get('imageMimeType'),
        aiMessageIdToUpdate: formData.get('aiMessageIdToUpdate')
      };

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          rawFiles.push(value);
        }
      }
    } else if (contentType.includes('application/json')) {
      const responseBody = await req.text();
      try {
        requestData = JSON.parse(responseBody);
      } catch (e) {
        console.error("Failed to parse JSON", e);
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'request-parse',
          error_code: 'REQUEST_JSON_PARSE_FAILED',
          message: `Failed to parse request body JSON`,
          details: { error: String(e) },
        });
        return new Response(JSON.stringify({
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (requestData.files && Array.isArray(requestData.files)) {
        jsonFiles = requestData.files;
      }
    } else {
      return new Response(JSON.stringify({
        error: 'Unsupported content type'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const {
      userId,
      sessionId,
      learningStyle = 'visual',
      learningPreferences = {},
      message = '',
      attachedDocumentIds = [],
      attachedNoteIds = [],
      courseContext = null,
      imageUrl = null,
      imageMimeType = null,
      aiMessageIdToUpdate = null,
      enableStreaming = true  // Enable streaming by default for agentic visibility
    } = requestData;

    if (!userId || !sessionId) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: userId or sessionId'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Validate AI message limit before processing
    const validator = createSubscriptionValidator();
    const limitCheck = await validator.checkAiMessageLimit(userId);

    if (!limitCheck.allowed) {
      return createErrorResponse(limitCheck.message || 'AI message limit exceeded', 403);
    }

    // **VALIDATE FILE COUNT LIMIT**
    const totalFiles = rawFiles.length + jsonFiles.length;
    const MAX_FILES_PER_REQUEST = 10;

    if (totalFiles > MAX_FILES_PER_REQUEST) {
      return new Response(JSON.stringify({
        error: `Too many files attached. Maximum is ${MAX_FILES_PER_REQUEST} files per request.`,
        details: `You attached ${totalFiles} files. Please reduce the number of files and try again.`
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // **VALIDATE INDIVIDUAL FILE SIZES**
    const MAX_FILE_SIZE_MB = 20; // 20MB per file
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    for (const file of rawFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return new Response(JSON.stringify({
          error: `File too large: ${file.name}`,
          details: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. This file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

    let filesMetadata: any[] = [];
    let courseMaterialsContext = '';
    let attachedContext: string = '';

    // If a course context is provided, fetch course materials and include their document ids
    if (courseContext && courseContext.id) {
      try {
        const { data: cmData, error: cmError } = await supabase
          .from('course_materials')
          .select('document_id')
          .eq('course_id', courseContext.id);

        if (!cmError && Array.isArray(cmData) && cmData.length > 0) {
          const courseDocIds = cmData.map((r: any) => r.document_id).filter(Boolean);
          // Merge unique ids into attachedDocumentIds
          for (const id of courseDocIds) {
            if (!attachedDocumentIds.includes(id)) attachedDocumentIds.push(id);
          }

          // Fetch document extracts for context
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('id,title,file_name,content_extracted,processing_status')
            .in('id', courseDocIds);

          if (!docsError && Array.isArray(docs)) {
            courseMaterialsContext += `COURSE MATERIALS FOR ${courseContext.title || courseContext.id}:\n`;
            for (const d of docs) {
              courseMaterialsContext += `Title: ${d.title || d.file_name}\n`;
              if (d.content_extracted) {
                courseMaterialsContext += `Content: ${d.content_extracted}\n\n`;
              } else {
                courseMaterialsContext += `Processing status: ${d.processing_status || 'pending'}\n\n`;
              }
            }
          }
        }
      } catch (err) {
        console.error('[gemini-chat] Error fetching course materials:', err);
        logSystemError(supabase, {
          severity: 'warning',
          source: 'gemini-chat',
          component: 'course-materials',
          error_code: 'COURSE_MATERIALS_FETCH_FAILED',
          message: `Failed to fetch course materials: ${String(err)}`,
          details: { error: String(err) },
          user_id: userId,
        });
      }
    }
    const hasFiles = rawFiles.length > 0 || jsonFiles.length > 0;

    let userMessageId: string | null = null;
    let userMessageTimestamp: string | null = null;
    let aiMessageId: string | null = null;
    let aiMessageTimestamp: string | null = null;

    if (hasFiles) {
      const processorUrl = Deno.env.get('DOCUMENT_PROCESSOR_URL'); // ✅ Fixed
      if (!processorUrl) throw new Error('DOCUMENT_PROCESSOR_URL not configured');

      let processorResponse;
      if (contentType.includes('multipart/form-data')) {
        const formData = new FormData();
        formData.append('userId', userId);
        for (const file of rawFiles) {
          formData.append('file', file);
        }

        processorResponse = await fetch(processorUrl, {
          method: 'POST',
          headers: {
            // ✅ Add authorization headers
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: formData
        });
      } else {
        const body = JSON.stringify({
          userId,
          files: jsonFiles
        });

        processorResponse = await fetch(processorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ✅ Add authorization headers
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body
        });
      }

      if (!processorResponse.ok) {
        const errorBody = await processorResponse.text();
        console.error(`Document processor error: ${processorResponse.status} - ${errorBody}`);
        logSystemError(supabase, {
          severity: 'error',
          source: 'gemini-chat',
          component: 'document-processor',
          error_code: `DOC_PROCESSOR_HTTP_${processorResponse.status}`,
          message: `Document processor failed: HTTP ${processorResponse.status}`,
          details: { status: processorResponse.status, errorBody: errorBody?.substring(0, 500) },
          user_id: userId,
        });

        // ✅ Send user-friendly error message
        const errorMessage = {
          userId,
          sessionId,
          content: `❌ I encountered an issue processing your documents:\n\n${errorBody}\n\nPlease try:\n• Uploading smaller files\n• Using a different file format\n• Uploading one file at a time\n\nYou can still continue our conversation without the files.`,
          role: 'assistant',
          isError: true,
          attachedDocumentIds: attachedDocumentIds.length > 0 ? attachedDocumentIds : null,
          attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
          imageUrl: imageUrl,
          imageMimeType: imageMimeType
        };

        const savedErrorMessage = await saveChatMessage(errorMessage);

        // ✅ Return error response immediately instead of continuing
        return new Response(JSON.stringify({
          error: 'Document processing failed',
          errorDetails: errorBody,
          aiMessageId: savedErrorMessage?.id,
          aiMessageTimestamp: savedErrorMessage?.timestamp,
          userMessageId,
          userMessageTimestamp,
          sessionId,
          userId,
          success: false
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      const processedData = await processorResponse.json();
      uploadedDocumentIds = processedData.uploadedDocumentIds || [];
      filesMetadata = processedData.filesMetadata || [];
      processingResults = processedData.processingResults || [];

      // ✅ Check for partial failures
      const failedFiles = processedData.processingResults?.filter(
        (result: any) => result.status === 'failed'
      ) || [];

      if (failedFiles.length > 0 && failedFiles.length < processedData.processingResults.length) {
        // Partial failure - some succeeded, some failed
        console.warn(`Partial document processing failure: ${failedFiles.length}/${processedData.processingResults.length} files failed`);
      } else if (failedFiles.length === processedData.processingResults.length) {
        // Total failure - all files failed
        const errorMessage = {
          userId,
          sessionId,
          content: `❌ All ${failedFiles.length} file(s) failed to process:\n\n${failedFiles.map((f: any) => `• ${f.name}: ${f.error || 'Unknown error'}`).join('\n')
            }\n\nPlease check the file formats and try again.`,
          role: 'assistant',
          isError: true
        };

        const savedErrorMessage = await saveChatMessage(errorMessage);

        return new Response(JSON.stringify({
          error: 'All documents failed to process',
          errorDetails: failedFiles,
          aiMessageId: savedErrorMessage?.id,
          aiMessageTimestamp: savedErrorMessage?.timestamp,
          userMessageId,
          userMessageTimestamp,
          sessionId,
          userId,
          success: false
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    const allDocumentIds = [
      ...new Set([
        ...uploadedDocumentIds,
        ...attachedDocumentIds
      ])
    ];

    await ensureChatSession(userId, sessionId, allDocumentIds, message);

    // Save user message BEFORE streaming (so we have the ID to send back)
    if (message || hasFiles || attachedContext) {
      const userMessageData = {
        userId,
        sessionId,
        content: message,
        role: 'user',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType,
        filesMetadata: filesMetadata.length > 0 ? filesMetadata : null
      };

      const savedUserMessage = await saveChatMessage(userMessageData);
      if (savedUserMessage) {
        userMessageId = savedUserMessage.id;
        userMessageTimestamp = savedUserMessage.timestamp;
        console.log('✅ User message saved for streaming:', userMessageId);
        try {
          if (message) {
            await updateSessionTokenCount(sessionId, userId, message, 'add');
          }
        } catch (err) {
          console.error('[Main] Failed to update token count after saving user message:', err);
        }
      }
    }

    // Check if streaming is enabled
    if (enableStreaming) {
      // Return streaming response with saved user message ID
      return handleStreamingResponse(
        userId,
        sessionId,
        message,
        allDocumentIds,
        attachedNoteIds,
        learningStyle,
        learningPreferences,
        userMessageImageUrl,
        imageMimeType,
        filesMetadata,
        userMessageId,
        userMessageTimestamp,
        aiMessageIdToUpdate,
        courseMaterialsContext,
        courseContext
      );
    }

    // ========== AGENTIC UNDERSTANDING PHASE ==========
    console.log('[Agentic] Starting advanced query understanding...');

    // Get tier-based AI model configuration for this user (non-streaming path)
    const aiModelConfig = await (async () => {
      try {
        const modelValidator = createSubscriptionValidator();
        return await modelValidator.getAiModelConfig(userId);
      } catch (e) {
        console.warn('[NonStreaming] Failed to get AI model config, using default chain:', e);
        return {
          tier: 'free' as const,
          modelChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
          streamingChain: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
          displayLabel: 'Gemini Flash',
        };
      }
    })();
    console.log(`[NonStreaming] AI model tier: ${aiModelConfig.tier}, primary model: ${aiModelConfig.modelChain[0]}`);

    // Get conversation history for context
    const conversationHistory = await getConversationHistory(userId, sessionId);

    // Step 1: Understand user intent deeply
    const userIntent = await agenticCore.understandQuery(message, userId, conversationHistory);
    console.log(`[Agentic] Intent: ${userIntent.primary}, Complexity: ${userIntent.complexity}, Confidence: ${userIntent.confidence}`);
    console.log(`[Agentic] Entities detected: ${userIntent.entities.map(e => `${e.type}:${e.value}`).join(', ')}`);

    // Step 2: Retrieve relevant context using semantic understanding
    const relevantContext = await agenticCore.retrieveRelevantContext(userIntent, userId, sessionId);
    console.log(`[Agentic] Retrieved ${relevantContext.length} relevant context items`);

    // Step 3: Build reasoning chain
    const reasoningChain = await agenticCore.buildReasoningChain(userIntent, relevantContext, message);
    console.log(`[Agentic] Reasoning steps: ${reasoningChain.length}`);

    // Step 4: Get comprehensive memory
    const [workingMemory, longTermMemory, episodicMemory] = await Promise.all([
      agenticCore.getWorkingMemory(sessionId, userId),
      agenticCore.getLongTermMemory(userId),
      agenticCore.getEpisodicMemory(userId, message)
    ]);
    console.log(`[Agentic] Memory loaded - Working: ${workingMemory.recentMessages?.length || 0} msgs, LongTerm: ${longTermMemory.facts?.length || 0} facts`);

    // Step 5: Select appropriate tools if needed
    const selectedTools = await agenticCore.selectTools(userIntent, relevantContext);
    if (selectedTools.length > 0) {
      console.log(`[Agentic] Tools selected: ${selectedTools.join(', ')}`);
    }

    // Build enhanced attached context from agentic retrieval
    attachedContext = '';
    if (allDocumentIds.length > 0 || attachedNoteIds.length > 0) {
      attachedContext = await buildAttachedContext(allDocumentIds, attachedNoteIds, userId);
    }

    // Merge any course materials context we fetched earlier (non-streaming path)
    if (courseMaterialsContext && courseMaterialsContext.length > 0) {
      attachedContext = `${courseMaterialsContext}\n\n${attachedContext}`;
    }

    // Add semantically retrieved context
    if (relevantContext.length > 0) {
      attachedContext += '\n\n=== SEMANTICALLY RELEVANT CONTEXT ===\n';
      relevantContext.slice(0, 10).forEach(ctx => {
        attachedContext += `\n[${ctx.type.toUpperCase()}] ${ctx.title} (Relevance: ${(ctx.relevanceScore * 100).toFixed(0)}%)\n`;
        if (ctx.content) {
          const preview = ctx.content.substring(0, 500);
          attachedContext += `${preview}${ctx.content.length > 500 ? '...' : ''}\n`;
        }
      });
    }

    // Add reasoning chain to system understanding
    attachedContext += '\n\n=== REASONING CHAIN ===\n';
    attachedContext += reasoningChain.join('\n');

    // Add memory context
    if (episodicMemory.relevantSessions?.length > 0) {
      attachedContext += '\n\n=== RELEVANT PAST DISCUSSIONS ===\n';
      episodicMemory.relevantSessions.forEach((sess: any) => {
        attachedContext += `- ${sess.title}: ${sess.context_summary || 'No summary'}\n`;
      });
    }

    console.log('[Agentic] Context building complete');

    const userContext = await contextService.getUserContext(userId);
    const systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');

    const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);

    // **TOKEN VALIDATION**: Estimate total token count before sending to Gemini
    let totalEstimatedTokens = 0;

    // Estimate tokens from conversation contents
    for (const content of conversationData.contents) {
      if (content.parts) {
        for (const part of content.parts) {
          if (part.text) {
            totalEstimatedTokens += estimateTokenCount(part.text);
          }
          // Images contribute significantly to token count
          if (part.inlineData) {
            totalEstimatedTokens += 1000; // Rough estimate per image
          }
        }
      }
    }

    // Estimate tokens from system instruction
    if (conversationData.systemInstruction?.parts) {
      for (const part of conversationData.systemInstruction.parts) {
        if (part.text) {
          totalEstimatedTokens += estimateTokenCount(part.text);
        }
      }
    }

    // Check if exceeding token limit
    const MAX_SAFE_INPUT_TOKENS = ENHANCED_PROCESSING_CONFIG.MAX_INPUT_TOKENS * 0.9; // 90% of max for safety

    if (totalEstimatedTokens > MAX_SAFE_INPUT_TOKENS) {
      console.error(`[TokenValidation] Estimated tokens (${totalEstimatedTokens}) exceeds safe limit (${MAX_SAFE_INPUT_TOKENS})`);
      return new Response(JSON.stringify({
        error: 'Content too large to process',
        details: `The total content (message + attachments + context) is too large. Estimated: ${totalEstimatedTokens} tokens, Maximum: ${Math.floor(MAX_SAFE_INPUT_TOKENS)} tokens. Please reduce the number of attachments or message length.`,
        estimatedTokens: totalEstimatedTokens,
        maxTokens: Math.floor(MAX_SAFE_INPUT_TOKENS)
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    console.log(`[TokenValidation] Estimated input tokens: ${totalEstimatedTokens} (within safe limit: ${MAX_SAFE_INPUT_TOKENS})`);

    if (message || hasFiles || attachedContext) {
      const userMessageData = {
        userId,
        sessionId,
        content: message,
        role: 'user',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        imageUrl: userMessageImageUrl || imageUrl,
        imageMimeType: userMessageImageMimeType || imageMimeType,
        conversationContext: {
          totalMessages: conversationData.contextInfo.totalMessages,
          recentMessages: conversationData.contextInfo.recentMessages?.length || 0,
          summarizedMessages: conversationData.contextInfo.summarizedMessages || 0,
          hasSummary: !!conversationData.contextInfo.conversationSummary,
          crossSessionContext: conversationData.contextInfo.crossSessionContext?.length || 0
        },
        filesMetadata: filesMetadata.length > 0 ? filesMetadata : null
      };

      const savedUserMessage = await saveChatMessage(userMessageData);
      if (savedUserMessage) {
        userMessageId = savedUserMessage.id;
        userMessageTimestamp = savedUserMessage.timestamp;
        if (message) {
          await updateSessionTokenCount(sessionId, userId, message, 'add');
        }
      }
    }

    if (aiMessageIdToUpdate) {
      await supabase
        .from('chat_messages')
        .update({
          is_updating: true,
          is_error: false
        })
        .eq('id', aiMessageIdToUpdate)
        .eq('session_id', sessionId)
        .eq('user_id', userId);
    }

    console.log('🤖 Calling Gemini API for Final Response...');

    const finalResponse = await callEnhancedGeminiAPI(conversationData.contents, geminiApiKey, {
      systemInstruction: conversationData.systemInstruction,
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192
    }, aiModelConfig.modelChain);

    let generatedText = '';
    let apiCallSuccess = false;

    if (!finalResponse.success || !finalResponse.content) {
      generatedText = finalResponse.userMessage || finalResponse.error || `I apologize, but I wasn't able to generate a response at this time. Your message has been saved, and you can try asking again.`;
      apiCallSuccess = false;
    } else {
      generatedText = finalResponse.content;
      apiCallSuccess = true;
    }

    // ========== AGENTIC VERIFICATION PHASE ==========
    if (apiCallSuccess && generatedText) {
      console.log('[Agentic] Verifying response quality...');
      const verification = await agenticCore.verifyResponse(generatedText, userIntent, relevantContext);
      console.log(`[Agentic] Response confidence: ${(verification.confidence * 100).toFixed(1)}%`);

      if (verification.issues.length > 0) {
        console.warn(`[Agentic] Issues detected: ${verification.issues.join(', ')}`);

        // If confidence is too low, add clarification
        if (verification.confidence < 0.5) {
          generatedText += '\n\n_Note: I may not have all the information needed for a complete answer. Please let me know if you need clarification._';
        }
      }

      // If we identified missing information during understanding, ask for it
      if (userIntent.confidence < 0.7 && userIntent.entities.some(e => !e.resolvedId)) {
        const unresolvedEntities = userIntent.entities.filter(e => !e.resolvedId);
        generatedText += `\n\n_I noticed you mentioned: ${unresolvedEntities.map(e => e.value).join(', ')}. Could you clarify which specific ${unresolvedEntities[0].type} you're referring to?_`;
      }
    }

    console.log(`[Main] Checking for actions in AI response...`);
    const actionResult = await executeAIActions(userId, sessionId, generatedText);
    generatedText = actionResult.modifiedResponse;

    // Ensure final assistant text does not contain any leftover action blocks
    generatedText = sanitizeAssistantOutput(generatedText);

    // Extract images from successfully executed GENERATE_IMAGE actions (non-streaming path)
    const nonStreamImages: Array<{ url: string; alt?: string }> = [];
    for (const ea of actionResult.executedActions) {
      if (ea.type === 'GENERATE_IMAGE' && ea.success && ea.data) {
        const imgUrl = ea.data.imageUrl || ea.data.image_url || ea.data.url;
        if (imgUrl) {
          nonStreamImages.push({ url: imgUrl, alt: ea.data.prompt || ea.data.message || 'Generated image' });
          console.log(`[ImageExtraction][NonStream] Added image from GENERATE_IMAGE action: ${imgUrl}`);
        }
      }
    }

    // Append image markdown to response if images exist but aren't referenced
    if (nonStreamImages.length > 0) {
      const hasImageRef = nonStreamImages.some(img => generatedText.includes(img.url));
      if (!hasImageRef) {
        const imageMd = nonStreamImages.map(img => `\n\n![${(img.alt || 'Generated image').replace(/[[\]()]/g, '')}](${img.url})`).join('');
        generatedText = generatedText.trimEnd() + imageMd;
        console.log(`[ImageExtraction][NonStream] Appended ${nonStreamImages.length} image(s) as markdown to response`);
      }
    }


    if (apiCallSuccess && generatedText) {
      try {
        const extractedFacts = await extractUserFacts(message, generatedText, userId, sessionId);
        if (extractedFacts.length > 0) {
          await contextService.updateUserMemory(userId, extractedFacts);
        }
      } catch (factError) {
        console.error('Error extracting user facts:', factError);
        logSystemError(supabase, {
          severity: 'info',
          source: 'gemini-chat',
          component: 'user-facts',
          error_code: 'USER_FACTS_EXTRACTION_FAILED',
          message: `User facts extraction failed: ${String(factError)}`,
          details: { error: String(factError) },
          user_id: userId,
        });
      }
    }

    // Get current session title for response
    let aiGeneratedTitle = 'New Chat Session';
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (existingSession?.title) {
      aiGeneratedTitle = existingSession.title;
    }

    const assistantMessageData = {
      userId,
      sessionId,
      content: generatedText,
      role: 'assistant',
      attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
      attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
      imageUrl: nonStreamImages.length > 0 ? nonStreamImages[0].url : (userMessageImageUrl || imageUrl),
      imageMimeType: nonStreamImages.length > 0 ? (nonStreamImages[0].url.endsWith('.png') ? 'image/png' : 'image/jpeg') : (userMessageImageMimeType || imageMimeType),
      filesMetadata: nonStreamImages.length > 0 ? nonStreamImages.map(img => ({ type: 'image', url: img.url, alt: img.alt })) : null,
      isError: !apiCallSuccess,
      conversationContext: {
        totalMessages: (conversationData.contextInfo?.totalMessages || 0) + 1,
        recentMessages: conversationData.contextInfo?.recentMessages?.length || 0,
        summarizedMessages: conversationData.contextInfo?.summarizedMessages || 0,
        hasSummary: !!conversationData.contextInfo?.conversationSummary
      }
    };

    if (aiMessageIdToUpdate) {
      await supabase
        .from('chat_messages')
        .update({
          content: generatedText,
          is_updating: false,
          is_error: !apiCallSuccess,
          conversation_context: assistantMessageData.conversationContext
        })
        .eq('id', aiMessageIdToUpdate)
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      aiMessageId = aiMessageIdToUpdate;
      aiMessageTimestamp = new Date().toISOString();
    } else {
      const savedAiMessage = await saveChatMessage(assistantMessageData);
      if (savedAiMessage) {
        aiMessageId = savedAiMessage.id;
        aiMessageTimestamp = savedAiMessage.timestamp;
        console.log(`[gemini-chat] Saved AI message with ID: ${aiMessageId}`);
      }
    }

    if (generatedText) {
      await updateSessionTokenCount(sessionId, userId, generatedText, 'add');
    }

    const summaryToSave = conversationData.contextInfo?.conversationSummary || null;
    await updateSessionLastMessage(sessionId, summaryToSave, aiGeneratedTitle);

    if (conversationData.contextInfo?.recentMessages &&
      conversationData.contextInfo.recentMessages.length >= ENHANCED_PROCESSING_CONFIG.SUMMARY_THRESHOLD) {
      updateConversationSummary(sessionId, userId, conversationData.contextInfo.recentMessages)
        .catch((err) => console.error('Summary update failed:', err));
    }

    const processingTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      response: generatedText,
      userId,
      sessionId,
      title: aiGeneratedTitle,
      timestamp: new Date().toISOString(),
      userMessageId,
      userMessageTimestamp,
      aiMessageId,
      aiMessageTimestamp,
      processingTime,
      filesProcessed: hasFiles ? rawFiles.length || jsonFiles.length : 0,
      documentIds: allDocumentIds,
      contextInfo: {
        totalMessages: conversationData.contextInfo?.totalMessages || 0,
        recentMessages: conversationData.contextInfo?.recentMessages?.length || 0,
        relevantOlderMessages: conversationData.contextInfo?.relevantOlderMessages?.length || 0,
        summarizedMessages: conversationData.contextInfo?.summarizedMessages || 0,
        hasSummary: !!conversationData.contextInfo?.conversationSummary,
        crossSessionReferences: conversationData.contextInfo?.crossSessionContext?.length || 0,
        userMemoryUsed: userContext.userMemory?.length || 0
      },
      processingResults,
      success: apiCallSuccess,
      modelUsed: finalResponse.modelUsed || aiModelConfig.modelChain[0],
      modelLabel: aiModelConfig.displayLabel,
      modelTier: aiModelConfig.tier,
      executedActions: actionResult.executedActions.map((a: any) => ({
        type: a.type,
        success: a.success,
        timestamp: a.timestamp
      })),
      images: nonStreamImages.length > 0 ? nonStreamImages : null,
      imageUrl: nonStreamImages.length > 0 ? nonStreamImages[0].url : undefined,
      files_metadata: nonStreamImages.length > 0 ? JSON.stringify(nonStreamImages) : undefined
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    const hasFiles = rawFiles.length > 0 || jsonFiles.length > 0;
    const processingTime = Date.now() - startTime;
    console.error('Error in ai-chat function:', error);

    logSystemError(supabase, {
      severity: 'critical',
      source: 'gemini-chat',
      component: 'main-handler',
      error_code: 'CHAT_REQUEST_FAILED',
      message: `AI chat request failed: ${error.message || String(error)}`,
      details: { stack: error.stack, processingTime, hasFiles, sessionId: requestData?.sessionId },
      user_id: requestData?.userId,
    });

    let userFriendlyMessage = 'I apologize, but I encountered an unexpected error while processing your request. Please try again.';

    if (error.message?.includes('GEMINI_API_KEY')) {
      userFriendlyMessage = 'The AI service is not properly configured. Please contact support.';
    } else if (error.message?.includes('FILE_PROCESSOR')) {
      userFriendlyMessage = 'I had trouble processing your files. Please try uploading them again.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userFriendlyMessage = 'I\'m having trouble connecting to the AI service. Please check your internet connection and try again.';
    } else if (error.message?.includes('timeout')) {
      userFriendlyMessage = 'The request took too long to process. Please try again with a shorter message or fewer files.';
    }

    if (requestData?.userId && requestData?.sessionId) {
      try {
        await saveChatMessage({
          userId: requestData.userId,
          sessionId: requestData.sessionId,
          content: userFriendlyMessage,
          role: 'assistant',
          isError: true,
          attachedDocumentIds: uploadedDocumentIds.length > 0 ? uploadedDocumentIds : null,
          attachedNoteIds: requestData.attachedNoteIds?.length > 0 ? requestData.attachedNoteIds : null,
          imageUrl: userMessageImageUrl || requestData.imageUrl,
          imageMimeType: userMessageImageMimeType || requestData.imageMimeType
        });
      } catch (dbError) {
        console.error('Failed to save error message to database:', dbError);
      }
    }

    return new Response(JSON.stringify({
      error: userFriendlyMessage,
      errorDetails: error.message || 'Internal Server Error',
      processingTime,
      filesProcessed: hasFiles ? rawFiles.length || jsonFiles.length : 0,
      success: false
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});