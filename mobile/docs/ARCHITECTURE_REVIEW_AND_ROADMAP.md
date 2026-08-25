# Architecture Review & Scale Roadmap

> **Date:** 2026-08-21
> **Scope:** Full Android app + Supabase backend
> **Audience:** Engineering team planning production scaling

---

## 1. Current State Audit

### 1.1 — File Size & Complexity

| File | Lines | Problem |
|---|---|---|
| `StuddyHubRepository.kt` | **4,882** | God object — handles profile, roadmap, quizzes, flashcards, notes, documents, podcasts, social, AI chat, onboarding, sync, games, streaks, credits |
| `BackendApiService.kt` | **3,845** | God object — mixes auth, REST clients, edge function calls, profile CRUD, roadmap sync, quiz sync, document upload, social API, TTS |
| `StuddyHubApp.kt` | **785** | Monolithic composable — navigation, theme, all screens wired together |

**Industry standard:** 200–500 lines per file. These are 10–20× over budget.

### 1.2 — Codebase Metrics

| Metric | Current | Industry Standard |
|---|---|---|
| Total Kotlin files | 111 | — |
| ViewModels | 18 | — |
| Edge functions (Deno) | 93 | — |
| **Unit tests** | **0** | Every PR needs tests |
| **Integration tests** | **0** | Critical path coverage |
| **CI/CD pipeline** | **None** | Automated on every push |
| **Dependency injection** | Manual singletons | Hilt / Koin |
| **Architecture pattern** | God objects | Clean Architecture / MVVM |
| **Error handling** | Inconsistent (5+ patterns) | Single sealed interface |
| **DB schema governance** | Manual, out-of-date | Migration-only, CI-checked |

### 1.3 — What's Actually Good

- ✅ Jetpack Compose UI (modern, declarative)
- ✅ Room for local persistence (offline-first)
- ✅ Supabase for backend (Postgres + Edge Functions + Realtime)
- ✅ Progressive roadmap generation (just-in-time, token-efficient)
- ✅ Multi-tier system (Explorer/Achiever/Scholar)
- ✅ Flow-based reactive data (Room → Compose)
- ✅ Offline fallback infrastructure

---

## 2. Priority 1: CRITICAL (Do Before 100 Users)

### 2.1 — Break the God Repository

**Problem:** `StuddyHubRepository.kt` (4,882 lines) is a single class that handles every domain. This means:
- Every developer touches the same file → merge conflicts
- Impossible to test individual domains
- One bug in quiz code can break roadmap code
- New team members can't understand the codebase

**Solution:** Split into domain-based repositories:

```
data/repository/
  ├── ProfileRepository.kt         (~200 lines)  — profile, auth state, tier
  ├── RoadmapRepository.kt         (~300 lines)  — roadmap steps, lessons, learning path
  ├── QuizRepository.kt            (~200 lines)  — quizzes, attempts, scoring
  ├── SyncRepository.kt            (~250 lines)  — cloud ↔ local sync engine
  ├── OnboardingRepository.kt      (~150 lines)  — education setup, tier selection
  ├── ChatRepository.kt            (~200 lines)  — AI chat, sessions, messages
  ├── SocialRepository.kt          (~150 lines)  — posts, likes, bookmarks
  ├── GameRepository.kt            (~150 lines)  — game progress, XP, streaks
  └── DocumentRepository.kt        (~150 lines)  — notes, docs, folders
```

The existing `StuddyHubRepository` becomes a thin facade that delegates:
```kotlin
class StuddyHubRepository(
    val profile: ProfileRepository,
    val roadmap: RoadmapRepository,
    val quiz: QuizRepository,
    val sync: SyncRepository,
    // ...
)
```

**Migration strategy:** Don't rewrite — extract one domain at a time. Start with `ProfileRepository` since it's the most critical (auth/onboarding bug was here).

### 2.2 — Split BackendApiService

**Problem:** `BackendApiService.kt` (3,845 lines) mixes 15+ API domains in a single `object`.

**Solution:** One API client per domain, all sharing a common HTTP/JWT layer:

