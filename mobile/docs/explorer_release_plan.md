# StuddyHub Explorer Tier: Comprehensive Production Readiness Audit & Go-Live Plan

**Generated On:** August 22, 2026
**Last Updated:** August 23, 2026
**Target Release:** Explorer Tier (Primary to JHS — Ages 6–14) Public Go-Live
**Author:** AI Studio Engineering & Architecture Engine
**Status:** PROPOSED PLAN (Awaiting User Review Before Implementation)

---

## PART 1 — Current Game Inventory

### Active Games (6)

| # | Game | Key | Subject | Type | Levels | gameGuidance |
|---|------|-----|---------|------|--------|-------------|
| 1 | **Ananse Riddles** | `ananse_riddles` | Logic & Wisdom | AI-generated MCQ | 5 | ✅ Yes |
| 2 | **Maths Quest** | `maths_quest` | Mathematics | AI-generated MCQ | 5 | ❌ No |
| 3 | **Kente Quiz** | `kente_quiz` | Ghana Heritage | AI-generated MCQ | 5 | ✅ Yes |
| 4 | **Spelling Bee** | `spelling_bee` | English / Phonics | TTS + letter tiles | 5 | ❌ No |
| 5 | **Math Asteroid Blaster** | `math_asteroid_blaster` | Mathematics | Falling equation shooter | 5 | ❌ No |
| 6 | **Science Discovery Lab** | `science_explorer` | Science | AI-generated MCQ | 5 | ❌ No |

**Additional Modes:**
- **Speed Race** — Live multiplayer race (uses Maths Quest questions)
- **1v1 Battle Arena** — Live head-to-head (custom subject challenges)
- **Custom Subject Challenge** — User picks from 5 subjects (Maths, English, Science, Ghana Lore, Tech & ICT)

**Legacy Aliases (backward-compatible):** `asteroid_laser`, `asteroid_blaster`, `math_laser`, `oware_math`, `chaskele_speed`, `number_ninja`, `maths_challenge`, `codi`, `coasted_quiz` — all mapped to canonical keys via `normalizeGameKey()`.

**Missing from Arcade Hub:**
- No dedicated English/Reading game beyond Spelling Bee
- No Social Studies game in the arcade (only via custom challenge)
- No ICT/Tech game at all

### Future Game Ideas

#### Tier 1 — High Impact, Low Effort (Add Before V1)

| Game | Key | What | Why |
|------|-----|------|-----|
| **Adinkra Symbol Match** | `adinkra_match` | Memory card game matching symbols to meanings | Deeply Ghanaian, visual, no text-heavy reading needed for ages 6-9 |
| **Ghana Geography Explorer** | `ghana_geo` | Pin locations on a map, name regions/capitals | Maps/visuals are engaging for kids; addresses weak geography coverage |
| **Tongue Twister Race** | `tongue_twister` | TTS pronunciation challenge — speak fast without mistakes | Fun English pronunciation drill; leverages existing TTS engine |

#### Tier 2 — Medium Effort, High Engagement

| Game | Key | What | Why |
|------|-----|------|-----|
| **Story Builder** | `story_builder` | Fill-in-the-blank creative stories with AI suggestions | Boosts English creative writing for JHS |
| **Science Lab Sim** | `science_sim` | Simple drag-and-drop experiments (mix colors, grow plants) | Differentiates from plain MCQ science |
| **Code Puzzler** | `code_puzzler` | Simple block-based logic sequences (unplugged CS) | Fills the ICT gap entirely; no device needed |
| **Word Builder** | `word_builder` | Anagram/scramble game (Wordle-style for kids) | Vocabulary building without AI dependency |

#### Tier 3 — Future Roadmap (Post-V1)

| Game | What |
|------|------|
| **Math Word Problem Arena** | Multi-step word problems with visual diagrams |
| **History Timeline Builder** | Drag-and-drop Ghana/African history events in order |
| **Vocabulary Bingo** | Multiplayer vocabulary bingo game |
| **Art & Pattern Creator** | Draw Adinkra-inspired patterns (canvas API) |

---

## PART 2 — Re-Verification of Prior Findings

