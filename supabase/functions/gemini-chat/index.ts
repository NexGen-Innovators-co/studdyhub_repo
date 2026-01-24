/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { UserContextService } from './context-service.ts';
import { EnhancedPromptEngine } from './prompt-engine.ts';
import { StuddyHubActionsService } from './actions-service.ts';
import { AgenticCore, type UserIntent, type EntityMention } from './agentic-core.ts';
import { createStreamResponse, StreamingHandler } from './streaming-handler.ts';
import { createSubscriptionValidator, createErrorResponse } from '../utils/subscription-validator.ts';
import { executeParsedActions, runAction, AI_ACTION_SCHEMA, getFriendlyActionLabel } from './actions_helper.ts';
import { DB_SCHEMA_DEFINITION } from './db_schema.ts';

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
  CONTEXT_MEMORY_WINDOW: 100,  // Increased for better context
  SUMMARY_THRESHOLD: 30,  // Balanced summarization
  CONTEXT_RELEVANCE_SCORE: 0.6,
  RETRY_ATTEMPTS: 3,  // More retries for reliability
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 5000,
  EXPONENTIAL_BACKOFF_MULTIPLIER: 2,
  RELEVANCE_SCORING_ENABLED: true,  // Enable for better context
  RELEVANCE_TOP_K: 10,  // More relevant items
  RELEVANCE_SIMILARITY_THRESHOLD: 0.7,
  RELEVANCE_DECAY_FACTOR: 0.95
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
  initialContextWindow: number = ENHANCED_PROCESSING_CONFIG.CONTEXT_MEMORY_WINDOW
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

