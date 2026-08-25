# StuddyHub Production Launch Build Spec

**Version:** 1.0 — First Launch & Beta Testing  
**Date:** August 19, 2026  
**Target:** Google Play Store (Open Beta → Production)

---

## Executive Summary

StuddyHub is a Ghanaian educational app with three tiers: **Explorer** (primary/JHS kids), **Achiever** (SHS/WASSCE), and **Scholar** (university). The codebase is ~4500 lines in the main repository module alone, with 105+ Supabase tables, 20+ edge functions, and a Compose-based Android client. This spec identifies every gap between the current state and a production-ready release, organized by priority.

---

## PHASE 0 — CRITICAL BLOCKERS (Must fix before any build ships)

### 0.1 Compilation Must Pass

**Status:** ✅ PASSING

`./gradlew installDebug` builds and installs successfully on device. Zero compilation errors — only deprecation warnings (Icons.Filled.\* → AutoMirrored, `capitalize()` → `replaceFirstChar`, etc.)

**Action items:**

- [ ] Fix all unresolved references in `StuddyHubRepository.kt` (lines 1260-2570 — missing `BackendApiService` imports, type mismatches)
- [ ] Fix `NoteDetailScreen.kt` type mismatches (lines 1292, 1337)
- [ ] Fix `OnboardingViewModel.kt` type mismatch (line 251)
- [ ] Fix `SocialViewModel.kt` type mismatch (line 751)
- [ ] Fix `QuizzesViewModel.kt` missing return (line 706)
- [ ] Run `./gradlew compileDebugKotlin` until clean
- [ ] Run `./gradlew assembleDebug` until APK builds

**Verification:** `./gradlew assembleDebug` produces a runnable APK with zero errors.

---

### 0.2 ProGuard / R8 Must Be Enabled

**Status:** ❌ DISABLED

`app/build.gradle.kts:45` — `isMinifyEnabled = false`

For production, R8 must be enabled to:

- Shrink unused code (reduce APK size)
- Obfuscate class names (basic reverse-engineering protection)
- Optimize bytecode

**Action items:**

- [ ] Set `isMinifyEnabled = true` in release buildType
- [ ] Create `proguard-rules.pro` with keep rules for:
  - Room entities and DAOs
  - Moshi/JSON adapters
  - Retrofit API interfaces
  - Supabase client classes
  - Compose classes
  - Kotlin serialization (if used)
- [ ] Set `isShrinkResources = true` in release buildType
- [ ] Test release build on a real device

---

### 0.3 Signing & Upload Key

**Status:** ⚠️ CONFIGURED BUT UNVERIFIED

The build file reads from env vars (`KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_PASSWORD`). The release signing config references `${rootDir}/my-upload-key.jks` as fallback.

**Action items:**

- [ ] Generate a production keystore (not the debug keystore)
- [ ] Store keystore securely (CI/CD secret, NOT in git)
- [ ] Verify `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_PASSWORD` are set in CI
- [ ] Test signed release APK on device
- [ ] Register upload key with Google Play Console

---

### 0.4 `fallbackToDestructiveMigration()` Must Be Removed

**Status:** ⚠️ DANGEROUS

`StuddyHubDatabase.kt:320` — `fallbackToDestructiveMigration()` means if any migration is missing or fails, **all user data is wiped**. This is catastrophic for production users.

**Action items:**

- [ ] Remove `fallbackToDestructiveMigration()` after all migrations are verified
- [ ] Ensure migration chain is complete (currently v7→v22 with gaps filled)
- [ ] Test: install old version → create data → upgrade → verify data survives
- [ ] Add a Room schema export for version validation

---

## PHASE 1 — SECURITY (Must complete before beta)

### 1.1 API Keys & Secrets

**Status:** ✅ MOSTLY GOOD

Keys are loaded via `BuildConfig.VITE_SUPABASE_URL` / `BuildConfig.VITE_SUPABASE_ANON_KEY` from `.env` file via the Secrets Gradle Plugin. No hardcoded keys found in source.

**Remaining items:**

- [ ] Verify `.env` is in `.gitignore` (check `app/.gitignore`)
- [ ] Verify `.env.example` exists with placeholder values
- [ ] Rotate any keys that were ever committed to git history
- [ ] Ensure Supabase anon key has minimal permissions (it does — RLS enforces ownership)
- [ ] Ensure Gemini API key is not exposed in edge function logs

### 1.2 Row-Level Security (RLS)

**Status:** ✅ COMPREHENSIVE

RLS is enabled on most tables with owner-based policies. The `supabase/db/rlp.sql` file contains 151+ policy definitions. The `20260210_comprehensive_rls_hardening.sql` migration tightened permissive policies.

**Remaining items:**

- [ ] Audit live_quiz tables — migration `20260802_live_quiz_realtime_fairness.sql` notes RLS is intentionally DISABLED for realtime to work. Document this tradeoff.
- [ ] Verify `social_users` table — has `FOR ALL USING (true) WITH CHECK (true)` which is wide open (line 62 of `20260325_add_unique_constraints_and_social_schema.sql`)
- [ ] Run Supabase Database Linter to catch any remaining permissive policies

### 1.3 Network Security

