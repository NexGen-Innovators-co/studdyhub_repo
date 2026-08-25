# Mobile App Architecture

> **Last updated:** 2026-08-24 — After API Gateway migration + server-side RPCs

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Android App (Kotlin + Jetpack Compose)                 │
│                                                         │
│  ┌─────────┐    ┌────────────┐    ┌──────────────────┐ │
│  │  UI      │───▶│ Repository │───▶│ BackendApiService│ │
│  │ (Compose)│    │ (Room +    │    │ (Gateway client) │ │
│  │          │    │  Flows)    │    │                  │ │
│  └─────────┘    └────────────┘    └────────┬─────────┘ │
│                                            │            │
│                                            ▼            │
│                                   ┌─────────────────┐   │
│                                   │ API Gateway      │   │
│                                   │ (Deno Edge Fn)   │   │
│                                   │ /functions/v1/   │   │
│                                   │   api/v1/        │   │
│                                   └────────┬────────┘   │
│                                            │            │
│                                   ┌────────▼────────┐   │
│                                   │ Supabase         │   │
│                                   │ Postgres + Auth  │   │
│                                   └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Layers

### 1. UI Layer (`ui/`)
- **One activity** — `MainActivity` → `StuddyHubApp()` (NavHost + bottom bar)
- **Screens** — one package per feature under `ui/screens/`
- **ViewModels** — created via `ViewModelFactory`, most screens have one
- **Components** — shared kit in `ui/components/` (avatars, podium, cards, etc.)

### 2. Data Layer (`data/`)
- **Room** (`StuddyHubDatabase`, v24) — source of truth on-device
- **Repository** (`StuddyHubRepository`, ~5400 lines) — single entry point for UI → data
- **BackendApiService** (~3800 lines) — API Gateway client, all cloud I/O
- **SyncManager** — offline write-ahead sync queue processor
- **RealtimeSyncManager** — Supabase Realtime subscriptions

### 3. Backend Layer (`supabase/`)
- **API Gateway** (`functions/api/index.ts`) — 23 REST routes + RPC handler
- **Edge Functions** — 80+ Deno functions for complex operations
- **Postgres** — tables mirror Room entities, RLS on all tables

## Data Flow

### Read Flow
```
UI (LaunchedEffect) → Repository Flow → Room DB → UI recomposes
                                          ↓ (background)
                                   SyncManager pulls from cloud
```

### Write Flow
```
UI (button tap) → Repository suspend fn → Server RPC
                                              ↓
                                         Server validates + calculates
                                              ↓
                                         Returns updated state
                                              ↓
                                         Update local Room from response
                                              ↓
                                         UI recomposes from Room Flow
```

### Offline Flow
```
UI → Repository → Server RPC (fails) → Local Room update only
                                              ↓
                                   SyncManager queues for later
                                              ↓
                                   When online: replay queue to cloud
```

## Key Design Decisions

1. **Server is source of truth** — All business logic (XP, level, streak, credits) runs in PostgreSQL RPCs
2. **Client caches locally** — Room DB is updated from server responses, not calculated client-side
3. **No direct DB access** — Client never talks to PostgREST; all through API Gateway
4. **Offline-first** — Every RPC has a local fallback; SyncManager replays when online
5. **Single repository** — `StuddyHubRepository` is the only data access point for UI

## Database Schema

### Room (v24) — 16+ entities
`ProfileEntity`, `NoteEntity`, `DocumentEntity`, `DocumentFolderEntity`, `QuizEntity`, `QuizAttemptEntity`, `FlashcardEntity`, `FlashcardDeckEntity`, `ScheduleItemEntity`, `ChatSessionEntity`, `ChatMessageEntity`, `UserStatsEntity`, `GameProgressEntity`, `RoadmapStepEntity`, `SyncQueueItemEntity`

### Cloud (Postgres) — mirrors Room + extras
Same tables plus: `social_posts`, `social_users`, `social_likes`, `social_bookmarks`, `social_comments`, `social_groups`, `social_follows`, `peer_cheers`, `live_quiz_sessions`, `live_quiz_players`, `live_quiz_questions`, `live_quiz_answers`, `ai_podcasts`, `podcast_chunks`, `audio_segments`, `courses`, `course_enrollments`, `institutions`, `content_moderation_log`

## Security

- **Auth:** Supabase email/password, JWT auto-refresh
- **RLS:** Enabled on all tables, scoped to `auth.uid()`
- **API Gateway:** All requests require valid JWT
- **Edge Functions:** Use service role for server-side operations
- **Client:** Never stores passwords; tokens in memory only