| Item | Status in Old Audit | Current Verified State | Delta / Flag |
|:-----|:--------------------|:-----------------------|:-------------|
| **1. 8 Explorer Badges Hardcoding** | Hardcoded (`isUnlocked` set statically to `false`) | **DYNAMICALLY DERIVED:** `ExplorerBadgesScreen.kt` now receives a `BadgeProgress` data class computed from real Room DB activity. `buildExplorerBadges(progress)` calculates unlock conditions (`currentStreak >= 3`, `kenteQuizStars >= 3`, `mathsQuestCount >= 20`, `spellingBeeCount >= 15`, `sstLessonsCompleted >= 5`, `scienceLessonsCompleted >= 3`). Unlocked badges now award XP and can be pinned to the profile. | **Contradicts Old Audit:** Fixed and functional on device. |
| **2. `weak_areas` Parameter Connection** | Unpopulated / Disconnected | **DISCONNECTED:** `weak_areas` does not exist in any client quiz generation call. Live quiz generation parameters rely on explicit `gameGuidance()`, `levelIndex`, and user-selected difficulty. | **Holds (Confirmed):** Still disconnected from adaptive game difficulty loops. |
| **3. Firebase Initialization & Push Notifications** | Failed on launch / missing credentials | **INITIALIZED BUT NOTIFICATIONS UNWIRED:** `GoogleServicesPlugin` and `google-services.json` are present and compile cleanly; FCM service is not declared in `AndroidManifest.xml`. Device push notifications are currently non-functional end-to-end. | **Partially Changed:** Builds without crashing, but lacks active FCM message handler. |
| **4. Backend Edge Function Deployments** | Unverified / Pending sync | **CANNOT VERIFY DIRECT DEPLOYMENT:** Local codebase contains client-side fallbacks. Direct access to remote edge function execution runtime is outside local container privileges. **Action Required:** User must verify deployed Supabase Edge Function environment variables and live endpoints manually. | **Holds:** Requires manual backend check. |
| **5. `subjects` Table Schema & Fallbacks** | 8 Core Ghanaian Subjects | **UNCHANGED:** Pre-seeded fallback core subjects are English (`ENG`), Mathematics (`MATH`), Science (`SCI`), Social Studies (`SST`), ICT (`ICT`), Creative Arts (`ART`), French (`FRENCH`), and Twi (`TWI`). | **Holds (Confirmed):** 100% aligned with Ghana Basic 1–JHS 3 NaCCA categories. |

### Newly Verified Findings (August 23, 2026)

| # | Finding | Status | Details |
|---|---------|--------|---------|
| **6. Missing `gameGuidance` for 3 of 6 games** | 🆕 NEW | `maths_quest`, `science_explorer`, and `math_asteroid_blaster` have NO `gameGuidance()` in `QuizzesViewModel.kt`. Only `kente_quiz` and `ananse_riddles` have it. AI generates unfocused questions for the other 4 games. |
| **7. Leaderboard ranked by spendable coins** | 🆕 FIXED | Leaderboard was ordering by `points_balance` (spendable) instead of lifetime XP. Now fixed — uses `user_stats.total_xp` via cloud join. |
| **8. Avatar default resolved incorrectly** | 🆕 FIXED | `findAvatar()` matched owl emoji "🦉" to Professor Ollie (1000-star Mythic) instead of Simba. Fixed with `EMOJI_TO_AVATAR_ID` mapping. |
| **9. Coins vs Stars labeling confusion** | 🆕 FIXED | Both spendable coins and lifetime XP were labeled "Stars". Now clearly separated: 🪙 Coins (spendable) vs ⭐ Stars (ranking/lifetime). |
| **10. No wrong-answer review in LearnIt Check** | 🆕 NEW | When a student answers wrong in LearnIt's Check phase, the answer just moves on. No explanation is shown until the final result. |
| **11. No grade-differentiated lesson content** | 🆕 NEW | Basic 1 and JHS 3 get the same paragraph complexity from AI. No `difficultyBand` flag is passed to lesson generation. |
| **12. Roadmap game steps open LearnIt instead of games** | 🆕 FIXED | Roadmap steps with game titles (e.g. "Oware Math") were generating AI quiz questions instead of opening the actual game. Fixed with title-matching detection. |

---

## PART 3 — LearnIt: Flaws, Gaps & Future Vision

### Current Architecture

LearnIt follows a 3-phase flow:
1. **Reading Phase** — TTS-narrated paragraphs with vocabulary words
2. **Check Phase** — 4-option MCQ quiz (Kahoot-style 3D buttons)
3. **Result Phase** — Star rating, coins earned, continue/retry

Content is AI-generated via `generateLessonJson()` with zero-shot prompts. Game roadmap steps also flow through LearnIt when tagged as `stepType = "lesson"` in the cloud.

### Critical Flaws

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| L1 | **No grade-differentiated content** — Basic 1 and JHS 3 get the same paragraph complexity | Basic 1-3 kids can't read complex text; JHS kids get baby content | 🚨 Blocker |
| L2 | **No gameGuidance for 3 of 6 games** — `maths_quest`, `science_explorer`, `math_asteroid_blaster` have NO `gameGuidance()` | AI generates unfocused or wrong questions for these games | 🚨 Blocker |
| L3 | **No wrong-answer review in Check phase** — wrong answers are just marked red and the quiz moves on | Kids don't learn from their mistakes | ⚠️ Should-Fix |
| L4 | **Font size fixed at 12sp** in code/formula blocks | Small on low-dpi tablets | ⚠️ Should-Fix |
| L5 | **Zero human content review** — all AI content goes directly to children | Safety risk; hallucinated content possible | 🚨 Blocker |
| L6 | **No progress persistence** — can't resume a half-finished lesson | Wasted effort if interrupted | ⚠️ Should-Fix |
| L7 | **No illustrations or diagrams** — text-only lessons | Less engaging for visual learners; harder to understand concepts | ⚠️ Should-Fix |
| L8 | **No wrong-answer explanations shown inline** | Students repeat the same mistakes | ⚠️ Should-Fix |

