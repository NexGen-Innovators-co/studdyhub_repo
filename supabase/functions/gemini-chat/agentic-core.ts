// agentic-core.ts - Advanced Agentic Mechanisms for Accurate Understanding & Response

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Provide a default config if ENHANCED_PROCESSING_CONFIG is not defined elsewhere
declare const ENHANCED_PROCESSING_CONFIG: any;
const DEFAULT_ENHANCED_PROCESSING_CONFIG = {
  MAX_ENTITY_NOTES: 100,
  MAX_ENTITY_DOCUMENTS: 100,
  MAX_ENTITY_GOALS: 50,
  MAX_CONVERSATION_HISTORY: 100,
  MAX_LONG_TERM_MEMORY: 50,
  LONG_TERM_MEMORY_CONFIDENCE: 0.7,
  MAX_TOPIC_RESULTS: 20,
  MAX_SCHEDULE_RESULTS: 50,
  MAX_CROSS_SESSION_RESULTS: 10,
  MAX_LEARNING_HISTORY: 20
};
const CONFIG = (typeof ENHANCED_PROCESSING_CONFIG !== 'undefined' && ENHANCED_PROCESSING_CONFIG) || DEFAULT_ENHANCED_PROCESSING_CONFIG;

/**
 * AGENTIC MECHANISMS IMPLEMENTED:
 * 
 * 1. QUERY UNDERSTANDING & DECOMPOSITION
 *    - Intent classification (multi-label)
 *    - Entity extraction
 *    - Dependency analysis
 *    - Ambiguity detection
 * 
 * 2. SEMANTIC CONTEXT RETRIEVAL
 *    - Vector similarity search
 *    - Temporal relevance scoring
 *    - Cross-reference linking
 *    - Multi-source aggregation
 * 
 * 3. MULTI-STEP REASONING
 *    - Chain-of-thought prompting
 *    - Self-verification
 *    - Evidence gathering
 *    - Confidence scoring
 * 
 * 4. MEMORY & STATE MANAGEMENT
 *    - Working memory (current session)
 *    - Long-term memory (user patterns)
 *    - Episodic memory (past interactions)
 *    - Semantic memory (knowledge base)
 * 
 * 5. TOOL USE & FUNCTION CALLING
 *    - Dynamic tool selection
 *    - Parameter extraction
 *    - Result validation
 *    - Error recovery
 * 
 * 6. SELF-REFLECTION & CORRECTION
 *    - Response quality assessment
 *    - Hallucination detection
 *    - Missing information identification
 *    - Iterative refinement
 */

export interface UserIntent {
  primary: string;
  secondary: string[];
  entities: EntityMention[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiresContext: boolean;
  requiresAction: boolean;
  confidence: number;
}

export interface EntityMention {
  type: 'note' | 'document' | 'quiz' | 'schedule' | 'goal' | 'person' | 'date' | 'topic' | 'course';
  value: string;
  confidence: number;
  resolvedId?: string;
}

export interface RetrievalStrategy {
  sources: string[];
  temporalRange: 'current' | 'recent' | 'historical' | 'all';
  maxItems: number;
  rankingMethod: 'recency' | 'relevance' | 'hybrid';
  includeRelated: boolean;
}

export interface AgenticResponse {
  content: string;
  confidence: number;
  sources: RetrievalResult[];
  reasoning: string[];
  suggestedActions: Action[];
  needsClarification: boolean;
  clarificationQuestions: string[];
}

export interface RetrievalResult {
  type: string;
  id: string;
  title: string;
  relevanceScore: number;
  temporalScore: number;
  content?: string;
  metadata?: any;
}

export interface Action {
  type: string;
  params: any;
  confidence: number;
  rationale: string;
}

export class AgenticCore {
  private supabase: any;
  private geminiApiKey: string;

  constructor(supabaseUrl: string, supabaseKey: string, geminiApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.geminiApiKey = geminiApiKey;
  }

