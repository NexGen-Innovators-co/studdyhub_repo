# Backend — Supabase

> **Last updated:** 2026-08-24 — After API Gateway migration + server-side RPCs

## How the Mobile App Reaches the Backend

```
Mobile App
  │
  ├─ REST reads → API Gateway → /functions/v1/api/v1/<resource>
  ├─ RPC mutations → API Gateway → /functions/v1/api/v1/rpc/<function>
  ├─ Edge functions → Direct → /functions/v1/<function-name>
  └─ Realtime → WebSocket → Supabase Realtime channels
```

**Base URL:** `https://<project-ref>.supabase.co`
**Auth:** `Authorization: Bearer <user JWT>` on all requests

## API Gateway (`supabase/functions/api/index.ts`)

The gateway is a single Deno Edge Function that handles all client requests. It:

1. **Authenticates** via JWT (validates with Supabase Auth)
2. **Routes** to the correct handler (23 REST routes + RPC handler)
3. **Validates** inputs
4. **Enforces** user scoping (userId from JWT, not client-provided)
5. **Returns** consistent `{ success, data, error, meta }` responses

### REST Routes (reads + CRUD)

| Route | Methods | User Scoping |
|-------|---------|--------------|
| `/profile` | GET, PATCH | `id = auth.uid()` |
| `/profiles` | GET, POST | None (lookups) |
| `/notes` | GET, POST | `user_id = auth.uid()` |
| `/notes/:id` | PATCH, DELETE | `user_id = auth.uid()` |
| `/documents` | GET, POST | `user_id = auth.uid()` |
| `/documents/:id` | PATCH, DELETE | `user_id = auth.uid()` |
| `/document-folders` | GET, POST, PATCH, DELETE | `user_id = auth.uid()` |
| `/flashcards` | GET | `user_id = auth.uid()` |
| `/flashcards/decks` | GET | `user_id = auth.uid()` |
| `/flashcards/cards` | POST | `user_id = auth.uid()` |
| `/flashcards/cards/:id` | DELETE | `user_id = auth.uid()` |
| `/quizzes` | GET, POST | `user_id = auth.uid()` |
| `/quizzes/:id` | DELETE | `user_id = auth.uid()` |
| `/quizzes/:id/submit` | POST | `user_id = auth.uid()` |
| `/leaderboard` | GET | None (public) |
| `/schedule` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/chat/sessions` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/chat/messages` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/social/feed` | GET | None (public feed) |
| `/social/posts` | POST, DELETE | `author_id = auth.uid()` |
| `/social/likes` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/social/bookmarks` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/social/comments` | GET, POST | `user_id = auth.uid()` |
| `/social/groups` | GET, POST | None (public groups) |
| `/social/group-members` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/social/events` | GET, POST | None |
| `/social/follows` | GET, POST, DELETE | `follower_id = auth.uid()` |
| `/social/chat-messages` | GET, POST | `user_id = auth.uid()` |
| `/user-stats` | GET | `user_id = auth.uid()` |
| `/game-progress` | GET, POST | `user_id = auth.uid()` |
| `/roadmap-steps` | GET, POST, PATCH | `user_id = auth.uid()` |
| `/live-quiz-sessions` | GET, POST | None (public lobbies) |
| `/class-recordings` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/ai-podcasts` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/course-enrollments` | GET, POST, DELETE | `user_id = auth.uid()` |
| `/course-materials` | GET, POST | None (shared) |
| `/user-education-profiles` | GET, POST | `user_id = auth.uid()` |
| `/user-subjects` | GET, POST, DELETE | Via profile join |
| `/peer-cheers` | POST | `sender_id = auth.uid()` |
| `/social-users` | GET, POST | `id = auth.uid()` |

### RPC Handler (`/rpc/:functionName`)

All business logic mutations go through PostgreSQL RPCs:

| RPC | Purpose | Business Logic |
|-----|---------|----------------|
| `award_xp` | Award XP + credits + level | 500 XP cap, level = (xp/500)+1 |
| `submit_quiz_result` | Quiz completion | Stats + XP + streak + average |
| `spend_credits` | Spend credits | Atomic `SELECT ... FOR UPDATE` |
| `record_activity` | Record activity | Streak calc using `CURRENT_DATE` |
| `claim_daily_quest` | Daily quest | Date check + XP award |
| `claim_badge` | Badge claim | Dedup check + 50 XP |
| `submit_game_result` | Game completion | Stars + XP + progress + streak |
| `purchase_streak_freeze` | Buy freeze | Atomic credit deduction |

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "timestamp": "2026-08-24T..." }
}
```

## Edge Functions (80+)

Complex operations that need their own runtime:

| Category | Functions |
|----------|-----------|
| Auth | `auth-onboarding` |
| AI Chat | `gemini-chat` (agentic pipeline) |
| Live Quiz | `live-quiz` (server-authoritative) |
| Social | `create-social-post`, `toggle-like`, `toggle-bookmark`, `toggle-follow`, `comment-on-post`, `ai-rank-feed` |
| Content Gen | `generate-quiz`, `generate-ai-quiz`, `generate-flashcards`, `generate-podcast`, `generate-summary` |
| Audio | `gemini-audio-processor`, `podcast-transcribe`, `cloud-tts` |
| Documents | `document-extractor`, `document-processor`, `fetch-web-url` |
| Notifications | `send-notification`, `daily-notifications-engine` |

## Database

### Migrations
- Location: `supabase/migrations/`
- Format: `2026MMDD_description.sql`
- Latest: `20260824_server_side_rpcs.sql` (8 new RPCs)

### Key Tables
- `profiles` — user profiles (mirrors Room `ProfileEntity`)
- `user_stats` — XP, streaks, badges, quiz stats
- `notes`, `documents`, `document_folders` — content
- `quizzes`, `quiz_attempts` — quiz system
- `flashcards`, `flashcard_decks` — flashcard system
- `schedule_items` — schedule/calendar
- `chat_sessions`, `chat_messages` — AI chat
- `social_*` — social features (posts, likes, comments, groups, follows)
- `game_progress` — Explorer game progress
- `kid_roadmap_steps` — Explorer daily learning path
- `live_quiz_sessions/players/questions/answers` — live multiplayer

### RLS Policies
- All tables have RLS enabled
- Most scoped to `auth.uid()` (user can only see their own data)
- Social tables are more permissive (public read, scoped write)
- Edge functions use service role for cross-user operations

## Auth Flow

```
1. User signs up → Supabase Auth creates user
2. Auth-onboarding edge function creates profiles + user_stats rows
3. Client receives JWT (access + refresh tokens)
4. All API requests include `Authorization: Bearer <JWT>`
5. Gateway validates JWT → extracts userId → enforces user scoping
6. Access token auto-refreshes from refresh token
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Edge function env (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function env (server-side) |
| `GEMINI_API_KEY` | AI chat provider |
| `VITE_SUPABASE_URL` | Client build config |
| `VITE_SUPABASE_ANON_KEY` | Client build config |
