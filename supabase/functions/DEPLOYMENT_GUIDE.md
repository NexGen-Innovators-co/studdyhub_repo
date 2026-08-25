# Supabase Edge Function Deployment Guide

## Prerequisites
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_REF`

## Quick Deploy (All Functions)

```bash
# Deploy ALL edge functions (80 total)
supabase functions deploy --no-verify-jwt gemini-chat
supabase functions deploy --no-verify-jwt create-social-post
supabase functions deploy --no-verify-jwt toggle-like
supabase functions deploy --no-verify-jwt toggle-bookmark
supabase functions deploy --no-verify-jwt toggle-follow
supabase functions deploy --no-verify-jwt join-leave-group
supabase functions deploy --no-verify-jwt comment-on-post
supabase functions deploy --no-verify-jwt document-processor
supabase functions deploy --no-verify-jwt generate-quiz
supabase functions deploy --no-verify-jwt generate-ai-quiz
supabase functions deploy --no-verify-jwt generate-spelling-words
supabase functions deploy --no-verify-jwt generate-flashcards
supabase functions deploy --no-verify-jwt generate-podcast
supabase functions deploy --no-verify-jwt generate-summary
supabase functions deploy --no-verify-jwt generate-note-from-document
supabase functions deploy --no-verify-jwt generate-image-from-text
supabase functions deploy --no-verify-jwt generate-inline-content
supabase functions deploy --no-verify-jwt send-notification
supabase functions deploy --no-verify-jwt send-message
supabase functions deploy --no-verify-jwt live-quiz
supabase functions deploy --no-verify-jwt cloud-tts
supabase functions deploy --no-verify-jwt process-audio
supabase functions deploy --no-verify-jwt podcast-transcribe
supabase functions deploy --no-verify-jwt paystack-webhook
supabase functions deploy --no-verify-jwt document-extractor
supabase functions deploy --no-verify-jwt image-analyzer
supabase functions deploy --no-verify-jwt image-search-proxy
supabase functions deploy --no-verify-jwt realtime-transcribe
supabase functions deploy --no-verify-jwt calendar-auth
supabase functions deploy --no-verify-jwt calendar-callback
supabase functions deploy --no-verify-jwt context-service
supabase functions deploy --no-verify-jwt dashboard-insights
supabase functions deploy --no-verify-jwt manage-notifications
supabase functions deploy --no-verify-jwt scheduled-notifications-dispatcher
supabase functions deploy --no-verify-jwt quiz-scheduler
supabase functions deploy --no-verify-jwt get-social-feed
supabase functions deploy --no-verify-jwt get-comments
supabase functions deploy --no-verify-jwt get-chat-messages
supabase functions deploy --no-verify-jwt get-chat-sessions
```

## ⚠️ Critical Functions (Deploy These First)

These functions are **directly called by the mobile app** (`BackendApiService.kt`):

| Function | Mobile API Call | Purpose |
|----------|----------------|---------|
| `gemini-chat` | `sendAiChatMessage()` | AI chat responses |
| `comment-on-post` | `addSocialComment()` | Social comments |
| `create-social-post` | `createSocialPost()` | Social posts |
| `toggle-like` | `toggleLikePost()` | Like/unlike posts |
| `toggle-bookmark` | `toggleBookmarkPost()` | Bookmark/unbookmark |
| `toggle-follow` | `toggleFollowUser()` | Follow/unfollow users |
| `join-leave-group` | `toggleJoinGroup()` | Join/leave study groups |
| `document-processor` | `createDocument()` | AI document extraction |
| `generate-spelling-words` | `generateSpellingWords()` | Explorer Spelling Bee word generation |
| `delete-user-data` | `deleteUserData()` | "Erase All My Data" — wipes the user's rows across all tables |

## 🔧 Functions Needed for Missing Mobile Features

### Live Quizzes (P2 - Coming soon)
```bash
supabase functions deploy --no-verify-jwt live-quiz
```

### Push Notifications (P1 - Coming soon)
```bash
supabase functions deploy --no-verify-jwt send-notification
supabase functions deploy --no-verify-jwt scheduled-notifications-dispatcher
supabase functions deploy --no-verify-jwt manage-notifications
```

### AI Features
```bash
supabase functions deploy --no-verify-jwt generate-quiz
supabase functions deploy --no-verify-jwt generate-ai-quiz
supabase functions deploy --no-verify-jwt generate-spelling-words
supabase functions deploy --no-verify-jwt generate-flashcards
supabase functions deploy --no-verify-jwt generate-podcast
supabase functions deploy --no-verify-jwt generate-summary
supabase functions deploy --no-verify-jwt generate-note-from-document
```

## Batch Deploy Script

Create a `deploy-functions.sh` file:

```bash
#!/bin/bash
# Deploy Critical Functions First
echo "Deploying critical functions..."
CRITICAL=(
  "gemini-chat"
  "create-social-post"
  "toggle-like"
  "toggle-bookmark"
  "toggle-follow"
  "join-leave-group"
  "comment-on-post"
  "document-processor"
)

for fn in "${CRITICAL[@]}"; do
  echo "Deploying $fn..."
  supabase functions deploy --no-verify-jwt "$fn"
done

echo "✅ Critical functions deployed!"
echo ""
echo "Run the same pattern for remaining functions."
```

## Environment Variables (Secrets)

Ensure these are set in your Supabase project:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase secrets set VITE_SUPABASE_URL=https://your-project.supabase.co
supabase secrets set VITE_SUPABASE_ANON_KEY=your-anon-key
supabase secrets set OPENAI_API_KEY=your-openai-key  # if used
supabase secrets set PAYSTACK_SECRET_KEY=your-paystack-key  # for subscriptions
```

## Verify Deployment

Check deployed functions:
```bash
supabase functions list
```

Test a function:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/gemini-chat \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "sessionId": "test-123", "userId": "test-user"}'
```