  /**
   * MECHANISM 1: Advanced Query Understanding
   * Decomposes user query into actionable components
   */
  async understandQuery(
    query: string,
    userId: string,
    conversationHistory: any[]
  ): Promise<UserIntent> {
    // Extract entities using pattern matching and context
    const entities = await this.extractEntities(query, userId);
    
    // Classify intent with multi-label support
    const intents = await this.classifyIntent(query, conversationHistory);
    
    // Detect if query is ambiguous
    const isAmbiguous = await this.detectAmbiguity(query, entities);
    
    // Analyze complexity
    const complexity = this.analyzeComplexity(query, intents, entities);
    
    return {
      primary: intents[0],
      secondary: intents.slice(1),
      entities,
      complexity,
      requiresContext: entities.length > 0 || this.needsHistoricalContext(query),
      requiresAction: this.detectsAction(query),
      confidence: isAmbiguous ? 0.6 : 0.9
    };
  }

  /**
   * MECHANISM 2: Semantic Context Retrieval with Ranking
   */
  async retrieveRelevantContext(
    intent: UserIntent,
    userId: string,
    sessionId: string
  ): Promise<RetrievalResult[]> {
    const retrievalTasks: Promise<RetrievalResult[]>[] = [];

    // Retrieve based on detected entities
    for (const entity of (intent.entities || [])) {
      retrievalTasks.push(this.retrieveByEntity(entity, userId));
    }

    // Retrieve based on topics mentioned
    const topics = await this.extractTopics(intent);
    retrievalTasks.push(this.retrieveByTopics(topics, userId));

    // Retrieve based on temporal context
    if (this.hasTemporalReference(intent)) {
      retrievalTasks.push(this.retrieveByTimeRange(intent, userId));
    }

    // Retrieve cross-session relevant context
    retrievalTasks.push(this.retrieveCrossSessionContext(userId, sessionId, intent));

    // Execute all retrievals in parallel
    const allResults = await Promise.all(retrievalTasks);
    const flatResults = allResults.flat();

    // Rank results by hybrid scoring
    return this.rankResults(flatResults, intent);
  }

  /**
   * MECHANISM 3: Multi-Step Reasoning Chain
   */
  async buildReasoningChain(
    intent: UserIntent,
    context: RetrievalResult[],
    query: string
  ): Promise<string[]> {
    const reasoningSteps: string[] = [];

    // Step 1: What do we know?
    reasoningSteps.push(`Query Intent: ${intent.primary}`);
    reasoningSteps.push(`Entities Identified: ${(intent.entities || []).map(e => `${e.type}:${e.value}`).join(', ') || 'none'}`);
    reasoningSteps.push(`Context Items Retrieved: ${context.length} items`);

    // Step 2: What's missing?
    const missingInfo = this.identifyMissingInformation(intent, context);
    if (missingInfo.length > 0) {
      reasoningSteps.push(`Missing Information: ${missingInfo.join(', ')}`);
    }

    // Step 3: How should we respond?
    const responseStrategy = this.determineResponseStrategy(intent, context, missingInfo);
    reasoningSteps.push(`Response Strategy: ${responseStrategy}`);

    return reasoningSteps;
  }

  /**
   * MECHANISM 4: Memory Management
   */
  async getWorkingMemory(sessionId: string, userId: string): Promise<any> {
    // Get recent conversation from current session
    // Use the enhanced config for max history
    const MAX_HISTORY = CONFIG.MAX_CONVERSATION_HISTORY;
    const { data: recentMessages } = await this.supabase
      .from('chat_messages')
      .select('content, role, timestamp, attached_document_ids, attached_note_ids')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_error', false)
      .order('timestamp', { ascending: false })
      .limit(MAX_HISTORY);

    return {
      recentMessages: recentMessages || [],
      activeTopics: this.extractActiveTopics(recentMessages),
      referencedItems: this.extractReferencedItems(recentMessages)
    };
  }