### Gaps vs. Class Levels

| Level | What's Missing |
|-------|---------------|
| **Basic 1-3** | Simpler vocabulary, larger fonts, more pictures/emojis in text, no abstract concepts, untimed mode, phonics-focused |
| **Basic 4-6** | Moderate complexity, visual diagrams, connecting concepts to daily Ghanaian life |
| **JHS 1-3** | Exam-prep style (BECE format), analytical questions, word problems, harder vocabulary |

### Recommendations

1. **Add `difficultyBand` to lesson generation** — pass `isLowerPrimary`/`isJHS` flag to the AI prompt to control vocabulary level
2. **Add wrong-answer explanations** in the Check phase (show explanation after each answer, not just at end)
3. **Grade-aware star thresholds** — Basic 1-3: 40%/60%/80%, JHS: 50%/70%/90%
4. **Persist lesson progress** to Room DB so interrupted lessons can be resumed
5. **Dynamic font sizing** — minimum 14sp for body text, scaling up for lower grades
6. **Content moderation layer** — flag AI-generated content for human review before display

---

## PART 4 — LearnIt Future Vision: Video, Visuals & Tutor Lessons

### The Problem

Text-only AI lessons are less engaging than video-based learning. Kids today are visual learners who respond better to animations, demonstrations, and real human instructors. The current LearnIt experience feels static compared to YouTube or TikTok-style content.

### Vision: Multi-Modal LearnIt

Transform LearnIt from a text-only reader into a **multi-modal learning experience** with three content tiers:

#### Tier 1 — AI-Generated Lesson Videos (Immediate, Automated)

| Component | What | How |
|-----------|------|-----|
| **Text-to-Speech Narration** | Already exists via Android TTS | ✅ Working |
| **Animated Illustrations** | Generate simple SVG/Canvas animations for each lesson paragraph | Use AI (e.g. Lottie animations from prompt) or pre-built animation templates per subject |
| **Diagram Generator** | Auto-generate diagrams for math concepts, science processes, Ghana maps | Use AI image generation (DALL-E/Stable Diffusion) or programmatically drawn SVGs |
| **Whiteboard Animation** | Simulated "hand drawing" effect showing equations/words being written | Lottie/CSS-style animation overlays on lesson text |

**Implementation:** Store generated animations as Lottie JSON files in Supabase Storage, cached locally on first view. Fallback to text-only if animation fails to load.

#### Tier 2 — Curated YouTube Video Integration (Curation-Based)

| Component | What | How |
|-----------|------|-----|
| **Curated Video Library** | YouTube videos matched to lesson topics | Store video IDs in a `lesson_videos` Supabase table (topic → YouTube ID mapping) |
| **YouTube Player Integration** | Embedded player within LearnIt screen | Use `YouTubePlayerView` (Android library) or custom `WebView` player |
| **Video-Text Sync** | Highlight lesson text while video plays | Timestamp-based sync via embedded captions |
| **Offline Fallback** | Cache video metadata + offer download for offline | Store video URLs in Room DB; download via `YouTubeDownloader` API for offline viewing |

**Content Strategy:**
- Partner with Ghanaian educational YouTubers (e.g. channels covering NaCCA syllabus)
- Curate Khan Academy Kids, Learn At Home Ghana, and similar channels
- Build a `video_curations` table: `(subject, topic, grade_min, grade_max, youtube_id, channel_name, duration_sec, verified)`

#### Tier 3 — Real Tutor-Led Video Lessons (Premium Content)

| Component | What | How |
|-----------|------|-----|
| **Tutor Video Portal** | Platform for tutors to upload recorded lessons | Build a web-based upload portal (Next.js/Supabase Storage) |
| **Tutor Profiles** | Verified teacher profiles with ratings | Table: `tutor_profiles` (user_id, name, subject, bio, verified, rating) |
| **Lesson Matching** | Match tutor videos to roadmap topics | AI-powered topic matching (embed both lesson topic and video transcript, cosine similarity) |
| **Quality Review** | All tutor content reviewed before publishing | Admin dashboard with approve/reject workflow |
| **Revenue Model** | Tutors earn per view; StuddyHub takes a platform fee | Stripe/MoMo integration for tutor payouts |

**Partnership Opportunities:**
- **Ghana Education Service (GES)** — Official curriculum-aligned content
- **STEMbees Ghana** — STEM education for girls
- **Ghana Code Club** — ICT/programming content
- **University education students** — Tutoring as internship/service learning

### LearnIt v2 UX Flow

