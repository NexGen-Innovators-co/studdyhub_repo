# Kids (Explorer) Learning System — Overview & Implementation Plan

> Target: Basic School → JHS students (Explorer tier). Ghana-first, gamified, roadmap-driven.
> Status: **Phase 0 (kid onboarding + Core Four) executed** and aligned to the existing education schema
> (`countries`, `education_levels`, `curricula`, `examinations`, `subjects`, `user_education_profiles`,
> `user_subjects`, `institutions`). Phases 1–4 are planned, not yet built.

---

## 1. Vision (one paragraph)

A kid signs up, picks **Ghana 🇬🇭** and their **class (Basic 1 → JHS 3)**. The app auto-enrols them in the **Core Four** (English, Mathematics, Science, Social Studies — JHS set; class-adjusted for lower primary), lets them add optional subjects, and Ollie (the AI) builds their **personal learning space**: a lesson-by-lesson **roadmap**, starter quizzes, daily goals, and a study schedule — all matched to their class. Every day they come back to the space there is something waiting: a **Daily Quest**, streak flame, points/credits, per-game levels and stars, and a class/school **ranking**. The games are real learning: **Ananse Riddles** (logic/riddles), **Maths Quest** (arithmetic with levels), **Kente Quiz** (Ghanaian culture/history with levels), **Spelling Bee** (new), plus **Learn It** tutorial sessions before each topic. **Speed Race** becomes a true **live** race against other kids online. The quiz experience for kids is visual, loud, and fun — a completely different runner from the adult one.

---

## 2. What already exists (inventory & reuse map)

### 2.1 Local Room DB (`app/src/main/java/com/example/data/local/entities/Entities.kt`)

| Need | Existing table/field | Gaps |
|---|---|---|
| Education context | `user_education_profiles` + `user_subjects` (mirror tables, migration 16→17) — country → education level → curriculum → target exam → grade + enrolled subjects | ❌ cloud refs (countries/levels/subjects) are cached in RAM only, not mirrored locally — fine for onboarding, add local cache only if offline re-entry is needed |
| Profile / tier / level | `profiles`: `academicTier`, `academicLevel`, `school`, `learningStyle`, `pointsBalance`, `bonusAiCredits` | ✅ enough — tier auto-derives from the education level; no extra columns needed |
| Streak / XP / level | `user_stats`: `totalXp`, `level`, `currentStreak`, `longestStreak`, `totalQuizzesCompleted`, `averageScore`, `lastStudyDayMillis` | ✅ perfect base — reuse as-is |
| Quizzes | `quizzes`: `title`, `sourceType`, `questionsJson` | ❌ no `subject`, `gameKey`, `levelIndex`, `isTutorial` |
| Attempts / history | `quiz_attempts`: `score`, `totalQuestions`, `percentage`, `timeTakenSeconds`, `xpEarned`, `liveResultsJson` | ❌ no `gameKey`, `subject`, `levelIndex` |
| Courses (Core Four) | `courses`: `code`, `title`, `description`, `schoolName`, `progressPercent`, `isEnrolled` | ✅ reuse — seed the four + optional subjects |
| Schedule (AI plan) | `schedule_items`: `title`, `subject`, `type`, `start/endTimeMillis`, `isCompleted` | ✅ reuse for the AI study plan |
| Flashcards / notes | `flashcards`, `notes` | ✅ reuse for lessons & Learn It |
| Sync queue | `sync_queue` (`entityType`, `entityId`, `serializedData`) | ➕ add new entity types (`game_progress`, `roadmap_step`) |

### 2.2 Supabase (cloud) — migrations in `supabase/migrations/`

