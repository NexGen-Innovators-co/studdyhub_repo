# Advanced Agentic System for Accurate AI Responses

## Overview

This implementation uses sophisticated agentic mechanisms to ensure **accurate, contextual, and intelligent responses** rather than simply optimizing for speed. The system deeply understands user intent and retrieves relevant context to provide high-quality answers.

## Agentic Mechanisms Implemented

### 1. **Query Understanding & Decomposition**
The system analyzes queries at multiple levels:

- **Intent Classification**: Multi-label classification (educational, creation, retrieval, modification, analysis, study assistance, planning)
- **Entity Extraction**: Identifies and resolves references to notes, documents, quizzes, schedules, goals, topics, and dates
- **Complexity Analysis**: Categorizes queries as simple, moderate, or complex
- **Ambiguity Detection**: Identifies unclear references and requests clarification
- **Dependency Analysis**: Understands relationships between entities

**Database Tables Used**:
- `notes` - For matching note titles and content
- `documents` - For matching document titles
- `user_learning_goals` - For matching goal references
- `schedule_items` - For temporal context
- `quizzes` - For study-related queries

### 2. **Semantic Context Retrieval**
Advanced retrieval using multiple strategies:

- **Entity-Based Retrieval**: Fetches exact content when entities are identified
- **Topic-Based Retrieval**: Searches across content using semantic topics
- **Temporal Retrieval**: Finds content within specific time ranges
- **Cross-Session Retrieval**: Connects current conversation to past relevant sessions
- **Hybrid Ranking**: Combines relevance score (60%), temporal score (30%), and intent match (10%)

**Retrieval Results Include**:
```typescript
{
  type: string;          // note, document, session, schedule, etc.
  id: string;            // Database ID
  title: string;         // Human-readable title
  relevanceScore: number; // 0-1 semantic relevance
  temporalScore: number;  // 0-1 recency score
  content?: string;       // Actual content
  metadata?: any;         // Additional context
}
```

### 3. **Multi-Step Reasoning Chain**
The system builds explicit reasoning steps:

1. **What do we know?** - Summarizes intent, entities, and context
2. **What's missing?** - Identifies information gaps
3. **How should we respond?** - Determines response strategy

**Response Strategies**:
- `ask_clarification` - When information is ambiguous
- `execute_action_with_confirmation` - For actionable requests
- `step_by_step_explanation` - For complex queries
- `direct_response` - For straightforward questions

### 4. **Comprehensive Memory Management**

#### **Working Memory** (Current Session)
- Recent messages from current conversation (bounded by `MAX_CONVERSATION_HISTORY`, default 500; live in every turn)
- Active topics being discussed
- Referenced items (documents/notes)

#### **Long-Term Memory** (User Patterns)
From `ai_user_memory` table:
- User interests (confidence_score >= 0.7)
- Learning preferences
- Struggle areas
- Strong subjects
- Preferred learning style

#### **Episodic Memory** (Past Interactions)
From `chat_sessions` table:
- Relevant past conversations (30 days)
- Similar discussion topics
- Learning history from quizzes
- Cross-session connections

#### **Semantic Memory** (Knowledge Base)
- Structured content from user's notes and documents
- AI summaries and extractions
- Organized by categories and tags

### 5. **Dynamic Tool Selection**
Automatically selects appropriate tools based on intent:

- **create_tool** - For creation requests
- **update_tool** - For modification requests
- **delete_tool** - For deletion requests
- **search_tool** - For finding information
- **calculator** - For computational queries
- **knowledge_retrieval** - For external knowledge needs

### 6. **Self-Verification & Quality Check**
Every response undergoes quality assessment:

**Verification Checks**:
- ✅ Hallucination detection - Ensures facts come from context
- ✅ Intent addressing - Confirms query is fully answered
- ✅ Contradiction detection - Checks for logical inconsistencies
- ✅ Confidence scoring - Calculates response reliability

**Quality Indicators**:
```typescript
{
  isValid: boolean;      // Pass/fail overall
  confidence: number;    // 0-1 confidence score
  issues: string[];      // List of detected problems
}
```

## Database Schema Integration

### Key Tables Used

**Chat & Context**:
- `chat_messages` - Conversation history
- `chat_sessions` - Session metadata and summaries
- `ai_user_memory` - Long-term user facts

**Content**:
- `notes` - User notes with AI summaries
- `documents` - Uploaded documents with extracted content
- `document_folders` - Organization structure

**Learning**:
- `user_learning_goals` - Learning objectives
- `quizzes` - Quiz data for subject tracking
- `quiz_attempts` - Performance history
- `schedule_items` - Temporal context
- `class_recordings` - Audio content

**Profile**:
- `profiles` - User info and preferences
- `user_stats` - Learning statistics
- `achievements` - Badges and milestones

## Configuration (Quality-Optimized)

```typescript
{
  MAX_INPUT_TOKENS: 2M,        // Full context window
  MAX_OUTPUT_TOKENS: 8192,     // Balanced quality/length
  MAX_CONVERSATION_HISTORY: 500, // Complete history
  SUMMARY_THRESHOLD: 10,       // Balanced summarization
  RETRY_ATTEMPTS: 3,           // High reliability
  RELEVANCE_SCORING: true,     // Smart ranking
  RELEVANCE_TOP_K: 10          // More relevant items
}
```