```
┌─────────────────────────────────────────────────────┐
│                   LEARN IT v2                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  CONTENT TYPE SELECTOR (Auto or Manual)       │  │
│  │                                               │  │
│  │  📝 Read & Listen    (current text + TTS)     │  │
│  │  🎬 Watch Lesson     (AI/Tutor video)         │  │
│  │  🗺️ Explore Diagram  (interactive diagram)    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  LESSON CONTENT (based on selected type)      │  │
│  │                                               │  │
│  │  If Video:                                    │  │
│  │    Embedded YouTube/Tutor player              │  │
│  │    Below: Key points summary (text)           │  │
│  │    Below: Vocabulary words                     │  │
│  │                                               │  │
│  │  If Diagram:                                  │  │
│  │    Interactive SVG/Canvas diagram              │  │
│  │    Tap elements for explanations               │  │
│  │    Below: Written explanation                  │  │
│  │                                               │  │
│  │  If Read & Listen:                            │  │
│  │    Current paragraph view + TTS               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  CHECK PHASE (same as current)                │  │
│  │  + inline wrong-answer explanations           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  RESULT PHASE                                 │  │
│  │  + "Watch Again" button (if video available)  │  │
│  │  + "Try Similar Lesson" recommendation        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Database Schema Additions (Future)

```sql
-- Curated video library
CREATE TABLE lesson_videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_code text NOT NULL,
    topic_keywords text[] NOT NULL,  -- ["fractions", "pizza", "basic math"]
    grade_min integer DEFAULT 1,
    grade_max integer DEFAULT 9,
    video_type text NOT NULL,        -- "youtube" | "tutor_upload" | "ai_generated"
    video_url text NOT NULL,
    youtube_id text,
    title text NOT NULL,
    description text,
    duration_sec integer,
    thumbnail_url text,
    channel_name text,
    tutor_id uuid REFERENCES tutor_profiles(id),
    verified boolean DEFAULT false,
    view_count integer DEFAULT 0,
    avg_rating numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Tutor profiles
CREATE TABLE tutor_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    bio text,
    subjects text[] NOT NULL,
    avatar_url text,
    verified boolean DEFAULT false,
    total_lessons integer DEFAULT 0,
    total_views integer DEFAULT 0,
    avg_rating numeric DEFAULT 0,
    payout_method text,  -- "momo" | "bank" | "stripe"
    payout_details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Lesson progress persistence
