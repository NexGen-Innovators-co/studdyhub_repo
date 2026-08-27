# Explorer Tier Fixes — Implementation Plan

> **Branch:** `explorer-tier-fixes`
> **Base:** `main` (commit `728579c`)
> **Status:** Ready for implementation
> **Focus:** Explorer tier only — no changes to Achiever/Scholar paths

---

## Table of Contents

1. [Overview](#overview)
2. [Issue Summary](#issue-summary)
3. [Phase 1: Error Message Sanitization](#phase-1-error-message-sanitization)
4. [Phase 2: Streak Calendar Fix](#phase-2-streak-calendar-fix)
5. [Phase 3: Sound Assets for Offline Use](#phase-3-sound-assets-for-offline-use)
6. [Phase 4: AI Chat Prompt Segmentation](#phase-4-ai-chat-prompt-segmentation)
7. [Phase 5: Live Battle UI Cleanup](#phase-5-live-battle-ui-cleanup)
8. [Testing Checklist](#testing-checklist)
9. [Merge Strategy](#merge-strategy)

---

## Overview

This document covers all fixes needed before the Explorer tier beta release. Each phase is independent and can be tested in isolation. The guiding principles are:

- **Explorer-only scope:** Do not touch Achiever/Scholar code paths unless necessary
- **Test one tier at a time:** Verify Explorer works before touching anything else
- **No regressions:** Existing working features must continue to work
- **Kid-friendly everything:** All user-facing text must be understandable by a 10-year-old

---

## Issue Summary

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Raw exception messages shown to kids in quiz/lesson generation | HIGH | 1 |
| 2 | Streak calendar dates not highlighting despite streak > 0 | HIGH | 2 |
| 3 | No offline sound assets — web uses remote URLs, mobile uses PCM synthesis | MEDIUM | 3 |
| 4 | AI chat doesn't know app features or tier capabilities | MEDIUM | 4 |
| 5 | Live battle screens have redundant TopAppBars | LOW | 5 |

---

## Phase 1: Error Message Sanitization

**Goal:** Replace all raw exception/technical messages with kid-friendly text.

### Step 1.1 — Add error constants to `UserMessages`

**File:** `mobile/app/src/main/java/com/example/data/remote/BackendApiService.kt`
**Location:** `UserMessages` object (around line 359)

Add these constants:

```kotlin
const val QUIZ_GENERATION_FAILED = "Ollie couldn't make those questions right now. Let's try again!"
const val SPELLING_FAILED = "Ollie couldn't generate those words. Please try again!"
const val LESSON_FAILED = "Ollie couldn't prepare this lesson. Please try again!"
const val QUESTIONS_FAILED = "Something went wrong loading the questions. Let's try again!"
const val LIVE_QUIZ_FAILED = "The live quiz ran into a problem. Please try rejoining!"
```

### Step 1.2 — Fix `QuizzesViewModel.generateLiveQuestions()`

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/QuizzesViewModel.kt`

**Lines to change:**
- Line 716: Replace `"Backend 'generate-ai-quiz' returned no valid questions..."` with `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED`
- Lines 720-721: Replace `"Edge function 'generate-ai-quiz' returned HTTP $code..."` with `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED`
- Line 723: Replace `"Edge function 'generate-ai-quiz' failed..."` with `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED`
- Line 728: Replace `"Backend live-question generation failed: ${e.message}"` with `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED`

### Step 1.3 — Fix `QuizzesViewModel.generateSpellingWords()`

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/QuizzesViewModel.kt`

**Lines to change:**
- Lines 775-776: Replace `"Edge function 'generate-spelling-words' returned HTTP $code..."` with `BackendApiService.UserMessages.SPELLING_FAILED`
- Line 778: Replace `"Edge function 'generate-spelling-words' failed..."` with `BackendApiService.UserMessages.SPELLING_FAILED`
- Line 784: Replace `"AI word generation failed: ${e.message}"` with `BackendApiService.UserMessages.SPELLING_FAILED`

### Step 1.4 — Fix `LearnItScreen` error messages

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/LearnItScreen.kt`

**Lines to change:**
- Line 276: Replace `"Lesson generation failed: ${backendRes.message}"` with `BackendApiService.UserMessages.LESSON_FAILED`
- Line 281: Replace `"Failed to generate lesson: ${e.localizedMessage ?: e.message}"` with `BackendApiService.UserMessages.LESSON_FAILED`

### Step 1.5 — Fix `ExplorerGameDetailScreen` error passthrough

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/ExplorerGameDetailScreen.kt`

- Line 162-164: The `realError` variable comes from `uiState.userMessage` which may contain unsanitized text. Add a sanitizer check:
```kotlin
generationError = if (realError != null && (realError!!.contains("Exception") || realError!!.contains("HTTP") || realError!!.contains("Edge function"))) {
    BackendApiService.UserMessages.QUIZ_GENERATION_FAILED
} else {
    realError ?: "Ollie couldn't prepare this level. Check your connection and try again."
}
```

### Verification

After Phase 1, trigger a quiz generation failure (e.g., go offline mid-request) and confirm:
- No Java class names appear on screen
- No HTTP status codes appear on screen
- No "Edge function" or "generate-ai-quiz" text appears
- All messages say something a kid would understand

---

## Phase 2: Streak Calendar Fix

**Goal:** Make calendar dates highlight correctly when streak > 0.

### Step 2.1 — Refresh `activeDays` on dashboard resume

**File:** `mobile/app/src/main/java/com/example/ui/screens/dashboard/ExplorerHomeContent.kt`

**Current code (line 82-84):**
```kotlin
var activeDays by remember { mutableStateOf(emptySet<String>()) }
LaunchedEffect(Unit) {
    activeDays = repo.getActiveDays()
}
```

**Change to:**
```kotlin
var activeDays by remember { mutableStateOf(emptySet<String>()) }
LaunchedEffect(Unit) {
    activeDays = repo.getActiveDays()
}
// Re-fetch when the composable resumes (e.g., after user completes an activity)
val lifecycleOwner = LocalLifecycleOwner.current
DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
        if (event == Lifecycle.Event.ON_RESUME) {
            activeDays = repo.getActiveDays()
        }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
}
```

**New imports needed:**
```kotlin
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
```

### Step 2.2 — Use `commit()` instead of `apply()` for active days persistence

**File:** `mobile/app/src/main/java/com/example/data/repository/StuddyHubRepository.kt`

**Current code (line 2675):**
```kotlin
prefs.edit().putStringSet("active_days", activeDays).apply()
```

**Change to:**
```kotlin
prefs.edit().putStringSet("active_days", activeDays).commit()
```

This ensures the data is written synchronously before `recordStudyActivity()` returns, so the calendar always has fresh data.

### Step 2.3 — Force-refresh active days on dashboard entry

**File:** `mobile/app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt`

Add a call to refresh `activeDays` in `onScreenResumed()`:
```kotlin
// In the DashboardScreen composable, ensure activeDays is refreshed
// when the screen becomes visible
```

### Verification

After Phase 2:
1. Complete a quiz or activity
2. Return to dashboard
3. Confirm the correct dates are highlighted in green (past) or orange (today)
4. The streak number should match the number of highlighted dates

---

## Phase 3: Sound Assets for Offline Use

**Goal:** Bundle high-quality sound effects with the app so they work offline.

### Background

The web app uses 5 remote Supabase Storage URLs for quiz sounds. The mobile app currently uses programmatic PCM synthesis (`GameAudioEngine.kt`) which sounds artificial. We need to bundle real audio files.

### Sound Files Needed

| Sound | Web URL | Usage |
|-------|---------|-------|
| Background music | `sonican-informational-quiz-loop-397409.mp3` | Lobby, quiz in-progress |
| Correct answer | `mixkit-correct-answer-tone-2870.wav` | Right answer feedback |
| Clock ticking | `mixkit-fast-wall-clock-ticking-1063.wav` | Countdown timer |
| Wrong answer | `mixkit-wrong-answer-fail-notification-946.wav` | Wrong answer feedback |
| Applause | `mixkit-end-of-show-clapping-crowd-477.wav` | Results screen, victory |

### Step 3.1 — Obtain the audio files

**Option A (preferred):** You upload the files to the new Supabase storage bucket and I download them via `curl` or `wget` into `mobile/app/src/main/res/raw/`.

**Option B:** You provide the files locally and I copy them into the project.

**Option C:** I download them from the original Supabase Storage URLs directly (if still accessible):
```bash
mkdir -p mobile/app/src/main/res/raw
curl -o mobile/app/src/main/res/raw/quiz_bgm.mp3 "https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/sonican-informational-quiz-loop-397409.mp3"
curl -o mobile/app/src/main/res/raw/correct_answer.wav "https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-correct-answer-tone-2870.wav"
curl -o mobile/app/src/main/res/raw/clock_ticking.wav "https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-fast-wall-clock-ticking-1063.wav"
curl -o mobile/app/src/main/res/raw/wrong_answer.wav "https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-wrong-answer-fail-notification-946.wav"
curl -o mobile/app/src/main/res/raw/applause.wav "https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-end-of-show-clapping-crowd-477.wav"
```

### Step 3.2 — Create `LiveQuizSoundManager.kt`

**New file:** `mobile/app/src/main/java/com/example/ui/components/LiveQuizSoundManager.kt`

```kotlin
package com.example.ui.components

import android.content.Context
import android.media.MediaPlayer
import com.example.R

/**
 * Manages audio playback for live quiz sessions.
 * Uses bundled raw resources for offline-capable sound effects.
 * Falls back to GameAudioEngine PCM synthesis if resources fail.
 */
class LiveQuizSoundManager(private val context: Context) {

    private var bgmPlayer: MediaPlayer? = null
    private var ttsPlayer: MediaPlayer? = null

    fun playBackgroundMusic() {
        stopBackgroundMusic()
        bgmPlayer = MediaPlayer.create(context, R.raw.quiz_bgm)?.apply {
            isLooping = true
            setVolume(0.3f, 0.3f)
            start()
        }
    }

    fun stopBackgroundMusic() {
        bgmPlayer?.stop()
        bgmPlayer?.release()
        bgmPlayer = null
    }

    fun playCorrectAnswer() {
        playOneShot(R.raw.correct_answer)
    }

    fun playWrongAnswer() {
        playOneShot(R.raw.wrong_answer)
    }

    fun playClockTick() {
        playOneShot(R.raw.clock_ticking)
    }

    fun playApplause() {
        playOneShot(R.raw.applause)
    }

    private fun playOneShot(resId: Int) {
        try {
            MediaPlayer.create(context, resId)?.apply {
                setOnCompletionListener { it.release() }
                start()
            }
        } catch (_: Exception) {
            // Fallback: use TactileSoundSystem
            com.example.ui.components.TactileSoundSystem.playPopSound()
        }
    }

    fun release() {
        stopBackgroundMusic()
        ttsPlayer?.release()
        ttsPlayer = null
    }
}
```

### Step 3.3 — Integrate into live quiz screens

**Files to modify:**
- `mobile/app/src/main/java/com/example/ui/screens/quizzes/QuizzesScreen.kt` — `LiveQuizSessionRunner`
- `mobile/app/src/main/java/com/example/ui/screens/quizzes/ExplorerMultiplayerBattleScreen.kt`

Add `LiveQuizSoundManager` as a lifecycle-aware component:
```kotlin
val soundManager = remember { LiveQuizSoundManager(context) }
DisposableEffect(Unit) {
    onDispose { soundManager.release() }
}
```

Play sounds at:
- Lobby join → `playBackgroundMusic()`
- Question revealed → `stopBackgroundMusic()`
- Correct answer → `playCorrectAnswer()`
- Wrong answer → `playWrongAnswer()`
- Timer < 5s → `playClockTick()`
- Results screen → `playApplause()`

### Verification

After Phase 3:
1. Go to a live quiz lobby — background music should play
2. Answer correctly — correct tone plays
3. Answer wrong — buzzer plays
4. Timer under 5 seconds — ticking plays
5. Results screen — applause plays
6. Kill internet — all sounds still work (bundled resources)

---

## Phase 4: AI Chat Prompt Segmentation

**Goal:** Split the monolithic system prompt into a general base + tier-specific injection, so the AI knows what features each tier can access.

### Current Problem

The system prompt for each tier only describes the AI persona (e.g., "You are Ollie the Wise Owl") but does NOT tell the AI:
- What games/features exist in the app
- What the user's tier can access
- When to recommend specific features

### Step 4.1 — Create general base prompt

**File:** `mobile/app/src/main/java/com/example/data/repository/StuddyHubRepository.kt`

Add a new constant before the `when (userTier)` block:

```kotlin
val generalBasePrompt = """
You are an AI tutor at StuddyHub, a learning app for students in Ghana.

CORE RULES:
- Be encouraging, friendly, and age-appropriate
- Use simple language suitable for the student's level
- Use Ghanaian cultural examples when helpful (Kwaku Ananse, Oware, Kenkey, football)
- Never ask for or accept personal information (phone numbers, full names, home addresses)
- Never generate violent, adult, or inappropriate themes
- If you don't know something, say so honestly rather than making things up

APP FEATURES YOU CAN RECOMMEND (when relevant to the student's question):
- Interactive lessons with step-by-step explanations
- Flashcards for memorization
- AI-generated quizzes to test knowledge
- Live multiplayer quiz battles
- Study notes and document management
- AI chat (that's you!)
- Progress tracking and streaks
- Podcasts for audio learning

When a student asks something that relates to a feature in the app, gently suggest they try it. For example:
- "Want to practice this? Try the quiz feature!"
- "I can make flashcards for this topic — want me to?"
- "There's a live battle happening — you could test your knowledge against others!"
""".trimIndent()
```

### Step 4.2 — Add tier-specific feature injection

Each tier's prompt should now be: `generalBasePrompt + tierPersona + tierFeatures`

```kotlin
val tierFeatures = when (userTier) {
    AcademicTier.EXPLORER -> """
EXPLORER TIER FEATURES (you can access all of these):
- Oware Beads math game — learn addition/subtraction through the traditional Oware game
- Spelling Bee — practice spelling words with voice input
- Math Asteroid Blaster — save the planet by solving math problems fast
- Word Crush — match letters to form words
- Explorer Roadmap — a quest-style learning path with lessons and challenges
- Live 1v1 Battle Arena — compete against other students in real-time quizzes
- Speed Race — fast-paced solo quiz challenge
- Interactive Lessons — Ollie explains topics with stories and examples
- Flashcards — create and study flashcard decks
- AI Quizzes — Ollie generates quiz questions on any topic
- Streak Calendar — track your daily study streak
""".trimIndent()

    AcademicTier.ACHIEVER -> """
ACHIEVER TIER FEATURES (you can access all of these):
- WASSCE Past Question Analysis — break down real exam questions step by step
- WAEC Marking Scheme Coach — learn exactly how examiners award marks
- Formula Mnemonics — memory tricks for math and science formulas
- Practice Quizzes — exam-style questions with detailed explanations
- Flashcards — create and study flashcard decks
- Study Notes — write and organize your revision notes
- Document Analysis — upload past papers for AI-powered analysis
- AI Chat — ask any WASSCE-related question
- Study Schedule — plan your revision timetable
""".trimIndent()

    AcademicTier.SCHOLAR -> """
SCHOLAR TIER FEATURES (you can access all of these):
- Document Analysis — upload research papers, textbooks, or notes for deep analysis
- Research Assistant — help with literature reviews, citations, and academic writing
- Study Guide Generator — transform notes into comprehensive study guides
- Advanced Flashcards — spaced repetition for complex topics
- AI Podcasts — generate audio lessons from your study materials
- Flowchart & Diagram Generator — create visual study aids
- Academic Writing Coach — improve essays, reports, and papers
- AI Chat — ask any academic question with advanced reasoning
""".trimIndent()

    AcademicTier.ALL -> ""
}
```

### Step 4.3 — Combine prompts

```kotlin
val systemPrompt = when (userTier) {
    AcademicTier.EXPLORER -> {
        val persona = if (isThinking) {
            "You are Ollie the Wise Owl 🦉, a friendly, encouraging AI tutor for Basic & JHS primary school students in Ghana. Explain concepts in simple, engaging words using fun everyday examples, Ghanaian cultural stories (Kwaku Ananse, Oware, Kenkey, football), and positive reinforcement. You MUST start your response with your step-by-step reasoning process enclosed in a <thinking>...</thinking> tag, followed by your final kid-friendly answer outside of the tag."
        } else {
            "You are Ollie the Wise Owl 🦉, a friendly, encouraging AI tutor for Basic & JHS primary school students in Ghana. Explain concepts in simple, engaging words using fun everyday examples, Ghanaian cultural stories (Kwaku Ananse, Oware, Kenkey, football), and positive reinforcement. Keep answers clear, bite-sized, and enthusiastic!"
        }
        "$generalBasePrompt\n\n$persona\n\n$tierFeatures"
    }
    // ... same pattern for ACHIEVER, SCHOLAR, ALL
}
```

### Step 4.4 — Test on Explorer tier only

1. Set user tier to EXPLORER
2. Ask: "Can you help me practice math?" → Should suggest Oware game or quiz
3. Ask: "What games can I play?" → Should list Explorer-specific games
4. Ask: "Tell me about fractions" → Should explain AND suggest trying the quiz
5. Verify Achiever/Scholar prompts are unchanged

### Verification

After Phase 4:
- Explorer AI knows about Oware, Spelling Bee, Asteroid Blaster, Word Crush
- AI proactively suggests app features when relevant
- AI responses are still age-appropriate
- Achiever/Scholar tiers still work exactly as before

---

## Phase 5: Live Battle UI Cleanup

**Goal:** Remove redundant TopAppBars and improve UX flow.

### Current Problem

The battle screens have multiple navigation bars stacked:
- `ExplorerMultiplayerBattleScreen` has its own TopAppBar
- Inside it, `LiveQuizSessionRunner` has another TopAppBar with breadcrumbs
- This creates visual clutter

### Step 5.1 — Audit all TopAppBars in battle flow

**Files to check:**
- `ExplorerMultiplayerBattleScreen.kt` — lines 141+
- `QuizzesScreen.kt` — `LiveQuizSessionRunner` (line 1538+), `LiveQuizResultsScreen` (line 2675+)
- `SpeedRaceScreen.kt` — line 64+

### Step 5.2 — Consolidate to single TopAppBar per screen

For each battle screen, keep only ONE TopAppBar. Remove nested ones. Use the single TopAppBar to show:
- Session title
- Player count
- Role badge (HOST/PLAYER)

### Step 5.3 — Add contextual headers

Add prominent state headers (not TopAppBars) inside the content area:
- `"Waiting for players... (X/4)"` — lobby state
- `"Get Ready!"` — pre-question state
- `"Round X of Y"` — during questions
- `"Time's Up!"` — when timer expires

### Verification

After Phase 5:
- No stacked/doubled TopAppBars
- Clear visual hierarchy
- State transitions are obvious to kids

---

## Testing Checklist

### Explorer Tier Only

- [ ] Sign up as new Explorer user → onboarding completes
- [ ] Dashboard loads with streak calendar showing correct highlights
- [ ] AI Chat: ask about math → Ollie responds and suggests Oware game
- [ ] AI Chat: ask "what games can I play?" → lists Explorer games
- [ ] AI Chat: ask about personal topic → Ollie redirects safely
- [ ] Quiz generation: go offline mid-request → kid-friendly error shown
- [ ] Spelling Bee: go offline mid-request → kid-friendly error shown
- [ ] Interactive Lesson: go offline mid-request → kid-friendly error shown
- [ ] Live Battle: join lobby → single clean TopAppBar, background music plays
- [ ] Live Battle: answer correctly → correct tone plays
- [ ] Live Battle: answer wrong → wrong answer sound plays
- [ ] Live Battle: timer < 5s → ticking sound plays
- [ ] Live Battle: results → applause plays
- [ ] Streak: complete activity → return to dashboard → correct dates highlighted
- [ ] Streak: streak number matches highlighted date count
- [ ] All sound effects work with airplane mode ON (offline)

### Regression (Existing Features Still Work)

- [ ] Achiever tier AI chat works as before
- [ ] Scholar tier AI chat works as before
- [ ] Quiz creation and submission works
- [ ] Flashcard creation works
- [ ] Notes and documents work
- [ ] Profile and settings work
- [ ] Social feed works
- [ ] Sync queue processes correctly

---

## Merge Strategy

1. Implement each phase on `explorer-tier-fixes` branch
2. Test each phase independently on Explorer tier
3. Once all phases pass testing:
   ```
   git checkout main
   git merge explorer-tier-fixes
   git push origin main
   ```
4. Create release branch `release/explorer-beta-2` from main
5. Tag and build release APK

---

## File Reference

| File | Purpose | Phases |
|------|---------|--------|
| `BackendApiService.kt` | Error message constants | 1 |
| `QuizzesViewModel.kt` | Quiz/spelling error handling | 1 |
| `LearnItScreen.kt` | Lesson generation errors | 1 |
| `ExplorerGameDetailScreen.kt` | Game error passthrough | 1 |
| `ExplorerHomeContent.kt` | Streak calendar integration | 2 |
| `StuddyHubRepository.kt` | Active days persistence, AI prompts | 2, 4 |
| `DashboardScreen.kt` | Dashboard lifecycle | 2 |
| `LiveQuizSoundManager.kt` | NEW — sound effect manager | 3 |
| `QuizzesScreen.kt` | Live quiz UI + sound integration | 3, 5 |
| `ExplorerMultiplayerBattleScreen.kt` | Battle UI cleanup | 5 |
| `SpeedRaceScreen.kt` | Speed race UI cleanup | 5 |