> Note: Long-term memory (`ai_user_memory`) is persisted from BOTH the streaming
> and non-streaming paths. The self-verification phase (`verifyResponse`) runs as
> a post-generation guard, and dynamic tool selection (`selectTools`) shapes the
> ReAct planner's available tools (including the safe `CALCULATOR` arithmetic
> action). Write actions (INSERT/UPDATE/DELETE) are gated by a server-side
> confirmation ledger: `confirmed: true` is only honored for a genuinely pending
> action when the user's current message is an explicit confirmation.

## Processing Flow

```
User Query
    ↓
1. UNDERSTAND PHASE
   ├─ Extract entities (notes, docs, goals, dates)
   ├─ Classify intent (multi-label)
   ├─ Analyze complexity
   └─ Detect ambiguity
    ↓
2. RETRIEVAL PHASE
   ├─ Entity-based retrieval (exact matches)
   ├─ Topic-based retrieval (semantic search)
   ├─ Temporal retrieval (time-based)
   ├─ Cross-session retrieval (past convos)
   └─ Hybrid ranking (relevance + temporal + intent)
    ↓
3. REASONING PHASE
   ├─ Build reasoning chain
   ├─ Identify missing information
   ├─ Determine response strategy
   └─ Select appropriate tools
    ↓
4. MEMORY LOADING
   ├─ Working memory (current session)
   ├─ Long-term memory (user patterns)
   └─ Episodic memory (past sessions)
    ↓
5. GENERATION PHASE
   ├─ Enhanced context from all sources
   ├─ System prompt with user profile
   ├─ Gemini API call with full context
   └─ Token validation
    ↓
6. VERIFICATION PHASE
   ├─ Check for hallucinations
   ├─ Verify intent is addressed
   ├─ Detect contradictions
   ├─ Calculate confidence
   └─ Add clarification if needed
    ↓
7. ACTION EXECUTION
   ├─ Parse action requests
   ├─ Execute database operations
   └─ Update user memory
    ↓
Response to User
```

## Response Quality Enhancements

### Context Augmentation
Responses include:
- ✅ Semantically relevant past content (top 10 items)
- ✅ Reasoning chain visibility
- ✅ Relevant past discussions
- ✅ User memory facts
- ✅ Cross-session continuity

### Clarification System
When uncertainty detected:
- 🔍 Asks for specifics on unresolved entities
- 🔍 Requests clarification for ambiguous queries
- 🔍 Provides confidence indicators
- 🔍 Suggests related content

### Continuous Learning
System updates:
- 📚 Extracts new user facts from conversations
- 📚 Updates confidence scores on existing facts
- 📚 Tracks referenced content
- 📚 Builds topic connections across sessions

## Performance Characteristics

### What This System Prioritizes

1. **Accuracy** - Correct information from verified sources
2. **Contextual Understanding** - Full comprehension of user intent
3. **Continuity** - Remembers past conversations and preferences
4. **Completeness** - Thorough responses that address all aspects
5. **Quality** - Well-reasoned, evidence-based answers

### What This System Does NOT Prioritize

- ❌ Raw speed at the expense of accuracy
- ❌ Abbreviated responses
- ❌ Limited context windows
- ❌ Minimal database queries

## Example: How It Works

**User Query**: "Can you help me review my biology notes from last week?"

**Agentic Processing**:

1. **Intent**: `educational_explanation` + `information_retrieval`
2. **Entities Detected**: 
   - Topic: "biology"
   - Temporal: "last week"
   - Type: "notes"
3. **Retrieval**:
   - Finds all biology notes updated in past 7 days
   - Retrieves related quiz attempts for context
   - Checks past sessions discussing biology
4. **Reasoning**:
   - User wants to review specific content
   - Multiple notes found - should summarize or list?
   - User has struggled with certain biology topics (from memory)
5. **Response Strategy**: `step_by_step_explanation`
6. **Verification**: 
   - Confirms all notes are real (no hallucination)
   - Checks response addresses review needs
   - Adds personalized study tips based on user patterns

**Result**: Comprehensive, personalized review assistance with accurate content references.

## Extensibility

### Adding New Agentic Mechanisms

1. **New Intent Types**: Add to `classifyIntent()` method
2. **New Entity Types**: Extend `EntityMention` interface
3. **New Retrieval Sources**: Add to `retrieveRelevantContext()`
4. **New Verification Checks**: Extend `verifyResponse()`
5. **New Memory Types**: Add to memory loading system

### Custom Retrieval Strategies

Implement in `AgenticCore`:
```typescript
async retrieveByCustomStrategy(
  params: any,
  userId: string
): Promise<RetrievalResult[]> {
  // Custom retrieval logic
}
```

## Monitoring & Debugging

### Logging Points

- `[Agentic]` - Core agentic system operations
- `[Retrieval]` - Context retrieval details  
- `[Reasoning]` - Reasoning chain steps
- `[Verification]` - Quality check results
- `[Memory]` - Memory operations

### Key Metrics to Track

- Average relevance scores
- Context retrieval counts
- Confidence distribution
- Verification pass rates
- Entity resolution accuracy
- Cross-session connection frequency

## Conclusion

This agentic system provides **enterprise-grade accuracy** through:
- Deep query understanding
- Comprehensive context retrieval
- Multi-step reasoning
- Extensive memory systems
- Quality verification
- Continuous learning

The focus is on **correctness and intelligence**, not just speed.