| Need | Existing | Gaps |
|---|---|---|
| Live quiz (Speed Race) | `live_quiz_sessions`, `live_quiz_questions`, `live_quiz_players`, `live_quiz_answers` + `live-quiz` edge fn + realtime client (`LiveQuizRealtimeClient`) | ➕ add `game_key`, `is_public` to sessions for quick-match lobbies |
| AI goals | `user_learning_goals` (20260811) — the `gemini-chat` planner already writes here | ✅ reuse — mobile has no UI yet, add one |
| XP/activity | `user_daily_activity`, `update_activity_on_quiz_attempt` trigger, `backfill_quiz_xp` | ✅ reuse |
| Quiz generation | `generate-ai-quiz`, `generate-quiz` edge functions | ➕ add a "bank-first, AI-fallback" strategy for games |
| Education reference data | `countries`, `education_levels`, `curricula`, `examinations`, `subjects` + RPCs (`get_active_countries`, `get_education_framework`) — **already exist**; `20260814_ghana_education_seed.sql` seeds Ghana 🇬🇭 bands (Primary/JHS/SHS/Tertiary), NaCCA curricula, BECE/WASSCE, core+elective subjects | ✅ aligned — mobile reads them exactly like the web app (`useEducationContext.ts`) |
| User education | `user_education_profiles` + `user_subjects` + `institutions` + `institution_members` — **already exist** | ✅ mobile now upserts these via `saveEducationSetup` (mirrors web `useEducationFramework.ts`) |
| Tutorials / roadmap | — | ➕ new `kid_roadmap_steps` + `game_progress` tables |

### 2.3 Existing Explorer (kids) UI & flows

- **Tabs** (`Screen.kt` `getNavigationScreensForTier`): Dashboard · Ranking · Profile.
- **Home** (`ExplorerHomeContent.kt`): streak calendar widget, 2×2 tactile games grid (**Ananse Riddles, Oware Math, Kente Quiz, Chaskele Speed**), "Daily Quest Active! 🌟" card, AI companion FAB.
- **Game detail** (`ExplorerGameDetailScreen.kt` + `EXPLORER_GAMES` config map): difficulty picker (Easy/Medium/Hard with XP), two modes — **Solo Quest** and **Speed Race**. Both currently generate an AI quiz and launch the **same** runner. Speed Race is **not live** yet.
- **Quiz runner**: shared adult runner in `QuizzesScreen.kt` (`ActiveQuizRunner` + tactile feedback already added for Explorer).
- **Onboarding** (`OnboardingViewModel`): collects name / school / major / study-goal / learning-style via Ollie chat + manual form. Suggestions are university-flavoured ("Stanford University", "Computer Science"). ❌ No country, no class, no tier-specific flow.
- **Ranking** (`RankingScreen.kt` + `StuddyHubRepository.getTierScopedLeaderboard` ~L3613): tier-scoped leaderboard already exists.
- **Live quiz infra**: `LiveQuizRealtimeClient` (Phoenix/Realtime websocket) + edge functions — battle-tested for the adult live quiz.

---

## 3. Gap analysis (what must be built)

1. ~~**Kid onboarding** — country + class selection; Core-Four auto-enrolment; class-aware AI bootstrap~~ ✅ **DONE** (Phase 0): "My School Setup 🎒" sheet, cloud-driven country/level/subjects, upserts `user_education_profiles`+`user_subjects`, seeds `courses` rows. Remaining: class-aware AI bootstrap (Ollie builds roadmap/goals/schedule — Phase 2).
2. **Game system v2** — per-game **levels** (1…N) with stars; curated question banks per game/level (riddles, maths, culture, spelling) with AI fallback; `game_progress` tracking; per-game leaderboard.
3. **Spelling Bee** — new game (word bank by class level, audio TTS, letter tiles).
4. **Roadmap & Daily Quest** — AI generates a week-by-week roadmap per subject; home shows "today's path"; Daily Quest with reward; `kid_roadmap_steps`.
5. **Learn It tutorials** — short lesson + mini-check before each game/subject.
6. **Live Speed Race** — quick-match public lobbies (any online kid), PIN rooms, realtime scoreboard.
7. **Kid quiz runner v2** — visually entertaining, big text, mascot, sounds/confetti, simpler setup (1 tap = play), distinct from the adult runner.
8. **Retention loop** — streak rewards, credits (points), class/school rankings, "come back tomorrow" hooks.

---

## 4. Target user journeys

### 4.1 First run (Ghana basic-school kid)

```
Sign up (email/guest) → Tier = Explorer (auto)
  → "Where are you learning?" → 🇬🇭 Ghana (default) → Class picker (Basic 1–6 / JHS 1–3)
  → School name (free text; optional, later: directory autocomplete)
  → Core Four auto-enrolled ✅ (English, Maths, Science, Social Studies)  [changeable]
  → Optional subjects (ICT, Creative Arts, French, Twi, …)
  → Ollie bootstraps the space (spinner + mascot):
       • roadmap_steps seeded (Week 1 per subject)
       • 1 starter quiz + 1 Learn It lesson per subject
       • user_learning_goals written (e.g. "Finish Week 1 Maths by Friday")
       • schedule_items created (e.g. "Maths · 30 min · Mon/Wed")
       • starter XP quest active
  → Lands on "My Learning Space" 🎒 with everything waiting
```

