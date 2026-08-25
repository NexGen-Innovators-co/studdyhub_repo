# Explorer Mode (Kids / Primary-to-JHS) — Current-State Audit

**Date:** August 19, 2026
**Scope:** Entire codebase — Android app, Supabase edge functions, database schema, migrations
**Purpose:** Factual inventory for a follow-up planning session. No proposals or new schema.

---

## PART A — Explorers-Specific Surface Area

### A1. Distinct "Explorers" Mode / User Type

**Yes — a three-tier `AcademicTier` enum determines the entire UI theme, navigation, and AI persona.**

| Field | File | Values |
|-------|------|--------|
| `academicTier` | `app/.../ui/theme/TierTheme.kt:18-60` | `EXPLORER` (key=`"explorer"`), `ACHIEVER` (key=`"achiever"`), `SCHOLAR` (key=`"scholar"`) |
| `academic_tier` | cloud `profiles` table | Mirrors the enum key string. Set during onboarding or via Settings. |

**How tier is determined from onboarding:** `StuddyHubRepository.kt:259` maps education level names:
```
"primary", "basic", "jhs", "junior" → "explorer"
"shs", "high school" → "achiever"
"undergraduate", "graduate", "university" → "scholar"
```

**Tier switching:** Users can change tier from `ProfileAndSettingsScreen.kt:863-938` or `SettingsScreen.kt:247-307`. A **parental gate** (math puzzle) blocks tier changes: `ParentalGateModal.kt:31`.

**Navigation differs by tier** (`Screen.kt:121-134`):
- EXPLORER bottom nav: `Dashboard`, `Ranking`, `Profile` (3 tabs)
- ACHIEVER bottom nav: `Dashboard`, `Library`, `Practice`, `Assistant`, `Community` (5 tabs)

### A2. Kid-Facing Screens & Components

| Screen / Route | File | Status | What It Does |
|---------------|------|--------|-------------|
| `ExplorerHomeContent` | `dashboard/ExplorerHomeContent.kt` | **Live** | Main Explorer dashboard: streak calendar, next-mission hero card, 4 hub doors (Lessons, Multiplayer, Badges, Store), game arcade row, daily quest vault |
| `ExplorerGameDetailScreen` | `quizzes/ExplorerGameDetailScreen.kt` | **Live** | Game detail with level ladder (1-5), star thresholds, level generation trigger |
| `ExplorerQuizRunnerScreen` | `quizzes/ExplorerQuizRunnerScreen.kt` | **Live** | Full-screen kid-friendly quiz runner with big colored tiles, mascot reactions, confetti animation |
| `ExplorerBadgesScreen` | `quizzes/ExplorerBadgesScreen.kt` | **Live** | Ghanaian trophy badges showcase with Adinkra meanings |
| `ExplorerStoreScreen` | `quizzes/ExplorerStoreScreen.kt` | **Live** | Credits store: emoji avatars, streak freezes, 2X boosters |
| `ExplorerRoadmapDialog` | `dashboard/ExplorerRoadmapDialog.kt` | **Live** | Visual roadmap dialog showing learning journey stages |
| `SpellingBeeScreen` | `quizzes/SpellingBeeScreen.kt` | **Live** | Letter-tile spelling game with TTS word pronunciation |
| `LearnItScreen` | `quizzes/LearnItScreen.kt` | **Live** | Interactive lesson viewer (paragraphs, vocab, practice quiz) |
| `MathAsteroidBlasterGameScreen` | `quizzes/MathAsteroidBlasterGameScreen.kt` | **Live** | Canvas-based asteroid blaster math game with audio engine |
| `RankingScreen` | `RankingScreen.kt` | **Live** | Tier-filtered leaderboard (Explorers see school classmates) |
| `StreakCalendarWidget` | `components/StreakCalendarWidget.kt` | **Live** | 3D tactile weekly streak calendar with freeze indicators |
| `GameAudioEngine` | `components/GameAudioEngine.kt` | **Live** | Native PCM synthesizer: victory fanfares, laser shots, explosions, combo chimes |
| `TactileFeedback` | `components/TactileFeedback.kt` | **Live** | Haptic + audio feedback wrappers for game actions |
| `ConfettiExplosionEffect` | `components/ConfettiExplosionEffect.kt` | **Live** | Canvas-drawn confetti particles for celebrations |
| `MascotAssetSystem` | `components/MascotAssetSystem.kt` | **Live** | Ollie mascot with mood badges and aura effects |
| `AvatarSystem` | `components/AvatarSystem.kt` | **Live** | 3D HD avatar renderer with rarity auras and floating physics |
| `AICompanionFAB` | `components/AICompanionFAB.kt` | **Live** | Floating Ollie mascot FAB for quick AI access |
| `ParentalGateModal` | `components/ParentalGateModal.kt` | **Live** | COPPA-compliant math-puzzle parental gate |
| `ExplorerGames` | `quizzes/ExplorerGames.kt` | **Live** | Game config definitions (4 hero games with level ladders) |
| `KidsCurriculum` | `data/local/KidsCurriculum.kt` | **Live** | Ghana-specific offline fallback curriculum data |

### A3. Content Targeting by Age/Grade

**Partial — exists for tier selection and curriculum subjects, but NOT for individual content items.**

