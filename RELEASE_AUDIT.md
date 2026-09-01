# StuddyHub Release Audit — Pre-Launch Checklist

## Date: 2026-08-31

---

## 1. PODCAST FEATURE — DISABLED (Coming Soon)

Podcast generation is **disabled on mobile** across all entry points:

| Location | Change |
|----------|--------|
| `AssistantScreen.kt` tile | Shows "Coming Soon", Toast on click |
| `ScholarHomeContent.kt` dashboard tile | Shows "Coming Soon", Toast on click |
| `AIChatScreen.kt` suggestion chip | Changed to "🔒 AI Podcast — Coming Soon" |
| `AIChatScreen.kt` menu item | Disabled, shows Toast "Coming Soon" |
| `AIChatScreen.kt` generator modal | Disabled (`if (false && ...)`) |
| `AIChatScreen.kt` player overlay | Disabled (`if (false && ...)`) |
| `StuddyHubApp.kt` route | Shows "Coming Soon" placeholder screen |
| `ProfileScreen.kt` badge | Shows "Podcasts Coming Soon" |
| `SearchViewModel.kt` results | Podcast search results commented out |

**Why:** Mobile sends `textContent` but edge function only handles `noteIds`/`documentIds`. Credit system not integrated on mobile. Audio playback uses Android TTS instead of generated segments.

---

## 2. CRITICAL ISSUES (Must Fix Before Launch)

### 2.1 Google Sign-In DEVELOPER_ERROR (Code 10)
- **Status:** BLOCKED
- **Root cause:** Old project `948761763712` was deleted without clearing SHA-1
- **Fix:** Recover old project → remove SHA-1 → re-register in new project
- **Alternative:** Use debug builds (SHA-1: `E4:A6:6B:CE:...`) or change package name
- **Files:** `GoogleSignInNative.kt`, `google-services.json`, `build.gradle.kts`

### 2.2 Gemini API Quota Depleted
- **Status:** DEGRADED
- **Impact:** Only `gemini-3.5-flash-lite` works; all other models return 429
- **Affects:** Title generation, AI responses, podcast script generation
- **Fix:** Enable billing on Google Cloud project or wait for quota reset

### 2.3 Supabase Compute Quota (Podcast)
- **Status:** BLOCKED (but feature is disabled)
- **Impact:** Podcast edge function returns 402 Payment Required
- **Fix:** Upgrade Supabase plan or wait for quota reset

---

## 3. HIGH SEVERITY ISSUES

### 3.1 DOC/DOCX Content Extraction — NOT IMPLEMENTED
- **File:** `supabase/functions/document-parser/index.ts:62-64`
- **Impact:** Word documents return placeholder text instead of extracted content
- **Fix:** Implement DOCX parsing using a Deno-compatible library

### 3.2 Institution Invitation Emails — NOT SENT
- **File:** `supabase/functions/manage-institution-members/index.ts:142`
- **Impact:** Invited users never receive email notifications
- **Fix:** Add email sending via Resend/SendGrid

### 3.3 Group Nudge Notifications — HARDCODED
- **File:** `supabase/functions/daily-notifications-engine/index.ts:489-490`
- **Impact:** Users get irrelevant notifications regardless of group activity
- **Fix:** Query actual group activity before sending

### 3.4 Content Moderation Appeal — COMING SOON
- **File:** `web/src/modules/social/components/feed/FeedTabContent.tsx:200`
- **Impact:** Users cannot contest false-positive moderation rejections
- **Fix:** Implement appeal flow with admin review

### 3.5 Calendar Integrations — COMING SOON
- **File:** `web/src/modules/settings/components/CalendarIntegrationSettings.tsx:47-82`
- **Impact:** Google Calendar and Outlook integration non-functional
- **Fix:** Implement OAuth flows for Google/Outlook calendars

### 3.6 Educator Course View Count — TODO
- **File:** `web/src/modules/educator/hooks/useEducatorCourses.ts:221`
- **Impact:** Educator dashboard always shows 0 views
- **Fix:** Add view tracking to course pages

### 3.7 Class Recording CRUD — COMMENTED OUT
- **File:** `web/src/hooks/useAppOperations.tsx:670-704`
- **Impact:** Recording state management disabled
- **Fix:** Uncomment and test recording operations