**Status:** ⚠️ NO NETWORK SECURITY CONFIG

No `network_security_config.xml` found. No `<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />` for offline detection. The app uses HTTPS for all Supabase calls (enforced by the client SDK), but there's no certificate pinning.

**Action items:**

- [ ] Add `network_security_config.xml` with:
  - Cleartext traffic disabled (default, but make explicit)
  - Certificate pinning for `*.supabase.co` (optional but recommended)
  - Debug overrides for local development
- [ ] Reference in `AndroidManifest.xml`
- [ ] Add `ACCESS_NETWORK_STATE` permission for offline detection

### 1.4 Child Safety & COPPA

**Status:** ⚠️ PARTIAL

**What exists:**

- `ChildSafetyGuard.kt` — client-side PII/keyword filter for Explorer tier AI chat (line 21-59)
- `ParentalGateModal.kt` — math-problem parental gate for tier switching and sign-out (line 31-196)
- Display name sanitization for multiplayer (line 1168 of QuizzesViewModel)
- AI chat blocks on PII/keywords for Explorer tier (line 467-474 of AIChatViewModel)

**What's missing:**

- [ ] **No age verification during signup** — the onboarding collects school/grade but doesn't enforce age
- [ ] **No COPPA-compliant consent flow** — Google Play Families Policy requires verifiable parental consent for users under 13
- [ ] **Social feed is accessible to Explorer tier** — kids can see and create posts (content moderation is only keyword-based)
- [ ] **No data deletion mechanism** — COPPA requires parents to request data deletion
- [ ] **ChildSafetyGuard is client-side only** — a determined kid can bypass it
- [ ] **AI system prompts for Explorer tier don't include explicit COPPA restrictions** (need to verify in edge function)

**Action items:**

- [ ] Add age gate during signup (birth date field, under-13 detection)
- [ ] Implement COPPA parental consent flow (email consent or Google Play Families Policy compliance)
- [ ] Add "Request Data Deletion" option in settings
- [ ] Restrict Explorer tier from social feed creation (read-only or no access)
- [ ] Add server-side content moderation for Explorer tier (not just client-side)
- [ ] Review AI system prompts for Explorer tier — ensure no PII collection, no off-topic responses

### 1.5 Authentication

**Status:** ✅ FUNCTIONAL

Email/password auth via Supabase (`supabaseSignIn`, `supabaseSignUp`). Token refresh via `refreshToken`/`tokenExpiresAt` on profile entity. Session persistence in Room.

**Remaining items:**

- [ ] Verify email confirmation is enabled in Supabase Auth settings
- [ ] Test token refresh flow — does the app silently renew after 1 hour?
- [ ] Add rate limiting on auth endpoints (Supabase has this by default)
- [ ] Test: sign up → close app → reopen → verify session persists

---

## PHASE 2 — BUILD & RELEASE CONFIGURATION

### 2.1 Version Management

**Status:** ⚠️ HARDCODED

`build.gradle.kts:18` — `versionCode = 1`, `versionName = "1.0"`

**Action items:**

- [ ] Set `versionCode = 1` for first release (Google Play requires monotonically increasing)
- [ ] Set `versionName = "1.0.0-beta.1"` for beta
- [ ] Automate version bumping (CI script or version.properties)

### 2.2 App Icon & Store Listing

**Status:** ⚠️ NEEDS VERIFICATION

The manifest references `@mipmap/ic_launcher` and `@mipmap/ic_launcher_round`. These exist but need verification for production quality.

**Action items:**

- [ ] Verify adaptive icon exists in all density buckets (mdpi through xxxhdpi)
- [ ] Create store listing assets:
  - Feature graphic (1024×500)
  - Screenshots (phone + tablet, min 2, max 8)
  - Short description (80 chars)
  - Full description (4000 chars)
  - Privacy policy URL
  - Data safety form
- [ ] Create content rating questionnaire (IARC)
- [ ] Set up closed beta track first, then promote to open beta

### 2.3 Permissions

**Status:** ✅ MINIMAL

Only two permissions declared:

- `android.permission.INTERNET` — required
- `android.permission.RECORD_AUDIO` — required for voice input / podcast

**Action items:**

- [ ] Add runtime permission request for `RECORD_AUDIO` (already handled in code via `rememberLauncherForActivityResult`)
- [ ] Add `ACCESS_NETWORK_STATE` for offline detection
- [ ] Review if any other permissions are needed (camera for document scanning? — currently commented out)

### 2.4 `allowBackup` Configuration

**Status:** ⚠️ ENABLED WITH RULES

`AndroidManifest.xml:8` — `android:allowBackup="true"` with `android:dataExtractionRules="@xml/data_extraction_rules"`

**Action items:**

- [ ] Verify `data_extraction_rules.xml` exists and is correct
- [ ] Consider setting `allowBackup="false"` for production (prevents data extraction via adb)
- [ ] Or ensure cloud sync is the primary backup mechanism

---

## PHASE 3 — CRASH REPORTING & OBSERVABILITY

### 3.1 Crash Reporting

**Status:** ❌ NOT IMPLEMENTED

No Crashlytics, Timber, or any crash reporting found. Zero `@Test` files found — no unit tests exist.