### 4.2 Daily return

```
Open app → Home:
  • Streak widget (flame) + "Day 3! Come back tomorrow for +50 XP"
  • Daily Quest card → "Complete 1 Maths level + 1 Kente level"
  • Today's Path (roadmap): next lesson/quiz per subject, with progress bars
  • Games row (Ananse / Maths / Kente / Spelling) — each shows "Level 4 · ★★★"
  • Rank teaser: "You're #3 in Class 5A this week 🏅"
Play any game → XP + stars + streak → ranking updates
```

---

## 5. Data model changes

### 5.1 Local Room (`Entities.kt` + DAO + migration version bump)

```kotlin
// DONE in Phase 0 — education context lives in the education mirror tables (not profiles):
// user_education_profiles (countryId, countryCode, countryName, educationLevelId, levelName,
//   levelCategory, curriculumId, curriculumName, targetExaminationId, examName,
//   institutionName, yearOrGrade) + user_subjects (educationProfileId, subjectId, code, name, category, isPrimary)
// Tier is derived from the education level via mapAcademicLevelToTier (no new profile fields).

// quizzes — add:
val subject: String = "",
val gameKey: String? = null,       // "ananse_riddles" | "maths_quest" | "kente_quiz" | "spelling_bee"
val levelIndex: Int = 0,
val isTutorial: Boolean = false,

// quiz_attempts — add:
val gameKey: String? = null,
val subject: String = "",
val levelIndex: Int = 0,

// NEW table: game_progress
@Entity(tableName = "game_progress")
data class GameProgressEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val gameKey: String,            // ananse_riddles, maths_quest, kente_quiz, spelling_bee
    val unlockedLevel: Int = 1,     // highest unlocked level
    val starsByLevelJson: String = "{}", // {"1": 3, "2": 2}
    val bestScoresJson: String = "{}",
    val totalXpEarned: Int = 0,
    val lastPlayedAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED"
)

// NEW table: roadmap_steps
@Entity(tableName = "roadmap_steps")
data class RoadmapStepEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val subject: String,            // english, maths, science, social_studies
    val week: Int,                  // 1..N
    val day: Int,                   // 1..7 within the week
    val stepIndex: Int,             // ordering within the day
    val title: String,
    val stepType: String,           // "lesson" | "quiz" | "game" | "review" | "spelling"
    val refId: String? = null,      // quiz_id / flashcard deck id / game key
    val xpReward: Int = 20,
    val isCompleted: Boolean = false,
    val dueDateMillis: Long? = null,
    val completedAt: Long? = null,
    val syncStatus: String = "SYNCED"
)
```

`sync_queue` gains entity types `game_progress`, `roadmap_step`.

### 5.2 Supabase migrations (new files in `supabase/migrations/`)

```sql
-- 001: DONE — 20260814_ghana_education_seed.sql (idempotent reference-data seed:
--   GH/NG/KE countries, Ghana Primary/JHS/SHS/Tertiary levels, NaCCA curricula,
--   BECE + WASSCE, core/elective subjects). No profiles.* columns — the existing
--   user_education_profiles/user_subjects tables are the source of truth.

-- 002: game_progress (RLS = own rows, mirrors user_learning_goals pattern)
CREATE TABLE public.game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key text NOT NULL,
  unlocked_level int NOT NULL DEFAULT 1,
  stars_by_level jsonb NOT NULL DEFAULT '{}',
  best_scores jsonb NOT NULL DEFAULT '{}',
  total_xp_earned int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, game_key)
);
-- + RLS policies (select/insert/update/delete own) + updated_at trigger

-- 003: kid_roadmap_steps (RLS = own rows)
CREATE TABLE public.kid_roadmap_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  week int NOT NULL,
  day int NOT NULL,
  step_index int NOT NULL,
  title text NOT NULL,
  step_type text NOT NULL DEFAULT 'lesson',
  ref_id text,
  xp_reward int NOT NULL DEFAULT 20,
  is_completed boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- + RLS policies + updated_at trigger + index (user_id, week, day)

-- 004: live_quiz_sessions — kids Speed Race quick-match
ALTER TABLE public.live_quiz_sessions
  ADD COLUMN IF NOT EXISTS game_key text,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
-- public lobbies joinable via "quick match" (game_key + status='waiting')

-- 005: spelling_words (seeded bank; class-level + word + phonetic hint)
CREATE TABLE public.spelling_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_level text NOT NULL,          -- "Basic 1" ... "JHS 3"
  word text NOT NULL,
  definition text,
  sentence text,
  difficulty int DEFAULT 1,
  UNIQUE (class_level, word)
);
-- seed ~100 words per band (Basic 1-3, Basic 4-6, JHS 1-3)
```