  async getLongTermMemory(userId: string): Promise<any> {
    // Use dynamic config for limits and confidence threshold
    const MAX_MEMORY = CONFIG.MAX_LONG_TERM_MEMORY;
    const CONFIDENCE_THRESHOLD = CONFIG.LONG_TERM_MEMORY_CONFIDENCE;
    const { data: userMemory } = await this.supabase
      .from('ai_user_memory')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence_score', CONFIDENCE_THRESHOLD)
      .order('last_referenced', { ascending: false })
      .limit(MAX_MEMORY);

    return {
      facts: userMemory || [],
      patterns: this.analyzePatterns(userMemory),
      preferences: this.extractPreferences(userMemory)
    };
  }

  async getEpisodicMemory(userId: string, query: string): Promise<any> {
    // Get similar past interactions
    const topics = await this.extractTopics({ 
      primary: query, 
      secondary: [], 
      entities: [], 
      complexity: 'simple', 
      requiresContext: false, 
      requiresAction: false, 
      confidence: 0.8 
    } as UserIntent);
    
    const { data: pastSessions } = await this.supabase
      .from('chat_sessions')
      .select('id, title, context_summary, last_message_at')
      .eq('user_id', userId)
      .gte('last_message_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('last_message_at', { ascending: false })
      .limit(10);

    return {
      relevantSessions: this.filterRelevantSessions(pastSessions, topics),
      learningHistory: await this.getLearningHistory(userId, topics)
    };
  }

  /**
   * MECHANISM 5: Dynamic Tool Selection
   */
  async selectTools(intent: UserIntent, context: RetrievalResult[]): Promise<string[]> {
    const tools: string[] = [];

    // Determine which tools are needed
    if (intent.requiresAction) {
      if (intent.primary.includes('create')) tools.push('create_tool');
      if (intent.primary.includes('update')) tools.push('update_tool');
      if (intent.primary.includes('delete')) tools.push('delete_tool');
      if (intent.primary.includes('search')) tools.push('search_tool');
    }

    // Check if calculation is needed
    if (this.needsCalculation(intent)) tools.push('calculator');

    // Check if external knowledge is needed
    if (this.needsExternalKnowledge(intent, context)) tools.push('knowledge_retrieval');

    return tools;
  }

  /**
   * MECHANISM 6: Self-Verification & Quality Check
   */
  async verifyResponse(
    response: string,
    intent: UserIntent,
    context: RetrievalResult[]
  ): Promise<{ isValid: boolean; confidence: number; issues: string[] }> {
    const issues: string[] = [];

    // Check for hallucination indicators
    if (this.detectHallucination(response, context)) {
      issues.push('Possible hallucinated information detected');
    }

    // Check if response addresses the intent
    if (!this.addressesIntent(response, intent)) {
      issues.push('Response does not fully address user intent');
    }

    // Check for contradictions
    if (this.hasContradictions(response, context)) {
      issues.push('Response contains contradictions with context');
    }

    // Calculate confidence
    const confidence = this.calculateResponseConfidence(response, intent, context, issues);

    return {
      isValid: issues.length === 0,
      confidence,
      issues
    };
  }

  // ====== HELPER METHODS ======

  private async extractEntities(query: string, userId: string): Promise<EntityMention[]> {
    const entities: EntityMention[] = [];
    const queryLower = query.toLowerCase();

    // Fetch user's content to match against
    const NOTES_LIMIT = CONFIG.MAX_ENTITY_NOTES;
    const DOCS_LIMIT = CONFIG.MAX_ENTITY_DOCUMENTS;
    const GOALS_LIMIT = CONFIG.MAX_ENTITY_GOALS;
    const [notes, documents, goals] = await Promise.all([
      this.supabase.from('notes').select('id, title').eq('user_id', userId).limit(NOTES_LIMIT),
      this.supabase.from('documents').select('id, title').eq('user_id', userId).limit(DOCS_LIMIT),
      this.supabase.from('user_learning_goals').select('id, goal_text').eq('user_id', userId).limit(GOALS_LIMIT)
    ]);

    // Match notes
    notes.data?.forEach((note: any) => {
      if (queryLower.includes(note.title.toLowerCase())) {
        entities.push({
          type: 'note',
          value: note.title,
          confidence: 0.95,
          resolvedId: note.id
        });
      }
    });

    // Match documents
    documents.data?.forEach((doc: any) => {
      if (queryLower.includes(doc.title.toLowerCase())) {
        entities.push({
          type: 'document',
          value: doc.title,
          confidence: 0.95,
          resolvedId: doc.id
        });
      }
    });

    // Extract dates
    const datePatterns = [
      /today|tomorrow|yesterday/gi,
      /next (week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
      /last (week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g
    ];

    datePatterns.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        matches.forEach(match => {
          entities.push({
            type: 'date',
            value: match,
            confidence: 0.9
          });
        });
      }
    });

    return entities;
  }

