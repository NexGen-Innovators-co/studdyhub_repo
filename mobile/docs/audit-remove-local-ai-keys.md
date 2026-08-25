# Audit: Remove Direct Local Gemini / AI API Calls

**Status:** Open for implementation
**Goal:** Remove every direct local Gemini / third-party AI API call from the Android app so the
`GEMINI_API_KEY` (and any other local AI credentials) can be deleted from the local environment.
All AI traffic must flow through the Supabase edge functions, which hold the keys server-side.

---

## ⚠️ Critical finding (read first)

`GeminiApiService.generateText()` has a 5-link fallback chain. When the local `GEMINI_API_KEY` is
removed:

- **Link 1 — direct Gemini REST** — dies (needs the key). ✅ This is the intended removal.
- **Link 2 — `gemini-chat` edge function** — only runs when `systemInstruction` is **blank**.
  Many call sites pass a custom system instruction, so they skip the backend entirely.
- **Links 3–5 — Pollinations / OVHcloud public endpoints** — **need no key**, so they would
  silently take over. These are public third-party free AI services: not our Supabase backend,
  not private, and unreliable.

**Consequence:** simply deleting the key today does NOT route traffic to our backend — it redirects
most calls to public AI services. The rewrite must remove Links 1, 3, 4, 5 and make the edge
function the only text path.

---

## 1. The core file — `app/src/main/java/com/example/data/remote/GeminiApiService.kt`

| Function | Uses local key? | Notes / backend equivalent |
|---|---|---|
| `generateText()` Link 1 — direct Gemini REST | ✅ Yes | **Remove.** Replace with `gemini-chat` edge function (always, even when `systemInstruction` is set — edge function supports `systemPromptOverride`). |
| `generateText()` Links 3–5 — Pollinations + OVHcloud | ❌ Keyless public endpoints | **Remove entirely.** No backend equivalent; these are the privacy/unreliability risk. |
| `analyzeFile()` / `analyzeImage()` — direct Gemini vision REST | ✅ Yes | **Remove direct call.** Route to `gemini-document-extractor` / `document-extractor` edge function (images → `image-analyzer`). |

---

## 2. Every call site across the app

All direct calls funnel through `GeminiApiService`. The table lists every file that touches it
directly, what it does, and whether a backend edge function exists to replace it.

| # | File | Call sites | Purpose | Backend exists? |
|---|---|---|---|---|
| 1 | `data/repository/StuddyHubRepository.kt` | 12 | Note summary, note translation, AI copilot, diagram generation, quiz-gen fallback, flashcards, note-from-document, doc re-extraction, podcast script | ✅ Most: `generate-summary`, `generate-flashcards`, `generate-quiz` / `generate-ai-quiz`, `generate-note-from-document`, `gemini-document-extractor`, `generate-podcast`, `fix-diagram`<br>⚠️ Translation & AI copilot have **no dedicated backend** → use generic `gemini-chat` |
| 2 | `data/remote/BackendApiService.kt` | 3 | `generateSummary()`, `generateFlashcards()`, `generatePodcast()` — **FAKE backends**: named "Backend…" but call `GeminiApiService` locally | ✅ Real edge functions exist (`generate-summary`, `generate-flashcards`, `generate-podcast`) but are **never wired** — point these wrappers at them |
| 3 | `ui/screens/quizzes/QuizzesViewModel.kt` | 2 | Live game-question fallback, spelling-bee word generation | ✅ `generate-ai-quiz` (already first choice)<br>⚠️ Spelling words: no dedicated backend → `gemini-chat` |
| 4 | `ui/screens/onboarding/OnboardingViewModel.kt` | 1 | Ollie onboarding chat (JSON responses) | ✅ `gemini-chat` |
| 5 | `ui/screens/social/SocialViewModel.kt` | 1 | AI post rewrite | ⚠️ No dedicated backend → `gemini-chat` |
| 6 | `ui/screens/aichat/AIChatViewModel.kt` | 1 | Attachment text extraction (vision) | ✅ `gemini-document-extractor` |
| 7 | `ui/screens/documents/DocumentsViewModel.kt` | 5 | Document extraction, OCR scan content, upload processing, "AI flow" document, retry extraction | ✅ `gemini-document-extractor`, `document-processor` |
| 8 | `ui/screens/documents/DocumentDetailScreen.kt` | 1 | Retry AI extraction | ✅ `document-processor` |
| 9 | `ui/screens/notes/NoteDetailScreen.kt` | 3 | Image → notes, doc → notes, re-extraction | ✅ `generate-note-from-document` (already first choice), `image-analyzer` / `gemini-document-extractor` |

