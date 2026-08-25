# StuddyHub — Developer Onboarding Guide

> **Read this before writing any code.** This document covers the entire monorepo.

## Project Overview

**StuddyHub** is an AI-powered study workspace available as a **web app** and **Android app**, sharing a single **Supabase backend**.

| Platform | Stack | Location |
|----------|-------|----------|
| **Web** | React + Vite + TypeScript + Shadcn/UI | `web/` |
| **Android** | Kotlin + Jetpack Compose + Room | `mobile/` |
| **Backend** | Supabase (Postgres + Edge Functions) | `supabase/` |

---

## Monorepo Structure

```
studdyhub_repo/
├── web/                    # Vite + React web app (deployed to Vercel)
│   ├── src/
│   │   ├── services/       # ← NEW: API Gateway service layer
│   │   │   ├── apiClient.ts        # HTTP client for gateway
│   │   │   ├── notesService.ts     # Notes CRUD
│   │   │   ├── documentsService.ts # Documents CRUD
│   │   │   ├── quizzesService.ts   # Quizzes + attempts
│   │   │   ├── socialService.ts    # Social feed, posts, likes
│   │   │   ├── chatService.ts      # AI chat sessions
│   │   │   ├── scheduleService.ts  # Schedule items
│   │   │   ├── profileService.ts   # User profile
│   │   │   ├── podcastsService.ts  # AI podcasts
│   │   │   ├── flashcardsService.ts# Flashcards
│   │   │   ├── leaderboardService.ts# Leaderboard
│   │   │   ├── rpcService.ts       # Server-side function calls
│   │   │   └── recordingsService.ts# Class recordings
│   │   ├── hooks/          # React hooks (data loading, auth)
│   │   ├── modules/        # Feature modules (admin, aiChat, etc.)
│   │   ├── pages/          # Route pages
│   │   └── integrations/supabase/client.ts  # Supabase SDK (auth only)
│   ├── .env.local          # Environment variables
│   └── vercel.json         # Vercel config
│
├── mobile/                 # Android app (built via GitHub Actions)
│   ├── app/src/main/java/com/example/
│   │   ├── data/remote/BackendApiService.kt  # API Gateway client
│   │   ├── data/repository/StuddyHubRepository.kt
│   │   └── ui/screens/    # Feature screens
│   └── DEVELOPER.md       # Mobile-specific docs
│
├── supabase/               # Shared backend
│   ├── functions/
│   │   ├── api/index.ts    # ← API Gateway (29 routes + RPC handler)
│   │   └── ... (80+ edge functions)
│   ├── migrations/         # SQL migrations
│   └── config.toml         # Project config
│
├── scripts/                # Dev utilities
│   ├── import-users.js     # User migration script
│   ├── import-data.js      # Data migration script
│   ├── export-old-data.sql # SQL export queries
│   └── check-triggers.sql  # Trigger verification
│
└── .github/workflows/
    └── build-and-distribute.yml  # APK build + Firebase distribution
```

---

## Architecture: API Gateway Pattern

**Both web and mobile apps talk to the same API Gateway.** The client NEVER talks to PostgREST directly.

```
┌──────────────┐     ┌──────────────┐
│   Web App    │     │  Android App │
│  (React)     │     │  (Kotlin)    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │  Authorization:    │
       │  Bearer <jwt>      │
       ▼                    ▼
┌──────────────────────────────────────┐
│        API Gateway (Edge Function)   │
│        /functions/v1/api/v1/*        │
│                                      │
│  • JWT Auth & User Identification    │
│  • Payload Validation                │
│  • Business Logic Orchestration      │
│  • Atomic Transactions               │
│                                      │
│  29 REST Routes + 8 RPC Endpoints   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│     Supabase Postgres + Auth         │
│     (RLS on all tables)              │
└──────────────────────────────────────┘
```

### Standard Response Format