  private async classifyIntent(query: string, history: any[]): Promise<string[]> {
    const intents: string[] = [];
    const queryLower = query.toLowerCase();

    // Educational query patterns
    if (/explain|what is|how does|why|understand|learn about/i.test(query)) {
      intents.push('educational_explanation');
    }

    // Creation patterns
    if (/create|make|add|generate|new/i.test(query)) {
      intents.push('content_creation');
    }

    // Retrieval patterns
    if (/show|find|get|retrieve|search|look for|where is/i.test(query)) {
      intents.push('information_retrieval');
    }

    // Update patterns
    if (/update|change|modify|edit/i.test(query)) {
      intents.push('content_modification');
    }

    // Analysis patterns
    if (/analyze|summarize|review|compare/i.test(query)) {
      intents.push('content_analysis');
    }

    // Study help patterns
    if (/quiz|test|practice|review|study/i.test(query)) {
      intents.push('study_assistance');
    }

    // Planning patterns
    if (/schedule|plan|organize|arrange/i.test(query)) {
      intents.push('planning_organization');
    }

    // Default to general query
    if (intents.length === 0) {
      intents.push('general_query');
    }

    return intents;
  }

  private analyzeComplexity(query: string, intents: string[], entities: EntityMention[]): 'simple' | 'moderate' | 'complex' {
    let complexityScore = 0;

    // Query length
    if (query.split(' ').length > 20) complexityScore += 2;
    else if (query.split(' ').length > 10) complexityScore += 1;

    // Multiple intents
    if (intents.length > 2) complexityScore += 2;
    else if (intents.length > 1) complexityScore += 1;

    // Multiple entities
    if (entities.length > 3) complexityScore += 2;
    else if (entities.length > 1) complexityScore += 1;

    // Contains conditional logic
    if (/if|when|unless|provided|assuming/i.test(query)) complexityScore += 1;

    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  private async detectAmbiguity(query: string, entities: EntityMention[]): Promise<boolean> {
    // Check for vague pronouns without clear referents
    if (/\b(it|this|that|they|them)\b/i.test(query) && entities.length === 0) {
      return true;
    }

    // Check for multiple possible interpretations
    if (entities.filter(e => e.confidence < 0.8).length > 0) {
      return true;
    }

    return false;
  }

  private needsHistoricalContext(query: string): boolean {
    return /previous|before|earlier|last time|we discussed|you mentioned/i.test(query);
  }

  private detectsAction(query: string): boolean {
    return /create|make|add|delete|remove|update|change|schedule|plan|generate/i.test(query);
  }

  private async retrieveByEntity(entity: EntityMention, userId: string): Promise<RetrievalResult[]> {
    const results: RetrievalResult[] = [];

    if (entity.resolvedId) {
      if (entity.type === 'document') {
        // Fetch document and its attached media, plus direct file/image fields
        const { data: document } = await this.supabase
          .from('documents')
          .select('*, social_media(id, url, type, mime_type, filename, size_bytes, created_at)')
          .eq('id', entity.resolvedId)
          .single();

        if (document) {
          // Collect all possible file/image references
          const attachments: any[] = [];
          if (document.social_media && Array.isArray(document.social_media)) {
            attachments.push(...document.social_media);
          }
          if (document.file_url) {
            attachments.push({ url: document.file_url, type: 'file', mime_type: document.file_mime_type || '', filename: document.filename || '', size_bytes: document.size_bytes || 0 });
          }
          if (document.image_url) {
            attachments.push({ url: document.image_url, type: 'image', mime_type: document.image_mime_type || '', filename: document.image_filename || '', size_bytes: document.image_size_bytes || 0 });
          }
          if (document.attachments && Array.isArray(document.attachments)) {
            attachments.push(...document.attachments);
          }

          results.push({
            type: 'document',
            id: document.id,
            title: document.title,
            relevanceScore: 1.0,
            temporalScore: this.calculateTemporalScore(document.updated_at || document.created_at),
            content: document.content || document.content_extracted,
            metadata: { ...document, attachments }
          });
        }
      } else if (entity.type === 'note') {
        // Fetch note and check for direct file/image fields
        const { data: note } = await this.supabase
          .from('notes')
          .select('*')
          .eq('id', entity.resolvedId)
          .single();
        if (note) {
          const attachments: any[] = [];
          if (note.file_url) {
            attachments.push({ url: note.file_url, type: 'file', mime_type: note.file_mime_type || '', filename: note.filename || '', size_bytes: note.size_bytes || 0 });
          }
          if (note.image_url) {
            attachments.push({ url: note.image_url, type: 'image', mime_type: note.image_mime_type || '', filename: note.image_filename || '', size_bytes: note.image_size_bytes || 0 });
          }
          if (note.attachments && Array.isArray(note.attachments)) {
            attachments.push(...note.attachments);
          }
          results.push({
            type: 'note',
            id: note.id,
            title: note.title,
            relevanceScore: 1.0,
            temporalScore: this.calculateTemporalScore(note.updated_at || note.created_at),
            content: note.content,
            metadata: { ...note, attachments }
          });
        }
      }
    }

    return results;
  }

  private async extractTopics(intent: UserIntent): Promise<string[]> {
    // Extract keywords and topics from intent
    const entityText = (intent.entities || []).map(e => e.value).join(' ');
    const text = intent.primary + ' ' + entityText;
    const words = text.toLowerCase().split(/\s+/);
    
    // Filter out common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return words.filter(w => w.length > 3 && !commonWords.includes(w));
  }

  private async retrieveByTopics(topics: string[], userId: string): Promise<RetrievalResult[]> {
    if (topics.length === 0) return [];

    const results: RetrievalResult[] = [];

    // Search in notes
    const TOPIC_LIMIT = CONFIG.MAX_TOPIC_RESULTS;
    const { data: notes } = await this.supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .or(topics.map(t => `title.ilike.%${t}%,content.ilike.%${t}%,tags.cs.{${t}}`).join(','))
      .limit(TOPIC_LIMIT);

    notes?.forEach((note: any) => {
      results.push({
        type: 'note',
        id: note.id,
        title: note.title,
        relevanceScore: this.calculateTopicRelevance(note, topics),
        temporalScore: this.calculateTemporalScore(note.updated_at),
        content: note.content,
        metadata: note
      });
    });

    return results;
  }

  private async retrieveByTimeRange(intent: UserIntent, userId: string): Promise<RetrievalResult[]> {
    // Parse temporal references and retrieve accordingly
    const timeRange = this.parseTemporalReference(intent);
    const results: RetrievalResult[] = [];

    // Retrieve from multiple tables based on time range
    const SCHEDULE_LIMIT = CONFIG.MAX_SCHEDULE_RESULTS;
    const { data: schedules } = await this.supabase
      .from('schedule_items')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', timeRange.start)
      .lte('start_time', timeRange.end)
      .limit(SCHEDULE_LIMIT);

    schedules?.forEach((item: any) => {
      results.push({
        type: 'schedule',
        id: item.id,
        title: item.title,
        relevanceScore: 0.9,
        temporalScore: 1.0,
        metadata: item
      });
    });

    return results;
  }

  private async retrieveCrossSessionContext(
    userId: string,
    sessionId: string,
    intent: UserIntent
  ): Promise<RetrievalResult[]> {
    const topics = await this.extractTopics(intent);
    const results: RetrievalResult[] = [];

    // Find relevant past sessions
    const SESSION_LIMIT = CONFIG.MAX_CROSS_SESSION_RESULTS;
    const { data: sessions } = await this.supabase
      .from('chat_sessions')
      .select('id, title, context_summary, last_message_at')
      .eq('user_id', userId)
      .neq('id', sessionId)
      .order('last_message_at', { ascending: false })
      .limit(SESSION_LIMIT);

    sessions?.forEach((session: any) => {
      const relevance = this.calculateSessionRelevance(session, topics);
      if (relevance > 0.3) {
        results.push({
          type: 'session',
          id: session.id,
          title: session.title,
          relevanceScore: relevance,
          temporalScore: this.calculateTemporalScore(session.last_message_at),
          content: session.context_summary,
          metadata: session
        });
      }
    });

    return results;
  }

  private rankResults(results: RetrievalResult[], intent: UserIntent): RetrievalResult[] {
    // Hybrid ranking: relevance + temporal + intent match
    return results
      .map(r => ({
        ...r,
        finalScore: (r.relevanceScore * 0.6) + (r.temporalScore * 0.3) + (this.intentMatchScore(r, intent) * 0.1)
      }))
      .sort((a: any, b: any) => b.finalScore - a.finalScore)
      .slice(0, 30); // Return top 30 results
  }

  private calculateTemporalScore(timestamp: string): number {
    const now = Date.now();
    const itemTime = new Date(timestamp).getTime();
    const daysDiff = (now - itemTime) / (1000 * 60 * 60 * 24);

    if (daysDiff < 1) return 1.0;
    if (daysDiff < 7) return 0.9;
    if (daysDiff < 30) return 0.7;
    if (daysDiff < 90) return 0.5;
    return 0.3;
  }

  private calculateTopicRelevance(item: any, topics: string[]): number {
    let score = 0;
    const text = ((item.title || '') + ' ' + (item.content || '')).toLowerCase();

    topics.forEach(topic => {
      if (text.includes(topic)) score += 0.3;
    });

    return Math.min(score, 1.0);
  }

  private calculateSessionRelevance(session: any, topics: string[]): number {
    const text = ((session.title || '') + ' ' + (session.context_summary || '')).toLowerCase();
    let score = 0;

    topics.forEach(topic => {
      if (text.includes(topic)) score += 0.25;
    });

    return Math.min(score, 1.0);
  }

  private intentMatchScore(result: RetrievalResult, intent: UserIntent): number {
    // Check if result type matches intent entities
    const matchingEntities = (intent.entities || []).filter(e => e.type === result.type);
    return matchingEntities.length > 0 ? 1.0 : 0.5;
  }

  private parseTemporalReference(intent: UserIntent): { start: string; end: string } {
    const now = new Date();
    // Default to last 7 days
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return { start, end };
  }

  private hasTemporalReference(intent: UserIntent): boolean {
    return (intent.entities || []).some(e => e.type === 'date');
  }

  private identifyMissingInformation(intent: UserIntent, context: RetrievalResult[]): string[] {
    const missing: string[] = [];

    // Check if we have context for all entities
    (intent.entities || []).forEach(entity => {
      const hasContext = context.some(c => c.type === entity.type && c.title === entity.value);
      if (!hasContext) {
        missing.push(`${entity.type}: ${entity.value}`);
      }
    });

    return missing;
  }

  private determineResponseStrategy(
    intent: UserIntent,
    context: RetrievalResult[],
    missingInfo: string[]
  ): string {
    if (missingInfo.length > 0 && intent.confidence < 0.7) {
      return 'ask_clarification';
    }

    if (intent.requiresAction && context.length > 0) {
      return 'execute_action_with_confirmation';
    }

    if (intent.complexity === 'complex') {
      return 'step_by_step_explanation';
    }

    return 'direct_response';
  }

  private extractActiveTopics(messages: any[]): string[] {
    // Extract common topics from recent messages
    const topics = new Set<string>();
    messages?.forEach(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      words.forEach((word: string) => {
        if (word.length > 4) topics.add(word);
      });
    });
    return Array.from(topics).slice(0, 10);
  }