> `util/DocumentExporter.kt` matched the text search but is **not** an AI call — it only writes text
> files locally. No change needed.

---

## 3. Backend edge-function inventory (available replacements)

Confirmed to exist under `supabase/functions/`:

| Edge function | Replaces |
|---|---|
| `gemini-chat` | All generic text generation (translation, AI copilot, social rewrite, spelling words, onboarding chat, quiz fallback) |
| `generate-summary` | Note / document summaries |
| `generate-ai-quiz` / `generate-quiz` | Quiz generation |
| `generate-flashcards` | Flashcard generation |
| `generate-note-from-document` | Document → study note |
| `generate-podcast` | Podcast script generation |
| `gemini-document-extractor` / `document-extractor` | PDF / image / file text extraction (vision) |
| `image-analyzer` | Image analysis |
| `document-processor` | Document upload processing |
| `fix-diagram` | Diagram generation / repair |
| `gemini-audio-processor` | Recording transcript summaries |

---

## 4. Migration plan (3 layers)

### Layer 1 — Rewrite `GeminiApiService.kt` (the single choke point)
- Delete Link 1 (direct Gemini REST via `BuildConfig.GEMINI_API_KEY`).
- Delete Links 3–5 (Pollinations POST/GET + OVHcloud).
- Make the `gemini-chat` edge function the **only** text path, invoked for **every** call —
  including calls that pass a custom `systemInstruction` (pass it through as
  `systemPromptOverride` to the edge function).
- `analyzeFile()` / `analyzeImage()` → call the document-extractor edge function instead of the
  direct Gemini vision REST call.

### Layer 2 — Fix the fake backends in `BackendApiService.kt`
- `generateSummary()` → call the `generate-summary` edge function.
- `generateFlashcards()` → call the `generate-flashcards` edge function.
- `generatePodcast()` → call the `generate-podcast` edge function.

### Layer 3 — Update the remaining direct callers
Only the vision / doc-extraction call sites need explicit changes (swap `analyzeFile` /
`analyzeImage` for the backend wrapper):
- `DocumentsViewModel.kt` (extraction + upload paths)
- `DocumentDetailScreen.kt` (retry extraction)
- `NoteDetailScreen.kt` (image → notes, doc re-extraction)
- `AIChatViewModel.kt` (attachment extraction)
- `StuddyHubRepository.kt` (doc re-extraction helper)

Everything else that only calls `generateText()` for pure text (onboarding, social, quizzes,
copilot, translation) inherits the fix automatically from Layer 1 and needs **no change**.

---

## 5. Files to be edited (summary)

| File | Change |
|---|---|
| `app/src/main/java/com/example/data/remote/GeminiApiService.kt` | **Rewrite** — remove direct REST + public endpoints; edge-function only |
| `app/src/main/java/com/example/data/remote/BackendApiService.kt` | **Fix 3 fake backends** → real edge functions |
| `app/src/main/java/com/example/data/repository/StuddyHubRepository.kt` | Swap doc re-extraction to backend |
| `app/src/main/java/com/example/ui/screens/documents/DocumentsViewModel.kt` | Swap extraction/upload to backend |
| `app/src/main/java/com/example/ui/screens/documents/DocumentDetailScreen.kt` | Swap retry-extraction to backend |
| `app/src/main/java/com/example/ui/screens/notes/NoteDetailScreen.kt` | Swap image/doc → notes to backend |
| `app/src/main/java/com/example/ui/screens/aichat/AIChatViewModel.kt` | Swap attachment extraction to backend |

**Not edited (inherit the fix):** `OnboardingViewModel.kt`, `SocialViewModel.kt`,
`QuizzesViewModel.kt`, `DocumentExporter.kt`.

---

## 6. Acceptance criteria

1. `BuildConfig.GEMINI_API_KEY` is removed from the local environment / `.env.example`; the app
   builds and runs.
2. No HTTP request in the app targets `generativelanguage.googleapis.com`, `text.pollinations.ai`,
   or `oai.endpoints.kepler.ai.cloud.ovh.net` anymore (verified by logcat / network inspection).
3. All AI features still work with the Supabase edge functions as the sole provider:
   - Chat / onboarding conversation
   - Note summaries, translation, AI copilot, diagrams
   - Quiz + flashcard generation
   - Document upload, extraction, note-from-document
   - Recording summaries
4. Edge-function auth still resolves the user (JWT present) so server-side personalization
   (education context, country, subjects) continues to work.
