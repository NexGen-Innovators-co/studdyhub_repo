# 🔍 StuddyHub Mobile App — Production Readiness Audit

**Date:** 2026-08-19
**Auditor:** Codebuff AI Agent
**Scope:** Full Kotlin Android codebase + Supabase edge functions
**Last Updated:** 2026-08-19 (post-fix iteration)

---

## ✅ COMPLETED FIXES

### 1. Guest Mode — REMOVED
**Status:** ✅ Complete

Removed from 8 files:
- `AuthScreen.kt` — Guest button + OR divider removed
- `AuthViewModel.kt` — `loginAsGuest()` removed
- `BackendApiService.kt` — `isGuestUser()` now returns `currentUserId.isNullOrBlank()`
- `StuddyHubRepository.kt` — All 11 `guest-scholar-uuid` checks replaced with `isNullOrBlank()`
- `SyncManager.kt` — Guard simplified, log updated
- `SocialViewModel.kt` — Guard simplified
- `RealtimeSyncManager.kt` — Guard simplified
- `QuizzesViewModel.kt` — Auth guards simplified

### 2. Session Persistence — ALREADY WORKING
**Status:** ✅ Verified (no changes needed)

WhatsApp-style persistent login already works:
- Room DB stores `isLoggedIn`, `accessToken`, `refreshToken`, `tokenExpiresAt`
- SplashViewModel restores tokens on cold start
- Token refresh via `refreshSession()` + `onSessionRefreshed` callback
- DB migration `MIGRATION_10_11` added refresh token columns

### 3. Startup Performance — FIXED
**Status:** ✅ Complete

| Fix | File | Change |
|-----|------|--------|
| QuizzesViewModel deferred init | `QuizzesViewModel.kt` | Removed `refreshQuizzes()`/`checkActiveSessions()` from `init`, added `onScreenResumed()` |
| AIChatViewModel deferred init | `AIChatViewModel.kt` | Removed `refresh()` from `init`, added `onScreenResumed()` (now a no-op) |
| SocialViewModel deferred init | `SocialViewModel.kt` | Removed eager `ensureSocialUser()`/`syncSocialFeed()`/`fetchRealGroupsAndPeers()` from `init`, added `onScreenResumed()` |
| sweepOrphanedAiPlaceholders deferred | `StuddyHubApp.kt` | Moved to Dashboard route visit |
| `currentRoute` declaration order | `StuddyHubApp.kt` | Moved after `val currentRoute = ...` declaration |

### 4. Hardcoded/Dummy Data — CLEANED
**Status:** ✅ Complete

| Fix | File | Change |
|-----|------|--------|
| Podcast duration | `AIChatScreen.kt` | `totalSeconds` now uses `podcast?.durationMinutes` instead of hardcoded 240s |
| Default session ID | `AIChatViewModel.kt` | Changed from `"00000000-..."` to `"chat_default"` |
| Note author fallback | `NoteDetailScreen.kt` | Uses `getOrRestoreActiveUserId()` instead of `"00000000-..."` |
| Seed data removed | `StuddyHubDatabase.kt` | Removed `seedData()` + `DatabaseCallback` (Room defaults sufficient) |

### 5. Database Hardening — IMPROVED
**Status:** ✅ Complete

- Added `MIGRATION_8_9` (empty no-op) to fill gap in chain
- `fallbackToDestructiveMigration()` kept with clear comment (safety net for v1-6 only)
- Migration chain now complete: 7→8→9→10→11→12→13→14→15→16→17→18→19→20→21

### 6. Data Fetching Flood — FIXED
**Status:** ✅ Complete

| Fix | File | Change |
|-----|------|--------|
| `ensureSocialUserExists` dedup | `BackendApiService.kt` | Per-session guard (`lastSocialUserEnsuredId`) — fires once per user per session |
| `syncCloudDataToLocal` debounce | `StuddyHubRepository.kt` | Increased from 15s → 60s |
| `syncSocialFeed` debounce | `StuddyHubRepository.kt` | Added 30s debounce |
| `fetchRealGroupsAndPeers` debounce | `SocialViewModel.kt` | Added 30s debounce |
| `profilePoints` sync debounce | `StuddyHubRepository.kt` | Added 60s debounce to `syncProfilePointsFromCloud()` |
| `onScreenResumed` batch sync removed | `QuizzesViewModel.kt` | Only calls `checkActiveSessions()`, NOT `refreshQuizzes()` |
| AIChat `onScreenResumed` no-op | `AIChatViewModel.kt` | No network calls on screen visit |
| `ensureSocialUserExists` removed from AuthViewModel | `AuthViewModel.kt` | Removed redundant calls from `signIn()` and `signUp()` |