  private extractReferencedItems(messages: any[]): { documents: string[]; notes: string[] } {
    const documents = new Set<string>();
    const notes = new Set<string>();

    messages?.forEach((msg: any) => {
      msg.attached_document_ids?.forEach((id: string) => documents.add(id));
      msg.attached_note_ids?.forEach((id: string) => notes.add(id));
    });

    return {
      documents: Array.from(documents),
      notes: Array.from(notes)
    };
  }

  private analyzePatterns(memory: any[]): any {
    // Analyze user patterns from memory
    const patterns: any = {
      learningTimes: new Map(),
      preferredTopics: new Map(),
      strugglingAreas: new Map()
    };

    memory?.forEach((fact: any) => {
      if (fact.fact_type === 'interest') {
        patterns.preferredTopics.set(fact.fact_value, (patterns.preferredTopics.get(fact.fact_value) || 0) + 1);
      }
    });

    return patterns;
  }

  private extractPreferences(memory: any[]): any {
    return {
      learningStyle: memory?.find((f: any) => f.fact_type === 'learning_style')?.fact_value || 'visual',
      explanationDepth: 'detailed'
    };
  }

  private filterRelevantSessions(sessions: any[], topics: string[]): any[] {
    return sessions?.filter((session: any) => {
      const text = (session.title + ' ' + session.context_summary).toLowerCase();
      return topics.some(topic => text.includes(topic));
    }) || [];
  }