CREATE TABLE lesson_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id text NOT NULL,  -- roadmap step ID
    phase text NOT NULL,      -- "reading" | "check" | "result"
    current_paragraph integer DEFAULT 0,
    current_question integer DEFAULT 0,
    score_so_far integer DEFAULT 0,
    last_watched_video_id uuid,
    completed boolean DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, lesson_id)
);
```

---

## PART 5 — Curriculum Grounding & Retrieval (RAG) Audit

### 1. Vector & Embedding Infrastructure

- **pgvector Extension:** **NONE.** No vector columns, embedding fields, or `pgvector` indexing exist in the database or client models.
- **Embedding API Calls:** **NONE.** Neither client nor Supabase Edge functions invoke text-embedding models (e.g. `text-embedding-004`).

### 2. Ingested Source Material

- **Grounding Assets:** **ZERO ingested primary syllabus documents.** There are no raw NaCCA PDF files, past BECE exam mark schemes, or textbooks stored in Supabase Storage or bundled assets.
- **Current Mechanism:** 100% of curriculum alignment is currently generated via **zero-shot / few-shot prompt steering** using structured metadata strings defined in `KidsCurriculum.kt` and `QuizzesViewModel.kt`.

### 3. Prompt Steering Logic (`QuizzesViewModel.kt`)

- **`buildExplorerGameTopic` (Lines 618–638):**
  ```kotlin
  "kente_quiz" -> "$country history, culture, geography and national pride — Level $levelIndex: $levelName"
  "ananse_riddles" -> "Kid-friendly riddles, brain teasers and logic puzzles — Level $levelIndex: $levelName"
  "maths_quest" -> "Maths practice ($ops) — Level $levelIndex: $levelName"
  ```
- **`gameGuidance` (Lines 646–662):** Enforces negative constraints on the Gemini prompt to prevent hallucination (e.g. instructing the model that Kente Quiz covers general national culture and history rather than solely textile weaving).
- **Missing Guidance:** `maths_quest`, `science_explorer`, `math_asteroid_blaster`, `spelling_bee` have NO `gameGuidance()` — these games get generic, unfocused AI questions.

### 4. Content Approval & Safety Loop

- **Human-in-the-Loop Review:** **NONE.** AI quiz questions and explanations are generated and displayed live to children in real-time with zero human pre-screening.

---

## PART 6 — Multi-Country Generalization & Degradation

1. **Non-Ghana Country Selection at Onboarding:**
   - The user's selected country code is persisted in `user_education_profiles`.
   - `buildExplorerGameTopic()` dynamically injects the chosen `countryName` into the prompt.
   - If the remote country table has no matching education levels, the app falls back to standard Primary (Basic 1–6) & JHS structures without crashing.

2. **Offline Fallback Scope (`KidsCurriculum.kt`):**
   - Offline fallback structure is currently **Ghana-specific (NaCCA)**. If a non-Ghanaian user opens the app offline on first install, they will see Ghanaian curriculum subjects until online cloud sync occurs.

3. **Hardcoded Cultural Themes:**
   - Game keys such as `kente_quiz` and `ananse_riddles` retain their Ghanaian names, but prompt steering adapts to the user's selected country.

---

## PART 7 — Deep Settings Screen Audit (Dev States, Leaks & Security Gaps)

| Location | Issue / Leak / Vulnerability | Severity | HCI & Safety Impact |
|:---------|:----------------------------|:---------|:--------------------|
| **Lines 629–636** | **Debug Terminal Button:** `if (com.example.BuildConfig.DEBUG)` renders an "Inspect Cloud Sync / Inspect Sync Errors" button. | **Blocker** | Exposes raw sync logs to users on debug/staging builds. |
| **Lines 398–410** | **Parental Gate Bypass on Tier Switch:** "Switch to SHS ⚡" / "Switch to Uni 🎓" execute immediately without `ParentalGateModal`. | **Blocker** | Violates COPPA/CCI safety. Child can exit Explorer into university content. |
| **Lines 718–739** | **Unprotected Danger Zone:** "Reset Local Data" and "Erase All My Data" accessible without parental verification. | **Blocker** | High risk of accidental data deletion by young children. |
| **Lines 238, 278, 351** | **Hardcoded `Color.White` Cards** in Explorer Mode instead of `MaterialTheme.colorScheme.surface`. | **Should-Fix** | Glaring visual clash in Dark theme. |
| **Lines 288–292** | **Hardcoded SFX Switch:** Always `checked = true`, never persisted to DataStore/Room. | **Should-Fix** | Users/parents cannot mute game audio permanently. |

---

## PART 8 — Comprehensive Screen-by-Screen HCI & Usability Audit

Applying **HCI principles**, **Nielsen's 10 Usability Heuristics**, **Fitts's Law**, **Cognitive Load Theory**, and **Child-Computer Interaction (CCI)** guidelines:

### 1. Onboarding Screen (`OnboardingScreen.kt`)
- **Strengths:** Large visual avatar tiles, interactive character selection, clear country flags.
- **Weaknesses:** Step 3 (Style picker) presents dense educational jargon unsuitable for ages 6-9.
- **Recommendation:** Replace with kid-friendly emoji cards (🎨 Pictures, 🎧 Listen, 🧩 Puzzles).

### 2. Explorer Home Dashboard (`ExplorerHomeContent.kt`)
- **Strengths:** Daily streak flame, next mission hero card with reward badge, tactile 3D cards.
- **Weaknesses:** Default username fallback "codex". No first-time user guidance.
- **Recommendation:** Replace "codex" with "Young Explorer". Implement Ollie's first-quest tour.

### 3. Game Detail / Level Ladder (`ExplorerGameDetailScreen.kt`)
- **Strengths:** Connected level journey path, 3-star indicators, locked padlock badges.
- **Weaknesses:** Tapping locked level is silent — no feedback or encouragement.
- **Recommendation:** Add bounce animation + toast: "Complete Level X first! 🚀"

### 4. Quiz Runner Arena (`ExplorerQuizRunnerScreen.kt`)
- **Strengths:** Combo multiplier, heart-based lives, tactile haptic pop, 3D victory podium.
- **Weaknesses:** 20-second timer induces anxiety for Basic 1-3.
- **Recommendation:** Add "Relaxed Mode" (untimed) for Basic 1-3.

### 5. Spelling Bee Arena (`SpellingBeeScreen.kt`)
- **Strengths:** TTS phonics playback, interactive letter tiles, backspace undo.
- **Weaknesses:** Empty letter slots lack dashed borders showing word length.
- **Recommendation:** Add dashed bounding boxes for empty slots.

### 6. Math Asteroid Blaster (`MathAsteroidBlasterGameScreen.kt`)
- **Strengths:** Falling asteroid physics, arithmetic keypad, shield defense, space sounds.
- **Weaknesses:** Asteroids overlap with top HUD on small screens (<5.5").
- **Recommendation:** Clamp spawn boundary using `BoxWithConstraints`.

### 7. Speed Race & Multiplayer (`ExplorerMultiplayerBattleScreen.kt`)
- **Strengths:** Live race progress bars, PIN room code, confetti.
- **Weaknesses:** Network drop = unrecoverable waiting state, no exit button.
- **Recommendation:** 10-second reconnect watchdog + "Exit Race" button.

### 8. Learn It (`LearnItScreen.kt`)
- **Strengths:** Step progress bar, TTS read-aloud, child-friendly cards.
- **Weaknesses:** Fixed 12sp font in formula blocks. No wrong-answer explanations inline. No grade-differentiated content.
- **Recommendation:** Dynamic sp scaling, inline explanations, difficulty bands.

### 9. Learn It Library (`LearnItLibraryScreen.kt`)
- **Strengths:** Color-coded subject cards.
- **Weaknesses:** Empty search = blank column.
- **Recommendation:** Add Ollie illustration: "No lessons found — try 'Animals' or 'Fractions'!"

### 10. Badges (`ExplorerBadgesScreen.kt`)
- **Strengths:** 3D metallic rims, gold gradients, Adinkra trivia modals.
- **Weaknesses:** Badge #7 (Speed Demon) hardcoded locked.
- **Recommendation:** Wire speed race completion to Room DB stats.

### 11. Avatar Store (`ExplorerStoreScreen.kt`)
- **Strengths:** 3D podium, radial aura, real-time equip preview.
- **Weaknesses:** Insufficient stars = generic error tone, no helpful message.
- **Recommendation:** Dialog: "You need X more ⭐! Complete a Daily Quest to earn them."

### 12. Roadmap (`ExplorerRoadmapDialog.kt`)
- **Strengths:** Z-shaped island progression, glowing node links.
- **Weaknesses:** Final milestone = generic text, no exclusive reward.
- **Recommendation:** Award "Explorer Crown 👑" avatar on Citadel completion.

### 13. Parental Gate (`ParentalGateModal.kt`)
- **Strengths:** Dynamic multiplication challenge, keypad input.
- **Weaknesses:** Wrong answer doesn't auto-clear text field.
- **Recommendation:** Auto-reset buffer + shake animation on error.

### 14. Settings (`SettingsScreen.kt`)
- **Strengths:** Voice persona selector, speech speed slider.
- **Weaknesses:** Debug buttons exposed, tier switches bypass gate, destructive actions unprotected.
- **Recommendation:** All danger zone behind `ParentalGateModal`.

---

## PART 9 — System Scalability Assessment

### Current Architecture Strengths
- ✅ Room DB + Supabase cloud sync with offline-first design
- ✅ Edge functions for auth and profile management
- ✅ `minSdk = 24` covers 95%+ of West African budget phones
- ✅ GPU-accelerated Compose animations (`graphicsLayer`)
- ✅ `SyncManager` handles queue-based background sync
- ✅ `user_stats.total_xp` now synced to cloud for leaderboard ranking
- ✅ Coins vs Stars separation (spendable vs lifetime)

### Scalability Gaps

| Area | Issue | Fix |
|:-----|:------|:----|
| **Content Generation** | 100% zero-shot AI with no curriculum grounding | Ingest NaCCA syllabus into pgvector for RAG |
| **FCM Push Notifications** | Firebase initialized but no handler | Add `FirebaseMessagingService` for streak reminders |
| **Analytics Pipeline** | Zero analytics — can't track retention/engagement | Add lightweight event logging (Mixpanel/Amplitude) |
| **Multi-country Offline** | Offline fallback is Ghana-specific | Country-aware offline data or progressive download |
| **Content Safety** | No human review for AI content | Content moderation layer or flagged review queue |
| **Rate Limiting** | No client-side rate limiting on AI calls | Add cooldown timers to prevent abuse |
| **Video Infrastructure** | No video content delivery | Supabase Storage + CDN for video thumbnails/metadata |

---

## PART 10 — New User Onboarding & Feature Scaffolding Audit

### Current State
- Users complete basic setup and are dropped on the full dashboard without guidance.
- **Cognitive Barrier:** A 6-10 year-old faces decision fatigue — doesn't understand missions → stars → store → badges loop.

### Solution: Professor Ollie's 3-Step Interactive First-Quest Tour

1. **Interactive Spotlight (Step 1):** Dim background, highlight "Today's Mission" with Ollie dialogue: _"Welcome Explorer [Name]! Let's do our very first mission together! 🚀"_
2. **First Game Scaffolding (Step 2):** Pulsing finger indicator on letter tiles/buttons: _"Tap the letters to spell what you hear!"_
3. **Core Reward Loop (Step 3):** Award first 10 ⭐ Stars with confetti, guide to Store: _"You earned your first Stars! Let's customize your avatar! ✨"_

---

## PART 11 — Strategic Product Evaluation & Market Positioning

### 🌟 Core Product Strengths & Competitive Moats

- **Cultural Relevance (Ghana & Africa First):** Kente heritage, Adinkra lore, Ananse riddles, NaCCA syllabus — emotional resonance global apps can't match.
- **100% Offline Capability:** In Sub-Saharan Africa where data is costly, offline resilience is the single largest competitive advantage.
- **Tactile 3D Gamification:** Physical bounce animations, sound feedback, combo multipliers, avatar customization — learning feels like an arcade.
- **Multi-Modal LearnIt (Future):** Text + AI video + curated YouTube + tutor lessons = comprehensive learning experience.

### ⚠️ Strategic Weaknesses & How to Strengthen

- **Multi-Tier Identity Split:** Explorer/Achiever/Scholar in one codebase.
  - _Strategy:_ V1 marketing = Explorer only. Seal Explorer with Parental Gate.
- **Parental Visibility ("Proof of Learning"):** Kids play, parents pay.
  - _Strategy:_ Parent Report Card behind Parental Gate showing accuracy %, time spent, streak.
- **Content Depth:** Text-only lessons vs. video-rich competitors.
  - _Strategy:_ LearnIt v2 with AI videos, YouTube curation, and tutor content (see Part 4).

### 🚀 High-Growth Market Opportunities

- **School & Teacher Homework PINs:** 5-digit assignment PINs for viral classroom adoption.
- **Parent Daily Digest Notification:** Evening streak/activity notifications.
- **Tutor Marketplace:** Verified tutors upload lessons, earn per view.
- **AI Video Generation:** Auto-generate animated lesson videos from text content.
- **YouTube Curation:** Partner with Ghanaian educational YouTubers for curriculum-aligned content.

---

## PART 12 — Security, Privacy & Compliance Diagnostic

1. **Secrets Exposure:** **CLEAN.** No API keys or credentials in source code.
2. **Supabase RLS:** Row Level Security active on `user_education_profiles`, `quiz_submissions`, `game_sessions`.
3. **Data Protection (Ghana Act 843 & COPPA):**
   - No behavioral advertising, analytics trackers, or phone number collection.
   - **Requires** prominent in-app Privacy Policy accessible without login.
4. **Android Permissions:** Only `INTERNET` and `RECORD_AUDIO`; zero high-risk permissions.
5. **Gemini Safety:** No explicit `BLOCK_LOW_AND_ABOVE` enforcement for child accounts.

---

## PART 13 — Performance & Low-End Device Optimization

1. **Memory & 60fps:** Compose immutable view states eliminate recomposition thrashing.
2. **GPU Animations:** `graphicsLayer(translationY)` prevents CPU layout passes.
3. **Audio Performance:** Synthesizer tones must dispatch off main thread for budget quad-core devices.
4. **Device Coverage:** `minSdk = 24` covers 95%+ of West African budget phones.

---

## PART 14 — Prioritized Go-Live Plan

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRIORITIZED GO-LIVE PLAN                               │
├─────────────────┬──────────────────────────────────────────────────────┬───────────────┤
│ Tier            │ Action Item                                          │ Effort        │
├─────────────────┼──────────────────────────────────────────────────────┼───────────────┤
│ 🚨 BLOCKER      │ 1. Gate Settings Tier Switches with Parental Gate    │ Small (1 file)│
│ 🚨 BLOCKER      │ 2. Gate Danger Zone (Reset/Erase) with Parental Gate │ Small (1 file)│
│ 🚨 BLOCKER      │ 3. Remove Debug Terminal / Sync Log Buttons          │ Small (1 file)│
│ 🚨 BLOCKER      │ 4. Fix Hardcoded Light-Mode Cards in Settings        │ Small (1 file)│
│ 🚨 BLOCKER      │ 5. Add In-App Privacy Policy & Terms Link Modal      │ Small (1 file)│
│ 🚨 BLOCKER      │ 6. Enforce BLOCK_LOW_AND_ABOVE on Gemini Prompts     │ Small (1 file)│
│ 🚨 BLOCKER      │ 7. Sanitize Default Username Fallback ("codex")      │ Small (1 file)│
│ 🚨 BLOCKER      │ 8. Add gameGuidance for maths_quest, science_explorer│ Small (1 file)│
│ 🚨 BLOCKER      │ 9. Add gameGuidance for math_asteroid_blaster        │ Small (1 file)│
│ 🚨 BLOCKER      │ 10. Add gameGuidance for spelling_bee                │ Small (1 file)│
│ 🚨 BLOCKER      │ 11. Grade-aware lesson difficulty (Basic vs JHS)     │ Medium (2 f.) │
│                 │                                                      │               │
│ ⚠️ SHOULD FIX   │ 12. Implement Ollie's 3-Step Guided First-Quest Tour │ Medium (2 f.) │
│ ⚠️ SHOULD FIX   │ 13. Wire Speed Race Tracking for Badge #7            │ Medium (2 f.) │
│ ⚠️ SHOULD FIX   │ 14. Offload Audio Synthesizer Pops to Coroutine BG   │ Small (1 file)│
│ ⚠️ SHOULD FIX   │ 15. Add Dashed Letter Slots in Spelling Bee          │ Small (1 file)│
│ ⚠️ SHOULD FIX   │ 16. Add Reconnect Watchdog in Multiplayer Lobby      │ Medium (1 f.) │
│ ⚠️ SHOULD FIX   │ 17. Persist SFX Sound Toggle in DataStore            │ Small (1 file)│
│ ⚠️ SHOULD FIX   │ 18. Auto-clear Keypad on Parental Gate Error         │ Small (1 file)│
│ ⚠️ SHOULD FIX   │ 19. Wrong-answer explanations in LearnIt Check phase │ Small (1 file)│
│ ⚠️ SHOULD FIX   │ 20. Persist lesson progress for resume               │ Medium (2 f.) │
│ ⚠️ SHOULD FIX   │ 21. Dynamic font scaling in LearnIt (min 14sp)       │ Small (1 file)│
│                 │                                                      │               │
│ ⏳ V1.1         │ 22. Parent Report Card Dashboard                     │ Medium (Epic) │
│ ⏳ V1.1         │ 23. Teacher Homework 5-Digit PIN System              │ Medium (Epic) │
│ ⏳ V1.1         │ 24. Relaxed Untimed Mode for Basic 1–3               │ Medium (Epic) │
│ ⏳ V1.1         │ 25. LearnIt AI-generated lesson illustrations        │ Medium (Epic) │
│ ⏳ V1.1         │ 26. LearnIt YouTube video integration                │ Medium (Epic) │
│ ⏳ V1.1         │ 27. Adinkra Symbol Match game (new)                  │ Medium (1 f.) │
│                 │                                                      │               │
│ ⏳ V2.0         │ 28. NaCCA & BECE Ingestion with pgvector RAG         │ Large (Epic)  │
│ ⏳ V2.0         │ 29. Tutor Upload Portal & Video Lessons              │ Large (Epic)  │
│ ⏳ V2.0         │ 30. AI Video Generation for Lessons                  │ Large (Epic)  │
│ ⏳ V2.0         │ 31. Offline Local Voice Recognition Model            │ Large (Epic)  │
│ ⏳ V2.0         │ 32. Analytics Pipeline (Mixpanel/Amplitude)          │ Medium (Epic) │
│ ⏳ V2.0         │ 33. FCM Push Notifications (Streak Reminders)        │ Medium (Epic) │
└─────────────────┴──────────────────────────────────────────────────────┴───────────────┘
```

