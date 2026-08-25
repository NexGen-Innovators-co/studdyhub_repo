# StuddyHub Multi-Platform Server-Side API Architecture (BFF)

## 1. Executive Summary & Problem Statement

Historically, client applications (Android, iOS, Web) directly queried Supabase PostgreSQL tables using client-side SDK calls (`supabase.from('table').select(...)`, `.insert(...)`, etc.). While suitable for early rapid prototyping, direct client-side database coupling creates critical scaling, security, and multi-platform maintenance bottlenecks:

- **Schema Lock-In:** Renaming a database column or altering relations breaks existing deployed mobile clients until users update the app.
- **Fragmented Business Logic:** Complex workflows (e.g. creating a study note and calculating XP, updating streaks, and indexing search vectors) must be duplicated across Android (Kotlin), Web (TypeScript/React), and iOS (Swift).
- **Over-Fetching & Network Latency:** Multi-table joins require multiple client-side round-trips over high-latency cellular networks.
- **Inconsistent Security & Authorization:** Enforcing fine-grained business logic solely via PostgreSQL Row-Level Security (RLS) is cumbersome and lacks custom audit logging, payload validation, and rate-limiting.

## 2. Target Architecture: Unified Server-Side API Gateway

All client applications (Android, Web, iOS, Desktop) communicate with a unified, versioned REST/JSON API Gateway hosted on Supabase Edge Functions (`/functions/v1/api/*`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                           │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│  │   Android App        │  │     Web App         │  │   iOS / Other  │ │
│  │   (Kotlin/Compose)   │  │   (Next.js/React)   │  │  (Swift/Flutter│ │
│  └──────────┬───────────┘  └──────────┬──────────┘  └────────┬───────┘ │
└─────────────┼─────────────────────────┼──────────────────────┼─────────┘
              │ (HTTPS Bearer JWT)      │                      │
              ▼                         ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│             CENTRALIZED API LAYER (Supabase Edge Function API)         │
│                                                                        │
│  • JWT Auth & User Identification (`requireAuth` middleware)          │
│  • Zod/Schema Payload Validation                                       │
│  • Domain Business Logic Orchestration                                 │
│  • Atomic Transactions & XP/Streak Awarding                            │
│                                                                        │
│  Domain Modules:                                                       │
│  ├── /v1/notes       (List, Create, Update, Delete, Search)            │
│  ├── /v1/flashcards  (Decks, Cards, Review, SRS Interval Engine)       │
│  ├── /v1/quizzes     (List, Start Session, Submit Answers, Analytics)  │
│  ├── /v1/documents   (Library, Web Ingest, OCR, Chunk Status)          │
│  ├── /v1/study-plans (Active Plans, Milestone Tracking)                │
│  └── /v1/social      (Personalized Feed, Posts, Likes, Comments)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 DATA LAYER & EXTERNAL INTEGRATIONS                     │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │  PostgreSQL (Supabase)  │  │  AI / Gemini Services / Search Tools │ │
│  │  (Tables, Views, RLS)   │  │  (Embeddings, LLMs, Web Search)      │ │
│  └─────────────────────────┘  └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Standard API Response Contract

Every endpoint adheres to a strict standard envelope:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}
```

## 4. API Endpoints Specification

### 4.1 Notes Service (`/v1/notes`)
- `GET /v1/notes?folder_id=&search=&tag=&page=&limit=`: Returns user's notes with optional folder filtering and search.
- `GET /v1/notes/:id`: Returns single note with rich details and attached flashcards/quizzes.
- `POST /v1/notes`: Atomically creates a note, awards creation XP, and syncs search tags.
- `PUT /v1/notes/:id`: Updates title, content, or tags.
- `DELETE /v1/notes/:id`: Deletes note and cleans up associated references.

### 4.2 Flashcard Service (`/v1/flashcards`)
- `GET /v1/flashcards/decks`: Returns all flashcard decks with mastery level and due count.
- `GET /v1/flashcards/decks/:deck_id/cards`: Returns cards for study session.
- `POST /v1/flashcards/decks`: Creates new deck with initial cards.
- `POST /v1/flashcards/review`: Submits spaced repetition reviews (SM-2 rating: 1-5), updates next review date server-side.

### 4.3 Quiz Service (`/v1/quizzes`)
- `GET /v1/quizzes`: Returns available quizzes with previous attempt scores.
- `GET /v1/quizzes/:id`: Returns quiz questions and metadata.
- `POST /v1/quizzes/:id/submit`: Evaluates answers server-side, calculates accuracy, updates user stats/XP, and logs attempt.

### 4.4 Document & Web Resource Service (`/v1/documents`)
- `GET /v1/documents?folder_id=`: Returns document library with processing status and summary snippets.
- `POST /v1/documents/ingest-web`: Ingests an online URL or academic search result, parses markdown, and creates document record.
- `DELETE /v1/documents/:id`: Deletes document from storage and database.

### 4.5 Social & Feed Service (`/v1/social`)
- `GET /v1/social/feed?filter=&page=`: Returns pre-aggregated feed with author profile, like counts, and bookmark states.
- `POST /v1/social/posts`: Creates a new post.
- `POST /v1/social/posts/:id/like`: Toggles post like.
- `POST /v1/social/posts/:id/comment`: Adds comment.

## 5. Client Implementation Guidelines
Client applications use standard HTTP REST clients (e.g. `Ktor` / `Retrofit` in Android, `fetch` / `axios` in Web) targeting `https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/api/v1/...` with the `Authorization: Bearer <user_jwt>` header.