```
data/remote/
  ├── SupabaseHttpClient.kt       (~100 lines)  — shared HTTP, JWT, retry logic
  ├── AuthApi.kt                  (~200 lines)  — sign in, sign up, OTP, session
  ├── ProfileApi.kt               (~200 lines)  — profile CRUD, education profile
  ├── RoadmapApi.kt               (~150 lines)  — roadmap generate, fetch, upsert
  ├── ChatApi.kt                  (~200 lines)  — AI chat, streaming, sessions
  ├── QuizApi.kt                  (~150 lines)  — quiz generation, attempts
  ├── DocumentApi.kt              (~200 lines)  — upload, extract, process
  ├── SocialApi.kt                (~150 lines)  — posts, likes, comments
  └── SettingsApi.kt              (~100 lines)  — TTS, preferences, credits
```

### 2.3 — Dependency Injection (Hilt)

**Current:** Manual singletons with `companion object` + `getInstance()`:
```kotlin
// Fragile, untestable
class StuddyHubRepository(private val db: StuddyHubDatabase) {
    companion object {
        private var INSTANCE: StuddyHubRepository? = null
        fun getInstance(db: StuddyHubDatabase): StuddyHubRepository = ...
    }
}
```

**Target:** Hilt DI with constructor injection:
```kotlin
@Module @InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton fun provideDatabase(@ApplicationContext ctx: Context) =
        Room.databaseBuilder(ctx, StuddyHubDatabase::class.java, "studdyhub.db").build()

    @Provides @Singleton fun provideProfileRepository(db: StuddyHubDatabase, api: ProfileApi) =
        ProfileRepository(db, api)

    @Provides @Singleton fun provideSyncRepository(db: StuddyHubDatabase, sync: SyncApi) =
        SyncRepository(db, sync)
}

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val roadmapRepo: RoadmapRepository,
    private val profileRepo: ProfileRepository,
) : ViewModel() { ... }
```

**Why this matters:**
- Testable (inject mock repos)
- Lazy initialization (no manual singleton management)
- Compile-time safety (missing dependency = compile error)
- Industry standard (every Android team uses DI)

### 2.4 — Add Test Infrastructure

**Current: 0 tests.** For a production app with user data, this is the #1 risk.

**Minimum viable test coverage:**

| Layer | Tests | Priority |
|---|---|---|
| **Repository unit tests** | Mock Room + API, test business logic | 🔴 P0 |
| **Edge function tests** | Supabase has built-in Deno testing | 🔴 P0 |
| **Auth flow tests** | Sign up → verify → login → profile | 🔴 P0 |
| **Onboarding flow tests** | Tier selection → education setup → roadmap | 🟡 P1 |
| **Sync engine tests** | Conflict resolution, offline → online | 🟡 P1 |
| **E2E UI tests** | Espresso/Compose testing framework | 🟢 P2 |

---

## 3. Priority 2: IMPORTANT (Do Before Scaling to 1K Users)

### 3.1 — Module Separation

Everything is in one `app` module. At scale, build times will be 10+ minutes.

**Target structure:**
```
studdyhub/
  ├── core/                    # Shared: DB, DI, network, utils
  ├── domain/                  # Repository interfaces, models, use cases
  ├── feature-auth/            # Auth screen + viewmodel + tests
  ├── feature-onboarding/      # Onboarding screens + tests
  ├── feature-dashboard/       # Home screens + tests
  ├── feature-roadmap/         # LearnIt, lessons + tests
  ├── feature-quiz/            # Quiz system + tests
  ├── feature-chat/            # AI chat + tests
  ├── feature-social/          # Social feed + tests
  ├── feature-settings/        # Settings + profile + tests
  └── app/                     # Navigation, theme, entry point
```