| What | Where | Details |
|------|-------|---------|
| Tier determines AI persona | `StuddyHubRepository.kt:3437-3441` | EXPLORER gets strict kid-safety system prompt + "Ollie" persona |
| Education level → tier mapping | `StuddyHubRepository.kt:259` | Primary/JHS → explorer |
| Grade selection in onboarding | `OnboardingScreen.kt:1880-2100` | User picks country → education level (Primary/JHS/SHS) → grade → subjects |
| `education_levels` table | Cloud schema | Has `category` field: `"primary"`, `"lower_secondary"`, `"upper_secondary"` |
| `subjects` table | Cloud schema | Has `category`: `"core"` or `"elective"`. Core Four: ENG, MATH, SCI, SST |
| `user_education_profiles` | `Entities.kt:228-248` | Stores `levelName`, `levelCategory`, `yearOrGrade` — but used for curriculum, not content filtering |
| Quiz difficulty band | `KidsCurriculum.kt:90` | `difficultyBandForCategory()` maps level → `"primary"` / `"JHS"` / `"SHS"` |
| **Content-level age tagging** | **Not found** | No `age_band`, `age_range`, or `grade_band` field on quizzes, notes, flashcards, courses, or documents |

---

## PART B — Gamification Infrastructure

### B1. XP, Levels, Streaks

**Table: `user_stats`** (`Entities.kt:308-326`)

| Column | Type | Default | How Updated |
|--------|------|---------|-------------|
| `userId` | String (PK) | `"default_user"` | Set on first use |
| `totalXp` | Int | 0 | +XP on quiz completion (`recordQuizAttempt`, line 2244), game level completion (`recordGameLevelCompletion`, line 702), daily quest claim |
| `level` | Int | 1 | Computed: `(totalXp / 500) + 1` — updated at `line 2253` |
| `currentStreak` | Int | 0 | Updated by `recordStudyActivity()` at `line 2290` — increments if last study was ≤24h ago, resets to 1 otherwise |
| `longestStreak` | Int | 0 | `maxOf(currentStreak, longestStreak)` — updated at `line 2305` |
| `totalQuizzesCompleted` | Int | 0 | Incremented on quiz attempt save |
| `averageScore` | Float | 0f | Running average of quiz percentages |
| `totalStudyTimeSeconds` | Int | 0 | Accumulated study time |
| `lastStudyDayMillis` | Long | 0L | Epoch millis of last study day — used for streak decay |
| `streakFreezes` | Int | 0 | Bought from credits store (`StuddyHubRepository.kt:1143`) |
| `lastDailyQuestClaimedDate` | String | "" | ISO date of last daily quest claim (`line 1164`) |

**UI surfaces:** `StreakCalendarWidget` (weekly calendar), `ExplorerHomeContent` (streak count), `ProfileScreen` (streak stat), `ProfileAndSettingsScreen` (streak calendar)

### B2. Badges & Achievements

**No database-backed achievements table exists.** Badges are hardcoded in the mobile app only:

**`ExplorerBadgesScreen.kt:52-168`** — 8 hardcoded `GHANAIAN_BADGES`:

| Badge ID | Title | Category | Requirement | Hardcoded `isUnlocked` |
|----------|-------|----------|-------------|----------------------|
| `badge_adinkra` | Adinkra Sage | CULTURE | Score 3★ in Kente Heritage Bowl | `true` |
| `badge_oware` | Oware Grandmaster | MATH | Solve 20 math quests | `true` |
| `badge_spelling` | Spelling Bee Ace | ENGLISH | Spell 15 words accurately | `true` (0.8 progress) |
| `badge_black_star` | Black Star Legend | HERITAGE | Complete all SST independence lessons | `false` |
| `badge_scientist` | Junior Scientist | SCIENCE | Complete 3 Science lessons | `true` |
| `badge_streak` | Streak Guardian | STREAK | 3-day active streak | `true` |
| `badge_speed` | Chaskele Speedster | SPEED | Complete speed quiz in <30s | `false` |
| `badge_all_round` | Black Star Trophy | TROPHY | Unlock all 7 primary badges | `false` |

**Key issue:** All badges have hardcoded `isUnlocked` values — **no code awards them dynamically.** No `awardAchievement` function exists anywhere.

### B3. Quizzes & Flashcards

**Tables:** `quizzes`, `quiz_attempts`, `flashcards` (defined in `Entities.kt`, synced via `SyncManager.kt`)

**Quiz creation flow:**
1. AI generates via `generateQuizFromTopic()` → backend `generate-ai-quiz` edge function → Gemini fallback
2. Stored locally in `quizzes` table, synced to cloud
3. Attempt scored: score/total → percentage → XP = `score * 25 + 50`
4. `recordQuizAttempt()` at `StuddyHubRepository.kt:2244` writes to `quiz_attempts` and updates `user_stats`

**Flashcards:** Created via AI (`generateFlashcardsFromNote`, `generateFlashcardsFromTopic`) → `generate-flashcards` edge function. Review tracked by `reviewFlashcard()` with spaced repetition intervals.

**`weak_areas`:** Schema exists in `gemini-chat/db_schema.ts:795` (`weak_areas: text[]`) but is **never populated from the mobile app** — only referenced in the edge function's `topicStats` structure.

### B4. Live/Multiplayer Quiz System

**Fully built and live.** Traced through:

**Backend (edge functions):**
- `live-quiz/index.ts` — Full edge function: create session, join, submit answers, advance questions, podium, watchdog timer
- Database tables: `live_quiz_sessions`, `live_quiz_players`, `live_quiz_questions`, `live_quiz_answers`, `player_question_progress` (schema in `db_schema.ts`)

**Mobile frontend:**
- `QuizzesViewModel.kt:1136-1582` — Complete live session management: host/join, realtime subscription, answer submission, phase transitions, leaderboard
- `LiveQuizRealtimeClient.kt` — Supabase Realtime WebSocket client for live state updates
- `QuizzesScreen.kt:1349-1800+` — `LiveQuizSessionRunner`: full Kahoot-style question UI with server-authoritative countdown, host ranking peek, mediator mode, confetti podium
- `LiveQuizResultsScreen` — Post-game results with ranking, per-question review