async function callEnhancedGeminiAPI(contents: any[], geminiApiKey: string, configOverrides: any = {}): Promise<{
  success: boolean;
  content?: string;
  error?: string;
  userMessage?: string;
}> {
  // 1. Define the Fallback Chain (Priority Order)
  const MODEL_CHAIN = [
    'gemini-2.5-flash',
    'gemini-3-pro-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-pro',
    'gemini-1.5-pro',
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
          return { success: true, content: extractedContent };
        } else {
          console.warn(`[GeminiAPI] Model ${currentModel} returned no content.`);
        }
      } else {
        const errorText = await response.text();
        const status = response.status;
        console.error(`[GeminiAPI] Error ${status} with ${currentModel}: ${errorText.substring(0, 200)}...`);

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
      if (attempt < ENHANCED_PROCESSING_CONFIG.RETRY_ATTEMPTS - 1) {
        await sleep(1000);
      }
    }
  }

  return {
    success: false,
    error: 'ALL_MODELS_FAILED',
    userMessage: 'I am currently experiencing heavy load across all AI services. Please try again in a minute.'
  };
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
  aiMessageIdToUpdate: string | null
): Promise<Response> {
  const { stream, handler } = createStreamResponse();

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
      const systemPrompt = promptEngine.createEnhancedSystemPrompt(learningStyle, learningPreferences, userContext, 'light');
      const conversationData = await buildEnhancedGeminiConversation(userId, sessionId, message, [], attachedContext, systemPrompt);
      console.log('✅ Prompt built with', conversationData.contents.length, 'conversation parts');

      // =========================================================================
      // STEP 5: ACTION PLANNING (JSON)
      // =========================================================================
      console.log('⚙️ Starting Action Planning phase...');
      handler.sendThinkingStep(
        'action',
        'Planning actions',
        'Determining necessary operations based on your request...',
        'in-progress'
      );

      const actionSystemPrompt = `${systemPrompt}

You are an AI assistant that manages database operations and creative tools.
Analyze the user's request and the conversation context.

YOUR GOAL: Return a JSON object with the necessary actions.

CRITICAL RULES:
- Return JSON ONLY. No markdown, no extraneous text.
- The output must be a valid JSON object with a "thought_process" string and an "actions" array.
- When referring to the current user id, use the literal string "auth.uid" in the JSON; the runtime will replace it.
- For destructive operations (UPDATE/DELETE) ask for a short confirmation if the intent is ambiguous.
- For ambiguous scheduling details (time zone, start/end, recurrence), ask a clarifying question instead of guessing.

Note: The full DB action guidelines, scheduling guidance, and social-post guidance are included above in the system prompt; follow them precisely (use \`author_id\`, link media by \`post_id\`, prefer inline \`media\` in \`social_posts\`, etc.).`;
      // Copy contents for action planning
      const actionContents = [...conversationData.contents];
      actionContents.push({
        role: 'user',
        parts: [{ text: "Determine the actions to take. Return JSON only." }]
      });

      console.log('🤖 Calling Gemini API for Action Plan...');
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

      let executedActions: any[] = [];
      let finalResponseContext = attachedContext;

      try {
        const actionResponse = await callEnhancedGeminiAPI(actionContents, geminiApiKey, {
          responseMimeType: "application/json",
          systemInstruction: { parts: [{ text: actionSystemPrompt }] }
        });

        if (actionResponse.success && actionResponse.content) {
          try {
            console.log('📥 Parsing Action Plan JSON:', actionResponse.content);
            const parsed = JSON.parse(actionResponse.content);

            // Accept multiple plan shapes:
            // 1) Full plan: { thought_process: '', actions: [...] }
            // 2) Single action object: { type: 'DB_ACTION', params: {...} }
            // 3) Array of actions: [ {..}, {..} ]
            let actionsToExecute: any[] = [];
            if (Array.isArray(parsed)) {
              actionsToExecute = parsed;
            } else if (parsed && Array.isArray(parsed.actions)) {
              actionsToExecute = parsed.actions;
            } else if (parsed && parsed.type) {
              actionsToExecute = [parsed];
            }

            if (actionsToExecute.length > 0) {
              executedActions = await executeParsedActions(
                actionsService,
                userId,
                sessionId,
                actionsToExecute,
                (action, index, total) => {
                  const actionLabel = getFriendlyActionLabel(action.type, action.params);
                  handler.sendThinkingStep(
                    'action',
                    `Action ${index + 1}/${total}`,
                    `${actionLabel}...`,
                    'in-progress',
                    { action, index, total }
                  );
                }
              );

              finalResponseContext += '\n\n=== EXECUTED ACTIONS RESULTS ===\n';
              finalResponseContext += JSON.stringify(executedActions, null, 2);

              handler.sendThinkingStep(
                'action',
                'Actions executed',
                `Successfully executed ${executedActions.filter(a => a.success).length} out of ${executedActions.length} actions.`,
                'completed'
              );
            } else {
              console.log('No actions planned.');
              handler.sendThinkingStep(
                'action',
                'No actions needed',
                'Proceeding to response...',
                'completed',
                { actionCount: 0 }
              );
            }
          } catch (parseError: any) {
            console.error('Failed to parse action plan:', parseError);
            handler.sendThinkingStep('action', 'Action Planning Warning', 'Could not parse action plan, continuing...', 'completed');
            // Continue to response generation even if action parsing fails
          }
        } else {
          console.warn('Action planning API call failed or returned empty, continuing to response...');
          handler.sendThinkingStep('action', 'Action Planning Skipped', 'Proceeding to response generation...', 'completed');
        }
      } catch (actionError: any) {
        console.error('Error during action planning:', actionError);
        // Don't fail the entire request - continue to response generation
        handler.sendThinkingStep('action', 'Action Planning Error', 'Continuing to response generation...', 'completed');
      }

      // =========================================================================
      // STEP 6: FINAL RESPONSE GENERATION (Text)
      // =========================================================================
      console.log('🏁 Generating Final Response...');

      const finalContents = [...conversationData.contents];
      if (executedActions.length > 0) {
        finalContents.push({
          role: 'user',
          // 👇 UPDATED TEXT INSTRUCTION 👇
          parts: [{ text: `System Update: The following actions were executed successfully.
          
          Results: ${JSON.stringify(executedActions)}
          
          CRITICAL INSTRUCTION FOR FINAL RESPONSE:
          1. The actions are DONE. Do NOT output any JSON, "DB_ACTION", or code blocks.
          2. Just confirm to the user naturally (e.g., "I've added the image to your note.").
          3. Keep the response concise.` }]
        });
      }

      console.log('🤖 Calling Gemini API for Final Response...');

      const finalResponse = await callEnhancedGeminiAPI(finalContents, geminiApiKey, {
        systemInstruction: conversationData.systemInstruction
      });

      if (!finalResponse.success || !finalResponse.content) {
        throw new Error('Failed to generate final response');
      }

      let generatedText = finalResponse.content;
      console.log('✅ Generated response:', generatedText.length, 'characters');

      // ========== FALLBACK: LEGACY ACTION DETECTION ==========
      // Some models might revert to legacy ACTION: markers instead of using the JSON plan.
      // We check the final response for these markers and execute them as a fallback.
      console.log('[ActionExecution] Checking for legacy ACTION: markers in final response...');
      const fallbackResult = await executeAIActions(userId, sessionId, generatedText);

      if (fallbackResult.executedActions.length > 0) {
        console.log(`[ActionExecution] Found and executed ${fallbackResult.executedActions.length} legacy actions.`);

        // Add to the main executed actions list
        executedActions = [...executedActions, ...fallbackResult.executedActions];

        // Update generated text to strip the markers
        generatedText = fallbackResult.modifiedResponse;

        handler.sendThinkingStep(
          'action',
          'Legacy actions processed',
          `Executed ${fallbackResult.executedActions.length} additional actions found in response text.`,
          'completed'
        );
      }

      handler.sendThinkingStep(
        'action',
        'Response generated',
        'Successfully generated response',
        'completed'
      );
      console.log('✅ Action phase complete');

      console.log('✅ Actions executed (summary):', executedActions.length, 'actions');

      // Save AI message
      console.log('💾 Saving AI message...');
      const aiMessageData = {
        userId,
        sessionId,
        content: generatedText,
        role: 'assistant',
        attachedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : null,
        attachedNoteIds: attachedNoteIds.length > 0 ? attachedNoteIds : null,
        isError: false
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

      // Send final response
      console.log('🏁 Sending final response...');
      handler.sendDone({
        response: generatedText,
        aiMessageId: savedAiMessage?.id,
        aiMessageTimestamp: savedAiMessage?.timestamp,
        userMessageId,
        userMessageTimestamp,
        sessionId,
        userId,
        executedActions: executedActions
      });
      console.log('✅ Final response sent, closing stream');

      handler.close();
      console.log('✅✅✅ Streaming response completed successfully! ✅✅✅');
    } catch (error: any) {
      console.error('❌ FATAL ERROR in streaming handler:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      handler.sendError(error.message || 'An error occurred');
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
    let attachedContext = '';
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
        aiMessageIdToUpdate
      );
    }

    // ========== AGENTIC UNDERSTANDING PHASE ==========
    console.log('[Agentic] Starting advanced query understanding...');

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
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    });

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


    if (apiCallSuccess && generatedText) {
      try {
        const extractedFacts = await extractUserFacts(message, generatedText, userId, sessionId);
        if (extractedFacts.length > 0) {
          await contextService.updateUserMemory(userId, extractedFacts);
        }
      } catch (factError) {
        console.error('Error extracting user facts:', factError);
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
      imageUrl: userMessageImageUrl || imageUrl,
      imageMimeType: userMessageImageMimeType || imageMimeType,
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
      executedActions: actionResult.executedActions.map((a: any) => ({
        type: a.type,
        success: a.success,
        timestamp: a.timestamp
      }))
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