**Action items:**

- [ ] Add Firebase Crashlytics (dependency already in BOM)
- [ ] Add global uncaught exception handler
- [ ] Add `Timber` for structured logging (replace `android.util.Log` calls)
- [ ] Add crash reporting for edge functions (Supabase logs already exist)

### 3.2 Analytics

**Status:** ❌ NOT IMPLEMENTED

No Firebase Analytics or any analytics SDK found.

**Action items:**

- [ ] Add Firebase Analytics (dependency already in BOM)
- [ ] Track key events: signup, login, quiz completion, game level completion, AI chat usage
- [ ] Track funnel: signup → onboarding → first quiz → daily return
- [ ] Add screen tracking (automatic with Compose navigation)

### 3.3 Error Handling

**Status:** ⚠️ INCONSISTENT

Many `catch (e: Exception)` blocks exist but handling is inconsistent:

- Some show user messages, some silently swallow errors
- No centralized error reporting
- Edge function errors are logged to Supabase but not surfaced to crash reporting

**Action items:**

- [ ] Create a centralized `ErrorHandler` that logs to Crashlytics
- [ ] Ensure all user-facing errors have actionable messages
- [ ] Add retry mechanisms for network failures
- [ ] Add offline queue for critical operations (quiz attempts, chat messages)

---

## PHASE 4 — COMPLIANCE & LEGAL

### 4.1 Privacy Policy

**Status:** ❌ NOT FOUND

No privacy policy URL or document found in the codebase.

**Action items:**

- [ ] Create privacy policy covering:
  - Data collected (email, name, school, usage data, AI chat content)
  - How data is used (personalization, AI processing)
  - Data storage (Supabase cloud, local Room DB)
  - Third-party services (Supabase, Google AI/Gemini)
  - COPPA compliance (for Explorer tier)
  - Data deletion rights
  - Contact information
- [ ] Host on a public URL (GitHub Pages, Firebase Hosting, or your domain)
- [ ] Link in Google Play Store listing
- [ ] Link in app settings

### 4.2 Terms of Service

**Status:** ❌ NOT FOUND

**Action items:**

- [ ] Create ToS covering acceptable use, account responsibilities, AI content disclaimer
- [ ] Include age requirements and parental consent language
- [ ] Host and link in app

### 4.3 Data Safety Form (Google Play)

**Action items:**

- [ ] Complete Google Play Data Safety form:
  - Data collected: Email, name, school, usage data, AI chat content, voice recordings
  - Data shared: None (or disclose Gemini API calls)
  - Data encrypted in transit: Yes
  - Data deletion: Add mechanism
  - COPPA compliance: Yes (if Explorer tier ships)

### 4.4 Content Rating

**Action items:**

- [ ] Complete IARC content rating questionnaire
- [ ] Likely rating: "Everyone" or "Everyone 10+" (due to AI chat)
- [ ] If Explorer tier ships, may need "Designed for Families" badge

---

## PHASE 5 — TESTING & QUALITY

### 5.1 Unit Tests

**Status:** ❌ ZERO TESTS

No `@Test` functions found anywhere in the codebase.

**Priority test targets:**

- [ ] `ChildSafetyGuard.evaluateChildMessageSafety()` — verify PII detection, keyword blocking
- [ ] `starsForPercent()` / `xpForLevel()` — verify star/XP calculations
- [ ] `normalizeGameKey()` — verify legacy key mapping
- [ ] `parseQuizQuestionsJson()` — verify JSON parsing
- [ ] `BackendApiService` — mock network calls, verify error handling
- [ ] `StuddyHubRepository` — verify data flow (Room → cloud sync)

### 5.2 Integration Tests

**Action items:**

- [ ] Auth flow: signup → email confirm → login → profile creation
- [ ] Quiz flow: create quiz → attempt → save results → view in history
- [ ] Live quiz: create session → join → answer → results
- [ ] Document upload: pick file → process → view content
- [ ] AI chat: send message → receive response → TTS playback
- [ ] Sync: create offline → go online → verify sync

### 5.3 Manual QA Checklist

- [ ] Fresh install → onboarding → tier selection → first quiz
- [ ] Explorer tier: all 4 games playable end-to-end
- [ ] Explorer tier: parental gate blocks tier switching
- [ ] Explorer tier: AI chat blocks PII and inappropriate content
- [ ] Achiever/Scholar tier: quiz creation and attempt
- [ ] Live quiz: host creates → player joins → game plays → results saved
- [ ] Social feed: create post → like → comment → bookmark
- [ ] Profile: edit name, school, tier
- [ ] Settings: sign out (parental gate), clear data
- [ ] Offline: airplane mode → use app → reconnect → verify sync
- [ ] Back button: navigate back from every screen without crash
- [ ] Rotation: rotate device on every screen without crash
- [ ] Low memory: background app → return without crash

### 5.4 Performance

**Action items:**

- [ ] Profile with Android Studio Profiler
- [ ] Check for memory leaks (Compose recomposition, coroutine leaks)
- [ ] Verify lazy lists are efficient (no unnecessary recomposition)
- [ ] Check APK size (target: <30MB)
- [ ] Check startup time (target: <3 seconds cold start)