**Explorer-specific:** `SpeedRace` screen (`Screen.kt:82`) reuses `LiveQuizSessionRunner` for kid-friendly quick-match. `QuizzesViewModel.kt:1353` creates speed race sessions with 15s time limits.

### B5. Adaptive Difficulty / Topic Mastery

**Server-side only, not surfaced in UI:**

- `gemini-chat/context-service.ts:257-295` — `analyzeTopicMastery()`:
  - Queries `quiz_attempts` per subject, computes average score
  - Classifies: `≥90%` expert, `≥75%` advanced, `≥60%` intermediate, else beginner
  - Returns `topicMastery: Map<string, {averageScore, masteryLevel}>`
- Used by `context-service.ts:760-834` to build AI context for the chat tutor
- `gemini-chat/actions-service.ts:1665-1704` — `topicStats` with `weak_areas` field exists in schema but is only populated when explicitly updated

**NOT surfaced in any mobile UI.** The mobile app does not display mastery levels, weak areas, or adaptive difficulty indicators.

---

## PART C — Content & Curriculum Alignment

### C1. National Curriculum Mapping

**Yes — partial Ghanaian curriculum mapping exists in the cloud education schema:**

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `countries` | `id`, `code` (e.g. "GH"), `name` | Country picker |
| `education_levels` | `id`, `name`, `category` ("primary"/"lower_secondary"/"upper_secondary") | Grade bands |
| `curricula` | `id`, `name` (e.g. "NaCCA Standard") | Curriculum framework |
| `subjects` | `id`, `code` (ENG/MATH/SCI/SST/ICT), `name`, `category` ("core"/"elective") | Subject catalog |
| `examinations` | `id`, `name` (e.g. "BECE") | Target exams |

**Offline fallbacks** in `KidsCurriculum.kt:41-103`:
- Ghana hardcoded as default country
- Primary (Basic 1-6), Lower Secondary (JHS 1-3), Upper Secondary (SHS 1-3)
- Core Four: English, Mathematics, Science, Social Studies
- Electives: ICT, Creative Arts, French, Twi/Ghanaian Language

**What's missing:** No strand/indicator codes, no syllabus references, no lesson-level curriculum alignment. The schema provides grade bands and subjects but NOT curriculum content structure.

### C2. Content Creation Pipeline

| Content Type | Creation Mechanism | File Reference |
|-------------|-------------------|----------------|
| **Quizzes** | AI-generated on demand via `generate-ai-quiz` / `generate-quiz` edge functions | `BackendApiService.kt:2964-2984` |
| **Flashcards** | AI-generated on demand via `generate-flashcards` edge function | `BackendApiService.kt:3088` |
| **Notes** | User-created (rich text editor) or AI-generated from documents | `NoteDetailScreen.kt`, `StuddyHubRepository.kt:2532` |
| **Roadmap lessons** | AI-generated via `generate-roadmap` + `generate-interactive-lesson` edge functions | `StuddyHubRepository.kt:823` |
| **Podcast scripts** | AI-generated via `generate-podcast` edge function | `BackendApiService.kt:2915` |
| **Courses** | Admin-created (web app only, no mobile creation) | `BackendApiService.kt:1300+` |
| **Spelling Bee words** | AI-generated via `generate-spelling-words` edge function | `BackendApiService.kt:1274` |
| **Explorer game questions** | AI-generated per level at play time | `QuizzesViewModel.kt:369-400` |

**No CMS, no admin tool on mobile, no teacher-submitted content, no pre-seeded question banks.** All content is either user-authored or AI-generated on demand.

### C3. Language Support

**English only. No localization/i18n infrastructure exists.**

- All UI strings are hardcoded in English in Kotlin source files
- No `strings.xml` resource files used (all text inline in Compose)
- No language selection setting
- No multi-language content fields
- TTS voice selection in `TtsSettings.kt:83-130` filters for `Locale.US` English voices only
- Onboarding data labels are in English (from cloud or Ghana fallback constants)

---

## PART D — Engagement, Retention & Safety

### D1. Notifications

**Database tables exist in cloud schema (`db_schema.ts`):**
- `notification_preferences` — push notification settings
- `notifications` — notification records
- `notification_subscriptions` — subscription tracking

**Mobile app:** No push notification implementation found. No Firebase Cloud Messaging (FCM) setup. No streak reminder, daily-nudge, or re-engagement logic. `FirebaseApp` fails to initialize on every launch (`FirebaseApp: Default FirebaseApp failed to initialize`).

**Daily Quest** is the only retention mechanic: `ExplorerHomeContent.kt:777-791` — `DailyQuestGenerator` creates daily tasks (finish lesson, play game) with point rewards. Claimed via `StuddyHubRepository.claimDailyQuest()`.

### D2. Parent/Guardian & Teacher Visibility

**Parental gate exists but NO parent/teacher dashboard:**
- `ParentalGateModal.kt:31` — COPPA-compliant math puzzle gate for sensitive settings
- `ProfileAndSettingsScreen.kt:831-849` — "Parent / Guardian Settings" section header (label only, no actual functionality behind it)
- `SettingsScreen.kt:69-98` — `showParentalGateForTier` / `showParentalGateForSignOut` gates

**No parent/teacher account concept.** No visibility into child's progress. `school_name` field on `profiles` exists but is used for class leaderboard grouping (`StuddyHubRepository.kt:1169-1194`), not for teacher oversight.

### D3. Content Moderation & Child Safety

