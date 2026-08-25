# GitHub Issues Backlog

---

## Issue #1: Explorer settings not showing class/grade — shows "not selected"

**Labels:** `bug`, `explorer`, `onboarding`

### Description
When an Explorer (kids) user opens settings/profile, the class/grade field shows "not selected" even though the AI chatbot knows the user's class. The `academic_level` field in the `profiles` table stores `"Undergraduate"` (a migration default) instead of the user's actual class like `"Basic 5"`.

### Root Cause
The `complete_onboarding` RPC receives `p_academic_level` as `undefined` from the old Android app. The migration set `DEFAULT 'Undergraduate'` on the column, so it falls back to that. The actual class/grade lives in `user_education_profiles.year_or_grade` (e.g., "Basic 5") but is never synced to `profiles.academic_level`.

### Fix
- Ensure the onboarding flow populates `profiles.academic_level` with the user's actual class from `user_education_profiles`
- Or show the class from `user_education_profiles` directly in settings instead of `profiles.academic_level`

---

## Issue #2: Multiple inconsistent avatars across screens

**Labels:** `bug`, `ui`, `avatar`

### Description
The app shows different avatars in different places:
- **Home header**: Shows one avatar (possibly from `profiles.avatar_url`)
- **Workspace/Explorer home**: Shows a different avatar (possibly from `social_users.avatar_url`)  
- **Settings**: Shows yet another avatar (possibly from Room DB local state)

Even after purchasing an avatar, the displayed avatar is inconsistent across screens.

### Root Cause
Three separate avatar sources exist with no single source of truth:
1. `profiles.avatar_url` (cloud)
2. `social_users.avatar_url` (cloud, set by trigger from profiles)
3. In-memory / Room DB local state

The `sync_profile_to_social` trigger only syncs on INSERT, not on every UPDATE of `avatar_url`. The composables each read from different sources.

### Fix
- Standardize on `profiles.avatar_url` as the single source of truth
- Ensure `sync_profile_to_social` trigger also handles avatar_url updates
- Have all composables read avatar from the same `userProfile` Flow

---

## Issue #3: Avatar doesn't persist after logout/login

**Labels:** `bug`, `avatar`, `data-persistence`

### Description
When a user purchases/sets an avatar, it shows correctly. But after signing out and signing back in, the avatar reverts to the generic initial-letter placeholder or a dummy avatar.

### Root Cause
The avatar URL is stored in Room DB (`ProfileEntity.avatarUrl`) but the cloud sync doesn't populate it on login. The `get_profile` RPC returns `avatar_url` but the login flow may not map it to the local entity correctly.

### Fix
- Ensure `get_profile` RPC returns `avatar_url`
- Ensure `AuthViewModel` maps the returned `avatar_url` to `ProfileEntity.avatarUrl`
- Ensure `syncOnboardingStateFromCloud()` syncs `avatar_url` from cloud to local

---

## Issue #4: TTS settings showing twice in kids settings screen

**Labels:** `bug`, `ui`, `settings`, `tts`

### Description
In the Explorer (kids) settings screen, the TTS (Text-to-Speech) settings section appears twice, confusing users.

### Root Cause
Most likely a Compose recomposition issue where the TTS settings composable is rendered twice, possibly because it's included both in a parent composable and a child composable, or the settings screen has duplicate section rendering.

### Fix
- Check the Explorer settings screen for duplicate TTS section composables
- Check if the composable is accidentally rendered twice in the layout tree

---

## Issue #5: Bottom nav covering About section in profile/settings

**Labels:** `bug`, `ui`, `explorer`, `layout`

### Description
In the Explorer (kids) profile and settings screens, the bottom navigation bar covers the lower part of the About section. Users have to scroll to see it, but the bottom nav stays on top covering the content.

### Root Cause
The `Scaffold` component's `bottomBar` height is not accounted for in the content's bottom padding. The scrollable content needs to apply `Modifier.padding(bottom = bottomBarHeight)` or use `Scaffold`'s built-in padding system.

### Fix
- Ensure the scrollable content in Explorer profile/settings uses `Scaffold`'s inner padding (via `innerPadding`) to add bottom padding equal to the nav bar height
- Or wrap content in `Modifier.windowInsetsPadding(WindowInsets.navigationBars)`

---

## Issue #6: Quiz attempt population fails for games (Ananse riddles, etc.)

**Labels:** `bug`, `games`, `quizzes`

### Description
When a user plays a fun game like Ananse Riddles, Spelling Bee, or any other educational game, the quiz attempt record fails to populate/save to the database.

### Root Cause
Need investigation — likely one of:
1. The game screens use a different quiz attempt structure than what the `quiz_attempts` table expects
2. The `sync_profile_to_social` trigger interferes with the insert
3. Missing required fields or foreign key constraint violations
4. The game code writes to a different table/schema

### Fix
- Check device logs for the specific error when game quiz attempts fail
- Verify the game code matches the `quiz_attempts` table schema
- Check for constraint violations or missing required fields

---

## Issue #7: Settings screen has no save button — changes lost

**Labels:** `bug`, `settings`, `data-persistence`, `sync`

### Description
When a user changes settings (learning style, academic preferences, TTS voice, etc.), there is no save button to persist the changes. Changes are lost when the user navigates away or restarts the app. Changes are also not synced to the cloud.

### Root Cause
The settings screen likely updates local state (in-memory or ViewModel) but never calls:
1. `repository.updateProfile()` to save to Room DB
2. `BackendApiService.updateUserProfile()` or `syncProfileViaEdge()` to sync to cloud

### Fix
- Add a Save button to the settings screen that persists changes to both Room DB and cloud
- Or auto-save on change with a debounced sync to cloud
- Ensure all settings fields (learning_style, academic_level, academic_tier, etc.) are included in the sync payload
