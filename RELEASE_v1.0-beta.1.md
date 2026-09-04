# StuddyHub v1.0-beta.3 — Explorer Tier Beta Release

> **Third beta release** with build stability fixes, enhanced role verification, and device-aware downloads.

---

## What's New

### Bug Fixes
- Fixed malformed `try/catch` blocks in `RoleVerificationAdmin` that blocked Vercel deployment
- Enhanced role approval process with improved error handling and fallback logic
- Enhanced role rejection process with improved error handling and fallback logic

### Improvements
- **Device-Aware APK Download** — Header and layout detect Android vs iOS/desktop and show appropriate download button
- **Maintenance Mode** — Auth routes (`/auth`, `/reset-password`) redirect to a maintenance notice page pushing users to install the Android app
- **Direct APK Download** — One-tap install from the website without GitHub redirect

### Explorer Tier Fixes
- Fixed `LocalContext.current` inside non-composable lambda in `ScholarHomeContent`
- Google Sign-In `DEVELOPER_ERROR` (code 10) resolved for new and returning users
- New user onboarding pre-fills Google profile name and avatar

### Web App
- Landing page updated with "What's New" banner for v1.0-beta.3
- Terms of Service and Privacy Policy dates updated to September 2026
- Privacy Policy corrected AI provider reference (OpenAI → Google Gemini)

---

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| Android Version | 7.0 (API 24) |
| RAM | 2 GB |
| Storage | 100 MB free |
| Internet | Required for AI features, offline fallback available for quizzes |

---

## Installation

1. Download the `studdyhub-v1.0-beta.3.apk` file
2. Transfer to your Android device (or download directly on the device)
3. Open the APK file
4. If prompted, enable **"Install from unknown sources"** in your settings
5. Open StuddyHub and sign up
6. Select **"Explorer"** tier during onboarding

---

## How to Build & Release

### 1. Build the Release APK

```bash
cd mobile
.\gradlew.bat assembleRelease
```

Output: `mobile/app/build/outputs/apk/release/app-release.apk`

### 2. Copy APK to Web Public

```bash
copy app\build\outputs\apk\release\app-release.apk ..\web\public\studdyhub-v1.0-beta.3.apk
```

### 3. Update Version (for next release)

Edit `mobile/app/build.gradle.kts`:
```kotlin
defaultConfig {
    versionCode = 4        // increment by 1
    versionName = "1.0-beta.4"  // increment as needed
}
```

### 4. Commit & Push

```bash
git add -A
git commit -m "release: v1.0-beta.3"
git push origin main
```

### 5. Create GitHub Release

```bash
gh release create v1.0-beta.3 web/public/studdyhub-v1.0-beta.3.apk \
  --title "StuddyHub v1.0-beta.3" \
  --notes-file RELEASE_v1.0-beta.1.md
```

---

## Files Updated in This Release

### Web
- `RoleVerificationAdmin.tsx` — Fixed malformed try/catch blocks in approve/reject handlers
- `LayoutComponents.tsx` — Device-aware download button, APK reference updated
- `Header.tsx` — Device-aware download button, APK reference updated
- `MaintenanceNotice.tsx` — Maintenance page for auth routes
- `LandingPage.tsx` — "What's New" banner for v1.0-beta.3
- `TermsOfServices.tsx` — Date updated to September 2026
- `PrivacyPolicy.tsx` — Date updated, AI provider corrected

### Mobile
- `ScholarHomeContent.kt` — LocalContext fix
- `AuthViewModel.kt` — Base64.NO_WRAP fix for Google JWT decode
- `BackendApiService.kt` — Auth headers for edge function calls

### Edge Functions
- `gemini-chat/` — Unified system prompt, identity guardrail

### Database
- `20260901_create_social_user_status_enum.sql` — Creates missing enum type

---

## Known Issues

- Podcast feature disabled on mobile (Coming Soon)
- AI chat may occasionally return generic responses
- Streak calendar may not highlight dates correctly on first load

---

## What's Coming Next

- [ ] Bundled high-quality sound effects for games and battles
- [ ] AI chat with full knowledge of Explorer tier features
- [ ] Cleaned-up battle UI with better navigation
- [ ] Google Sign-In for faster signup
- [ ] Welcome screen for new users

---

## Feedback

Report bugs or suggest features at:
https://github.com/NexGen-Innovators-co/studdyhub_repo/issues

---

## Credits

Built with Kotlin + Jetpack Compose, React + TypeScript, Supabase, and Google Gemini AI.

**Version:** 1.0-beta.3
**Build:** Release (signed)
**Target:** Explorer Tier (Basic & JHS)