**`ChildSafetyGuard.kt`** — Local PII/inappropriate content filter:
- Blocks phone numbers, emails, address requests
- Blocks inappropriate keywords (porn, sex, gambling, kill, weapon, drugs, suicide)
- Sanitizes multiplayer display names
- Applied in `AIChatViewModel.kt:467-468` when `activeTier == EXPLORER`

**AI system prompt for Explorer tier** (`StuddyHubRepository.kt:3437-3441`):
```
STRICT SAFETY RULES: age-appropriate for kids under 13. Never ask for or accept
personal information. Never generate violent, adult, or inappropriate themes.
```

**Database moderation tables** exist in schema (`content_moderation_log`, `content_moderation_queue`) but are **not used by the mobile app** — no code writes to or reads from them.

### D4. Screen-Time / Usage Controls

**Not found.** No screen-time limits, session caps, or usage tracking specific to kids mode anywhere in the codebase. No `screenTime`, `usageLimit`, `sessionCap`, or `timeLimit` fields in any entity or cloud table for kids.

### D5. Offline Support

**Partial — local Room database provides offline-first reads:**
- All entities synced via `SyncManager.kt` with offline queue
- `LocalStorageManager.kt:48-118` — permanent offline file storage
- `KidsCurriculum.kt:41-103` — offline fallback curriculum when cloud unreachable
- `NetworkStatus.kt:21-50` — `rememberIsOnline()` composable tracks real connectivity
- `NetworkCallback` in `SyncManager.kt:52-74` — triggers sync when back online
- Onboarding has offline mode with sync notification (`OnboardingViewModel.kt:754-808`)

**NOT a dedicated low-data mode.** No image compression, no content pre-caching, no "download for offline" feature.

---

## PART E — Technical Constraints

### E1. Frontend Framework & Platform

| Aspect | Detail |
|--------|--------|
| **Platform** | Native Android (Kotlin + Jetpack Compose) — `app/build.gradle` |
| **UI Framework** | Jetpack Compose with Material3 |
| **State Management** | MVVM: `ViewModel` + `StateFlow` / `collectAsStateWithLifecycle` |
| **DI** | Manual singleton pattern (`StuddyHubRepository.getInstance()`, `BackendApiService`) |
| **DB** | Room (SQLite) — `StuddyHubDatabase.kt`, version 11+ |
| **Backend** | Supabase (PostgreSQL + Edge Functions + Realtime) — no direct SDK, all REST via `BackendApiService.kt` |
| **AI** | Supabase Edge Functions → Gemini API (via `gemini-chat`, `generate-*` functions) |
| **Auth** | Supabase Auth (email/password) |
| **Build** | Gradle (Kotlin DSL) |

### E2. Asset/Media Pipeline

| Asset Type | Storage | References |
|-----------|---------|------------|
| **App images** | Android drawable resources (`R.drawable.*`) | `ExplorerGames.kt`, `ExplorerHomeContent.kt` |
| **User uploads** | Supabase Storage (`documents` bucket) | `DocumentUploadHelper.kt` |
| **AI-generated audio** | Supabase Storage (podcast audio) | `AIPodcastViewModel.kt` |
| **Game audio** | **PCM synthesis at runtime** — `GameAudioEngine.kt:15-230` generates all sounds via `AudioTrack` | Victory fanfares, laser shots, explosions, chimes |
| **Animations** | Compose `Canvas` — `ConfettiExplosionEffect.kt`, `ExplorerQuizRunnerScreen.kt:425`, `MathAsteroidBlasterGameScreen.kt:236` | Confetti particles, game rendering |
| **3D rendering** | `ChatMarkdownRenderer.kt:1480-1513` — Three.js canvas for diagrams | WebView-based, experimental |
| **No Lottie, no Unity, no game engine** | Game rendering is all Compose Canvas | — |

### E3. Subscription / Tier Gating

**No subscription system exists.** The `AcademicTier` (Explorer/Achiever/Scholar) is a **user preference**, not a paywall:
- Free for all users
- Can be switched freely (with parental gate for Explorer)
- No feature gating based on tier — all features available in all tiers
- No `createSubscriptionValidator`, no payment processing, no plan-based restrictions

---

## PART F — Summary Gap Table

| Capability | Exists Today? | Where | Notes for Integration Planning |
|-----------|--------------|-------|-------------------------------|
| Distinct Explorers mode/route | **Yes** | `TierTheme.kt`, `Screen.kt` (3-tab nav), `StuddyHubApp.kt` | Full tier system with dedicated nav, theme, AI persona |
| Grade-band / age-band content tagging | **Partial** | `education_levels` table, `KidsCurriculum.kt` | Grade/level selection exists at onboarding, but individual content items (quizzes, notes, flashcards) have NO age/grade tagging |
| Ghanaian curriculum mapping | **Partial** | `countries`, `education_levels`, `subjects` tables, `KidsCurriculum.kt` | Subject codes (ENG/MATH/SCI/SST) and grade bands exist, but NO strand/indicator/syllabus-level mapping |
| XP/streak system | **Yes** | `user_stats` table, `StuddyHubRepository.kt`, `StreakCalendarWidget.kt` | Full XP/level/streak system with streak freezes and daily quest |
| Badges/achievements | **Partial** | `ExplorerBadgesScreen.kt` (hardcoded) | 8 badges exist visually but `isUnlocked` is hardcoded — NO dynamic award logic, NO database backing |
| Live multiplayer quiz capability | **Yes** | `live-quiz` edge function, `LiveQuizRealtimeClient.kt`, `LiveQuizSessionRunner` | Fully built and live — host/join, realtime, podium, speed race mode |
| Adaptive difficulty engine | **Partial** | `gemini-chat/context-service.ts:257-295` | Server-side `analyzeTopicMastery` exists but is NOT surfaced in any UI |
| Multi-language content/UI support | **No** | — | English only. No i18n infrastructure, no translation files, no language selection |
| Offline/low-data mode | **Partial** | `SyncManager.kt`, `LocalStorageManager.kt`, `KidsCurriculum.kt` | Room DB offline-first reads + sync queue. No dedicated low-data mode or content pre-caching |
| Parent/guardian visibility dashboard | **No** | — | Parental gate exists for settings, but NO parent account, NO progress visibility |
| Teacher/school visibility dashboard | **No** | — | `school_name` used only for leaderboard grouping. No teacher accounts or reporting |
| Screen-time controls | **No** | — | No time limits, session caps, or usage tracking for kids mode |
| Child-safety content moderation on kid surfaces | **Partial** | `ChildSafetyGuard.kt`, `AIChatViewModel.kt:467`, `StuddyHubRepository.kt:3437` | Client-side PII/keyword filter + AI system prompt. DB moderation tables exist but are NOT used by mobile |
| Push notification / re-engagement system | **No** | — | FCM not initialized. No push infrastructure. Daily quest is the only retention mechanic |
| Game-style interactive rendering | **Yes** | `GameAudioEngine.kt`, `ConfettiExplosionEffect.kt`, `MathAsteroidBlasterGameScreen.kt`, `ExplorerQuizRunnerScreen.kt` | Compose Canvas for confetti/games, native PCM audio synthesis, no game engine |