---

## PHASE 6 — CI/CD & DEPLOYMENT

### 6.1 Build Pipeline

**Action items:**

- [ ] Set up CI (GitHub Actions or Codemagic — already configured)
- [ ] Pipeline stages:
  1. Lint check
  2. Unit tests
  3. Build debug APK
  4. Build signed release APK
  5. Upload to Google Play (beta track)
- [ ] Store signing credentials in CI secrets
- [ ] Store `.env` file in CI secrets

### 6.2 Supabase Deployment

**Status:** ✅ FUNCTIONAL (edge functions deployed manually)

**Action items:**

- [ ] Automate edge function deployment in CI
- [ ] Run pending migrations:
  - `20260819_expand_quiz_source_type_check.sql` (quiz source_type constraint)
  - Any other pending migrations
- [ ] Verify all edge functions are deployed and working
- [ ] Set up Supabase branch environments for staging

### 6.3 Google Play Setup

**Action items:**

- [ ] Create Google Play Developer account ($25 one-time)
- [ ] Create app listing
- [ ] Upload signed AAB (not APK) to internal testing track
- [ ] Promote to closed beta → open beta → production
- [ ] Set up crash reporting dashboards

---

## PHASE 7 — POST-LAUNCH

### 7.1 Monitoring

- [ ] Set up Firebase Crashlytics dashboard
- [ ] Set up Firebase Analytics dashboard
- [ ] Monitor Supabase dashboard for API errors
- [ ] Set up alerts for edge function failures
- [ ] Monitor Gemini API quota usage

### 7.2 User Feedback

- [ ] Add in-app feedback mechanism (or link to Google Play feedback)
- [ ] Set up support email
- [ ] Create FAQ / help center

### 7.3 Iteration

- [ ] Plan v1.1 based on beta feedback
- [ ] Fix top crashers from Crashlytics
- [ ] Address top user complaints
- [ ] Add requested features

---

## COMPLIANCE MATRIX

| Requirement                      | Status     | Priority | Notes                         |
| -------------------------------- | ---------- | -------- | ----------------------------- |
| RLS on all tables                | ✅         | Critical | Comprehensive policies exist  |
| API keys not in source           | ✅         | Critical | Via BuildConfig               |
| Child safety (COPPA)             | ⚠️ Partial | Critical | Client-side only, no age gate |
| Privacy policy                   | ❌         | Critical | Must create before launch     |
| Terms of service                 | ❌         | Critical | Must create before launch     |
| Data safety form                 | ❌         | Required | Google Play requirement       |
| Crash reporting                  | ❌         | Required | Firebase Crashlytics          |
| Analytics                        | ❌         | Required | Firebase Analytics            |
| Unit tests                       | ❌         | Required | Zero tests currently          |
| ProGuard/R8                      | ❌         | Required | APK too large without it      |
| Signed release build             | ⚠️         | Required | Config exists, unverified     |
| `fallbackToDestructiveMigration` | ⚠️         | High     | Data loss risk                |
| Offline support                  | ⚠️         | Medium   | Partial (Room local DB)       |
| Network security config          | ❌         | Medium   | No cert pinning               |
| Content rating                   | ❌         | Required | IARC questionnaire            |
| App store assets                 | ❌         | Required | Screenshots, descriptions     |

---

## RECOMMENDED LAUNCH SEQUENCE

### Week 1: Foundation

1. ~~Fix all compilation errors~~ ✅ DONE
2. Enable ProGuard/R8 with proper keep rules
3. Create and verify signed release build
4. Add Firebase Crashlytics + Analytics
5. Create privacy policy + ToS
6. Remove `fallbackToDestructiveMigration()`

### Week 3: Security & Compliance

1. Add age gate to signup
2. Implement COPPA parental consent flow
3. Add server-side content moderation for Explorer tier
4. Verify all RLS policies
5. Add network security config
6. Complete Google Play Data Safety form

### Week 4: Testing & QA

1. Write unit tests for critical paths
2. Complete manual QA checklist
3. Performance profiling
4. Fix top issues

### Week 5: Launch Prep

1. Create Google Play listing
2. Upload to internal testing track
3. Run closed beta (20-50 testers)
4. Fix beta feedback
5. Promote to open beta
6. Monitor crash-free rate (target: >99.5%)

### Week 6: Production

1. Promote to production
2. Monitor dashboards
3. Respond to user feedback
4. Plan v1.1

---

## ESTIMATED EFFORT

| Phase                   | Effort         | Can Ship Without?   |
| ----------------------- | -------------- | ------------------- |
| Phase 0 (Blockers)      | 2-3 days       | NO                  |
| Phase 1 (Security)      | 3-5 days       | NO                  |
| Phase 2 (Build Config)  | 1-2 days       | Partially           |
| Phase 3 (Observability) | 2-3 days       | NO                  |
| Phase 4 (Compliance)    | 3-5 days       | NO                  |
| Phase 5 (Testing)       | 5-7 days       | Partially           |
| Phase 6 (CI/CD)         | 2-3 days       | Yes (manual deploy) |
| Phase 7 (Post-launch)   | Ongoing        | YES                 |
| **Total to launch**     | **~3-4 weeks** |                     |