### 5.3 Edge functions

| Function | Change |
|---|---|
| `generate-ai-quiz` / `generate-quiz` | Accept `gameKey` + `levelIndex`. **Bank-first**: load seeded questions for the game/level; only call Gemini when the bank runs dry (higher levels). Returns kid-friendly tone for Explorer. |
| `gemini-chat` planner | New `build_kid_space` intent: takes country + classLevel + courses → returns roadmap steps + goals (`user_learning_goals`) + schedule items (`schedule_items`) + starter quiz/lesson refs. |
| `live-quiz` | Accept `gameKey` + `is_public`; expose `find_public_lobby(game_key)` RPC for quick match; fair start when ≥2 players or 15s timer. |
| New `spelling-bee` (or extend quiz fn) | Pick word by class level, return letters + audio via existing `cloud-tts`. |

---

## 6. Implementation phases

### Phase 0 — Kid onboarding & Core Four (foundation) ✅ EXECUTED
- [x] **Aligned to the existing education schema** (no redundant `profiles.country/class_level`): Room mirrors `UserEducationProfileEntity` + `UserSubjectEntity`, migration 16→17, `EducationDao`.
- [x] **Cloud migration** `20260814_ghana_education_seed.sql` — idempotent seed of Ghana education reference data (countries, levels, curricula, BECE/WASSCE, subjects). RPCs `get_active_countries`/`get_education_framework` already exist in the deployed DB.
- [x] **BackendApiService**: `fetchActiveCountries()`, `fetchEducationFramework(countryId)`, `saveUserEducationProfile(...)`, `fetchUserEducationProfile(userId)`, `replaceUserSubjects(...)` — REST parity with the web app.
- [x] **Repository**: `saveEducationSetup(...)` (local mirror + background cloud upsert), `fetchEducationCountries()` / `fetchEducationLevels()` (cloud-first, `KidsCurriculum` offline fallback), `educationProfile`/`educationSubjects` flows.
- [x] **OnboardingViewModel**: `loadEducationCountries()` / `loadEducationLevels()` / `saveKidSetup()` — kid-friendly tier-aware chat prompts.
- [x] **OnboardingScreen**: "My School Setup 🎒" bottom sheet — country (🇬🇭 default) → level/class grid → Core Four pre-selected + optional subject chips → grade text → Save (profile `academicLevel`/`academicTier` kept in sync via `updateProfile`).
- [ ] **Remaining from Phase 0**: nothing — class-aware AI bootstrap (roadmap/goals/schedule) is Phase 2.

### Phase 1 — Game system v2 (levels, banks, Spelling Bee) ✅ EXECUTED
- [x] **4 hero games** in `ExplorerGames.kt`: `ananse_riddles`, `maths_quest` (merges old oware_math + chaskele_speed via aliases), `kente_quiz`, `spelling_bee`. Each has a 5-level ladder (names, difficulty band, question count, XP reward, star thresholds 40/70/90). Home grid updated to the 4 heroes.
- [x] **Seeded question banks** as Android assets (`assets/explorer_banks/*.json`): 5 levels × 5–6 questions for riddles/maths/kente; 5 levels × 5–8 words (word + definition + sentence) for spelling. `loadExplorerBank`/`loadSpellingWords` read them; empty level → AI fallback via existing `generateLiveQuestions`.
- [x] **game_progress** local (Room `GameProgressEntity`, migration 17→18, `GameProgressDao`) + cloud (`20260814_game_progress.sql`, upsert on `user_id,game_key` + RLS own-row policies).
- [x] **Repository**: `recordGameResult` (stars/best-score merge, unlock next level, per-game XP + global stats XP), `syncGameProgressFromCloud` wired into `syncCloudDataToLocal` (also wired `syncEducationContextFromCloud`, which existed but was never called).
- [x] **Game detail screen v2**: level ladder with locks/stars/XP per level, 1-tap PLAY (bank → runner), progress summary (total stars + unlocked level), spelling handoff to its own screen.
- [x] **Spelling Bee screen** (`SpellingBeeScreen.kt` + `Screen.SpellingBee` route): Ollie TTS speaks the word + sentence, tap letter tiles to build the word, per-word 30s timer, Clear/Check, correct→celebration, result screen with stars + XP, `recordSpellingResult`.
- [ ] **Deferred to Phase 3/4**: per-level leaderboards, public live Speed Race lobbies, and the dedicated kid quiz runner v2 (bank questions currently run in the shared runner with tactile feedback).