All API Gateway responses follow this envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "timestamp": "2026-08-25T..." }
}
```

---

## Web App (`web/`)

### Key Files

| File | Purpose |
|------|---------|
| `src/services/apiClient.ts` | HTTP client — attaches JWT, handles timeouts |
| `src/services/*.ts` | Service layer — one file per domain |
| `src/hooks/useAuth.tsx` | Auth via Supabase SDK (login/logout/session) |
| `src/hooks/useAppData.tsx` | Data loading (notes, docs, recordings) |
| `src/contexts/AppContext.tsx` | Central state management |
| `src/integrations/supabase/client.ts` | Supabase SDK (used for auth only) |

### How to Make a Server Call (Web)

```typescript
import { notesService } from '@/services/notesService';

// List notes
const { data, total } = await notesService.list({ limit: 20 });

// Create note
const note = await notesService.create({ title: 'My Note', content: '...' });

// RPC call
import { rpcService } from '@/services/rpcService';
const result = await rpcService.awardXp(userId, 50, 'quiz');
```

### Migration Status: Direct Supabase → Service Layer

| Feature | Old (supabase.from) | New (service layer) | Status |
|---------|---------------------|---------------------|--------|
| Auth | `supabase.auth.*` | Keep as-is | ✅ Done |
| Notes | `supabase.from('notes')` | `notesService` | ✅ Ready |
| Documents | `supabase.from('documents')` | `documentsService` | ✅ Ready |
| Quizzes | `supabase.from('quizzes')` | `quizzesService` | ✅ Ready |
| Social | `supabase.from('social_*')` | `socialService` | ✅ Ready |
| Chat | `supabase.from('chat_*')` | `chatService` | ✅ Ready |
| Schedule | `supabase.from('schedule_*')` | `scheduleService` | ✅ Ready |
| Profile | `supabase.from('profiles')` | `profileService` | ✅ Ready |
| Podcasts | `supabase.from('ai_podcasts')` | `podcastsService` | ✅ Ready |
| Flashcards | `supabase.from('flashcards')` | `flashcardsService` | ✅ Ready |
| Leaderboard | `supabase.from('profiles')` | `leaderboardService` | ✅ Ready |
| RPCs | `supabase.rpc()` | `rpcService` | ✅ Ready |

The services are built and ready. Migration happens feature-by-feature — old code still works.

---

## Android App (`mobile/`)

See `mobile/DEVELOPER.md` for mobile-specific details.

### Key Points
- Uses `BackendApiService.kt` (3800+ lines) to call the API Gateway
- Room database for offline support
- All mutations go through server-side RPCs
- Offline fallback pattern for every operation

---

## API Gateway Routes (`supabase/functions/api/index.ts`)

**Base URL:** `https://<project>.supabase.co/functions/v1/api/v1`

### REST Routes (29)

| # | Route | Methods | Description |
|---|-------|---------|-------------|
| 1 | `rpc/:functionName` | POST | Generic RPC passthrough |
| 2 | `profile` | GET, PATCH | Current user profile |
| 3 | `profiles` | GET, POST | Profile lookups + upsert |
| 4 | `notes` | GET, POST, PATCH, DELETE | Notes CRUD |
| 5 | `documents` | GET, POST, PATCH, DELETE | Documents CRUD |
| 6 | `document-folders` | GET, POST, PATCH, DELETE | Folder management |
| 7 | `flashcards` | GET, POST, DELETE | Flashcards + decks |
| 8 | `quizzes` | GET, POST, DELETE | Quizzes + submit |
| 9 | `leaderboard` | GET | Tier/school rankings |
| 10 | `user-stats` | GET | User statistics |
| 11 | `schedule` | GET, POST, DELETE | Schedule items |
| 12 | `chat/sessions` | GET, POST, DELETE | Chat sessions |
| 13 | `chat/messages` | GET, POST, DELETE | Chat messages |
| 14 | `social/feed` | GET | Social feed |
| 15 | `social/posts` | POST, DELETE | Post CRUD |
| 16 | `social/likes` | GET, POST, DELETE | Like toggle |
| 17 | `social/bookmarks` | GET, POST, DELETE | Bookmark toggle |
| 18 | `social/comments` | GET, POST | Comments |
| 19 | `social/groups` | GET, POST | Groups |
| 20 | `social/group-members` | GET, POST, DELETE | Group membership |
| 21 | `social/events` | GET, POST | Events |
| 22 | `social/follows` | GET, POST, DELETE | Follow/unfollow |
| 23 | `social/chat-messages` | GET, POST | Group chat |
| 24 | `admin/status` | GET | Admin check |
| 25 | `subscriptions` | GET, POST | Subscription status |
| 26 | `notification-preferences` | GET, POST, PATCH | Notification prefs |
| 27 | `testimonials` | GET | Public testimonials |
| 28 | `app-ratings` | GET | App ratings |
| 29 | `notifications` | GET, PATCH | User notifications |

### RPC Endpoints (8)

| RPC | Purpose | Key Params |
|-----|---------|------------|
| `award_xp` | Award XP + update level | `p_user_id, p_xp_amount, p_reason` |
| `submit_quiz_result` | Quiz completion | `p_user_id, p_score, p_total, p_time_seconds` |
| `spend_credits` | Atomic credit deduction | `p_user_id, p_cost, p_item` |
| `record_activity` | Streak update | `p_user_id` |
| `claim_daily_quest` | Daily quest reward | `p_user_id, p_points` |
| `claim_badge` | Badge claim + 50 XP | `p_user_id, p_badge_name` |
| `submit_game_result` | Game completion | `p_user_id, p_game_key, p_level, p_score, p_total` |
| `purchase_streak_freeze` | Buy freeze | `p_user_id, p_cost` |

### Edge Functions (80+)

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

## Database Triggers

| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| `on_profile_create_social` | profiles | `handle_new_user_social` | Auto-create social_users on signup |
| `on_profile_change_update_stats` | profiles | `trigger_update_app_stats` | Update app_stats on profile change |
| `on_note_change_update_stats` | notes | `trigger_update_app_stats` | Update app_stats on note creation |
| `on_quiz_attempt_update_stats` | quiz_attempts | `trigger_update_app_stats` | Update app_stats on quiz |
| `on_document_change_update_stats` | documents | `trigger_update_app_stats` | Update app_stats on document |
| `on_podcast_change_update_stats` | ai_podcasts | `trigger_update_app_stats` | Update app_stats on podcast |

### App Stats Table
| Column | Source |
|--------|--------|
| `active_users` | Users who signed in within 30 days |
| `total_users` | All registered users |
| `notes_processed` | Total notes count |
| `quizzes_taken` | Total quiz attempts |
| `documents_uploaded` | Total documents |
| `podcasts_generated` | Total AI podcasts |
| `user_rating` | Average from app_ratings |
| `uptime` | Always 99.9% |

---

## Deployment Pipeline

```
Git Push to main
    │
    ├──→ Vercel (web app)
    │    ├── Root directory: web/
    │    ├── Build: npm run build (vite build)
    │    └── Auto-deploys on push
    │
    ├──→ GitHub Actions (Android APK)
    │    ├── Builds from mobile/
    │    ├── Creates debug APK
    │    └── Distributes via Firebase App Distribution
    │
    └──→ Supabase (Edge Functions)
         └── Deploy manually: supabase functions deploy api
```

---

## Environment Variables

### Web (`web/.env.local`)
```
VITE_SUPABASE_URL=https://vykidardmwtxwjtijjap.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
```

### Mobile (`mobile/.env`)
```
VITE_SUPABASE_URL=https://vykidardmwtxwjtijjap.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

### GitHub Actions Secrets
- `GEMINI_API_KEY`
- `GOOGLE_SERVICES_JSON`
- `FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

---

## Common Workflows

### Adding a New Feature

1. **Database:** Create table + RPC in `supabase/migrations/2026MMDD_*.sql`
2. **Gateway:** Add route in `supabase/functions/api/index.ts`
3. **Deploy gateway:** `supabase functions deploy api --project-ref vykidardmwtxwjtijjap`
4. **Web service:** Create `web/src/services/yourFeature.ts`
5. **Web hook/page:** Use the service in your component
6. **Mobile:** Add method in `BackendApiService.kt`
7. **Mobile UI:** Create screen in `ui/screens/your_feature/`

### Deploying

1. Commit and push to `main`
2. Vercel auto-deploys web app
3. GitHub Actions builds Android APK
4. Deploy edge functions manually when changed

### Migrating Data

```bash
# Export from old project SQL Editor
# Save as scripts/export/<table>.json

# Import to new project
node scripts/import-data.js
```

---

## Critical Rules

1. **Server is Source of Truth** — ALL mutations go through the API Gateway
2. **No PostgREST in Client** — Use the service layer (web) or BackendApiService (mobile)
3. **Auth stays on Supabase SDK** — `supabase.auth.*` is fine, everything else goes through gateway
4. **Always check response** — `if (result.success)` before using data
5. **Offline fallback** — Every operation needs a local fallback (mobile)
6. **Never hardcode user_id** — Always get from auth session
7. **One trigger per event** — Check for duplicates before adding triggers