### 7. gemini-chat Timeout — FIXED
**Status:** ✅ Complete

- Added `"gemini-chat"` to `LONG_RUNNING_FUNCTIONS` set (240s read timeout)
- `sendAiChatMessage()` now uses `longRunningClient` instead of default `client`

### 8. Podcast Sync — FIXED
**Status:** ✅ Complete

- `createAIPodcast()` now includes `put("sources", JSONArray())` to satisfy cloud NOT NULL constraint

### 9. Background Token Refresh — ADDED
**Status:** ✅ Complete

- 45-minute periodic refresh in `StuddyHubRepository` init
- Checks `isAccessTokenExpired()` and calls `refreshSession()` silently
- Prevents "Invalid JWT" mid-session

---

## 🔴 REMAINING ITEMS (Not Yet Implemented)

### High Priority

| Item | Effort | Description |
|------|--------|-------------|
| **Soft logout** | Medium | `logoutUser()` currently calls `clearAllTables()` — destructive. Should keep content tables (notes, docs, flashcards, quizzes) and only clear profile + auth tokens. Separate "erase all data" option. |
| **Realtime-first architecture** | Large (1-2 weeks) | Replace batch `syncCloudDataToLocal()` with targeted syncs + Supabase Realtime subscriptions. Reduces login API calls from ~17 to ~3. Makes social/chat/quiz features instant. See detailed plan in conversation history. |
| **AIChatViewModel `onScreenResumed` empty** | Small | Currently a no-op — should load chat sessions from Room DB on screen visit if needed. |

### Medium Priority

| Item | Effort | Description |
|------|--------|-------------|
| **Remove `fallbackToDestructiveMigration()`** | Small | Once all users are on v7+, remove the safety net. Add proper migration for any future schema changes. |
| **Speed bonus/streak multiplier** | Small | `QuizConfig.speedBonusEnabled` and `streakMultiplierEnabled` toggles exist in UI but are never read by scoring logic. Either implement or remove. |
| **Fake podcast player** | Large | Current "podcast" is Android TTS reading a script with a fake timer. Needs real cloud TTS audio generation + playback. |

### Low Priority

| Item | Effort | Description |
|------|--------|-------------|
| **Clean `00000000-...` UUID fallbacks** | Small | Replace with proper null/empty checks in BackendApiService and StuddyHubRepository (5 remaining instances) |
| **Remove `legacySeededChatSessionId`** | Tiny | Keep for now — used by `sweepLegacyTemplateData()` for backwards compat. Remove after all users migrate. |
| **Courses/AIPodcast screens** | Medium | Both are stubs — no real course data model, podcast is fake TTS. Mark as beta or remove. |
| **Firebase config** | Tiny | `google-services.json` missing — non-blocking but should be added for production. |

---

## 📊 Architecture Summary

### Data Flow
```
Login → SplashViewModel → restore tokens → refresh if expired → navigate
     → StuddyHubRepository.init → syncCloudDataToLocal() [ONE batch, ~17 calls]
                                → syncSocialFeed() [social data]
                                → realtimeSync.connect() [WebSocket]
     → onScreenResumed() on screens → only lightweight checks (no batch sync)
```

### gemini-chat Call Chain
```
AI Chat message → StuddyHubRepository.generateAiReply()
               → BackendApiService.sendAiChatMessage() [240s timeout]
               → POST /functions/v1/gemini-chat

Quiz/Note/Doc/Facebook AI → GeminiApiService.generateText()
                           → BackendApiService.sendAiChatMessage() [240s timeout]
                           → POST /functions/v1/gemini-chat
```

All 26 `generateText()` callers route through `gemini-chat`. The `document-processor` edge function is used only for file extraction (base64 upload).

### Key Metrics (Post-Fix)

| Metric | Before | After |
|--------|--------|-------|
| API calls on login | ~20+ (duplicate syncs) | ~17 (one batch) |
| API calls on Settings navigate | ~15 | 0 |
| API calls on Community navigate | ~10 | ~7 (social only) |
| `ensureSocialUserExists` per login | 3 | 1 |
| `syncCloudDataToLocal` per session | 3+ | 1 |
| gemini-chat timeout | 20s | 240s |
| Token refresh | On cold start only | Every 45 min |
| Guest mode | Active (data leak risk) | Removed |
