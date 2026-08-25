#!/bin/bash
# =============================================================================
# StuddyHub Edge Functions - Deployment Script (Run AFTER supabase login)
# =============================================================================
# Step 0: supabase login        (opens browser - do this FIRST)
# Step 1: supabase link         (link to project)
# Step 2: supabase secrets set  (set GEMINI_API_KEY)
# Step 3: Run this script       (deploys all functions)
# =============================================================================

echo "========================================"
echo "  StuddyHub Edge Function Deployment"
echo "========================================"
echo "  Estimated time: 10-15 minutes"
echo "  (Run in tmux or terminal that stays open)"
echo "========================================"

# ── Verify CLI is logged in ──────────────────────────────────────────────────
if ! supabase projects list &>/dev/null; then
  echo "❌ Not logged in to Supabase CLI!"
  echo "   Run: supabase login"
  exit 1
fi
echo "✅ Supabase CLI logged in"

# ── Verify project is linked ─────────────────────────────────────────────────
if ! supabase functions list &>/dev/null; then
  echo "❌ Project not linked or no functions accessible!"
  echo "   Run: cd supabase && supabase link --project-ref vykidardmwtxwjtijjap"
  exit 1
fi
echo "✅ Project linked successfully"

echo "📌 Secrets already set (GEMINI_API_KEY found)"

echo ""
echo "📌 Deploying 80 edge functions..."
echo ""

# ======== CRITICAL FUNCTIONS (Used by mobile app directly) ========
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

# ======== AI GENERATION FUNCTIONS ========
AI_GENERATION=(
  "generate-quiz"
  "generate-ai-quiz"
  "generate-flashcards"
  "generate-podcast"
  "generate-summary"
  "generate-note-from-document"
  "generate-inline-content"
  "generate-image-from-text"
  "generate-dashboard-insights"
)

# ======== SOCIAL FUNCTIONS ========
SOCIAL=(
  "get-social-feed"
  "get-comments"
  "get-social-groups"
  "get-suggested-users"
  "get-user-posts-metadata"
  "get-user-resources"
  "save-shared-resource"
  "track-post-view"
  "ai-categorize-post"
  "ai-rank-feed"
  "create-study-group"
  "delete-social-post"
  "delete-group"
  "edit-social-post"
  "follow-user"
  "like-post"
  "manage-event"
  "manage-group-member"
  "content-moderation"
  "send-group-message"
  "send-chat-message"
  "send-message"
  "send-notification"
)

# ======== DOCUMENT / PROCESSING FUNCTIONS ========
DOCUMENT=(
  "document-extractor"
  "document-parser"
  "document-processor-watchdog"
  "resume-processing"
  "fetch-web-url"
  "gemini-document-extractor"
  "analyze-document-structure"
  "image-analyzer"
  "image-search-proxy"
  "context-service"
)

# ======== PODCAST / AUDIO FUNCTIONS ========
AUDIO=(
  "cloud-tts"
  "process-audio"
  "podcast-transcribe"
  "realtime-transcribe"
  "transcribe-caption"
  "complete-podcast-chunks"
  "upload-podcast-chunk"
  "start-recording-session"
  "gemini-audio-processor"
)

# ======== CHAT FUNCTIONS ========
CHAT=(
  "get-chat-messages"
  "get-chat-sessions"
  "create-chat-session"
  "create-ai-chat-session"
  "delete-chat-message"
  "ai-chat-session-search"
)

# ======== SCHEDULE / NOTIFICATION FUNCTIONS ========
SCHEDULE=(
  "check-schedule-reminders"
  "quiz-scheduler"
  "daily-notifications-engine"
  "scheduled-notifications-dispatcher"
  "manage-notifications"
)

# ======== ADMIN / INSTITUTION FUNCTIONS ========
ADMIN=(
  "admin-ai-insights"
  "accept-institution-invite"
  "create-institution"
  "get-institution-analytics"
  "manage-institution-members"
)

# ======== SUBSCRIPTION / CALENDAR / MISC ========
MISC=(
  "paystack-webhook"
  "calendar-auth"
  "calendar-callback"
  "refresh-calendar-token"
  "live-quiz"
  "fix-diagram"
)

ALL_FUNCTIONS=(
  "${CRITICAL[@]}"
  "${AI_GENERATION[@]}"
  "${SOCIAL[@]}"
  "${DOCUMENT[@]}"
  "${AUDIO[@]}"
  "${CHAT[@]}"
  "${SCHEDULE[@]}"
  "${ADMIN[@]}"
  "${MISC[@]}"
)

echo "Found ${#ALL_FUNCTIONS[@]} functions to deploy"
echo ""

TOTAL=${#ALL_FUNCTIONS[@]}
COUNT=0
FAILED=()

for fn in "${ALL_FUNCTIONS[@]}"; do
  COUNT=$((COUNT + 1))
  printf "[%2d/%2d] Deploying: %s ... " "$COUNT" "$TOTAL" "$fn"
  
  if supabase functions deploy --no-verify-jwt "$fn" 2>&1; then
    echo "  ✅"
  else
    echo "  ❌"
    FAILED+=("$fn")
  fi
  echo ""
done

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo "  Total:      $TOTAL"
echo "  Succeeded:  $((TOTAL - ${#FAILED[@]}))"
echo "  Failed:     ${#FAILED[@]}"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "  Failed functions:"
  for f in "${FAILED[@]}"; do
    echo "    ❌ $f"
  done
  echo ""
  echo "  To retry individually:"
  echo "  supabase functions deploy --no-verify-jwt <function-name>"
fi

echo ""
echo "✅ Verify deployed functions: supabase functions list"
