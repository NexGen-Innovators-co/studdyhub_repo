# Android Developer Guide

> **For mobile-specific docs.** See `../DEVELOPER.md` for the full monorepo architecture.

## Project Overview

**StuddyHub** Android app — part of a monorepo with a web app (`../web/`) sharing the same Supabase backend.

**Stack:** Kotlin + Jetpack Compose · Room (local DB) · Supabase (Postgres + Edge Functions) · Gemini AI

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│  Android App (Kotlin + Compose)                     │
│                                                     │
│  UI (Screens) → Repository → BackendApiService      │
│                                  │                  │
│                    ┌─────────────┴──────────────┐   │
│                    │  API Gateway                │   │
│                    │  /functions/v1/api/v1/      │   │
│                    │                            │   │
│                    │  REST endpoints (23 routes) │   │
│                    │  RPC endpoints (8 mutations)│   │
│                    │  Edge Functions (80+ hooks) │   │
│                    └─────────────┬──────────────┘   │
│                                  │                  │
│                    Supabase (Postgres + Auth)        │
└─────────────────────────────────────────────────────┘
```

---

## Critical Rules

### 1. Server is Source of Truth
- **ALL mutations** go through server-side RPCs (`/v1/rpc/*`)
- **ALL reads** go through the API Gateway (`/v1/*`)
- The client NEVER talks to PostgREST directly
- The client NEVER writes to the database directly

### 2. RPC Pattern for All Mutations
```kotlin
// WRONG — client calculates XP, pushes to cloud
localStats.totalXp += xp
pushUserStatsToCloud(localStats)

// RIGHT — server calculates, returns result
val result = BackendApiService.submitQuizResult(userId, score, total, time)
if (result is Success) {
    // Update local cache from server response
    updateLocalFromServer(result.data)
}
```

### 3. Offline Fallback Pattern
Every RPC call has a local fallback for offline mode:
```kotlin
val result = BackendApiService.awardXp(userId, 50, "quiz")
if (result is Success) {
    // Update local Room from server response
    updateLocalFromResponse(result.data)
} else {
    // Offline fallback: update locally only
    updateLocalOnly(50)
}
```

### 4. No PostgREST Syntax in Client
```kotlin
// WRONG — PostgREST syntax
executeRestGet("notes?select=*&user_id=eq.$userId&order=updated_at.desc")

// RIGHT — clean REST helpers
tableGet("notes", order = "updated_at.desc")

// RIGHT — explicit RPC call
callRpc("award_xp", JSONObject().put("p_user_id", userId).put("p_xp_amount", 50))
```

### 5. Response Format is Always `{ success, data, error, meta }`
```json
{
  "success": true,
  "data": { "total_xp": 150, "level": 1, "points_balance": 150 },
  "error": null,
  "meta": { "timestamp": "2026-08-24T..." }
}
```

---

## File Structure

### Android App (`app/src/main/java/com/example/`)
```
├── data/
│   ├── local/
│   │   ├── StuddyHubDatabase.kt      # Room DB (v24) + migrations
│   │   ├── dao/StuddyHubDaos.kt      # All DAOs
│   │   ├── entities/Entities.kt       # All Room entities
│   │   ├── SyncManager.kt            # Offline sync queue processor
│   │   └── KidsCurriculum.kt         # Explorer curriculum data
│   ├── remote/
│   │   ├── BackendApiService.kt       # API Gateway client (3800+ lines)
│   │   ├── GeminiApiService.kt        # Direct Gemini calls
│   │   ├── RealtimeSyncManager.kt     # Supabase Realtime subscriptions
│   │   └── LiveQuizRealtimeClient.kt  # Live quiz WebSocket client
│   └── repository/
│       └── StuddyHubRepository.kt     # Single repository (5400+ lines)
├── ui/
│   ├── StuddyHubApp.kt               # NavHost, bottom bar, root composable
│   ├── components/                    # Shared UI kit
│   └── screens/                       # One package per feature
```

### Backend (`supabase/`)
```
├── functions/
│   ├── api/index.ts                   # API Gateway (23 REST routes + RPC handler)
│   ├── auth-onboarding/index.ts       # Auth + profile sync
│   ├── gemini-chat/index.ts           # AI tutor (agentic pipeline)
│   ├── live-quiz/index.ts             # Live multiplayer quiz engine
│   └── ... (80+ edge functions)
├── migrations/                        # SQL migrations (chronological)
└── db/                                # Full DB dumps + validation
```

---

## API Gateway — The Only Way In

**Base URL:** `https://<project>.supabase.co/functions/v1/api/v1`

### REST Endpoints (reads + simple CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Current user's profile |
| PATCH | `/profile` | Update profile |
| GET | `/profiles?id=X` | Lookup profile by id/email |
| GET | `/notes` | List notes (query: folder_id, search, order, limit) |
| POST | `/notes` | Create note |
| PATCH | `/notes/:id` | Update note |
| DELETE | `/notes/:id` | Delete note |
| GET | `/documents` | List documents (query: folder_id, order, limit) |
| POST | `/documents` | Create/upload document |
| PATCH | `/documents/:id` | Update document |
| DELETE | `/documents/:id` | Delete document |
| GET | `/flashcards` | List flashcards |
| GET | `/flashcards/decks` | List decks |
| POST | `/flashcards/cards` | Create card |
| DELETE | `/flashcards/cards/:id` | Delete card |
| GET | `/quizzes` | List quizzes |
| POST | `/quizzes` | Create quiz |
| DELETE | `/quizzes/:id` | Delete quiz |
| POST | `/quizzes/:id/submit` | Submit quiz attempt |
| GET | `/leaderboard` | Tier/school scoped leaderboard |
| GET | `/schedule` | List schedule items |
| POST | `/schedule` | Create/update schedule item |
| DELETE | `/schedule/:id` | Delete schedule item |
| GET | `/chat/sessions` | List chat sessions |
| POST | `/chat/sessions` | Create session |
| GET | `/chat/messages` | List messages (query: session_id) |
| POST | `/chat/messages` | Create message |
| GET | `/social/feed` | Social feed with author data |
| POST | `/social/posts` | Create post |
| DELETE | `/social/posts/:id` | Delete post |
| GET/POST/DELETE | `/social/likes` | Toggle like |
| GET/POST/DELETE | `/social/bookmarks` | Toggle bookmark |
| GET | `/social/comments` | List comments (query: post_id) |
| POST | `/social/comments` | Create comment |
| GET/POST | `/social/groups` | Groups |
| GET/POST/DELETE | `/social/group-members` | Group membership |
| GET/POST | `/social/events` | Events |
| GET/POST/DELETE | `/social/follows` | Follow/unfollow |
| GET/POST | `/social/chat-messages` | Group chat |
| GET | `/user-stats` | User stats |
| GET | `/game-progress` | Game progress |
| GET/POST | `/roadmap-steps` | Roadmap steps |
| GET/POST | `/live-quiz-sessions` | Live quiz lobbies |
| GET/POST/DELETE | `/class-recordings` | Recordings |
| GET/POST/DELETE | `/ai-podcasts` | Podcasts |
| GET/POST/DELETE | `/course-enrollments` | Course enrollments |

### RPC Endpoints (mutations with business logic)

| RPC | Purpose | Key Params |
|-----|---------|------------|
| `award_xp` | Award XP + update level + credits | `p_user_id, p_xp_amount, p_reason` |
| `submit_quiz_result` | Quiz completion (stats + XP + streak) | `p_user_id, p_score, p_total, p_time_seconds` |
| `spend_credits` | Atomic credit deduction | `p_user_id, p_cost, p_item` |
| `record_activity` | Streak update (server time) | `p_user_id` |
| `claim_daily_quest` | Daily quest reward | `p_user_id, p_points` |
| `claim_badge` | Badge claim + 50 XP | `p_user_id, p_badge_name` |
| `submit_game_result` | Game completion (stars + XP + progress) | `p_user_id, p_game_key, p_level, p_score, p_total` |
| `purchase_streak_freeze` | Buy freeze (atomic) | `p_user_id, p_cost` |

### Edge Functions (complex operations)

| Function | Purpose |
|----------|---------|
| `auth-onboarding` | Auth + profile sync |
| `gemini-chat` | AI tutor (agentic pipeline) |
| `live-quiz` | Live multiplayer quiz engine |
| `create-social-post` | Post creation + moderation |
| `toggle-like` | Like/unlike with self-healing |
| `toggle-bookmark` | Bookmark toggle |
| `toggle-follow` | Follow/unfollow |
| `comment-on-post` | Comment creation |
| `generate-quiz` | AI quiz generation |
| `generate-ai-quiz` | Adaptive AI quiz |
| `generate-summary` | Note summarization |
| `generate-flashcards` | Flashcard generation |
| `generate-podcast` | AI podcast creation |
| `gemini-audio-processor` | Audio transcription/summary |
| `document-extractor` | Document processing |

---

## Key Business Logic (Server-Side)

All business logic runs in PostgreSQL RPCs, not on the client:

| Logic | RPC | Formula |
|-------|-----|---------|
| Level calculation | `award_xp` | `level = (total_xp / 500) + 1` |
| XP cap | `award_xp` | Max 500 XP per single award |
| Streak calculation | `submit_quiz_result` | Uses `CURRENT_DATE` (server time) |
| Average score | `submit_quiz_result` | Running average across all quizzes |
| Stars per game | `submit_game_result` | ≥90% = 3★, ≥70% = 2★, ≥40% = 1★ |
| Credit spending | `spend_credits` | `SELECT ... FOR UPDATE` (atomic) |
| Daily quest claim | `claim_daily_quest` | Server date check, one per day |
| Badge eligibility | `claim_badge` | Dedup check, awards 50 XP |

---

## Client-Side Patterns

### How to Make a Server Call
```kotlin
// For mutations (XP, quiz, game, spend, etc.)
val result = BackendApiService.submitQuizResult(userId, score, total, time)
if (result is BackendResult.Success) {
    val data = result.data
    // Update local Room from server response
    val stats = db.userStatsDao().getUserStatsDirect(userId)
    if (stats != null) {
        db.userStatsDao().insertOrUpdate(stats.copy(
            totalXp = data.optInt("total_xp", stats.totalXp),
            level = data.optInt("level", stats.level),
            // ... other fields from server response
        ))
    }
}

// For reads
val result = tableGet("notes", order = "updated_at.desc", limit = 50)
if (result is BackendResult.Success) {
    val notes = result.data // JSONArray of notes
}

// For RPCs
val result = callRpc("award_xp", JSONObject().apply {
    put("p_user_id", userId)
    put("p_xp_amount", 50)
    put("p_reason", "quiz")
})
```

### How to Add a New Feature

1. **Server-side:** Create SQL RPC in `supabase/migrations/`
2. **Gateway:** Add route handler in `supabase/functions/api/index.ts`
3. **Client RPC method:** Add `callRpc("your_rpc", params)` in `BackendApiService.kt`
4. **Client UI:** Create screen in `ui/screens/your_feature/`
5. **Repository:** Wire up with offline fallback pattern

---

## Database

- **Room DB:** `StuddyHubDatabase.kt` — version 24, 16+ entities
- **Cloud DB:** Supabase Postgres — tables mirror Room entities
- **Migrations:** `supabase/migrations/` — chronological `2026MMDD_*.sql`
- **RLS:** Enabled on all tables, scoped to `auth.uid()`
- **Sync:** Client writes to Room → enqueue sync → SyncManager replays to cloud

---

## Environment

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Supabase anon key |
| `GEMINI_API_KEY` | `.env` | Google Gemini API key |

Build with: `./gradlew :app:assembleDebug`

---

## Common Pitfalls

1. **Never trust client-side calculations for XP/level/streak** — always use server RPCs
2. **Never use PostgREST syntax** (`eq.`, `in.()`) — use clean REST helpers
3. **Never skip the offline fallback** — every RPC needs a local fallback
4. **Never push stats to cloud directly** — always go through `pushUserStatsToCloud()` or RPCs
5. **Never assume the server response format** — always check `result is Success` first
6. **Never hardcode user_id** — always use `getOrRestoreActiveUserId()`
7. **Always update local Room from server response** — server is source of truth
