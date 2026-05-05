# Exam Mode & Onboarding Wizard Update

**Date:** February 19, 2026

---

## 1. Exam Mode (Premium Feature — Genius Tier)

### Overview

Exam Mode transforms any quiz with 3+ questions into a timed, full-screen exam experience with anti-cheat features and a 1.5x XP bonus. It was listed in the Genius subscription plan but had no implementation — now fully built.

### Files Created

| File | Purpose |
|------|---------|
| `src/components/quizzes/hooks/useExamMode.ts` | Core hook: timer, fullscreen, tab detection, question shuffling, answer locking, flag system |
| `src/components/quizzes/components/ExamModeSetup.tsx` | Pre-exam configuration dialog |
| `src/components/quizzes/components/ExamModeQuiz.tsx` | Full-screen exam UI with navigator, timer, and results |

### Files Modified

| File | Change |
|------|--------|
| `src/components/quizzes/Quizzes.tsx` | Wired exam state, handlers, feature access check, renders setup + quiz overlays |
| `src/components/quizzes/components/QuizModal.tsx` | Added "Switch to Exam Mode" button in header |
| `src/components/quizzes/components/QuizHistory.tsx` | Added "Exam Mode" button on quiz cards (3+ questions) |
| `src/components/quizzes/hooks/useQuizManagement.ts` | Exposed `setShowResults`, `setUserAnswers`, `setCurrentQuestionIndex`; added `isExamMode` to `recordQuizAttempt` |
| `src/components/quizzes/hooks/useQuizTracking.ts` | Added `isExamMode` param with 1.5x XP multiplier |
| `src/components/subscription/SubscriptionPage.tsx` | Updated Exam Mode description to "Full-screen, timed quizzes with anti-cheat and 1.5x XP" |

### Feature Access

- **Gated to Genius tier** via `useFeatureAccess('hasExamMode')`
- Entry points hidden for free/Scholar users
- Uses existing `SubscriptionGuard` pattern

### How to Access

1. Navigate to the **Quizzes** tab
2. Open any quiz with 3+ questions
3. Click **"Switch to Exam Mode"** (in QuizModal header) or **"Exam Mode"** (on quiz cards in history)
4. Configure exam settings in the setup dialog:
   - Time limit (0–60 minutes, 0 = unlimited)
   - Shuffle questions
   - Lock answers (no going back)
   - Show/hide timer
   - Tab detection (flags if user switches tabs)
5. Click **Start Exam** → full-screen exam begins

### Exam Features

| Feature | Description |
|---------|-------------|
| **Countdown Timer** | Configurable time limit with visual countdown; auto-submits at 0 |
| **Question Navigator** | Side panel grid showing answered/flagged/current question status |
| **Keyboard Shortcuts** | Arrow keys (navigate), 1-4 (select answer), F (flag), Enter (lock) |
| **Flag System** | Mark questions for review; flagged count shown in navigator |
| **Answer Locking** | Optional — once confirmed, answer can't be changed |
| **Tab Detection** | Detects browser tab switches; shows warning count in header |
| **Fullscreen** | Requests fullscreen API on start |
| **1.5x XP Bonus** | Exam completions earn 50% more XP than regular quizzes |
| **Submit Confirmation** | Modal confirmation before final submission |
| **Results Screen** | Score, time taken, XP earned, question-by-question breakdown |

---

## 2. Onboarding Wizard (All Users)

### Overview

Replaced the old single-dialog permission prompt with a full 5-step onboarding wizard. The previous onboarding only asked for notifications/mic/camera permissions and was often skipped because it required specific conditions to trigger.

### Files Created

| File | Purpose |
|------|---------|
| `src/components/onboarding/OnboardingWizard.tsx` | Full multi-step wizard component with all 5 steps |

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replaced old Dialog-based onboarding with wizard; cleaned up unused imports (`Dialog`, `getNotificationPermissionStatus`, `requestNotificationPermission`, `useNotifications`); added `setUserProfile` from context |

### Trigger Conditions

- **Old (v1):** Required `push_notifications` preference ON + browser permission `'default'` — many users never saw it
- **New (v2):** Shows for **any authenticated user** who hasn't completed onboarding (localStorage key: `studdyhub_onboarding_completed_v2`)

### 5-Step Flow

| Step | Title | What It Does |
|------|-------|-------------|
| 1. Welcome | "Welcome to StuddyHub!" | Animated intro with site logo, tagline, feature highlights (Notes, Quizzes, Recordings, AI Chat) |
| 2. Profile | "Set Up Your Profile" | Avatar upload, full name, school/institution — saved to `profiles` table |
| 3. Learning | "How Do You Learn Best?" | Learning style (visual/auditory/kinesthetic/reading), difficulty level, explanation style |
| 4. AI Personalization | "Personalize Your AI" | 12 quick-pick cards + optional freeform text — builds `personal_context` for AI |
| 5. Permissions | "Almost There!" | Toggle switches for notifications, mic, camera with descriptions |

### Design Decisions

- **Always skippable** — "Skip for now" at top of every step, "Skip this step" per individual step
- **v2 localStorage key** so existing users who completed v1 also see the improved wizard
- **Saves to Supabase** on finish — profile, learning preferences, AI context all persisted in one batch
- **Media streams released** — Camera/mic tracks are immediately stopped after permission grant (`stream.getTracks().forEach(t => t.stop())`)
- **Responsive** — Logo container and all grid layouts adapt to mobile/desktop
- **Dark/light mode** — All elements use proper `dark:` Tailwind variants
- **Animated** — Framer Motion slide transitions between steps, spring animation on logo

### AI Context Quick-Pick Cards

| Card | Snippet Added to Context |
|------|-------------------------|
| 🎓 University student | "I'm a university student" |
| 🏫 High school student | "I'm a high school student" |
| 📊 Visual learner | "I learn best with diagrams, charts, and visual aids" |
| 📝 Bullet points please | "I prefer responses in bullet points rather than long paragraphs" |
| 🧑‍💻 Tech / CS focus | "I'm studying technology / computer science" |
| 🔬 Science focus | "I'm studying science subjects" |
| 📖 Arts / humanities | "I'm studying arts and humanities" |
| 💼 Business / economics | "I'm studying business or economics" |
| 🌅 Morning studier | "I study best in the morning" |
| 🌙 Night owl | "I study best at night" |
| ⏱ Short sessions | "I prefer short, focused study sessions (25-30 min)" |
| 📚 Long deep-dives | "I prefer long, deep study sessions" |

---

## Summary of All Changes

### New Files (4)

1. `src/components/quizzes/hooks/useExamMode.ts`
2. `src/components/quizzes/components/ExamModeSetup.tsx`
3. `src/components/quizzes/components/ExamModeQuiz.tsx`
4. `src/components/onboarding/OnboardingWizard.tsx`

### Modified Files (7)

1. `src/components/quizzes/Quizzes.tsx`
2. `src/components/quizzes/components/QuizModal.tsx`
3. `src/components/quizzes/components/QuizHistory.tsx`
4. `src/components/quizzes/hooks/useQuizManagement.ts`
5. `src/components/quizzes/hooks/useQuizTracking.ts`
6. `src/components/subscription/SubscriptionPage.tsx`
7. `src/pages/Index.tsx`

### Build Status

TypeScript compilation: **Clean (0 errors)** — `npx tsc --noEmit` exit code 0