### Detailed Item Breakdown & File Paths

#### 🚨 1. BLOCKERS (Must Complete Before Any Public Release)

- **B1: Gate Settings Tier Switches Behind Parental Gate**
  - _Files:_ `SettingsScreen.kt`
  - _Description:_ Wrap tier switch clicks with `ParentalGateModal`.

- **B2: Protect Danger Zone Actions**
  - _Files:_ `SettingsScreen.kt`
  - _Description:_ Require parental verification before Reset/Erase dialogs.

- **B3: Remove Debug Terminal Sync Log UI**
  - _Files:_ `SettingsScreen.kt`
  - _Description:_ Remove debug sync button from release builds.

- **B4: Fix Hardcoded Light-Mode Cards**
  - _Files:_ `SettingsScreen.kt`
  - _Description:_ Replace `Color.White` with `MaterialTheme.colorScheme.surface`.

- **B5: In-App Privacy Policy Modal**
  - _Files:_ `SettingsScreen.kt`, `OnboardingScreen.kt`
  - _Description:_ Ghana Act 843 / COPPA child privacy notice.

- **B6: Enforce Gemini Safety Settings**
  - _Files:_ `StuddyHubRepository.kt`
  - _Description:_ `BLOCK_LOW_AND_ABOVE` for all child accounts.

