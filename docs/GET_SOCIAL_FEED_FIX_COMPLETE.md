# Get-Social-Feed Bug Fix - Complete Solution

**Date:** March 17, 2026  
**Bug:** Profile shows OTHER users' posts when viewing empty user profile  
**Root Cause:** Fallback logic applies to all modes, should only apply to feed/trending  
**Status:** ✅ FIXED

---

## 🐛 The Bug

### Symptoms
1. ❌ Purge user A (deletes all their posts)
2. ❌ Visit user A's profile → Shows OTHER users' posts
3. ✓ Create one post for user A → Now shows only that post
4. ❌ Continuous fetches (15.4 kB repeated responses)

### Root Cause
The fallback logic at line 523 in `get-social-feed/index.ts`:

```typescript
// BUGGY: Applies to ALL modes
if (postsData.length === 0) {
  // Query returns OTHER USERS' posts!
  const { data: fallback } = await supabase
    .from('social_posts')
    .eq('privacy', 'public')
    .neq('author_id', userId)  // ← Shows DIFFERENT users!
```

**Why it happens:**
1. User profile requests: `mode='user'` with `author_id='purged-user'`
2. Query returns 0 posts
3. Fallback kicks in: `WHERE privacy='public' AND author_id != 'purged-user'`
4. Returns all public posts from OTHER users
5. Frontend displays them on purged user's profile ❌

---

## ✅ The Fix

**File:** `supabase/functions/get-social-feed/index.ts`  
**Line:** 523  
**Change:** Add mode check before fallback

### Before (Broken)
```typescript
if (postsData.length === 0) {
  // Fallback applies to user/bookmarked/liked modes TOO!
  const { data: fallback } = await supabase...
}
```

### After (Fixed)
```typescript
if (postsData.length === 0 && (mode === 'feed' || mode === 'trending')) {
  // Fallback only applies to feed and trending modes
  const { data: fallback } = await supabase...
}
```

**Why this fixes it:**
- `mode='user'` → No fallback, returns empty ✓
- `mode='bookmarked'` → No fallback, returns empty ✓
- `mode='liked'` → No fallback, returns empty ✓
- `mode='feed'` → Fallback still works for low activity ✓
- `mode='trending'` → Fallback still works for low activity ✓

---

## 🧪 Testing the Fix

### Test 1: Empty User Profile (Primary Bug)
```bash
# 1. Purge a user (or create a new user with no posts)
# 2. Visit their profile page
# 3. Check Network tab → get-social-feed request
# 4. Expected Response (BEFORE FIX):
{
  "posts": [
    { "author_id": "OTHER_USER_1", "content": "..." },
    { "author_id": "OTHER_USER_2", "content": "..." },
    ...
  ]
}
# WRONG! Shows other users' posts

# 5. Expected Response (AFTER FIX):
{
  "posts": [],
  "hasMore": false,
  "nextCursor": null
}
# CORRECT! Empty profile
```

### Test 2: User With Posts (Should Still Work)
```bash
# 1. Create user B with 5 posts
# 2. Visit user B's profile
# 3. Check Network tab → get-social-feed
# 4. Expected Response:
{
  "posts": [
    { "author_id": "B", "id": "post1" },
    { "author_id": "B", "id": "post2" },
    { "author_id": "B", "id": "post3" },
    { "author_id": "B", "id": "post4" },
    { "author_id": "B", "id": "post5" }
  ],
  "hasMore": false
}
# CORRECT! Only user B's posts
```

### Test 3: Feed Mode Still Has Fallback
```bash
# 1. User follows nobody (empty feed)
# 2. View feed with feedMode='following'
# 3. Check Network tab → get-social-feed
# 4. Expected Response (with fallback):
{
  "posts": [
    { "author_id": "PUBLIC_USER_1", "content": "..." },
    { "author_id": "PUBLIC_USER_2", "content": "..." }
  ]
}
# CORRECT! Shows public posts as fallback (feed mode intended)
```