---

## RISK REGISTER

| Risk                                 | Impact   | Likelihood | Mitigation                        |
| ------------------------------------ | -------- | ---------- | --------------------------------- |
| App crashes on launch                | High     | Medium     | Crashlytics + QA                  |
| COPPA violation                      | Critical | Medium     | Age gate + consent flow           |
| Data loss from destructive migration | Critical | Low        | Remove fallback, test migrations  |
| API key exposure                     | High     | Low        | Already using BuildConfig         |
| Gemini API quota exhaustion          | Medium   | High       | Multi-model fallback chain exists |
| Poor kid safety                      | High     | Medium     | Server-side moderation            |
| Play Store rejection                 | High     | Medium     | Privacy policy + Data Safety form |

---

_This spec is a living document. Update as items are completed._

---

# Screen-by-Screen Production Tweaks

## Naming Convention

- **[FIX]** = Must fix before launch
- **[POLISH]** = Should fix for quality
- **[COMING SOON]** = Tag as "Coming Soon" in the next update

---

## 1. Splash Screen

**File:** `SplashScreen.kt`

| #   | Issue                                          | Priority | Action                                                 |
| --- | ---------------------------------------------- | -------- | ------------------------------------------------------ |
| 1   | No app version displayed                       | [POLISH] | Add `BuildConfig.VERSION_NAME` to splash               || 2 | No loading indicator while checking auth state | [FIX] | ✅ Splash has LinearProgressIndicator + status text |

---

## 2. Onboarding Flow

**File:** `OnboardingScreen.kt` (2122 lines — very long)

| #   | Issue                                                      | Priority      | Action                                                                |
| --- | ---------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| 1   | No age/birth date collection                               | [FIX]         | Add birth date field for COPPA age gate                               |
| 2   | No "Skip for now" option on later steps                    | [POLISH]      | Allow skipping non-essential profile fields                           || 3 | AI-powered onboarding chat creates new sessions repeatedly | [FIX] | ✅ Fixed — migrated to dedicated `onboarding-assistant` edge function |
| 4   | No progress indicator showing which step user is on        | [POLISH]      | Add step indicator (1/5, 2/5, etc.)                                   |
| 5   | Hardcoded strings throughout (no i18n)                     | [COMING SOON] | Localize for Ghanaian languages (Twi, Ga, Ewe)                        |

---

## 3. Auth Screen (Login/Signup)

**File:** `AuthViewModel.kt`

| #   | Issue                                         | Priority | Action                                                                   |
| --- | --------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| 1   | No email verification enforcement             | [FIX]    | ✅ Client handles Supabase email confirmation; server-side config needed |
| 2   | No rate limiting on failed login attempts     | [POLISH] | Add exponential backoff after 3 failed attempts                          |
| 3   | No "Remember me" / session persistence toggle | [POLISH] | Always persist session (current behavior is fine)                        |
| 4   | Password reset flow exists but untested       | [FIX]    | Test end-to-end password reset                                           |
| 5   | No password strength validation on signup     | [POLISH] | Minimum 8 characters, show strength indicator                            |

---

## 4. Dashboard — Explorer Home

**File:** `ExplorerHomeContent.kt` (802 lines)

| #   | Issue                                                                | Priority      | Action                                              |
| --- | -------------------------------------------------------------------- | ------------- | --------------------------------------------------- |
| 1   | "Store 🛍️" door exists but store is not implemented                  | [COMING SOON] | Add "Coming Soon" badge on store door               |
| 2   | "Multiplayer ⚔️" door — live quiz system works but needs polish      | [POLISH]      | Verify end-to-end flow                              |
| 3   | Daily Quest progress bar shows but quest logic is basic              | [POLISH]      | Ensure quest completion triggers properly           |
| 7   | Roadmap steps show "null" when backend hasn't generated content      | [FIX]         | ✅ Fixed — .ifBlank fallback on title + subjectName |
| 5   | No pull-to-refresh on dashboard                                      | [POLISH]      | Add PullToRefreshBox                                |
| 6   | Streak calendar widget shows for all tiers but only Explorer uses it | [COMING SOON] | Extend streak system to Achiever/Scholar            |
| 7   | Hardcoded emoji strings (not in string resources)                    | [COMING SOON] | Move to strings.xml for localization                |

---

## 5. Dashboard — Achiever Home

**File:** `AchieverHomeContent.kt`

| #   | Issue                                                 | Priority      | Action                                                                 |
| --- | ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| 1   | "Past Papers" section shows placeholder cards         | [COMING SOON] | Mark as "Coming Soon" or wire to real data                             |
| 2   | "Study Groups" section not connected to social groups | [COMING SOON] | Wire to group system                                                   |
| 3   | WASSCE countdown timer — no real exam date set        | [FIX]         | ✅ Fixed — dynamically computes days until May 31 of current/next year |

---

## 6. Dashboard — Scholar Home

**File:** `ScholarHomeContent.kt`

| #   | Issue                                       | Priority      | Action                |
| --- | ------------------------------------------- | ------------- | --------------------- |
| 1   | "Research Hub" section is placeholder       | [COMING SOON] | Mark as "Coming Soon" |
| 2   | "Thesis Tracker" not implemented            | [COMING SOON] | Mark as "Coming Soon" |
| 3   | "Study Groups" same as Achiever — not wired | [COMING SOON] | Wire to group system  |