## PART G — Explorer Games Inventory (Follow-Up)

---

### 1. Full Inventory of ExplorerGames.kt

**Total game configs defined:** 4 hero games + 6 backward-compatible aliases = 10 entries in `EXPLORER_GAMES` map, but only 4 unique games.

Source: `app/src/main/java/com/example/ui/screens/quizzes/ExplorerGames.kt`

---

#### Game 1: `ananse_riddles`

| Field | Value |
|-------|-------|
| **Key** | `ananse_riddles` |
| **Display name** | "Ananse Riddles" |
| **Subtitle** | "Logic & Riddle Quest" |
| **Subject** | No subject tag — standalone logic/brain-teaser game |
| **Emoji** | 🕷️ |
| **Badge** | `LOGIC QUEST` |
| **Description** | "Test your wit against Ananse the wise spider with tricky riddles, patterns and puzzles!" |
| **Drawable** | `R.drawable.img_ananse_riddles_1786717187634` |
| **Core mechanic** | **AI-generated multiple-choice quiz rendered in the ExplorerQuizRunnerScreen** (Kahoot-style). The kid taps one of 4 giant colored shape buttons (Red Triangle, Blue Diamond, Yellow Circle, Green Square) to answer. Features: 3 lives/heart system, combo streak multiplier (2X/3X/4X), 50/50 and Hint power-ups, animated confetti celebration on completion. (Source: `ExplorerQuizRunnerScreen.kt`, lines 43-50, 82-109) |
| **Level ladder** | 5 levels: Starter Riddles → Clever Clues → Brain Teasers → Ananse's Trap → Spider's Mastery |
| **Levels detail** | Diffs: easy/easy/medium/medium/hard. Questions: 5/5/6/6/6. XP: 20/25/40/50/80. No time limit. |
| **Star calculation** | `starsForPercent()` at line 90: ≥40% = 1★, ≥70% = 2★, ≥90% = 3★ |
| **Content source** | **AI-generated on demand** at play time. `buildExplorerGameTopic()` (line 621) produces: `"Kid-friendly riddles, brain teasers and logic puzzles — Level N: {levelName}"`. `gameGuidance()` (line 642) adds: "Every question must be a riddle, logic puzzle or pattern puzzle appropriate for a primary school student, with one clearly correct answer." Questions generated via `generateLiveQuestions()` → backend `generate-ai-quiz` edge function with direct Gemini fallback. (Lines 665-700) |
| **Reachable?** | **YES** — wired via `StuddyHubApp.kt:566-575`. Navigation: Quizzes tab → tap "Ananse Riddles" card → `ExplorerGameDetailScreen(gameKey="ananse_riddles")` → tap a level → `ExplorerQuizRunnerScreen`. |

---

#### Game 2: `maths_quest`

| Field | Value |
|-------|-------|
| **Key** | `maths_quest` (aliases: `oware_math`, `chaskele_speed`, `number_ninja`, `maths_challenge`) |
| **Display name** | "Maths Quest" |
| **Subtitle** | "Numbers, Beads & Speed" |
| **Subject** | No subject tag — standalone maths/arithmetic game |
| **Emoji** | 🔢 |
| **Badge** | `NUMBER QUEST` |
| **Description** | "Add, subtract, multiply and divide your way up the ladder — Oware style!" |
| **Drawable** | `R.drawable.img_oware_math_1786717198699` |
| **Core mechanic** | **AI-generated multiple-choice quiz in ExplorerQuizRunnerScreen** (same Kahoot-style runner as Ananse Riddles). Same 4 shape buttons, lives, combos, power-ups. Additionally, the game detail screen offers a **Speed Race** mode — either a Quick Race (joins a public live lobby) or Friend Room (private PIN-based host/join). Speed Race uses the live multiplayer quiz system (`LiveQuizSessionRunner`). (Source: `ExplorerGameDetailScreen.kt:82-140`, `QuizzesViewModel.kt:1298-1340`) |
| **Level ladder** | 5 levels: Counting Beads → Speedy Sums → Times Table Clash → Division Duel → Grand Number Master |
| **Levels detail** | Diffs: easy/easy/medium/medium/hard. Questions: 5/5/6/6/6. XP: 20/25/40/50/80. No time limit on solo levels. |
| **Star calculation** | Same as Ananse Riddles: ≥40/70/90% = 1/2/3★ |
| **Content source** | **AI-generated on demand**. `buildExplorerGameTopic()` (line 624) produces difficulty-specific topics: easy = "simple addition, subtraction and counting"; medium = "multiplication, division, fractions and money word problems"; hard = "multi-digit multiplication, division and multi-step word problems". `gameGuidance()` (line 647): "Every question must be a real arithmetic or maths word problem with exactly one correct numeric answer." |
| **Reachable?** | **YES** — wired via `StuddyHubApp.kt:566-582`. Solo levels via ExplorerQuizRunnerScreen; Speed Race via SpeedRace route. Legacy keys (`oware_math`, `chaskele_speed`, etc.) are normalized to `maths_quest` at line 195. |

