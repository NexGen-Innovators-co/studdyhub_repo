# App Performance Optimisation Plan (Low-End Devices)

Goal: smooth scrolling, fast navigation, and no "pulsating/glitchy" feel even on budget
Android hardware (<= 128MB ART heap or <= 4 CPU cores), with the chat screen as the priority.

Everything below is ranked by (impact ÷ risk). Items marked ✅ DONE are implemented; the rest
are proposals — get approval before implementing.

---

## 1. Kill the sync storms ✅ DONE

`syncCloudDataToLocal()` was called from **15 different ViewModels** on init (splash, dashboard,
notes, quizzes, flashcards, documents, profile, schedule, chat, recordings, courses, onboarding,
podcast, …). Each call runs **~15+ sequential REST fetches** (notes, documents, folders,
flashcards, chat sessions + one message fetch per session (N+1), courses, recordings, podcasts,
quizzes, quiz attempts, schedule, education context, game progress, roadmap) and writes
everything to Room. Opening 3 screens quickly = 3 full syncs running in parallel → the app
feels frozen on weak CPUs/networks.

Fix (implemented): coalescing guard on `syncCloudDataToLocal()` — skip while a sync is already
running, and debounce repeats to 15s (realtime already keeps data fresh). `StuddyHubRepository.kt`

Proposals:
- [ ] **N+1 chat messages**: `getChatMessages()` per session inside the full sync; fetch
      messages only for the active/opened session instead.
- [ ] **SyncManager** retriggers the sync queue on every network-reconnect callback; add a
      minimum-interval guard.

## 2. Chat screen — live streaming jank

Implemented:
- ✅ **Auto-scroll no longer fights the user**: previously `animateScrollToItem()` spring-scrolled
  to the bottom on every new message (yanking the viewport — the "pulsating" feel — and
  animating long distances). Now it scrolls **instantly and only when the user is already near
  the bottom**. `AIChatScreen.kt`

Proposals (the remaining chat jank sources):
- [ ] **Markdown re-parse per token**: while a reply streams, `ChatMarkdownRenderer` re-parses
      the *entire growing message* on every SSE flush (~20x/sec), getting more expensive as the
      reply grows. Option: render plain Text while streaming and let the persisted message
      render full rich markdown once the stream completes.
- [ ] **Typing dots**: 3 perpetual alpha animations per bubble (×2 bubble types); could become
      static dots on low-end devices.
- [ ] **List recycling**: add `contentType` to the chat LazyColumn items.
- [ ] Coalesce thinking-step updates the same way content is coalesced (steps arrive as discrete
      JSONObjects; currently every step triggers a `streamingState` copy).
- [ ] Trim very long replies server-side (edge function max output tokens) so the final
      markdown render stays bounded.

## 3. Gate perpetual infinite animations on low-end

The util exists: `util/DevicePerf.kt` ✅ DONE (detects low-end once per process —
memoryClass ≤ 128MB or cores ≤ 4). It is **not wired into any UI yet** — pending approval.

Proposals (wire `DevicePerf.isLowEndDevice` into):
- [ ] `Avatar3DRenderer` — float + glow animations (2 per avatar) + aura brush + 6dp shadow.
- [ ] `AICompanionFAB` — always-on pulse scale animation.
- [ ] Chat typing dots.
- [ ] `StreakCalendarWidget`/mascot bounces, `ProfessorOllieLoader` pulse, Explorer roadmap
      dialog "pulse node".

## 4. Scrolling & navigation feel (global)

- ✅ Sync storms (the #1 cause of screen-open jank) are coalesced.
- The floating pill nav bar is already an overlay (no content jump when it appears).
- NavHost uses default (no) transitions — navigation cost is dominated by screen setup, not
  transitions.

Proposals (medium risk, big feel-win):
- [ ] **Stable list keys everywhere**: audit LazyColumn/LazyRow usages outside chat for missing
      `key = { it.id }` (missing keys cause full-list recomposition + item recycling thrash).
- [ ] **`derivedStateOf` for scroll-dependent UI**: e.g., hide-on-scroll headers, FAB visibility —
      avoid recomposing on every scroll frame.
- [ ] **Avoid `animateContentSize`/`AnimatedVisibility` inside list items** (any present cause
      layout pass per change).
- [ ] **Images in lists**: ensure Coil `SubcomposeAsyncImage` uses fixed sizes + `contentScale`
      (no measure-on-load reflow). Consider `rememberAsyncImagePainter` with a small
      `MemoryCacheKey` for avatars.

## 5. Startup / first frame

- ✅ Startup full sync is now coalesced with the login/VM-init syncs (one run, not five).
- [ ] Move the init-time `syncCloudDataToLocal()` out of individual ViewModels and into a single
      app-level "sync once after login" — realtime covers everything after that.
- [ ] Room: check for accidental main-thread queries. Profile with `adb shell dumpsys gfxinfo`
      on a real budget device.

## 6. How to verify

1. Build & install on a real low-end device (or emulator with 1GB RAM, 2 cores).
2. `adb shell dumpsys gfxinfo <pkg> framestats` while scrolling chat + navigating screens —
   target: no frames > 16ms during scroll, no jank clusters while an AI reply streams.
3. Check `adb logcat` for "Cloud sync already in progress — skipping duplicate" (proves the
   coalescing works).
4. Confirm credits (points) match between ranking and store after the profile-points sync.