### Phase 2 — Roadmap, tutorials & the learning space ✅ EXECUTED
- [x] **Roadmap data**: `RoadmapStepEntity` (Room, migration 18→19) + `RoadmapDao`; cloud `kid_roadmap_steps` table + RLS (`20260814_kid_roadmap_steps.sql`); repository `roadmapStepsFlow`, `syncRoadmapFromCloud`/`syncRoadmapToCloud` wired into `syncCloudDataToLocal`, `completeRoadmapStep` (XP + streak + cloud PATCH).
- [x] **Deterministic bootstrap** `bootstrapKidRoadmap()`: seeded once after school setup from the enrolled subjects (Core Four fallback) — 4 weeks × 3 steps/subject (lesson day 1, practice quiz day 3, game day 5) with per-subject templates and game refs (ENG→spelling_bee, MATH→maths_quest, SCI→ananse_riddles, SST→kente_quiz). Runs from `saveKidSetup`. AI enrichment (gemini `build_kid_space`) can layer on later.
- [x] **Learn It screen** (`LearnItScreen.kt` + `Screen.LearnIt` route): Ollie lesson (per-subject body + tips) → 3-question check (per-subject bank) → pass = step completed + XP + streak; "Play the Game" button when the step links a game. Quiz steps reuse the same check as a practice round.
- [x] **Home v2 ("My Learning Space")**: Today's Path card (next 3 steps, GO/PLAY per step, game steps → game detail, others → Learn It), My Subjects progress strip (per-subject % bars), and a computed Daily Quest (2 actions today = complete) with progress bar.
- [ ] **Deferred**: goals screen UI for `user_learning_goals`, ranking v2 (class/school + per-game leaderboards), AI-generated roadmap content (currently deterministic templates).

