# SocialFeed Data Flow Analysis - Critical Issues & Solutions

**Date:** March 14, 2026  
**Status:** Complete Analysis of User Profile Data Initialization

---

## Executive Summary

The SocialFeed component and user profile data flow has **multiple critical initialization gaps** that prevent `currentUser` and `socialData` from being properly populated after login. The main issue is a **decoupling between authentication timing and social data initialization**, combined with missing dependency arrays in useEffects.

---

## 1. DATA FLOW OVERVIEW

### Where User Data Should Enter SocialFeed:
```
Auth Login → useAuth() gets user → AppProvider initializes → 
useSocialData() runs → currentUser is set → SocialFeed gets socialData from context
```

### Actual Flow (With Issues):
```
Auth Login → useAuth() gets user → AppProvider initializes (INCOMPLETE) →
useSocialData() runs ONCE on mount (no user dependency) → 
currentUser fetched but might be NULL if auth not complete →
SocialFeed uses stale/null socialData
```

---

## 2. CRITICAL ISSUES FOUND

### ISSUE #1: useSocialData Initializes on Mount Before Auth Completes
**Location:** [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts#L407-L475)

**Problem:**
```tsx
useEffect(() => {
  const initializeSocialUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    // ... fetch social_users for this user
  };
  initializeSocialUser();
}, []); // ❌ EMPTY DEPENDENCY ARRAY - RUNS ONLY ONCE ON MOUNT
```

**Why It Fails:**
- The effect runs on component mount, but at that point `useAuth()` may still be loading
- `supabase.auth.getUser()` might return `null` if called during auth initialization
- Once the effect completes, it never runs again even after auth completes
- If `currentUser` is null, ALL subsequent features (posts, groups, etc.) won't initialize

**Impact:** 
- `currentUser` remains null after login
- SocialFeed can't render user profile in left sidebar
- Posts don't load because `currentUser` is required for many operations

---

### ISSUE #2: useSocialData Missing User Dependency in useAppContext
**Location:** [src/contexts/AppContext.tsx](src/contexts/AppContext.tsx#L433)

**Problem:**
```tsx
const socialData = useSocialData(userProfile);
//                                 ^^^^^^^^^^^
// ❌ USES userProfile (from profiles table)
// NOT the authenticated user from useAuth()
```

**Why It Fails:**
- `userProfile` comes from `useAppData(user)` which loads from the `profiles` table
- The `profiles` table is **separate from social_users** table
- `userProfile` may load slower or have different data than needed
- `useSocialData` needs the **authenticated user's ID** from `useAuth()`, not the profile

**Flow Problem:**
1. `useAuth()` returns user at time T1
2. `useAppData(user)` starts fetching `profiles` table (slower)
3. `useSocialData(userProfile)` is called with `userProfile = null` (still loading)
4. Social initialization skips because `userProfile` is null
5. By time `userProfile` loads at T2, `useSocialData` doesn't re-run (no dependency)

---

### ISSUE #3: currentUser Never Set in Many Code Paths
**Location:** [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts#L434-L475)

**Problem:**
In the `initializeSocialUser` effect, `setCurrentUser()` is only called in:**
1. Create path (if social_users doesn't exist)
2. Update path (if avatar/name need syncing)
3. But NOT in the primary "user exists" path that just fetches

```tsx
if (fetchError && fetchError.code === 'PGRST116') {
  // Create new social user - SETS currentUser ✅
  setCurrentUser(newSocialUser);
} else if (!fetchError && socialUser) {
  // User exists - BUT DOESN'T SET currentUser! ❌
  // Only does partial sync
  setCurrentUser(socialUser);  // This line exists but is at the end
}
```

**Wait**, actually looking more carefully at the code:
```tsx
if (fetchError && fetchError.code === 'PGRST116') {
  // ... create new
  setCurrentUser(newSocialUser);
} else if (!fetchError && socialUser) {
  // ... sync if needed
  setCurrentUser(socialUser);  // This IS there
} else {
  setIsLoading(false);
  setIsLoadingGroups(false);
  // ❌ NO FALLBACK - if any error, setCurrentUser never called
}
```

**Real Issue:** If there's ANY error that's not PGRST116 (not found), the whole function fails silently and `currentUser` stays null.

---

### ISSUE #4: resetAndFetchData Depends on currentUser Being Set
**Location:** [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts#L646-L668)

**Problem:**
```tsx
useEffect(() => {
  if (currentUser && !isInitializedRef.current) {  // ❌ Waits for currentUser
    isInitializedRef.current = true;
    const initWithViewed = async () => {
      // ... fetch viewed posts for currentUser
      resetAndFetchData();  // Fetches all feed data
    };
  }
}, [currentUser]);  // ✅ Good dependency
```

**Why It's a Problem:**
- If `currentUser` is null (from Issue #1-3), this effect **never runs**
- No posts load, no groups load, no trending data loads
- User sees empty social feed

---

### ISSUE #5: AppShell/Sidebar Missing Social User Data
**Location:** [src/pages/Index.tsx](src/pages/Index.tsx) (where SocialFeed is rendered)

**Problem:**
- AppShell's Sidebar component gets `fullName` and `avatarUrl` from `userProfile` (profiles table)
- Should get them from `socialData.currentUser` (social_users table) for consistency
- Creates mismatch: sidebar shows old avatar, profile section shows different avatar

---

### ISSUE #6: useAppContext Hook Provides socialData But No Guarantee of Initialization
**Location:** [src/hooks/useAppContext.ts](src/hooks/useAppContext.ts#L1-20)

**Problem:**
```tsx
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return {
    ...context,
    socialData: context.socialData as ReturnType<typeof useSocialData>,
  };
}
```

**Issue:** 
- No validation that `context.socialData` is actually initialized
- No guard that `currentUser` is populated
- Consumers can't tell if data is stale or uninitialized

---

## 3. WHERE DATA IS SUPPOSED TO COME FROM

### User Profile Data Should Come From:

**After Login:**
```
1. supabase.auth.getUser() → User from auth.users table
   ↓
2. Fetch from profiles table → UserProfile (full_name, avatar_url, etc.)
   ↓
3. Fetch from social_users table → SocialUserWithDetails (username, bio, interests)
   ↓
4. Both should be synced - if profiles has avatar, social_users should get it
```

### Current Implementation:

```
AppProvider
├─ useAuth() → gets user (auth timing unpredictable)
├─ useAppData(user) → fetches from profiles (SLOW)
└─ useSocialData(userProfile) → fetches from social_users
   └─ Called with userProfile as parameter
   └─ But userProfile might be NULL when effect runs
   └─ And none of the other effects trigger on auth completion
```

---

## 4. WHERE DATA IS LOST

### The Death Chain:

1. **Auth Completes:** `useAuth()` returns user object
2. **useAppData Starts:** Fetches profiles table (takes time)
3. **useSocialData Runs:** Fire-and-forget effect with empty deps
   - Calls `supabase.auth.getUser()` (works if timing is right)
   - Fetches social_users (works)
   - But if any error, silently fails
4. **currentUser Never Set:** No error shown, just stays null
5. **resetAndFetchData Skipped:** Depends on currentUser, so never runs
6. **All Feed Data Empty:** No posts, no groups, no trending
7. **Sidebar Shows Nothing:** Uses different user data source (profiles)

### Data Loss Points:
- ❌ No error handling for social_users fetch failures
- ❌ No re-trigger when auth actually completes
- ❌ Silent failures in useEffect with empty dependencies
- ❌ No validation that authenticated user matches social_users fetch
- ❌ No refetch if userProfile changes in AppContext

---

## 5. MISSING INITIALIZATION STEPS

### Required But Missing:

1. **Guarantee auth is complete before fetching social_users**
   - Currently: `useSocialData` ignores the `user` from `useAuth()`
   - Should: Add `user` as dependency to effect

2. **Re-initialize when auth state changes**
   - Currently: Empty dependency array means one-time only
   - Should: Trigger effect when user login/logout detected

3. **Sync avatar/display_name between tables**
   - Currently: Only syncs on updateProfile
   - Should: Auto-sync on login if differences detected

4. **Validate currentUser before using it**
   - Currently: Used directly with null checks scattered everywhere
   - Should: Centralized validation in AppContext or hook

5. **Handle social_users not existing gracefully**
   - Currently: Creates it if PGRST116, but other errors are silent
   - Should: Log errors, show toast, retry with backoff

6. **Retry mechanism for failed initializations**
   - Currently: Never retries
   - Should: useEffect with proper dependency chain allows retry

---

## 6. CODE SECTIONS THAT NEED FIXING

### Fix #1: useSocialData - Add auth dependency
**File:** [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts#L407-L475)

**Current:**
```tsx
useEffect(() => {
  const initializeSocialUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    // ...
  };
  initializeSocialUser();
}, []); // ❌ Empty deps
```

**Should Be:**
```tsx
useEffect(() => {
  let mounted = true;
  const initializeSocialUser = async () => {
    // Wait for auth to settle
    const { data: { user } } = await supabase.auth.getUser();
    if (!mounted) return;
    if (!user) {
      setIsLoading(false);
      setIsLoadingGroups(false);
      return;
    }
    // ... rest of initialization
  };
  initializeSocialUser();
  return () => { mounted = false; };
}, [userProfile]); // ✅ Add dependency on userProfile
```

---

### Fix #2: AppContext - Pass auth user to useSocialData
**File:** [src/contexts/AppContext.tsx](src/contexts/AppContext.tsx#L433)

**Current:**
```tsx
const socialData = useSocialData(userProfile);
//                                ^^^^^^^^^^^
// From profiles table, may be null when social_users needs to initialize
```

**Should Be:**
```tsx
const socialData = useSocialData(userProfile, user);
//                                          ^^^^
// Add authenticated user for timing guarantee
```

---

### Fix #3: useSocialData signature
**File:** [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts#L50-58)

**Current:**
```tsx
export const useSocialData = (
  userProfile: any,
  initialSortBy: SortBy = 'newest',
  // ...
) => {
```

**Should Be:**
```tsx
export const useSocialData = (
  userProfile: any,
  authUser?: any,  // Add authenticated user
  initialSortBy: SortBy = 'newest',
  // ...
) => {
```

---

### Fix #4: App.tsx or Index.tsx - Pass user to context
**File:** [src/pages/Index.tsx](src/pages/Index.tsx) or [src/App.tsx](src/App.tsx)

**Ensure AppProvider receives authenticated user info**

---

### Fix #5: Add Loading Boundary
**File:** [src/components/social/SocialFeed.tsx](src/components/social/SocialFeed.tsx#L183-200)

**Add guard:**
```tsx
if (!socialData.currentUser && socialData.isLoading) {
  return <LoadingSpinner />; // Don't show empty feed during init
}

if (!socialData.currentUser && !socialData.isLoading) {
  return <InitializationError />; // Show error after timeout
}
```

---

### Fix #6: Sidebar - Use social data instead of profile data
**File:** [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)

**Current:**
```tsx
const { fullName, avatarUrl } = props; // From profiles table
```

**Should Be:**
```tsx
const fullName = props.fullName || socialData?.currentUser?.display_name;
const avatarUrl = props.avatarUrl || socialData?.currentUser?.avatar_url;
```

---

## 7. COMPLETE INITIALIZATION CHAIN (After Fixes)

```
1. User logs in
   ↓
2. useAuth() detects auth state change → returns user
   ↓
3. useAppData(user) starts loading profiles table
   ↓
4. AppProvider calls: useSocialData(userProfile, user)
   ↓
5. useSocialData effect watches [userProfile, authUser]
   ↓
6. First runs: userProfile might be null, authUser is not
   → Uses authUser to fetch social_users
   → Creates if doesn't exist
   → Sets currentUser ✅
   ↓
7. Then runs again: userProfile loads
   → Syncs avatar/name if needed ✅
   ↓
8. currentUser now available ✅
   ↓
9. useEffect([currentUser]) triggers resetAndFetchData()
   ↓
10. Fetches posts, groups, trending, suggestions ✅
    ↓
11. SocialFeed receives socialData with all data populated ✅
    ↓
12. Sidebar shows correct user data ✅
```

---

## 8. VERIFICATION CHECKLIST

- [ ] `initializeSocialUser` has `[userProfile]` or `[authUser]` dependency
- [ ] Effect doesn't silently fail - has error handling
- [ ] `currentUser` is set in all code paths (not just create path)
- [ ] `currentUser` logged to console for debugging
- [ ] `resetAndFetchData` triggers when `currentUser` changes
- [ ] SocialFeed shows loading state while `currentUser` initializes
- [ ] Sidebar uses `socialData.currentUser` OR synced profile data
- [ ] No more null reference errors from missing `currentUser`
- [ ] Posts load after login (not stuck in loading state)
- [ ] User can create posts (needs currentUser)
- [ ] User profile displayed in left sidebar
- [ ] Avatar/name match across both sidebar and social profile tab

---

## 9. ROOT CAUSE SUMMARY

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| currentUser null | initializeSocialUser runs before auth completes | Feed empty |
| No re-initialization | Empty dependency array | User data never updates |
| Silent failures | No error handling in effect | Hard to debug |
| Sidebar mismatch | Uses profiles table instead of social_users | Wrong avatar shown |
| No guardrails | No validation of initialization status | Crashes in edge cases |

---

## 10. RECOMMENDED IMPLEMENTATION ORDER

1. **Phase 1:** Fix effect dependencies in useSocialData
2. **Phase 2:** Add error handling and retry logic
3. **Phase 3:** Pass authUser to useSocialData
4. **Phase 4:** Add loading boundaries in SocialFeed
5. **Phase 5:** Sync sidebar to use correct data source
6. **Phase 6:** Add debug logging and monitoring

---

## Files to Review/Fix

1. [src/hooks/useSocialData.ts](src/hooks/useSocialData.ts) - Add dependencies & error handling
2. [src/contexts/AppContext.tsx](src/contexts/AppContext.tsx) - Pass auth user to socialData hook
3. [src/components/social/SocialFeed.tsx](src/components/social/SocialFeed.tsx) - Add loading states
4. [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) - Use social user data
5. [src/hooks/useAppContext.ts](src/hooks/useAppContext.ts) - Add validation
6. [src/pages/Index.tsx](src/pages/Index.tsx) - Verify AppProvider usage

---

**This analysis provides the specific code lines and exact fixes needed to restore the data flow.**