---

#### Game 3: `kente_quiz`

| Field | Value |
|-------|-------|
| **Key** | `kente_quiz` (alias: `coasted_quiz`) |
| **Display name** | "Kente Quiz" |
| **Subtitle** | "Heritage & Culture Quest" |
| **Subject** | No subject tag — maps to Social Studies / heritage content via AI guidance |
| **Emoji** | 🧶 |
| **Badge** | `HERITAGE BOWL` |
| **Description** | "Climb the levels of Ghanaian history, culture, geography and national pride!" |
| **Drawable** | `R.drawable.img_kente_quiz_1786717209972` |
| **Core mechanic** | **AI-generated multiple-choice quiz in ExplorerQuizRunnerScreen** (same Kahoot-style runner). Same mechanics as the other quiz games. Also supports Speed Race mode. |
| **Level ladder** | 5 levels: My Ghana → National Pride → Festivals & Food → History Heroes → Kente Master Weaver |
| **Levels detail** | Diffs: easy/easy/medium/medium/hard. Questions: 5/5/6/6/6. XP: 20/25/40/50/80. No time limit on solo. |
| **Star calculation** | Same: ≥40/70/90% = 1/2/3★ |
| **Content source** | **AI-generated on demand**. `buildExplorerGameTopic()` (line 617) dynamically pulls the student's country from their education profile: `"$country history, culture, geography and national pride — Level N: {levelName}"`. `gameGuidance()` (line 639) explicitly instructs: "This is a Social Studies quiz about the student's country. Cover its history, national heroes, independence, culture, geography, festivals, food, symbols and daily life. **Do NOT make all or most questions about kente cloth** — kente is only one small part of the country's heritage." |
| **Reachable?** | **YES** — wired via `StuddyHubApp.kt:566-582`. |

---

#### Game 4: `spelling_bee`

| Field | Value |
|-------|-------|
| **Key** | `spelling_bee` |
| **Display name** | "Spelling Bee" |
| **Subtitle** | "Letters, Sounds & Words" |
| **Subject** | No subject tag — English/phonics via AI-generated words |
| **Emoji** | 🐝 |
| **Badge** | `WORD BEE` |
| **Description** | "Listen to Ollie say a word, then build it with the letter tiles. Buzz through the levels!" |
| **Drawable** | `R.drawable.img_ghana_student_1786717174359` |
| **isSpelling** | `true` (line 182) — triggers dedicated SpellingBeeScreen instead of ExplorerQuizRunnerScreen |
| **Core mechanic** | **Completely different from the other 3 games.** Uses `SpellingBeeScreen.kt` (537 lines). Flow: (1) AI generates words via `generate-spelling-words` edge function (line 54-58). (2) Ollie's TTS voice speaks the word + definition + example sentence (lines 115-122). (3) Shuffled letter tiles appear at the bottom; kid taps tiles in order to build the word (line 92: `tiles = word.toList().shuffled()`). (4) 30-second countdown per word (line 31: `SECONDS_PER_WORD = 30`). (5) Correct/Wrong feedback with sound effects. (6) Stars based on how many words spelled correctly within the time. |
| **Level ladder** | 5 levels: Honey Words → Busy Bee Words → Hive Climbers → Queen Bee → Grand Champion Bee |
| **Levels detail** | Diffs: easy/easy/medium/medium/hard. Questions (words): 5/6/7/8/8. XP: 20/25/40/50/80. 30s time limit per word. |
| **Star calculation** | Based on correct count out of total words (lines 295-310 in SpellingBeeScreen). |
| **Content source** | **AI-generated on demand** via `generate-spelling-words` edge function. `QuizzesViewModel.generateSpellingWords()` (line 1402) calls `BackendApiService.generateSpellingWords(levelIndex, count)`. The edge function returns word + definition + example sentence. |
| **Reachable?** | **YES** — wired via `StuddyHubApp.kt:586-595`. Navigation: Quizzes tab → tap "Spelling Bee" → `ExplorerGameDetailScreen(gameKey="spelling_bee")` → tap level → `SpellingBeeScreen(level=N)`. |

---

#### Backward-Compatible Aliases (ExplorerGames.kt lines 184-191)

| Alias Key | Maps To | Purpose |
|-----------|---------|---------|
| `oware_math` | `maths_quest` | Legacy saved game key |
| `chaskele_speed` | `maths_quest` | Legacy saved game key |
| `number_ninja` | `maths_quest` | Legacy saved game key |
| `maths_challenge` | `maths_quest` | Legacy saved game key |
| `codi` | `ananse_riddles` | Legacy saved game key |
| `coasted_quiz` | `kente_quiz` | Legacy saved game key |

All aliases are normalized via `normalizeGameKey()` (line 195) to the canonical hero key.

---

#### Additional: Math Asteroid Blaster (NOT in EXPLORER_GAMES)