---

## 7. AI Chat Screen

**File:** `AIChatScreen.kt` (2198 lines)

| #   | Issue                                                         | Priority      | Action                                                            |
| --- | ------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| 1   | Chat bubble cuts off text when LaTeX formulas are present     | [FIX]         | Already fixed (increased height buffers + delayed re-measurement) |
| 2   | TTS reads different text than displayed                       | [FIX]         | Already fixed (disable AI rewrite, read exact text)               |
| 3   | No loading spinner when TTS is processing                     | [FIX]         | Already fixed (added CircularProgressIndicator)                   |
| 4   | Minimap active indicator doesn't track scroll position        | [FIX]         | Already fixed (derivedStateOf)                                    |
| 5   | Attached files don't show in sent message bubble              | [FIX]         | Already fixed (added attachment capsules)                         |
| 6   | "Fix Diagram" button doesn't always pass error to AI          | [POLISH]      | Error is passed but may be too generic                            |
| 7   | Thinking/reasoning steps panel — works but confusing for kids | [POLISH]      | Consider hiding for Explorer tier or simplifying                  |
| 8   | No message search functionality                               | [COMING SOON] | Add search within chat history                                    |
| 9   | No export/share chat transcript                               | [COMING SOON] | Add share button                                                  |
| 10  | Confirmation loop — actions re-execute on subsequent "yes"    | [FIX]         | Already fixed (clear stale flags in DB)                           |

---

## 8. Notes Screen & Note Detail

**Files:** `NotesScreen.kt`, `NoteDetailScreen.kt`

| #   | Issue                                                                          | Priority      | Action                                                |
| --- | ------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| 1   | Tags show as `["tag1","tag2"]` after leaving and returning                     | [FIX]         | Already fixed (parseTagsFromCloud + sanitizeNoteTags) |
| 2   | Rich text editor (Quill/Tiptap) — WebView-based, works but has deprecated APIs | [POLISH]      | Fix deprecated `allowFileAccessFromFileURLs`          |
| 3   | No folder/tag organization for notes                                           | [COMING SOON] | Add note folders                                      |
| 4   | No note sharing/export                                                         | [COMING SOON] | Add share as PDF/Markdown                             |
| 5   | AI note operations (simplify, expand, questions) — works but no undo           | [POLISH]      | Add undo for AI transformations                       || 6 | Speech-to-text for notes — requires RECORD_AUDIO permission | [FIX] | ✅ Already handled — requestPermission launcher in place |

---

## 9. Documents Screen

**Files:** `DocumentsScreen.kt`, `DocumentUploadScreen.kt`, `DocumentDetailScreen.kt`

| #   | Issue                                                           | Priority      | Action                                                    |
| --- | --------------------------------------------------------------- | ------------- | --------------------------------------------------------- |
| 1   | Upload returns empty content until refresh                      | [FIX]         | Already fixed (immediate cloud push + content extraction) |
| 2   | Tag chosen becomes folder with 0 files                          | [FIX]         | Already fixed (folder_id in cloud payload)                |
| 3   | No document preview (PDF viewer, image viewer)                  | [COMING SOON] | Add inline document viewer                                |
| 4   | No document sharing                                             | [COMING SOON] | Add share functionality                                   |
| 5   | Document detail screen — AI analysis works but no loading state | [POLISH]      | Add loading shimmer                                       |
| 6   | Large file uploads may timeout                                  | [POLISH]      | Add progress indicator for large files                    |

---

## 10. Flashcards Screen

**File:** `FlashcardsScreen.kt`

| #   | Issue                                                               | Priority      | Action                                   |
| --- | ------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| 1   | AI-generated flashcards — works but no spaced repetition scheduling | [COMING SOON] | Add SM-2 algorithm for review scheduling |
| 2   | No card editing after creation                                      | [POLISH]      | Add edit mode for flashcards             |
| 3   | No flashcard export/import                                          | [COMING SOON] | Add Anki-compatible export               |
| 4   | Flip animation is basic                                             | [POLISH]      | Consider 3D flip effect                  || 5 | TTS on flashcards — same fix as chat (read exact text) | [FIX] | ✅ TTS reads exact card content (fixed in prior session) |

---

## 11. Quizzes Screen

**File:** `QuizzesScreen.kt` (3700+ lines)

| #   | Issue                                                            | Priority      | Action                                |
| --- | ---------------------------------------------------------------- | ------------- | ------------------------------------- |
| 1   | Quiz creation works but no quiz editing                          | [COMING SOON] | Add edit quiz functionality           |
| 2   | No quiz sharing between users                                    | [COMING SOON] | Add share quiz link                   |
| 3   | Quiz history — live quiz attempts show correctly after fix       | [FIX]         | Already fixed (liveResultsJson)       || 4 | "Learn It" lessons — works but some lessons show "not available" | [FIX] | ✅ Improved empty state message with guidance |
| 5   | Quiz rules dialog — works but could be clearer                   | [POLISH]      | Simplify rules text for Explorer tier |
| 6   | No quiz printing/export                                          | [COMING SOON] | Add PDF export                        |