- **B7: Sanitize Default Username**
  - _Files:_ `ExplorerHomeContent.kt`
  - _Description:_ Replace "codex" with "Young Explorer".

- **B8-B10: Add Missing gameGuidance**
  - _Files:_ `QuizzesViewModel.kt`
  - _Description:_ Add `gameGuidance()` entries for `maths_quest`, `science_explorer`, `math_asteroid_blaster`, `spelling_bee`.

- **B11: Grade-Aware Lesson Difficulty**
  - _Files:_ `QuizzesViewModel.kt`, `StuddyHubRepository.kt`
  - _Description:_ Pass `difficultyBand` to lesson generation AI prompt based on user's grade level.

#### ⚠️ 2. SHOULD FIX

- **S1: Ollie's 3-Step First-Quest Tour** — Guide first-time users.
- **S2: Speed Race Badge Tracking** — Wire race completion to Room DB.
- **S3: Offload Audio to Background Thread** — Guarantee 60fps on budget devices.
- **S4: Dashed Letter Slots in Spelling Bee** — Visual word length indicator.
- **S5: Reconnect Watchdog in Multiplayer** — Exit button on network stall.
- **S6: Persist SFX Toggle** — Store in SharedPreferences.
- **S7: Auto-clear Parental Gate Keypad** — Shake + reset on wrong answer.
- **S8: Wrong-Answer Explanations** — Show inline in LearnIt Check phase.
- **S9: Persist Lesson Progress** — Resume interrupted lessons.
- **S10: Dynamic Font Scaling** — Minimum 14sp body text in LearnIt.

#### ⏳ 3. V1.1 (Post-Launch, 2-4 Weeks)

- **P1: Parent Report Card Dashboard**
- **P2: Teacher Homework 5-Digit PIN System**
- **P3: Relaxed Untimed Mode for Basic 1-3**
- **P4: LearnIt AI-Generated Illustrations**
- **P5: LearnIt YouTube Video Integration**
- **P6: Adinkra Symbol Match Game**

#### ⏳ 4. V2.0 (Long-Term Roadmap)

- **P7: NaCCA & BECE Ingestion with pgvector RAG**
- **P8: Tutor Upload Portal & Video Lessons**
- **P9: AI Video Generation for Lessons**
- **P10: Offline Local Voice Recognition Model**
- **P11: Analytics Pipeline**
- **P12: FCM Push Notifications**
- **P13: Parent Daily Digest Notifications**
