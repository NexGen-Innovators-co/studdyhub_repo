# 🔌 StuddyHub API Reference

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [AI & Chat Functions](#ai--chat-functions)
- [Document Processing Functions](#document-processing-functions)
- [Audio & Recording Functions](#audio--recording-functions)
- [Quiz Functions](#quiz-functions)
- [Social Functions](#social-functions)
- [Payment Functions](#payment-functions)
- [Utility Functions](#utility-functions)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

StuddyHub's API is built on Supabase Edge Functions running on Deno runtime. All functions are serverless, auto-scaling, and globally distributed.

### Key Features
- ✅ RESTful architecture
- ✅ JWT authentication
- ✅ JSON request/response
- ✅ Automatic rate limiting
- ✅ CORS enabled
- ✅ Global CDN distribution

---

## Authentication

All API endpoints require authentication unless otherwise specified.

### Authentication Header
```
Authorization: Bearer <JWT_TOKEN>
```

### Getting the Token

The JWT token is automatically managed by Supabase Auth:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Get current session
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Authentication Flow

1. User logs in via Supabase Auth
2. Supabase returns JWT token
3. Token stored in localStorage
4. Token included in all API requests
5. Edge Functions validate token

---

## Base URL

```
Production: https://your-project.supabase.co/functions/v1
Development: http://localhost:54321/functions/v1
```

---

## AI & Chat Functions

### 1. Gemini Chat

Send messages to AI assistant with context awareness.

**Endpoint**: `POST /gemini-chat`

**Request Body**:
```json
{
  "message": "string (required)",
  "contextIds": ["uuid", "uuid"] (optional),
  "learningStyle": "visual|auditory|kinesthetic|reading" (optional),
  "preferences": {
    "explanation_style": "simple|detailed|comprehensive",
    "examples": boolean,
    "difficulty": "beginner|intermediate|advanced"
  } (optional)
}
```

**Response**:
```json
{
  "response": "string",
  "tokensUsed": number,
  "contextUsed": ["uuid"]
}
```

**Example**:
```typescript
const { data, error } = await supabase.functions.invoke('gemini-chat', {
  body: {
    message: "Explain photosynthesis",
    contextIds: [noteId],
    learningStyle: "visual",
    preferences: {
      explanation_style: "simple",
      examples: true,
      difficulty: "beginner"
    }
  }
});
```

**Rate Limits**:
- Visitor: 5 messages/day
- Scholar: 50 messages/day
- Genius: 200 messages/day

---

### 2. Generate Inline Content

Generate text content inline while typing.

**Endpoint**: `POST /generate-inline-content`

**Request Body**:
```json
{
  "prompt": "string (required)",
  "context": "string (optional)",
  "style": "continue|elaborate|summarize|explain" (required)
}
```

**Response**:
```json
{
  "content": "string",
  "tokensUsed": number
}
```

**Example**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-inline-content', {
  body: {
    prompt: "The mitochondria is",
    style: "continue",
    context: "Biology notes about cells"
  }
});
```

---

### 3. Context Service

Get relevant context for AI responses.

**Endpoint**: `POST /context-service`

**Request Body**:
```json
{
  "query": "string (required)",
  "userId": "uuid (required)",
  "maxResults": number (optional, default: 5)
}
```

**Response**:
```json
{
  "context": [
    {
      "id": "uuid",
      "type": "note|document|recording",
      "title": "string",
      "content": "string",
      "relevance": number
    }
  ]
}
```

---

## Document Processing Functions

### 4. Document Extractor

Extract text content from uploaded documents.

**Endpoint**: `POST /document-extractor`

**Request Body**:
```json
{
  "fileUrl": "string (required)",
  "fileType": "pdf|docx|txt|jpg|png" (required),
  "documentId": "uuid (required)"
}
```

**Response**:
```json
{
  "content": "string",
  "metadata": {
    "pages": number,
    "wordCount": number,
    "language": "string"
  },
  "success": boolean
}
```

**Supported Formats**:
- PDF (.pdf)
- Word (.docx, .doc)
- Text (.txt, .md)
- Images (.jpg, .png, .jpeg) - OCR

---

### 5. Analyze Document Structure

Analyze document and extract structure.

**Endpoint**: `POST /analyze-document-structure`

**Request Body**:
```json
{
  "content": "string (required)",
  "documentId": "uuid (required)"
}
```

**Response**:
```json
{
  "structure": {
    "headings": ["string"],
    "sections": [
      {
        "title": "string",
        "content": "string",
        "level": number
      }
    ],
    "keyPoints": ["string"],
    "summary": "string"
  }
}
```

---

### 6. Gemini Document Extractor

Advanced AI-powered document analysis.

**Endpoint**: `POST /gemini-document-extractor`

**Request Body**:
```json
{
  "fileUrl": "string (required)",
  "fileType": "string (required)",
  "analysisType": "summary|keypoints|questions|all" (optional)
}
```

**Response**:
```json
{
  "content": "string",
  "summary": "string",
  "keyPoints": ["string"],
  "questions": ["string"],
  "entities": ["string"]
}
```

---

### 7. Image Analyzer

Analyze images using AI vision.

**Endpoint**: `POST /image-analyzer`

**Request Body**:
```json
{
  "imageUrl": "string (required)",
  "prompt": "string (optional)"
}
```

**Response**:
```json
{
  "description": "string",
  "objects": ["string"],
  "text": "string (OCR results)",
  "analysis": "string"
}
```

---

## Audio & Recording Functions

### 8. Gemini Audio Processor

Process and transcribe audio recordings.

**Endpoint**: `POST /gemini-audio-processor`

**Request Body**:
```json
{
  "audioUrl": "string (required)",
  "recordingId": "uuid (required)",
  "options": {
    "transcribe": boolean (default: true),
    "summarize": boolean (default: true),
    "extractKeyPoints": boolean (default: true)
  }
}
```

**Response**:
```json
{
  "transcription": "string",
  "summary": "string",
  "keyPoints": ["string"],
  "speakers": [
    {
      "id": "speaker_1",
      "segments": [
        {
          "text": "string",
          "timestamp": "00:00:00"
        }
      ]
    }
  ],
  "duration": number
}
```

**Example**:
```typescript
const { data, error } = await supabase.functions.invoke('gemini-audio-processor', {
  body: {
    audioUrl: storageUrl,
    recordingId: recording.id,
    options: {
      transcribe: true,
      summarize: true,
      extractKeyPoints: true
    }
  }
});
```

**Supported Audio Formats**:
- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- WEBM (.webm)

**Max File Size**: 100MB

---

### 9. Process Audio

Basic audio processing without AI.

**Endpoint**: `POST /process-audio`

**Request Body**:
```json
{
  "audioUrl": "string (required)",
  "action": "metadata|duration|format" (required)
}
```

**Response**:
```json
{
  "duration": number,
  "format": "string",
  "sampleRate": number,
  "channels": number
}
```

---

## Quiz Functions

### 10. Generate Quiz

Generate quiz from notes or text.

**Endpoint**: `POST /generate-quiz`

**Request Body**:
```json
{
  "content": "string (required)",
  "numQuestions": number (optional, default: 5),
  "difficulty": "beginner|intermediate|advanced" (optional),
  "questionTypes": ["mcq", "true_false", "short_answer"] (optional)
}
```

**Response**:
```json
{
  "quiz": {
    "title": "string",
    "questions": [
      {
        "id": "string",
        "type": "mcq|true_false|short_answer",
        "question": "string",
        "options": ["string"] (for MCQ),
        "correctAnswer": "string",
        "explanation": "string",
        "difficulty": "string"
      }
    ]
  }
}
```

**Example**:
```typescript
const { data, error } = await supabase.functions.invoke('generate-quiz', {
  body: {
    content: noteContent,
    numQuestions: 10,
    difficulty: "intermediate",
    questionTypes: ["mcq", "true_false"]
  }
});
```

---

### 11. Generate Quiz from Notes

Create quiz from specific notes.

**Endpoint**: `POST /generate-quiz-from-notes`

**Request Body**:
```json
{
  "noteIds": ["uuid"] (required),
  "numQuestions": number (optional),
  "difficulty": "string (optional)"
}
```

**Response**: Same as Generate Quiz

---

### 12. Generate AI Quiz

Advanced AI-powered quiz generation.

**Endpoint**: `POST /generate-ai-quiz`

**Request Body**:
```json
{
  "topic": "string (required)",
  "numQuestions": number (required),
  "difficulty": "string (required)",
  "learningObjectives": ["string"] (optional)
}
```

**Response**: Same as Generate Quiz

---

### 13. Generate Flashcards

Create flashcards from content.

**Endpoint**: `POST /generate-flashcards`

**Request Body**:
```json
{
  "content": "string (required)",
  "numCards": number (optional, default: 10)
}
```

**Response**:
```json
{
  "flashcards": [
    {
      "front": "string",
      "back": "string",
      "category": "string"
    }
  ]
}
```

---

## Social Functions

### 14. Create Social Post

Create a new social post.

**Endpoint**: `POST /create-social-post`

**Request Body**:
```json
{
  "content": "string (required)",
  "mediaUrl": "string (optional)",
  "visibility": "public|followers|private" (optional)
}
```

**Response**:
```json
{
  "post": {
    "id": "uuid",
    "userId": "uuid",
    "content": "string",
    "mediaUrl": "string",
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "timestamp"
  }
}
```

---

### 15. Comment on Post

Add comment to a post.

**Endpoint**: `POST /comment-on-post`

**Request Body**:
```json
{
  "postId": "uuid (required)",
  "content": "string (required)"
}
```

**Response**:
```json
{
  "comment": {
    "id": "uuid",
    "postId": "uuid",
    "userId": "uuid",
    "content": "string",
    "createdAt": "timestamp"
  }
}
```

---

### 16. Like Post

Like or unlike a post.

**Endpoint**: `POST /like-post`

**Request Body**:
```json
{
  "postId": "uuid (required)",
  "action": "like|unlike" (required)
}
```

**Response**:
```json
{
  "success": boolean,
  "likesCount": number
}
```

---

### 17. Follow User

Follow or unfollow a user.

**Endpoint**: `POST /follow-user`

**Request Body**:
```json
{
  "targetUserId": "uuid (required)",
  "action": "follow|unfollow" (required)
}
```

**Response**:
```json
{
  "success": boolean,
  "followersCount": number,
  "followingCount": number
}
```

---

### 18. Create Study Group

Create a new study group.

**Endpoint**: `POST /create-study-group`

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "isPrivate": boolean (optional, default: false),
  "tags": ["string"] (optional)
}
```

**Response**:
```json
{
  "group": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "ownerId": "uuid",
    "membersCount": 1,
    "createdAt": "timestamp"
  }
}
```

---

## Payment Functions

### 19. Paystack Webhook

Handle payment webhooks from Paystack.

**Endpoint**: `POST /paystack-webhook`

**Note**: This endpoint is called by Paystack, not directly by clients.

**Request Body**:
```json
{
  "event": "charge.success|subscription.create|...",
  "data": {
    "reference": "string",
    "amount": number,
    "customer": {
      "email": "string"
    }
  }
}
```

**Webhook Events**:
- `charge.success` - Payment successful
- `subscription.create` - Subscription created
- `subscription.disable` - Subscription cancelled

---

## Utility Functions

### 20. Generate Summary

Generate summary from text.

**Endpoint**: `POST /generate-summary`

**Request Body**:
```json
{
  "content": "string (required)",
  "maxLength": number (optional, default: 200)
}
```

**Response**:
```json
{
  "summary": "string"
}
```

---

### 21. Fix Diagram

Fix Mermaid diagram syntax.

**Endpoint**: `POST /fix-diagram`

**Request Body**:
```json
{
  "diagram": "string (required)"
}
```

**Response**:
```json
{
  "fixedDiagram": "string",
  "errors": ["string"],
  "suggestions": ["string"]
}
```

---

### 22. Generate Image from Text

Generate images using AI (Gemini Imagen).

**Endpoint**: `POST /generate-image-from-text`

**Request Body**:
```json
{
  "prompt": "string (required)",
  "style": "realistic|artistic|sketch" (optional)
}
```

**Response**:
```json
{
  "imageUrl": "string",
  "prompt": "string"
}
```

---

### 23. Send Message

Send internal messages between users.

**Endpoint**: `POST /send-message`

**Request Body**:
```json
{
  "recipientId": "uuid (required)",
  "content": "string (required)",
  "messageType": "text|system" (optional)
}
```

**Response**:
```json
{
  "message": {
    "id": "uuid",
    "senderId": "uuid",
    "recipientId": "uuid",
    "content": "string",
    "read": false,
    "createdAt": "timestamp"
  }
}
```

---

### 24. Generate Note from Document

Create a note from document content.

**Endpoint**: `POST /generate-note-from-document`

**Request Body**:
```json
{
  "documentId": "uuid (required)",
  "format": "summary|detailed|bullet_points" (optional)
}
```

**Response**:
```json
{
  "note": {
    "title": "string",
    "content": "string (markdown)",
    "tags": ["string"]
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "string",
  "message": "string (detailed)",
  "code": "string (error code)",
  "statusCode": number
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `INTERNAL_ERROR` | 500 | Server error |
| `LIMIT_EXCEEDED` | 402 | Subscription limit reached |

### Error Handling Example

```typescript
try {
  const { data, error } = await supabase.functions.invoke('gemini-chat', {
    body: { message: "Hello" }
  });
  
  if (error) {
    if (error.message.includes('limit')) {
      toast.error("Daily limit reached. Please upgrade.");
    } else if (error.message.includes('auth')) {
      router.push('/auth');
    } else {
      toast.error("Something went wrong. Please try again.");
    }
    return;
  }
  
  // Handle success
  console.log(data);
} catch (err) {
  console.error("Unexpected error:", err);
}
```

---

## Rate Limiting

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

### Rate Limits by Tier

| Tier | AI Messages | Document Processing | Audio Processing |
|------|-------------|---------------------|------------------|
| **Visitor** | 5/day | 20/month | 3/month |
| **Scholar** | 50/day | 100/month | 20/month |
| **Genius** | 200/day | Unlimited | Unlimited |

### Handling Rate Limits

```typescript
const { data, error } = await supabase.functions.invoke('gemini-chat', {
  body: { message }
});

if (error?.message?.includes('429')) {
  const resetTime = new Date(response.headers['X-RateLimit-Reset']);
  toast.error(`Rate limit exceeded. Resets at ${resetTime}`);
}
```

---

## Examples

### Complete Chat Flow

```typescript
import { supabase } from '@/integrations/supabase/client';

async function sendChatMessage(message: string) {
  try {
    // 1. Check if user can send messages
    const { canSendMessage } = await checkMessageLimit();
    if (!canSendMessage) {
      toast.error("Daily message limit reached");
      return;
    }
    
    // 2. Get relevant context
    const { data: contextData } = await supabase.functions.invoke('context-service', {
      body: {
        query: message,
        userId: user.id,
        maxResults: 3
      }
    });
    
    // 3. Send message with context
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: {
        message,
        contextIds: contextData.context.map(c => c.id),
        learningStyle: user.learning_style,
        preferences: user.learning_preferences
      }
    });
    
    if (error) throw error;
    
    // 4. Save to database
    await supabase.from('ai_messages').insert([
      { role: 'user', content: message },
      { role: 'assistant', content: data.response, tokens_used: data.tokensUsed }
    ]);
    
    // 5. Update usage tracking
    await updateUsageStats('ai_messages');
    
    return data.response;
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
}
```

### Document Processing Flow

```typescript
async function processDocument(file: File) {
  try {
    // 1. Upload to Supabase Storage
    const fileName = `${userId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // 2. Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('documents')
      .getPublicUrl(fileName);
    
    // 3. Extract content
    const { data: extractData, error: extractError } = 
      await supabase.functions.invoke('document-extractor', {
        body: {
          fileUrl: publicUrl,
          fileType: file.type,
          documentId: documentId
        }
      });
    
    if (extractError) throw extractError;
    
    // 4. Analyze with AI
    const { data: analysisData } = 
      await supabase.functions.invoke('gemini-document-extractor', {
        body: {
          fileUrl: publicUrl,
          fileType: file.type,
          analysisType: 'all'
        }
      });
    
    // 5. Save to database
    await supabase.from('documents').insert({
      title: file.name,
      file_path: fileName,
      file_type: file.type,
      file_size: file.size,
      content: extractData.content,
      ai_summary: analysisData.summary
    });
    
    return analysisData;
  } catch (error) {
    console.error("Document processing error:", error);
    throw error;
  }
}
```

### Quiz Generation Flow

```typescript
async function generateQuizFromNotes(noteIds: string[]) {
  try {
    // 1. Fetch notes content
    const { data: notes } = await supabase
      .from('notes')
      .select('content')
      .in('id', noteIds);
    
    // 2. Combine content
    const combinedContent = notes.map(n => n.content).join('\n\n');
    
    // 3. Generate quiz
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: {
        content: combinedContent,
        numQuestions: 10,
        difficulty: 'intermediate',
        questionTypes: ['mcq', 'true_false']
      }
    });
    
    if (error) throw error;
    
    // 4. Save quiz
    const { data: savedQuiz } = await supabase
      .from('quizzes')
      .insert({
        title: data.quiz.title,
        questions: data.quiz.questions,
        difficulty: 'intermediate'
      })
      .select()
      .single();
    
    return savedQuiz;
  } catch (error) {
    console.error("Quiz generation error:", error);
    throw error;
  }
}
```

---

## Testing Edge Functions Locally

### Setup

```bash
# Start Supabase locally
npx supabase start

# Serve functions
npx supabase functions serve
```

### Test with cURL

```bash
# Test gemini-chat function
curl -i --location --request POST 'http://localhost:54321/functions/v1/gemini-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "message": "Hello, world!",
    "contextIds": []
  }'
```

### Test with TypeScript

```typescript
const response = await fetch(
  'http://localhost:54321/functions/v1/gemini-chat',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "Test message",
      contextIds: []
    })
  }
);

const data = await response.json();
console.log(data);
```

---

## Best Practices

### 1. Always Handle Errors
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: payload
});

if (error) {
  // Handle error appropriately
  console.error(error);
  return;
}

// Use data
```

### 2. Check Subscription Limits First
```typescript
const { canPerformAction } = useFeatureAccess();

if (!canPerformAction('ai_message')) {
  toast.error("Upgrade to send more messages");
  return;
}

// Proceed with action
```

### 3. Implement Retry Logic
```typescript
async function invokeWithRetry(functionName, body, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body
    });
    
    if (!error) return data;
    
    if (i === maxRetries - 1) throw error;
    
    // Wait before retry (exponential backoff)
    await new Promise(resolve => 
      setTimeout(resolve, Math.pow(2, i) * 1000)
    );
  }
}
```

### 4. Use TypeScript Types
```typescript
interface ChatRequest {
  message: string;
  contextIds?: string[];
  learningStyle?: LearningStyle;
}

interface ChatResponse {
  response: string;
  tokensUsed: number;
  contextUsed: string[];
}

const { data } = await supabase.functions.invoke<ChatResponse>(
  'gemini-chat',
  { body: requestData as ChatRequest }
);
```

---

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Architecture Documentation](ARCHITECTURE.md)
- [Features Documentation](FEATURES.md)

---

**Need help?** Contact support@studdyhub.com or visit our [Discord](https://discord.gg/studdyhub)