**Benefits:**
- Parallel builds (each module compiles independently)
- Clear ownership (one team per module)
- Enforced boundaries (can't import across modules without explicit dependency)
- Faster CI (only rebuild changed modules)

**Migration strategy:** Start by extracting `core/` and `feature-auth/` as proof of concept.

### 3.2 — Standardize UI State Pattern

Currently each ViewModel manages UI state differently:
```kotlin
// Inconsistent patterns across ViewModels
class SomeViewModel {
    val uiState = MutableStateFlow(SomeUiState())
    val error = MutableStateFlow<String?>(null)
    val isLoading = MutableStateFlow(false)
}

// Standardize to:
data class DashboardUiState(
    val isLoading: Boolean = true,
    val roadmap: List<RoadmapStep> = emptyList(),
    val stats: UserStats? = null,
    val error: String? = null,
    val lastSyncAt: Long? = null,
)

sealed interface DashboardEvent {
    data class StepCompleted(val stepId: String) : DashboardEvent
    object RetryLoad : DashboardEvent
    data class FilterChanged(val filter: String) : DashboardEvent
}
```

### 3.3 — Standardize Error Handling

**Current:** 5+ different error patterns:
- `BackendResult<T>` (Success/Error)
- `Result<T>` (Kotlin stdlib)
- `try/catch` with `Log.e()`
- Silent swallowing (`catch { }`)
- String-based error messages

**Target:** Single `AppResult<T>` everywhere:
```kotlin
sealed interface AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>
    data class Error(val message: String, val code: Int? = null, val cause: Throwable? = null) : AppResult<Nothing>
    data object Loading : AppResult<Nothing>
}

// Extension for mapping
fun <T, R> AppResult<T>.map(transform: (T) -> R): AppResult<R> = when (this) {
    is AppResult.Success -> AppResult.Success(transform(data))
    is AppResult.Error -> this
    is AppResult.Loading -> this
}
```

### 3.4 — Edge Function Architecture

**Current:** 93 standalone functions with inconsistent patterns. Some share `_shared/` utilities but there's no enforced structure.

**Target:**
```
functions/
  ├── _shared/
  │   ├── middleware.ts          # Auth guard, rate limiting, CORS
  │   ├── database.ts           # Supabase client factory
  │   ├── validators.ts         # Input validation helpers
  │   ├── ai.ts                 # AI provider chain (Gemini, Groq, etc.)
  │   └── errorLogger.ts        # Structured error logging
  ├── roadmap/
  │   ├── generate.ts           # Main handler
  │   ├── cache.ts              # Caching logic
  │   └── prompts.ts            # AI prompt templates
  ├── quiz/
  │   ├── generate.ts
  │   ├── evaluate.ts
  │   └── prompts.ts
  └── cron/
      ├── roadmap-cron.ts
      └── notification-cron.ts
```

**Key principle:** Every edge function must:
1. Use shared auth middleware (not reimplement JWT parsing)
2. Validate inputs with shared validators
3. Return structured errors via shared logger
4. Have a timeout guard (no more 504s from runaway AI calls)

---

## 4. Priority 3: PRODUCTION QUALITY (Do Before 10K Users)

### 4.1 — CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: 17, distribution: temurin }
      - name: Lint
        run: ./gradlew lintDebug
      - name: Typecheck
        run: ./gradlew compileDebugKotlin
      - name: Unit Tests
        run: ./gradlew testDebugUnitTest
      - name: Build
        run: ./gradlew assembleDebug

  edge-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint Deno
        run: deno lint supabase/functions/
      - name: Type check
        run: deno check supabase/functions/*/index.ts
      - name: Test
        run: deno test supabase/functions/

  schema-check:
    runs-on: ubuntu-latest
    steps:
      - name: Verify migration consistency
        run: supabase db diff --use-migra
```

### 4.2 — Database Schema Governance

**Current problems:**
- `fulldb.sql` is out of date with production
- `real_schema.sql` was pulled manually and is stale by definition
- No CI check ensures migration consistency

**Rules:**
1. `supabase/migrations/` is the ONLY source of truth
2. Never edit production DB directly — always through migrations
3. CI runs `supabase db diff` on every PR to catch drift
4. Every column change needs a migration file with a descriptive name

### 4.3 — Monitoring & Observability

| Tool | Purpose | Status |
|---|---|---|
| Firebase Crashlytics | Android crashes | Dependency added, not configured |
| Supabase Dashboard | Edge function metrics | Available, not monitored |
| `system_error_logs` table | Backend errors | Exists, no dashboard |
| AI token tracking | Cost monitoring | Not implemented |

**Action items:**
- Configure Firebase Crashlytics (already in build.gradle)
- Create a Supabase Edge Function dashboard (invocations, errors, p95 latency)
- Add AI token cost tracking per user (for billing/limits)
- Set up alerts for error rate spikes

### 4.4 — Rate Limiting & Abuse Protection

**Current:** No rate limiting on edge functions. One user can spam AI calls.

**Need:**
- Per-user rate limits on AI-generating endpoints (gemini-chat, generate-roadmap, etc.)
- Global concurrency limits (prevent 1000 simultaneous AI calls)
- IP-based throttling for unauthenticated endpoints
- `system_error_logs` → auto-alert when error rate > 5%

---

## 5. Migration Strategy (Phased Approach)

### Phase 1: Foundation (Weeks 1–2)
```
□ Add Hilt dependency injection
□ Extract ProfileRepository from god repo
□ Extract AuthApi from god service
□ Add unit tests for profile + auth flows
□ Configure Firebase Crashlytics
□ Fix: deploy auth-onboarding migration + edge function
```

### Phase 2: Structure (Weeks 3–4)
```
□ Extract remaining domain repositories (8 files)
□ Extract remaining API clients (7 files)
□ Standardize error handling (AppResult<T>)
□ Standardize UI state pattern
□ Add CI pipeline (GitHub Actions)
□ Add integration tests for onboarding flow
```

### Phase 3: Scale (Weeks 5–8)
```
□ Module separation (core, domain, feature-*)
□ Edge function architecture standardization
□ Database schema CI check
□ Rate limiting on edge functions
□ Performance monitoring dashboard
□ AI token cost tracking
```

### Phase 4: Production (Weeks 9–12)
```
□ E2E UI tests (Compose testing)
□ Load testing (1000 concurrent users)
□ Security audit (RLS policies, auth flow)
□ App Store / Play Store submission prep
□ Monitoring alerts (error rate, latency, costs)
```

---

## 6. Quick Wins (Do Today)

These don't require architecture changes:

| # | Change | Impact |
|---|---|---|
| 1 | Deploy `20260821_combined_fix_trigger_and_rpcs.sql` | Fixes auth-onboarding 500s |
| 2 | Deploy `auth-onboarding` edge function | Single source of truth for profiles |
| 3 | Deploy `generate-roadmap` rewrite | Progressive generation, less token waste |
| 4 | Add `distinctUntilChanged` to Flows | Reduces recomposition churn |
| 5 | Batch roadmap UPSERT | 16 calls → 1 call |
| 6 | Add `@OptIn(ExperimentalCoroutinesApi::class)` | Suppresses compiler warning |
| 7 | Configure Firebase Crashlytics | Crash visibility |

---

## 7. Anti-Patterns to Fix

| Anti-Pattern | Where | Fix |
|---|---|---|
| God object | `StuddyHubRepository` (4,882 lines) | Split into domain repos |
| God object | `BackendApiService` (3,845 lines) | Split into API clients |
| Manual DI | `companion object { fun getInstance() }` | Hilt |
| String-based errors | `throw Exception("message")` | Sealed interface |
| Silent error swallowing | `catch { }` / `catch { Log.e() }` | Structured error logging |
| No tests | Entire codebase | Add test infrastructure |
| No CI | No automation | GitHub Actions |
| Mutable state without validation | `academicTier` accepting `"null"` string | Server-side CHECK + client sanitization |
| Blocking main thread | REST calls in `viewModelScope` | Move to `Dispatchers.IO` |
| Sequential where parallel is possible | Roadmap week generation | Parallel with semaphore (done ✅) |
| No rate limiting | All edge functions | Add per-user limits |
| Stale schema | `fulldb.sql` vs real DB | Migration-only governance |

---

## 8. Recommended Tech Stack (Production)

| Layer | Current | Recommended |
|---|---|---|
| **DI** | Manual singletons | Hilt |
| **Networking** | OkHttp manual | Retrofit + OkHttp |
| **Local DB** | Room (good) | Room (keep) |
| **State** | MutableStateFlow | Kotlin StateFlow + sealed interface |
| **Navigation** | Compose Navigation | Compose Navigation (keep) |
| **Testing** | None | JUnit5 + MockK + Compose Testing |
| **CI/CD** | None | GitHub Actions |
| **Crash reporting** | None | Firebase Crashlytics |
| **Analytics** | None | Firebase Analytics / PostHog |
| **Edge functions** | 93 standalone | Structured with shared middleware |
| **DB governance** | Manual | Migration-only + CI diff check |

---

## 9. Team Scaling Considerations

### For a team of 2–5 developers:

1. **Module boundaries** = team boundaries. Each developer owns a feature module.
2. **CI on every PR** = no broken code reaches main.
3. **Shared `core/`** = common patterns (DI, error handling, networking) maintained by one person.
4. **Edge function ownership** = each feature team owns their functions.
5. **Migration reviews** = every DB change needs a PR review (prevents schema drift).

### Code review checklist:

```
□ Does this PR have tests?
□ Does it follow the AppResult<T> error pattern?
□ Is the new code in the correct module/feature?
□ Does the DB change have a migration?
□ Are edge function changes backward-compatible?
□ Is the API contract documented?
```

---

*This document is a living guide. Update it as the architecture evolves.*