### Phase 3 — Live Speed Race ✅
- [x] `live_quiz_sessions` + `game_key`/`is_public` (migration `20260814_speed_race_columns.sql`); `find-public-lobby` action on the `live-quiz` edge fn (matches any waiting public lobby for the game, <8 players).
- [x] Speed Race mode = "Quick Race" (auto-join public lobby via `BackendApiService.findPublicLobby(gameKey)`; otherwise create one and auto-start) or "Friend Room" (PIN via existing live-quiz flow, manual host Start). Uses existing `LiveQuizRealtimeClient` + `live-quiz` edge fn.
- [x] Live lobby UI: reuses the existing `LiveQuizSessionRunner` (waiting room, countdown, live scoreboard, podium) — host auto-starts once ≥2 racers are in or after 20s with ≥1 racer (public only; private rooms keep the manual Start button).
- [x] Speed Race questions: bank-first (5 shuffled from the game's `explorer_banks` JSON, levels 1–3), Gemini-generated fallback; 15s/question, auto-advance, no late join.

### Phase 4 — Kid quiz runner v2 & retention ✅
- [x] **Kid runner v2** (`ExplorerQuizRunnerScreen`, `Screen.ExplorerQuizRunner`): full-screen gradient background, Ollie mascot reactions (THINKING → CELEBRATING/MOTIVATING), big question card, 2×2 colored answer tiles with ✓/✗ reveal, canvas confetti burst + celebration sound on correct, level-path bead progress, kid result screen with stars/XP + Play Again. Solo game levels now route here instead of the adult `ActiveQuizRunner`.
- [x] **Credits store-lite** (`ExplorerStoreScreen`, `Screen.ExplorerStore`): points = `profiles.pointsBalance` (earned 1:1 with level XP in `recordGameResult`, synced via `updateUserProfile(pointsBalance)`); spend on emoji avatars (`setAvatarEmoji`) and streak freezes (`addStreakFreeze`, new `user_stats.streakFreezes` — Room migration 19→20 + cloud `20260814_explorer_retention.sql`). Streak calendar now shows the real freeze count; 🛍️ Store chip on the home.
- [x] **Daily Quest generator** (seeded by date → stable all day): 2–3 actions from a pool (learn a lesson / play a game / race), live progress from roadmap completions + game plays today, claimable points reward once per day (`claimDailyQuest`, stamped on `user_stats.lastDailyQuestClaimedDate`) with "come back tomorrow" copy.
- [x] **Class leaderboard**: RankingScreen gains a 🌍 Global / 🏫 My Class toggle for Explorer tier — same `school` + `academic_level` ranked by `points_balance` (`getClassLeaderboardProfiles` + `fetchClassLeaderboard`).

---

## 7. What we reuse vs build (quick map)

| Need | Reuse | Build |
|---|---|---|
| Streak/XP/level | `user_stats` + decay logic in repo | per-game streak bonus |
| Live multiplayer | live-quiz tables + realtime client + edge fn | public lobbies + game_key |
| AI lessons/goals/schedule | `gemini-chat` planner, `user_learning_goals`, `schedule_items`, flashcards | `kid-bootstrap` intent + roadmap |
| Quizzes | `quizzes`/`quiz_attempts`, `generate-ai-quiz` | bank-first games, Spelling Bee, tutorial flag |
| Rankings | `getTierScopedLeaderboard` | class/school + per-game scoping |
| Tactile/fun UI | `Tactile3DCard`, `tactileClick`, `TactileSoundSystem`, `OllieMascot`, `PodiumLeaderboard` | kid runner v2 + confetti |
| Onboarding | existing chat/manual forms | country + class branch, Core Four ✅ done |
| Education schema | `countries`, `education_levels`, `curricula`, `examinations`, `subjects`, `user_education_profiles`, `user_subjects`, `institutions` (cloud) + web app's `useEducationContext.ts`/`useEducationFramework.ts` as reference | mobile mirror entities + seed migration ✅ done |

---

## 8. Key decisions to confirm before building

1. **Class bands** — confirm the exact Core Four per band: lower primary (Basic 1–3: English, Maths, Science, OWOP) vs upper primary (Basic 4–6) vs JHS (English, Maths, Integrated Science, Social Studies). The "Core Four" wording suggests the JHS set — confirm if OWOP should appear for Basic 1–3.
2. **Spelling Bee words** — seed bank authored in-app (English only) or also local languages (Twi, Ewe, Ga)? TTS voice availability matters.
3. **Speed Race matchmaking** — public quick-match requires a threshold of online kids; acceptable wait (15s?) and what to show when nobody's online (bot opponents vs "come back later").
4. **Age gating / guardian consent** — do we need a birth-year gate and guardian contact for under-13s before this ships?
5. **School directory** — the `institutions` + `institution_members` tables already exist (type school/university, verification_status). Phase 0 uses free text (`profiles.school`) as in the web app; later phases can resolve school → `institutions` row so class/school rankings have integrity (needs a lookup RPC + verification flow).
6. **Migration to apply** — `20260814_ghana_education_seed.sql` must be run (`supabase db push`) before the education picker returns cloud data; until then the app falls back to offline defaults.

---

## 9. Suggested order of execution

**Start with Phase 0** (onboarding + Core Four + profile columns) — everything else hangs off the class/country being real. Then **Phase 1** (games/levels/Spelling Bee) because it's the daily hook, then **Phase 2** (roadmap/tutorials/home), **Phase 3** (live Speed Race), **Phase 4** (runner v2 + retention polish). Phases 1–2 can overlap; 3 depends on the live-quiz infra which already works.

After this is nailed, the **SHS (Achiever) level** gets the same structure: country/class (SHS 1–3 + WASSCE prep), auto-enrol core + elective courses, roadmap toward the WASSCE window, and the same games tuned to SHS difficulty (with the existing WASSCE countdown home already in place).