---

## 12. Explorer Games

**Files:** `ExplorerGames.kt`, `ExplorerGameDetailScreen.kt`, `ExplorerQuizRunnerScreen.kt`, `SpellingBeeScreen.kt`

| #   | Issue                                                              | Priority      | Action                                                    |
| --- | ------------------------------------------------------------------ | ------------- | --------------------------------------------------------- |
| 1   | All 4 games work end-to-end                                        | ✅            | Verified                                                  |
| 2   | Badge system is hardcoded — no dynamic unlock                      | [FIX]         | ✅ Fixed — badges unlock from game_progress + streak data |
| 3   | Speed Race — live multiplayer works but needs lobby polish         | [POLISH]      | Add player count indicator in lobby                       |
| 4   | Math Asteroid Blaster — standalone, not connected to game progress | [POLISH]      | Wire to game_progress table                               |
| 5   | Spelling Bee words — AI-generated, sometimes too advanced for kids | [POLISH]      | Add difficulty constraints to word generation             |
| 6   | No sound effects toggle in settings                                | [POLISH]      | Add global sound toggle                                   |
| 7   | Game progress syncs to cloud but no cross-device resume            | [COMING SOON] | Ensure cloud sync is complete                             |

---

## 13. Explorer Badges Screen

**File:** `ExplorerBadgesScreen.kt`

| #   | Issue                                                                      | Priority | Action                                                            |
| --- | -------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| 1   | All badge states are hardcoded (isUnlocked, progress)                      | [FIX]    | ✅ Fixed — buildExplorerBadges() computes from live BadgeProgress |
| 2   | No animation when viewing badge details                                    | [POLISH] | Add shimmer/glow effect                                           |
| 3   | "Kente Heritage Bowl" requirement text — misleading (game is "Kente Quiz") | [FIX]    | ✅ Fixed — text now says "Kente Quiz"                             |

---

## 14. Social Feed

**File:** `SocialFeedScreen.kt` (1448 lines)

| #   | Issue                                                   | Priority      | Action                                         |
| --- | ------------------------------------------------------- | ------------- | ---------------------------------------------- |
| 1   | Explorer tier can create posts — only keyword filtering | [FIX]         | ✅ Fixed — Explorer FAB + create button hidden |
| 2   | No content reporting/flagging                           | [COMING SOON] | Add report button on posts                     |
| 3   | No image posting — text only                            | [COMING SOON] | Add image attachment                           |
| 4   | AI post rewrite works                                   | ✅            | Verified                                       |
| 5   | Pull-to-refresh works                                   | ✅            | Verified                                       |
| 6   | No post editing after creation                          | [COMING SOON] | Add edit post                                  |
| 7   | No post deletion by author                              | [POLISH]      | Add delete own post                            |
| 8   | Category filtering works                                | ✅            | Verified                                       |
| 9   | Social groups — exist in schema but not wired to UI     | [COMING SOON] | Wire groups to navigation                      |

---

## 15. Recordings Screen

**File:** `RecordingsScreen.kt`

| #   | Issue                                 | Priority      | Action                    |
| --- | ------------------------------------- | ------------- | ------------------------- |
| 1   | Audio recording + transcription works | ✅            | Verified                  |
| 2   | AI summary of recordings works        | ✅            | Verified                  |
| 3   | No recording playback speed control   | [COMING SOON] | Add 0.5x/1x/1.5x/2x speed |
| 4   | No recording trimming/editing         | [COMING SOON] | Add basic trim            |
| 5   | Large recordings may fail to upload   | [POLISH]      | Add chunked upload        |

---

## 16. Podcast Screen

**File:** `AIPodcastScreen.kt`

| #   | Issue                                        | Priority      | Action              |
| --- | -------------------------------------------- | ------------- | ------------------- |
| 1   | AI podcast generation works                  | ✅            | Verified            |
| 2   | TTS playback works                           | ✅            | Verified            |
| 3   | No podcast download for offline              | [COMING SOON] | Add download button |
| 4   | No podcast sharing                           | [COMING SOON] | Add share link      |
| 5   | Podcast creation from attached notes — works | ✅            | Verified            |

---

## 17. Schedule Screen

**File:** `ScheduleTasksScreen.kt`

| #   | Issue                                         | Priority      | Action                     |
| --- | --------------------------------------------- | ------------- | -------------------------- |
| 1   | Schedule creation works                       | ✅            | Verified                   |
| 2   | No notification reminders for scheduled tasks | [COMING SOON] | Add push notifications     |
| 3   | No calendar view (only list)                  | [COMING SOON] | Add calendar grid view     |
| 4   | No recurring schedule support                 | [COMING SOON] | Add weekly/daily recurring |

---

## 18. Settings Screen

**File:** `SettingsScreen.kt` (736 lines)