| Field | Value |
|-------|-------|
| **File** | `app/src/main/java/com/example/ui/screens/quizzes/MathAsteroidBlasterGameScreen.kt` (489 lines) |
| **Route** | `Screen.MathAsteroidBlaster.route` (StuddyHubApp.kt:657) |
| **In EXPLORER_GAMES?** | **NO** — standalone screen, not in the game config map |
| **Core mechanic** | Falling equation shoot-'em-up. Math problems fall from the top as "asteroids." Kid taps answer buttons at the bottom to "shoot" them before they crash. Features: 3 shields, combo streak multiplier, laser animation, explosion effects. (Lines 34-89) |
| **Content source** | **Procedurally generated client-side** — random math problems, no AI call. Operations scale by round: + for rounds 1-3, - for 4-6, × for 7-8. (Lines 60-89) |
| **Level structure** | 8 rounds, 3 shields. Not a level-ladder game. |
| **Reachable?** | **YES** — wired via StuddyHubApp.kt:657-663. But it's a separate route, not part of the ExplorerGames system. |
| **Relationship to games** | Independent mini-game. Not connected to game progress tracking, star ratings, or the level ladder system. Awards daily quest credits on completion. |

---

### 2. "Kente Heritage Bowl" Specifically

**Is "Kente Heritage Bowl" a game in ExplorerGames.kt?**

No. "Kente Heritage Bowl" does NOT appear as a game title, key, or display name anywhere in ExplorerGames.kt. The closest match is:

- The game `kente_quiz` has `badge = "HERITAGE BOWL"` (ExplorerGames.kt:150)
- The badge `badge_adinkra` has `requirement = "Score 3 stars in the Kente Heritage Bowl quiz"` (ExplorerBadgesScreen.kt:59)

**"Kente Heritage Bowl" is therefore a reference to the `kente_quiz` game**, using the badge label ("HERITAGE BOWL") as the display name in the requirement text. It is NOT a separate quiz, category filter, or one-off screen.

**What is its actual content?**

The `kente_quiz` game is about **broad Ghanaian heritage** — not just Kente cloth. The AI guidance explicitly says: "Do NOT make all or most questions about kente cloth — kente is only one small part of the country's heritage" (QuizzesViewModel.kt:641). Content covers: history, national heroes, independence, culture, geography, festivals, food, symbols, and daily life. Questions are AI-generated per level with difficulty-appropriate scope.

**Does completing it set badge_adinkra's unlock state?**

**NO.** All badges in `GHANAIAN_BADGES` (ExplorerBadgesScreen.kt:52-169) have hardcoded `isUnlocked` values:
- `badge_adinkra`: `isUnlocked = true` (line 60)
- `badge_oware`: `isUnlocked = true` (line 76)
- `badge_spelling`: `isUnlocked = true, progress = 0.8f` (line 92-93)
- `badge_black_star`: `isUnlocked = false, progress = 0.6f` (line 105-106)
- `badge_scientist`: `isUnlocked = true` (line 119)
- `badge_streak`: `isUnlocked = true` (line 133)
- `badge_speed`: `isUnlocked = false, progress = 0.4f` (line 147-148)
- `badge_all_round`: `isUnlocked = false, progress = 0.5f` (line 160-161)

There is **zero dynamic badge unlock logic** anywhere in the codebase. No code writes to `isUnlocked` or `progress` based on game results. The `GameProgressEntity` (stars, levels) exists and is functional, but it is never connected to the badge system. Badges are purely decorative/hardcoded.

---

### 3. Other Named Games/Activities Referenced

#### a) "Math Asteroid Blaster"

| Field | Value |
|-------|-------|
| **Referenced in** | `MathAsteroidBlasterGameScreen.kt` (489 lines), `StuddyHubApp.kt:657` |
| **Badge tie-in** | None directly, but conceptually related to `badge_speed` ("Chaskele Speedster — Complete a speed quiz round in under 30 seconds") |
| **In EXPLORER_GAMES?** | No |
| **Mechanic** | Falling equation shoot-'em-up (described above in Game section) |
| **Reachable** | Yes, via separate route |

#### b) "Speed Race" (Live Multiplayer)

| Field | Value |
|-------|-------|
| **Referenced in** | `ExplorerGameDetailScreen.kt:82-140`, `QuizzesViewModel.kt:1298-1340`, `LiveQuizSessionRunner` |
| **Badge tie-in** | `badge_speed` ("Chaskele Speedster — Complete a speed quiz round in under 30 seconds", ExplorerBadgesScreen.kt:139-148) |
| **In EXPLORER_GAMES?** | Not a separate game — it's a **mode** within `maths_quest` (and potentially other games). The detail screen offers "Quick Race" (public lobby) and "Friend Room" (private PIN). |
| **Mechanic** | Uses the live multiplayer quiz system: real-time WebSocket questions, auto-advance timer (15s), players compete simultaneously, leaderboard ranking. (QuizzesViewModel.kt:1298-1340) |
| **Reachable** | Yes, from any game's detail screen via the Speed Race button |

#### c) "Oware" (Historical Reference)

| Field | Value |
|-------|-------|
| **Referenced in** | `ExplorerGames.kt` — alias `oware_math` maps to `maths_quest`. Badge `badge_oware` requirement: "Solve 20 quick addition and subtraction math quests" |
| **In EXPLORER_GAMES?** | Only as a legacy alias. The actual game is `maths_quest`. |
| **Mechanic** | Same as Maths Quest (Kahoot-style quiz). No actual Oware board game mechanics exist. |
| **Reachable** | Yes, via `maths_quest` (the alias resolves to the same game) |

#### d) "Chaskele" (Historical Reference)

