# StuddyHub — AI Study Workspace

<div align="center">

**Android app** · Jetpack Compose · Kotlin · Room · Supabase · Gemini

An AI-powered study workspace: smart notes, quizzes, flashcards, class recordings, AI podcasts, schedules, live quizzes, an agentic AI tutor, and a social study community — built offline-first with cloud sync.

</div>

---

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env: set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 2. Build
./gradlew :app:assembleDebug

# 3. Install
./gradlew :app:installDebug
```

## Documentation

| Document | Purpose | Read This First? |
|----------|---------|:---:|
| [`DEVELOPER.md`](DEVELOPER.md) | **Full onboarding guide** — architecture, rules, patterns, API contract | ✅ Yes |
| [`docs/API.md`](docs/API.md) | Complete API contract — all endpoints, params, responses | ✅ Yes |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture — layers, data flow, security | |
| [`docs/BACKEND.md`](docs/BACKEND.md) | Backend architecture — gateway, RPCs, edge functions | |
| [`docs/explorer_release_plan.md`](docs/explorer_release_plan.md) | Explorer (kids) feature plan | |

## Architecture

```
Android App → API Gateway → Supabase (Postgres + Auth)
                 ↑
            23 REST routes
            8 RPC mutations
            80+ Edge functions
```

**Key principle:** Server is source of truth. All business logic (XP, level, streak, credits) runs in PostgreSQL RPCs. The client caches locally from server responses.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Jetpack Compose + Material 3 |
| Local DB | Room (v24) |
| Backend | Supabase (Postgres + Edge Functions) |
| AI | Google Gemini (agentic pipeline) |
| Auth | Supabase Auth (email/password) |
| Realtime | Supabase Realtime (WebSocket) |
| Sync | Offline-first with sync queue |

## Project Structure

```
app/                    # Android app
  src/main/java/com/example/
    data/               # Room, API, sync, repository
    ui/                 # Compose screens, components, theme
supabase/               # Backend
  functions/api/        # API Gateway (Deno Edge Function)
  functions/            # 80+ edge functions
  migrations/           # SQL migrations
docs/                   # Documentation
```
