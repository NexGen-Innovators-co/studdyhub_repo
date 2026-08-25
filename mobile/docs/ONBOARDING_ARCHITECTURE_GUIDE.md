# Production Architecture & Scalability Guide: Onboarding & Tour Flow

## 1. Overview & Core Philosophy

The StuddyHub onboarding architecture is designed for **high throughput, offline resilience, and minimal user drop-off**. In production environments serving tens of thousands of simultaneous students (e.g. at the start of a school term), synchronous blocking edge-function calls and multiple full-screen loaders degrade conversion rates and spike cloud costs.

### Guiding Principles
1. **Zero-Latency UI (Cache-First / Offline-First)**: UI renders instantly (0ms) using pre-packaged local curriculum templates (`KidsCurriculum`) and Room database records.
2. **Single Loader Gate**: The full-screen *"Building your workspace"* animation is a **one-time transition event** when entering the dashboard—never repeated across nested sheets or modals.
3. **Asynchronous Cloud Sync & Roadmap Seeding**: Heavy AI operations, cloud profile synchronization, and roadmap bootstrapping are delegated to background coroutines and `SyncManager`, never blocking the user's primary navigation.
4. **Progressive Disclosure**: Only essential setup information is collected during the first 30 seconds; granular preferences are collected contextually during regular study sessions.

---

## 2. Onboarding Flow Architecture

```
                                  [ User Enters Onboarding ]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
         [ Option A: AI Chat ]                               [ Option B: Fast Form ]
     • 3 concise questions                               • Direct fields
     • Stage-aware (Explorer/Achiever/Scholar)           • 0ms typing lag
                    └─────────────────────────┬─────────────────────────┘
                                              │
                                              ▼
                                   [ Personalization Tour ]
                       • Slide 1: Custom AI Study Guides
                       • Slide 2: Dialogue Audio Podcasts
                       • Slide 3: Summary + Optional School Setup Sheet
                                              │
                                              ▼  (Tap "Launch Workspace")
                               [ Single Exit Loader Gate ]
                       • Save profile & tier to Room DB (Instant)
                       • Dispatch background SyncManager queue
                       • Navigate immediately to DashboardScreen
```

---

## 3. Key Design Decisions & Scalability Trade-offs

### A. Resolution of the Double Loader Screen
- **Previous Flaw**: When a kid finished the "My School Setup" modal sheet, `saveKidSetup()` displayed a full-screen "Building your lessons, quizzes and games" loader. Then, tapping "Launch Workspace" on the tour summary triggered an identical full-screen loader a second time.
- **Production Implementation**:
  - `saveKidSetup()` now writes to Room immediately and updates the summary card state to a green **"School & Subjects Configured ✓"** state with 0ms interruption.
  - The full-screen loader appears **strictly once** at the exit point (`completeOnboarding()`), providing a clear psychological transition into the main app.

### B. Network Timeouts vs. Cache-First Data Loading
- **Previous Flaw**: Arbitrary client-side timers (`withTimeoutOrNull(2000L)`) aborted legitimate requests on 2G/3G connections and caused race conditions between local fallback data and late server commits.
- **Production Implementation**:
  - Educational country and curriculum level pickers load from local cache (`KidsCurriculum.FALLBACK_COUNTRIES`) synchronously on initial composition.
  - An asynchronous background task polls the Supabase `education_levels` table and updates `StateFlow` seamlessly when the connection permits.
  - OkHttp connection and read timeouts handle low-level socket health without breaking the Compose state tree.

### C. Backend Load Mitigation (Mass Signups)
- Instead of executing multi-token Gemini API calls sequentially during the signup carousel:
  - Default starter lessons and study sets are populated from pre-verified offline skeletons in `StuddyHubRepository.bootstrapKidRoadmap()`.
  - Live AI lesson expansions are triggered on-demand as the user actively unlocks levels, preventing edge-function concurrency exhaustion during traffic spikes.

---

## 4. Best Practices for Future Feature Extensions

1. **Adding New Onboarding Questions**:
   - Always verify if the question is strictly required before the user sees the dashboard.
   - If it can be asked contextually later (e.g. "Do you prefer dark mode?", "Upload your profile picture"), defer it to in-app spotlight prompts.
2. **Adding Modal Sheets in Onboarding**:
   - Modal sheets should always close with subtle inline toast / checkmark confirmations.
   - **Never** trigger `uiState.isSettingUpWorkspace = true` from within an intermediate sheet.
3. **Database Mutations**:
   - Always persist mutations locally to the Room database first (`dao.insertOrUpdate`), then trigger `SyncManager.triggerSync()` or launch in `repositoryScope`.
