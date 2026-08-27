🚀 FTUE Improvement Plan

1. Welcome Hero Screen (before Auth)

What: Animated intro screen with "Learn smarter with AI" → "Get Started" button
Files to create/modify:
- New:  mobile/app/src/main/java/com/example/ui/screens/welcome/WelcomeScreen.kt 
- Modify:  mobile/app/src/main/java/com/example/ui/navigation/Screen.kt  — add  Welcome  route
- Modify:  mobile/app/src/main/java/com/example/ui/StuddyHubApp.kt  — add Welcome → Auth navigation
- Modify:  mobile/app/src/main/java/com/example/ui/screens/splash/SplashViewModel.kt  — new users go to Welcome instead of Auth

Flow: Splash → Welcome (NEW) → Auth → Onboarding → Dashboard

UI:
- Full-screen gradient background
- Animated mascot/logo illustration
- 3 short bullet points ("AI-powered study buddy", "Track your progress", "Learn with friends")
- Large "Get Started" CTA button
- "Already have an account? Sign In" link at bottom
- Swipeable dot indicators (3 pages)

────────────────────────────────────────────────────────────────────────────────

2. Google Sign-In (1-tap)

What: One-tap Google signup/login
Files to modify:
-  mobile/app/build.gradle.kts  — add Google Sign-In dependency
-  mobile/app/src/main/java/com/example/ui/screens/auth/AuthScreen.kt  — add Google button
-  mobile/app/src/main/java/com/example/ui/screens/auth/AuthViewModel.kt  — add Google sign-in logic
-  mobile/app/src/main/java/com/example/data/repository/StuddyHubRepository.kt  — add Google auth flow
-  mobile/app/src/main/java/com/example/data/remote/BackendApiService.kt  — add Google token exchange endpoint

Implementation:
- Add  com.google.android.gms:play-services-auth  dependency
- Google button between tabs and email fields
- On success → exchange Google ID token with Supabase Auth → same flow as email signup
- Backend needs to handle Google OAuth (Supabase supports this natively)

────────────────────────────────────────────────────────────────────────────────

3. Onboarding Progress Indicator

What: Step 1/4 → 2/4 → 3/4 → 4/4 during onboarding chat
Files to modify:
-  mobile/app/src/main/java/com/example/ui/screens/onboarding/OnboardingScreen.kt  — add progress bar
-  mobile/app/src/main/java/com/example/ui/screens/onboarding/OnboardingViewModel.kt  — track current step

Steps (for Explorer tier):
1. "What's your name?" + school setup
2. "What class are you in?" + grade selection
3. "What's your favorite subject?" + learning style
4. "You're all set! 🎉" → Dashboard

UI:
- Horizontal step indicator at top (4 dots or progress bar)
- Current step highlighted, completed steps checked
- Smooth transition between steps

────────────────────────────────────────────────────────────────────────────────

4. Welcome Animation on First Dashboard

What: Confetti/celebration when user lands on dashboard for the first time
Files to create/modify:
- New:  mobile/app/src/main/java/com/example/ui/components/ConfettiEffect.kt 
- Modify:  mobile/app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt  — show confetti on first visit
- Modify:  mobile/app/src/main/java/com/example/ui/screens/dashboard/ExplorerHomeContent.kt  — add welcome banner

Implementation:
- Use Compose Canvas or Lottie animation for confetti
- Check if this is the first time on dashboard (SharedPreferences flag)
- Show "Welcome to StuddyHub! 🎉" banner with confetti
- Auto-dismiss after 3 seconds
- Never show again

────────────────────────────────────────────────────────────────────────────────

Implementation Order

┌──────┬────────────────────────────────┬───────────┬───────────────┐
│ Step │ Task                           │ Est. Time │ Dependencies  │
├──────┼────────────────────────────────┼───────────┼───────────────┤
│ 1    │ Welcome Hero Screen            │ 2-3 hours │ None          │
│ 2    │ Onboarding Progress Indicator  │ 1-2 hours │ None          │
│ 3    │ Welcome Animation on Dashboard │ 1 hour    │ None          │
│ 4    │ Google Sign-In                 │ 3-4 hours │ Backend setup │
└──────┴────────────────────────────────┴───────────┴───────────────┘

Total: 7-10 hours of implementation