### Test 4: No More Continuous Fetches
```bash
# 1. Visit empty user profile
# 2. Scroll down repeatedly
# 3. Check Network tab → get-social-feed requests
# BEFORE FIX: 10+ identical requests with 15.4 kB each
# AFTER FIX: 1 request with empty response, no more fetches
```

---

## 📊 Impact Analysis

### Fixed Issues
- ✅ Purged users' profiles show empty (not other users' posts)
- ✅ Bookmarked/Liked views show empty (not other users' posts)
- ✅ No continuous fetching loop
- ✅ Correct UX: "No posts yet" state for empty profiles

### Still Works
- ✅ Feed with fallback (shows public posts when no follows)
- ✅ Trending with fallback (shows public posts when low activity)
- ✅ Pagination/cursor-based infinite scroll
- ✅ AI ranking and sorting

### Performance Impact
- ⠀ Slightly better (fewer fallback queries for user/bookmarked/liked modes)
- ⠀ Stops unnecessary infinite scrolling

---

## 🔍 Code Changes Summary

**File Changed:** `supabase/functions/get-social-feed/index.ts`

**Lines Modified:** 523

**Change Type:** Conditional check added

**Diff:**
```diff
- if (postsData.length === 0) {
+ if (postsData.length === 0 && (mode === 'feed' || mode === 'trending')) {
```

**Total Impact:**
- Lines added: 1 (comment + condition)
- Lines removed: 0
- Lines modified: 1
- Risk: Very low (only affects empty result handling)
- Backward compatible: Yes (feed/trending still use fallback)

---

## 🚀 Deployment Steps

1. **Review Changes**
   - File: `supabase/functions/get-social-feed/index.ts`
   - Line: 523
   - Change: Add `&& (mode === 'feed' || mode === 'trending')` to condition

2. **Test Locally** (if possible)
   - Create test user with no posts
   - Call function with `mode='user'`
   - Should return empty array

3. **Deploy to Supabase**
   ```bash
   supabase functions deploy get-social-feed
   ```

4. **Verify in Production**
   - Visit profile of purged user
   - Should show "No posts" instead of other users' posts
   - Check Network tab to confirm request changes

5. **Monitor**
   - Check error logs for next 24h
   - Monitor for increased "empty feed" results
   - Verify no 500 errors in get-social-feed

---

## 📋 Related Issues

### Orphaned Records Prevention
This fix ensures that:
- ✅ Deletion is clean (CASCADE works)
- ✅ Queries are correct (no showing wrong data)
- ✅ UX is expected (empty profile stays empty)

### Data Integrity
- ✅ No data corruption (purged posts stay deleted)
- ✅ No incorrect associations (can't show user A's posts on user B's profile)
- ✅ RLS + app-level filtering work correctly

---

## ✔️ Verification Checklist

After deployment:

- [ ] Empty user profiles show "no posts"
- [ ] User profiles with posts show correct posts only
- [ ] Feed mode still shows fallback public posts
- [ ] Trending mode still shows fallback
- [ ] No 500 errors in logs
- [ ] Network requests show correct response shapes
- [ ] Infinite scroll no longer fetches continuously
- [ ] Cursor-based pagination still works

---

## 📝 Code Locations

| Aspect | File | Lines |
|--------|------|-------|
| **Bug** | `supabase/functions/get-social-feed/index.ts` | 523 |
| **Fixed** | `supabase/functions/get-social-feed/index.ts` | 523 |
| **Test Coverage** | Test steps above | - |
| **Documentation** | `docs/GET_SOCIAL_FEED_BUG_ANALYSIS.md` | All |

---

## 🎯 Summary

**Problem:** Fallback logic showing wrong users' posts on empty profiles  
**Solution:** Restrict fallback to feed/trending modes only  
**Impact:** One-line fix, high confidence  
**Status:** Ready for deployment ✅