| #   | Issue                                                                          | Priority      | Action                                                           |
| --- | ------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------- |
| 1   | Parental gate for tier switching — works                                       | ✅            | Verified                                                         |
| 2   | Parental gate for sign-out — works                                             | ✅            | Verified                                                         |
| 3   | "Reset Data" option exists — destructive, no confirmation beyond parental gate | [POLISH]      | Add second confirmation dialog                                   |
| 4   | No notification preferences UI                                                 | [COMING SOON] | Add notification settings                                        |
| 5   | No theme/dark mode toggle                                                      | [COMING SOON] | Add appearance settings                                          |
| 6   | No language selection                                                          | [COMING SOON] | Add language picker                                              |
| 7   | "About" section — no version number displayed                                  | [FIX]         | ✅ Fixed — BuildConfig.VERSION_NAME + VERSION_CODE shown         |
| 8   | No privacy policy link                                                         | [FIX]         | ✅ Fixed — link to https://studdyhub.vercel.app/privacy-policy   |
| 9   | No terms of service link                                                       | [FIX]         | ✅ Fixed — link to https://studdyhub.vercel.app/terms-of-service |

---

## 19. Profile Screen

**File:** `ProfileScreen.kt` (462 lines)

| #   | Issue                                   | Priority      | Action             |
| --- | --------------------------------------- | ------------- | ------------------ |
| 1   | Profile editing works                   | ✅            | Verified           |
| 2   | No profile picture upload               | [COMING SOON] | Add avatar upload  |
| 3   | XP/level display works                  | ✅            | Verified           |
| 4   | No achievement/badge display on profile | [COMING SOON] | Add badge showcase |
| 5   | Stats section — shows basic stats       | ✅            | Verified           |

---

## 20. Ranking/Leaderboard Screen

**File:** `RankingScreen.kt` (251 lines)

| #   | Issue                                    | Priority | Action                          |
| --- | ---------------------------------------- | -------- | ------------------------------- |
| 1   | Leaderboard works with tier filtering    | ✅       | Verified                        |
| 2   | "My Class" filter for Explorer — works   | ✅       | Verified                        |
| 3   | No avatar display on leaderboard entries | [POLISH] | Show user avatars               |
| 4   | No "you are ranked #X" indicator         | [POLISH] | Highlight current user position |
| 5   | Pull-to-refresh works                    | ✅       | Verified                        |

---

## 21. Search Screen

**File:** `SearchViewModel.kt`

| #   | Issue                                     | Priority      | Action                                   |
| --- | ----------------------------------------- | ------------- | ---------------------------------------- |
| 1   | Global search across notes, docs, quizzes | ✅            | Verified                                 |
| 2   | Search is local (Room DB) — not cloud     | [POLISH]      | Consider cloud search for large datasets |
| 3   | No search history/suggestions             | [COMING SOON] | Add recent searches                      |

---

## 22. Sync Details Dialog

**File:** `SyncDetailsDialog.kt`

| #   | Issue                             | Priority | Action                             |
| --- | --------------------------------- | -------- | ---------------------------------- |
| 1   | Shows sync status per entity type | ✅       | Verified                           |
| 2   | Retry failed items — works        | ✅       | Verified                           |
| 3   | No auto-retry for failed items    | [POLISH] | Add exponential backoff auto-retry |

---

## Summary: Priority Counts

| Priority          | Count | Description                         |
| ----------------- | ----- | ----------------------------------- |
| **[FIX]**         | 22 → 3 remaining  | ✅ 19 fixed, 3 need manual test (COPPA age gate, password reset, Learn It content gen) |
| **[POLISH]**      | 22    | Should fix for quality              |
| **[COMING SOON]** | 25    | Tag as "Coming Soon" in next update |

### Remaining [FIX] Items Requiring Manual Work

| # | Item | Why Manual |
|---|------|------------|
| 1 | **COPPA age/birth date collection** | Requires design review — age gate UI, parental consent flow, and data handling policy |
| 2 | **Password reset end-to-end test** | Requires live Supabase email delivery verification |
| 3 | **Learn It lesson generation edge function** | Requires testing the `generate-lesson` edge function with all subject/curriculum combos |

---

## Coming Soon Features (To Display in App)

These features should show a "🚧 Coming Soon" badge or tooltip in the UI:

1. **Store 🛍️** — Explorer dashboard door
2. **Profile Picture Upload** — Profile screen
3. **Achievement Showcase** — Profile screen
4. **Note Folders** — Notes screen
5. **Note Sharing/Export** — Notes screen
6. **Document Preview** — Documents screen
7. **Document Sharing** — Documents screen
8. **Flashcard Spaced Repetition** — Flashcards screen
9. **Flashcard Export/Import** — Flashcards screen
10. **Quiz Editing** — Quizzes screen
11. **Quiz Sharing** — Quizzes screen
12. **Quiz PDF Export** — Quizzes screen
13. **Content Reporting** — Social feed
14. **Image Posting** — Social feed
15. **Social Groups** — Social feed
16. **Post Editing** — Social feed
17. **Recording Speed Control** — Recordings screen
18. **Podcast Download** — Podcast screen
19. **Push Notification Reminders** — Schedule screen
20. **Calendar View** — Schedule screen
21. **Recurring Schedules** — Schedule screen
22. **Dark Mode Toggle** — Settings screen
23. **Language Selection** — Settings screen
24. **Message Search** — AI Chat screen
25. **Chat Export** — AI Chat screen