---

## 4. MEDIUM SEVERITY ISSUES

### 4.1 AI Chat File Attachment Type — BROKEN
- **File:** `web/src/modules/aiChat/types/chatTypes.ts:5`
- **Impact:** `AttachedFile` interface is incomplete
- **Fix:** Define proper interface

### 4.2 Flashcard Review API — NO-OP STUB
- **File:** `supabase/functions/api/index.ts:306`
- **Impact:** Public API flashcard review returns fake success
- **Fix:** Implement spaced repetition logic

### 4.3 Note Template Selection — COMING SOON
- **File:** `web/src/modules/notes/components/NoteEditor.tsx:1683`
- **Impact:** Always creates same generic template
- **Fix:** Build template library with selection UI

### 4.4 Global Search — 60% INCOMPLETE
- **File:** `web/docs/GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md`
- **Impact:** Only Notes are searchable; Documents, Recordings, Schedule, Podcasts, Quizzes not indexed
- **Fix:** Add search indexing for remaining entity types

### 4.5 Emoji Picker — PLACEHOLDER
- **File:** `web/src/modules/social/components/MessageInput.tsx:147`
- **Impact:** Emoji button does nothing
- **Fix:** Integrate emoji picker library

### 4.6 Public API Docs — COMING SOON
- **File:** `web/src/pages/APIs.tsx:61,112`
- **Impact:** API page visible but documentation missing
- **Fix:** Generate OpenAPI docs or hide the page

### 4.7 RLS Policy Hardening — 4 FUTURE TODOs
- **File:** `supabase/migrations/20260207_fix_rls_policies.sql`
- **Impact:** Wider-than-necessary attack surface on social features
- **Fix:** Convert triggers to SECURITY DEFINER, tighten RLS policies

### 4.8 Temp Audio Files — NO CLEANUP
- **File:** `web/src/modules/podcasts/services/transcriptionService.ts:25`
- **Impact:** Storage costs accumulate from uncleaned temp files
- **Fix:** Add scheduled cleanup job

---

## 5. LOW SEVERITY ISSUES

- Podcast sharing to social feed commented out (`PodcastsPage.tsx:762-784`)
- Following list infinite scroll not implemented (`UserProfile.tsx:668`)
- Podcast video GCS URI fetch not implemented (`generate-podcast/index.ts:1501`)
- Folder move callback placeholder (`MoveFolderDialog.tsx:75`)

---

## 6. WHAT'S WORKING (Ready to Ship)

- ✅ AI Chat (notes, flashcards, quizzes, schedule management)
- ✅ Notes CRUD with sync
- ✅ Flashcards with spaced repetition
- ✅ Quiz generation and attempts
- ✅ Schedule/calendar management
- ✅ Document upload and parsing (PDF, images, text)
- ✅ Social feed, groups, messaging
- ✅ Gamification (Explorer mode, badges, XP)
- ✅ Multi-tier UI (Explorer, Achiever, Scholar, Genius)
- ✅ Offline support with sync
- ✅ Search (notes only — partial)
- ✅ Profile and settings
- ✅ Image generation via AI
- ✅ Web/Android authentication (Google + Email)

---

## 7. RECOMMENDED LAUNCH STRATEGY

1. **Fix Google Auth** — Recover old project or use debug builds
2. **Disable Podcast** — Already done on mobile
3. **Disable Calendar Integrations** — Already marked "Coming Soon" on web
4. **Hide Public API page** — Or mark clearly as internal
5. **Test core flows** — AI Chat, Notes, Flashcards, Quizzes, Schedule
6. **Monitor Gemini quota** — Enable billing for production use
7. **Ship v1.0** — With known limitations documented

---

## 8. NEXT ACTIONS

1. [ ] Fix Google Sign-In DEVELOPER_ERROR
2. [ ] Fix Google OAuth consent screen status
3. [ ] Set Web Client Secret in Supabase Google provider
4. [ ] Test sign-in flow end-to-end
5. [ ] Enable Gemini billing
6. [ ] Upgrade Supabase plan (if needed for compute)