| Field | Value |
|-------|-------|
| **Referenced in** | `ExplorerGames.kt` — alias `chaskele_speed` maps to `maths_quest`. Badge `badge_speed` requirement: "Complete a speed quiz round in under 30 seconds" |
| **In EXPLORER_GAMES?** | Only as a legacy alias. No dedicated Chaskele game exists. |
| **Mechanic** | Speed Race mode within Maths Quest is the closest analog. |
| **Reachable** | Via `maths_quest` Speed Race mode |

#### e) "Daily Quest" System

| Field | Value |
|-------|-------|
| **Referenced in** | `StuddyHubRepository.kt:873` (`allGameProgressFlow`), daily quest claim logic |
| **Mechanic** | Not a game — a retention tracker that awards credits for completing game levels and study activities. |
| **Reachable** | Yes, surfaced in the Explorer home screen |

---

### 4. Subjects Actually Present in the Cloud Subjects Table

Source: `supabase/migrations/20260814_ghana_education_seed.sql`, lines 93-108

| Code | Name | Category | Sort Order |
|------|------|----------|------------|
| `ENG` | English Language | core | 1 |
| `MATH` | Mathematics | core | 2 |
| `SCI` | Science | core | 3 |
| `SST` | Social Studies | core | 4 |
| `ICT` | ICT | elective | 5 |
| `ART` | Creative Arts | elective | 6 |
| `FRENCH` | French | elective | 7 |
| `TWI` | Twi (Ghanaian Language) | elective | 8 |
| `RME` | Religious & Moral Education | elective | 9 |

**Total: 9 subjects** (4 core + 5 elective)

**Requested subjects check:**
| Subject | Exists? | Code |
|---------|---------|------|
| Religious and Moral Education (RME) | **YES** | `RME` (elective, sort 9) |
| Career Technology | **NO** | Not present |
| Physical and Health Education (P&H Education) | **NO** | Not present |
| Creative Arts & Design | **PARTIAL** | `ART` = "Creative Arts" (no "& Design" suffix) |
| Computing/ICT | **YES** | `ICT` = "ICT" (elective, sort 5) |

---

### 5. Reusability Check for Game Mechanics

#### A) Simulation-style game (planting/growing, cause-and-effect science experiments)

**Closest existing analog:** `MathAsteroidBlasterGameScreen` (Compose Canvas rendering, real-time game loop, state machines for animations)

**Fit assessment:** **Fundamentally different mechanic requiring new code.** The asteroid blaster is a fixed-timer shooting game with random math problems. A simulation game requires persistent state (plant growth stages, cause-and-effect chains), time-acceleration, and stateful UI that updates based on user decisions over multiple turns. None of the existing games have this pattern. The Compose Canvas rendering and `GameAudioEngine` could be reused, but the core game loop, state management, and UI would be entirely new.

#### B) Block-based logic/sequencing puzzle game

**Closest existing analog:** `ananse_riddles` (logic/puzzle game, AI-generated content)

**Fit assessment:** **Same engine, different content — but only partially.** The Ananse Riddles game uses the standard quiz runner (multiple-choice tap-to-answer). A block-based sequencing puzzle (drag-and-drop blocks into order, connect logic blocks) requires a fundamentally different input mechanism — drag gestures, snap-to-grid layout, and sequence validation. The AI content generation pipeline (`generate-ai-quiz`) could produce puzzle sequences, but the rendering and interaction layer would be entirely new. The quiz runner's 4-button tap mechanic is not reusable.

#### C) Business/resource-management simulation

**Closest existing analog:** None. The closest is the Daily Quest tracker (persistent state, cumulative progress), but that's a tracker, not a game.

**Fit assessment:** **Fundamentally different mechanic requiring new code.** No existing game has resource management, decision trees with consequences, or persistent state that evolves over multiple sessions. This would require a new game engine entirely. The only reusable pieces are the Compose UI framework and the XP/credits system (`addXpToStats`, `awardPoints`).

#### D) Explorable map or explorable-body interactive scene (tap regions to learn about them)

**Closest existing analog:** `kente_quiz` (Ghanaian geography/culture content) + `ExplorerQuizRunnerScreen` (interactive tap-based UI)

**Fit assessment:** **Fundamentally different mechanic requiring new code.** While `kente_quiz` covers geographic/cultural content, it does so through multiple-choice questions. An explorable map requires: interactive SVG/image rendering with hit-test regions, tap-to-reveal information panels, zoom/pan gestures, and potentially animated transitions between regions. None of this exists in the current codebase. The AI content generation could produce region descriptions, but the interactive rendering layer is entirely new. The closest existing tech is the `DiagramWebView` (Composable WebView for Mermaid/Chart.js), which could potentially be adapted for an interactive map — but the interaction model (tap regions vs. render-only) is fundamentally different.

---

### Summary: What Exists vs. What's Needed

| Concept | Existing Analog | Reusable Pieces | New Code Required |
|---------|----------------|-----------------|-------------------|
| Simulation game | MathAsteroidBlaster (Canvas) | Canvas rendering, audio engine, XP system | Game loop, state machine, persistent state, UI |
| Block-sequencing puzzle | ananse_riddles (quiz runner) | AI content generation pipeline | Drag-drop input, snap layout, sequence validation |
| Business/resource sim | None | XP/credits system, Compose UI | Entire game engine, persistent state, decision trees |
| Explorable map/body | kente_quiz (content only) | AI content generation, WebView rendering | Interactive hit-testing, zoom/pan, info panels |

**Key finding:** All 4 proposed game concepts require **fundamentally new game mechanics** that don't exist in the current codebase. The existing infrastructure (AI question generation, star ratings, XP system, level ladders, Compose Canvas for animations) provides a solid foundation for the *meta-game* layer (progress, rewards, navigation), but the actual gameplay loops for these concepts would need to be built from scratch.
