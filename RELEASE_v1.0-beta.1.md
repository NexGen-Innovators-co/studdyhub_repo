# StuddyHub Android — v1.0-beta.1 Release

## Version Info
- **Version Name:** `1.0-beta.1`
- **Version Code:** `2`
- **Package:** `com.aistudio.studdyhub.app`
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 36

---

## What's New

### New Features
- **Explorer Mode** — Fun puzzles, badges, and interactive flashcards for Basic & JHS students
- **AI Podcast Generation** — Create podcast-style audio from notes using SpeechSter TTS
- **AI Quiz Generation** — Generate quizzes from notes via the AI chat
- **AI Flashcard Generation** — Create flashcards from notes via the AI chat
- **Social Posts** — Share posts with content moderation
- **Multiplayer Quiz Battles** — Compete with other students in real-time
- **Speed Race Quiz** — Timed quiz challenges

### Improvements
- **Google Sign-In** — Fixed DEVELOPER_ERROR (code 10) for new and returning users
- **New User Onboarding** — Google profile name and avatar now pre-fill the onboarding form
- **Chat Session Titles** — AI-generated titles instead of raw message previews
- **Podcast Feature** — Muted on mobile as "Coming Soon" (web-only for now)
- **Release Audit** — Full pre-launch audit completed with 20 findings documented

### Bug Fixes
- Fixed `social_user_status` enum missing — new Google sign-ups no longer fail with 500
- Fixed JWT Base64 decode (`NO_WRAP` instead of `DEFAULT`) — Google user metadata now extracted
- Fixed `isAwaitingConfirmation` temporal dead zone bug in AI chat
- Fixed `LocalContext.current` inside non-composable lambda in `ScholarHomeContent`

### Web App
- Auth pages (`/auth`, `/reset-password`) now show maintenance notice directing users to install the Android app
- Download App button detects device type — Android gets direct APK download, iOS/desktop see appropriate messages

---

## How to Build & Release

### 1. Build the Release APK

```bash
cd mobile
.\gradlew.bat assembleRelease
```

Output: `mobile/app/build/outputs/apk/release/app-release.apk`

### 2. Rename the APK

```bash
copy app\build\outputs\apk\release\app-release.apk ..\web\public\StuddyHub-v1.0-beta.1.apk
```

This copies the APK to the web app's public folder so users can download it directly.

### 3. Update Version (for next release)

Edit `mobile/app/build.gradle.kts`:
```kotlin
defaultConfig {
    versionCode = 3        // increment by 1
    versionName = "1.0-beta.2"  // increment as needed
}
```

### 4. Commit & Push

```bash
git add -A
git commit -m "release: v1.0-beta.1"
git push origin explorer-tier-fixes
```

### 5. Merge to Main

1. Go to https://github.com/NexGen-Innovators-co/studdyhub_repo/pull/new/explorer-tier-fixes
2. Create PR targeting `main`
3. Resolve any conflicts
4. Merge

### 6. Deploy Web (Auto)

Vercel auto-deploys when `main` is updated. The APK in `web/public/` will be served at:
```
https://studdyhub.vercel.app/StuddyHub-v1.0-beta.1.apk
```

### 7. Create GitHub Release (Optional)

1. Go to https://github.com/NexGen-Innovators-co/studdyhub_repo/releases/new
2. Tag: `v1.0-beta.1`
3. Title: `v1.0-beta.1`
4. Upload `StuddyHub-v1.0-beta.1.apk` as release asset
5. Publish

---

## Files Updated in This Release

### Mobile (Android)
- `ScholarHomeContent.kt` — Podcast tile muted, LocalContext fix
- `AssistantScreen.kt` — Podcast tile muted
- `AIChatScreen.kt` — Podcast suggestion, menu, modal, player all muted
- `StuddyHubApp.kt` — AIPodcast route shows "Coming Soon" placeholder
- `ProfileScreen.kt` — Badge shows "Podcasts Coming Soon"
- `SearchViewModel.kt` — Podcast search results commented out
- `AuthViewModel.kt` — Base64.NO_WRAP fix for Google JWT decode
- `BackendApiService.kt` — Auth headers for edge function calls

### Edge Functions
- `gemini-chat/` — Unified system prompt, removed isSimpleQuery, identity guardrail
- `generate-podcast/` — Auth token extraction, credit deduction
- `generate-ai-quiz/` — Quiz generation pipeline
- `generate-flashcards/` — Flashcard generation pipeline
- `create-social-post/` — Social post with moderation

### Web
- `MaintenanceNotice.tsx` — New maintenance page for auth routes
- `App.tsx` — Auth routes show maintenance notice
- `LayoutComponents.tsx` — Device-aware download button
- `Header.tsx` — Device-aware download button
- `RoleVerificationAdmin.tsx` — Fixed malformed try/catch blocks

### Database
- `20260901_create_social_user_status_enum.sql` — Creates missing enum type

---

## Release Checklist

- [ ] Build release APK (`.\gradlew.bat assembleRelease`)
- [ ] Copy APK to `web/public/StuddyHub-v1.0-beta.1.apk`
- [ ] Test APK on a physical Android device
- [ ] Test Google Sign-In with new account
- [ ] Test onboarding flow with Google account
- [ ] Commit and push all changes
- [ ] Merge PR to main
- [ ] Verify Vercel deployment succeeds
- [ ] Test download button on web (Android + desktop)
- [ ] Create GitHub release (optional)
