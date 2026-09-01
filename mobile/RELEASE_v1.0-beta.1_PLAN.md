# StuddyHub v1.0-beta.1 — Full Implementation Plan

> **Branch:** `explorer-tier-fixes`
> **Base:** `main` (commit `728579c`)
> **Date:** 2026-08-28
> **Focus:** Explorer tier fixes + AI model chain standardization + document processing reliability

---

## Table of Contents

1. [Overview](#overview)
2. [Phase A: AI Model Chain Standardization](#phase-a-ai-model-chain-standardization)
3. [Phase B: Document Processing Reliability](#phase-b-document-processing-reliability)
4. [Phase 1: Error Message Sanitization](#phase-1-error-message-sanitization)
5. [Phase 2: Streak Calendar Fix](#phase-2-streak-calendar-fix)
6. [Phase 3: Sound Assets for Offline Use](#phase-3-sound-assets-for-offline-use)
7. [Phase 4: AI Chat Prompt Segmentation](#phase-4-ai-chat-prompt-sementation)
8. [Phase 5: Live Battle UI Cleanup](#phase-5-live-battle-ui-cleanup)
9. [Phase C: Gemini OAuth Client Keep-Alive](#phase-c-gemini-oauth-client-keep-alive)
10. [Testing Checklist](#testing-checklist)
11. [Merge Strategy](#merge-strategy)

---

## Overview

This document covers ALL changes for the v1.0-beta.1 release. Changes are split into two categories:

**Backend (Edge Functions):** Phases A, B, C — standardize AI model chains, fix document processing, keep GCP OAuth alive.

**Mobile (Android):** Phases 1–5 — Explorer tier UX fixes (error messages, streak calendar, sounds, AI prompts, battle UI).

### Guiding Principles

- **Explorer-only scope for mobile:** Do not touch Achiever/Scholar code paths
- **Backend changes are global:** Model chain fixes benefit ALL tiers
- **Test one tier at a time:** Verify Explorer works before touching anything else
- **No regressions:** Existing working features must continue to work
- **Kid-friendly everything:** All user-facing text must be understandable by a 10-year-old

---

## Issue Summary

| # | Issue | Severity | Phase | Scope |
|---|-------|----------|-------|-------|
| 1 | Gemini model chain too short (2 models) in document-processor | HIGH | A4-A5 | Backend |
| 2 | Groq fallback models decommissioned (404 errors) | HIGH | A2 | Backend |
| 3 | Model chains inconsistent across 20+ edge functions | HIGH | A1, A6 | Backend |
| 4 | Raw exception messages shown to kids in quiz/lesson generation | HIGH | 1 | Mobile |
| 5 | Streak calendar dates not highlighting despite streak > 0 | HIGH | 2 | Mobile |
| 6 | No offline sound assets — web uses remote URLs | MEDIUM | 3 | Mobile |
| 7 | AI chat doesn't know app features or tier capabilities | MEDIUM | 4 | Mobile |
| 8 | Live battle screens have redundant TopAppBars | LOW | 5 | Mobile |
| 9 | Gemini OAuth client inactive, will be deleted in 30 days | MEDIUM | C | Backend |

---

## Phase A: AI Model Chain Standardization

**Goal:** Give ALL edge functions the same robust 9-model Gemini chain + multi-provider fallback that gemini-chat already uses.

### Why This Matters

Currently, `gemini-chat` tries 9 Gemini models before falling back to Groq/OpenRouter/xAI/SambaNova. But `document-processor` only tries 2 models. When those 2 models hit quota (429), the fallback goes to Groq — which 404s because the models are decommissioned. The result: document uploads fail.

### Step A1 — Update shared model chain

**File:** `supabase/functions/utils/gemini.ts` (line 9-17)

**Current:**
```ts
const MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
];
```

**New (match gemini-chat's DEFAULT_CHAIN):**
```ts
const MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];
```

### Step A2 — Fix Groq fallback models

**File:** `supabase/functions/_shared/openRouterFallback.ts` (line 120)

**Current:**
```ts
const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
```

**New (working models as of Aug 2026):**
```ts
const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'groq/compound'];
```

### Step A3 — Fix gemini-chat's local Groq copy

**File:** `supabase/functions/gemini-chat/_shared/openRouterFallback.ts`

This file has a different structure (no Groq, only OpenRouter). **No Groq model fix needed** — it goes straight to OpenRouter. Confirm it works as-is.

### Step A4 — Expand document-processor model chain

**File:** `supabase/functions/document-processor/geminiApi.ts` (lines 12-15)

**Current:**
```ts
const DOC_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];
```

**New:**
```ts
const DOC_MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];
```

### Step A5 — Fix PDF fallback chain

**File:** `supabase/functions/document-processor/processors/documents.ts` (lines 72-74)

**Current:**
```ts
const models = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',];
```

**New:**
```ts
const models = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];
```

### Step A6 — Refactor standalone functions to use shared chain

**Strategy:** Replace each function's local `MODEL_CHAIN` with an import from `../utils/gemini.ts`.

**Functions to update (15 total):**

| # | File | Current Chain Size | Change |
|---|---|---|---|
| 1 | `generate-flashcards/index.ts` | 6 models | Import shared |
| 2 | `generate-summary/index.ts` | 6 models | Import shared |
| 3 | `gemini-document-extractor/index.ts` | 5 models | Import shared |
| 4 | `image-analyzer/index.ts` | 5 models | Import shared |
| 5 | `gemini-audio-processor/index.ts` | 5 models | Import shared |
| 6 | `generate-podcast/index.ts` | 2 models | Import shared |
| 7 | `generate-note-from-document/index.ts` | 2 models (repeated) | Import shared |
| 8 | `tts-narrate/index.ts` | 3 models | Import shared |
| 9 | `translate-text/index.ts` | 3 models | Import shared |
| 10 | `transform-note/index.ts` | 3 models | Import shared |
| 11 | `generate-diagram/index.ts` | 3 models | Import shared |
| 12 | `rewrite-text/index.ts` | 3 models | Import shared |
| 13 | `content-moderation/index.ts` | 2 models | Import shared |
| 14 | `create-social-post/index.ts` | 2 models | Import shared |
| 15 | `onboarding-assistant/index.ts` | 1 model (no chain) | Import shared |

**For each function, the pattern is:**

```ts
// OLD:
const MODEL_CHAIN = ['gemini-3.5-flash', 'gemini-3.6-flash'];
for (const model of MODEL_CHAIN) { /* ... */ }

// NEW:
import { callGemini } from '../utils/gemini.ts';
const result = await callGemini(prompt, { temperature: 0.7, maxOutputTokens: 4096 });
```

**Note:** Some functions use `callGemini` for text-only tasks, others use `callGeminiJSON` for structured output. Both are exported from `utils/gemini.ts`.

---

## Phase B: Document Processing Reliability

**Goal:** Ensure document uploads (DOCX, images, PDFs) succeed even when Gemini quota is exhausted.

### Current Flow

```
User uploads file → document-processor Edge Function
  → Gemini API (2 models) → 429 quota exhausted
  → Groq fallback (4 decommissioned models) → all 404
  → OpenRouter free tier → succeeds but strips binary content
  → Image content lost → "no actual image data attached"
```

### After Phase A Fix

```
User uploads file → document-processor Edge Function
  → Gemini API (6 models) → tries 3.7, 3.6, 3.5, 3.5-lite, 3.1-lite, 2.5
  → If all Gemini exhausted → Groq (4 working models) → likely succeeds
  → If Groq exhausted → OpenRouter free tier → last resort
```

### Step B1 — No additional code changes needed

Phase A already fixes the root cause. The document processor's fallback chain becomes:

1. 6 Gemini models (up from 2)
2. 4 working Groq models (up from 0)
3. OpenRouter free tier (unchanged)

### Step B2 — Optional: Gemini fallback for CSV/HTML

**File:** `supabase/functions/document-processor/processors/text.ts`

Add Gemini Vision fallback when `papaparse` or `cheerio` extraction returns empty/garbled results. **Skip for beta** — local libraries work fine for standard formats.

---

## Phase 1: Error Message Sanitization

**Goal:** Replace all raw exception/technical messages with kid-friendly text.

### Step 1.1 — Add error constants to UserMessages

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

Also add them to the `known` set:

```kotlin
val known: Set<String> = setOf(
    GENERIC, SERVER, OFFLINE, NOT_READY, SESSION_EXPIRED, SIGNED_OUT,
    NO_PERMISSION, DUPLICATE, NOT_FOUND, AI_NO_RESPONSE, UPLOAD_FAILED,
    QUIZ_GENERATION_FAILED, SPELLING_FAILED, LESSON_FAILED, QUESTIONS_FAILED, LIVE_QUIZ_FAILED,
    AUTH_INVALID_CREDENTIALS, AUTH_EMAIL_NOT_CONFIRMED, AUTH_ACCOUNT_EXISTS,
    AUTH_WEAK_PASSWORD, AUTH_INVALID_EMAIL, AUTH_RATE_LIMIT, AUTH_INVALID_OTP
)
```

### Step 1.2 — Fix QuizzesViewModel.generateLiveQuestions()

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/QuizzesViewModel.kt`

| Line | Current | New |
|------|---------|-----|
| 716 | `"Backend 'generate-ai-quiz' returned no valid questions..."` | `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED` |
| 720-721 | `"Edge function 'generate-ai-quiz' returned HTTP $code..."` | `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED` |
| 723 | `"Edge function 'generate-ai-quiz' failed..."` | `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED` |
| 728 | `"Backend live-question generation failed: ${e.message}"` | `BackendApiService.UserMessages.QUIZ_GENERATION_FAILED` |

### Step 1.3 — Fix QuizzesViewModel.generateSpellingWords()

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/QuizzesViewModel.kt`

| Line | Current | New |
|------|---------|-----|
| 775-776 | `"Edge function 'generate-spelling-words' returned HTTP $code..."` | `BackendApiService.UserMessages.SPELLING_FAILED` |
| 778 | `"Edge function 'generate-spelling-words' failed..."` | `BackendApiService.UserMessages.SPELLING_FAILED` |
| 784 | `"AI word generation failed: ${e.message}"` | `BackendApiService.UserMessages.SPELLING_FAILED` |

### Step 1.4 — Fix LearnItScreen error messages

**File:** `mobile/app/src/main/java/com/example/ui/screens/quizzes/LearnItScreen.kt`

| Line | Current | New |
|------|---------|-----|
| 276 | `"Lesson generation failed: ${backendRes.message}"` | `BackendApiService.UserMessages.LESSON_FAILED` |
| 281 | `"Failed to generate lesson: ${e.localizedMessage ?: e.message}"` | `BackendApiService.UserMessages.LESSON_FAILED` |

### Verification

After Phase 1, trigger a quiz generation failure (e.g., go offline mid-request) and confirm:
- No Java class names appear on screen
- No HTTP status codes appear on screen
- No "Edge function" or "generate-ai-quiz" text appears
- All messages say something a kid would understand

---

## Phase 2: Streak Calendar Fix

**Goal:** Make calendar dates highlight correctly when streak > 0.

### Step 2.1 — Refresh activeDays on dashboard resume

**File:** `mobile/app/src/main/java/com/example/ui/screens/dashboard/ExplorerHomeContent.kt`

**Current code (lines 82-85):**
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

### Step 2.2 — Use commit() instead of apply() for active days persistence

**File:** `mobile/app/src/main/java/com/example/data/repository/StuddyHubRepository.kt`

**Current code (line 2675):**
```kotlin
prefs.edit().putStringSet("active_days", activeDays).apply()
```

**Change to:**
```kotlin
prefs.edit().putStringSet("active_days", activeDays).commit()
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

**Option C:** I download them from the original Supabase Storage URLs directly (if still accessible).

### Step 3.2 — Create LiveQuizSoundManager.kt

**New file:** `mobile/app/src/main/java/com/example/ui/components/LiveQuizSoundManager.kt`

```kotlin
package com.example.ui.components

import android.content.Context
import android.media.MediaPlayer
import com.example.R

class LiveQuizSoundManager(private val context: Context) {

    private var bgmPlayer: MediaPlayer? = null

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

    fun playCorrectAnswer() = playOneShot(R.raw.correct_answer)
    fun playWrongAnswer() = playOneShot(R.raw.wrong_answer)
    fun playClockTick() = playOneShot(R.raw.clock_ticking)
    fun playApplause() = playOneShot(R.raw.applause)

    private fun playOneShot(resId: Int) {
        try {
            MediaPlayer.create(context, resId)?.apply {
                setOnCompletionListener { it.release() }
                start()
            }
        } catch (_: Exception) {
            com.example.ui.components.TactileSoundSystem.playPopSound()
        }
    }

    fun release() {
        stopBackgroundMusic()
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

When a student asks something that relates to a feature in the app, gently suggest they try it.
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
            "You are Ollie the Wise Owl, a friendly, encouraging AI tutor for Basic & JHS primary school students in Ghana. Explain concepts in simple, engaging words using fun everyday examples, Ghanaian cultural stories (Kwaku Ananse, Oware, Kenkey, football), and positive reinforcement. You MUST start your response with your step-by-step reasoning process enclosed in a <thinking>...</thinking> tag, followed by your final kid-friendly answer outside of the tag."
        } else {
            "You are Ollie the Wise Owl, a friendly, encouraging AI tutor for Basic & JHS primary school students in Ghana. Explain concepts in simple, engaging words using fun everyday examples, Ghanaian cultural stories (Kwaku Ananse, Oware, Kenkey, football), and positive reinforcement. Keep answers clear, bite-sized, and enthusiastic!"
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

## Phase C: Gemini OAuth Client Keep-Alive

**Goal:** Prevent the `gen-lang-client-0612038711` GCP project OAuth client from being deleted.

### Background

The OAuth client is used by:
- `generate-podcast/index.ts` — Vertex AI Cloud TTS
- `generate-image-from-text/index.ts` — Vertex AI Imagen

### Step C1 — Create keepalive function

**New file:** `supabase/functions/gcp-keepalive/index.ts`

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req) => {
  try {
    const gcpServiceAccountJson = Deno.env.get('GCP_SERVICE_ACCOUNT_JSON');
    if (!gcpServiceAccountJson) {
      return new Response(JSON.stringify({ status: 'skip', reason: 'No GCP_SERVICE_ACCOUNT_JSON' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sa = JSON.parse(gcpServiceAccountJson);
    const projectId = sa.project_id || 'gen-lang-client-0612038711';

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const enc = (o: any) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signingInput = `${enc(header)}.${enc(payload)}`;

    // Import private key for signing
    const pem = sa.private_key;
    const der = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    const keyData = Uint8Array.from(atob(der), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'pkcs8', keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );

    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'}`;

    // Exchange JWT for access token (activates the OAuth client)
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();

    return new Response(JSON.stringify({
      status: tokenRes.ok ? 'ok' : 'error',
      projectId,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Step C2 — Schedule monthly cron

```sql
SELECT cron.schedule(
  'gcp-oauth-keepalive',
  '0 0 1 * *',  -- First day of each month
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gcp-keepalive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  )$$
);
```

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
- [ ] Document upload: upload DOCX → text extracted successfully
- [ ] Document upload: upload image → OCR text extracted

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
| `supabase/functions/utils/gemini.ts` | Shared Gemini model chain | A1 |
| `supabase/functions/_shared/openRouterFallback.ts` | Groq fallback models | A2 |
| `supabase/functions/gemini-chat/_shared/openRouterFallback.ts` | gemini-chat local copy | A3 |
| `supabase/functions/document-processor/geminiApi.ts` | Document processor Gemini chain | A4 |
| `supabase/functions/document-processor/processors/documents.ts` | PDF fallback chain | A5 |
| 15 standalone edge functions | Model chain standardization | A6 |
| `supabase/functions/gcp-keepalive/index.ts` | NEW — OAuth keepalive | C |
| `BackendApiService.kt` | Error message constants | 1 |
| `QuizzesViewModel.kt` | Quiz/spelling error handling | 1 |
| `LearnItScreen.kt` | Lesson generation errors | 1 |
| `ExplorerHomeContent.kt` | Streak calendar integration | 2 |
| `StuddyHubRepository.kt` | Active days persistence, AI prompts | 2, 4 |
| `LiveQuizSoundManager.kt` | NEW — sound effect manager | 3 |
| `QuizzesScreen.kt` | Live quiz UI + sound integration | 3, 5 |
| `ExplorerMultiplayerBattleScreen.kt` | Battle UI cleanup | 5 |