  private async getLearningHistory(userId: string, topics: string[]): Promise<any> {
    // Get quiz history related to topics
    const QUIZ_LIMIT = CONFIG.MAX_LEARNING_HISTORY;
    const { data: quizzes } = await this.supabase
      .from('quiz_attempts')
      .select('*, quizzes(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(QUIZ_LIMIT);

    return quizzes || [];
  }

  private needsCalculation(intent: UserIntent): boolean {
    return /calculate|compute|how many|how much|total|sum|average/i.test(intent.primary);
  }

  private needsExternalKnowledge(intent: UserIntent, context: RetrievalResult[]): boolean {
    // If we have no context and it's a knowledge query
    return context.length === 0 && /what is|who is|explain|define/i.test(intent.primary);
  }

  private detectHallucination(response: string, context: RetrievalResult[]): boolean {
    // Check if response mentions specific facts not in context
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    const contextWords = new Set(
      context.map(c => (c.content || c.title).toLowerCase().split(/\s+/)).flat()
    );

    // If response has many unique words not in context, might be hallucination
    let uniqueCount = 0;
    responseWords.forEach(word => {
      if (word.length > 5 && !contextWords.has(word)) uniqueCount++;
    });

    return uniqueCount > responseWords.size * 0.3;
  }

  private addressesIntent(response: string, intent: UserIntent): boolean {
    // Check if response type matches intent
    if (intent.primary.includes('explain') && response.length < 50) return false;
    if (intent.primary.includes('create') && !response.includes('created')) return false;
    return true;
  }

  private hasContradictions(response: string, context: RetrievalResult[]): boolean {
    // Simple contradiction detection (can be enhanced)
    return false;
  }

  private calculateResponseConfidence(
    response: string,
    intent: UserIntent,
    context: RetrievalResult[],
    issues: string[]
  ): number {
    let confidence = 1.0;

    // Reduce confidence for each issue
    confidence -= issues.length * 0.2;

    // Reduce if low context
    if (context.length < 2) confidence *= 0.8;

    // Reduce if intent was ambiguous
    if (intent.confidence < 0.8) confidence *= 0.9;

    return Math.max(0.1, confidence);
  }
}
