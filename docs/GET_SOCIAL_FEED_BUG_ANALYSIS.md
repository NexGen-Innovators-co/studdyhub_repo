# GET-SOCIAL-FEED Flow Trace & Bug Root Cause

## 🔍 Issue Timeline

1. **User Purged** → All their posts CASCADE deleted ✓
2. **Visit Purged User's Profile** → Shows OTHER users' posts ❌
3. **Create One Post for User** → Shows ONLY that post ✓

This suggests the fallback logic is kicking in when it shouldn't.

---

## 📋 Get-Social-Feed Function Flow

**File:** `supabase/functions/get-social-feed/index.ts`

### Step 1: Extract Parameters (Line 280-303)
```typescript
const body = await req.json();
const {
  mode = 'feed',         // 'feed' | 'trending' | 'user' | 'liked' | 'bookmarked'
  sortBy = 'newest',     // 'newest' | 'popular'
  feedMode = 'all',      // 'for-you' | 'following' | 'my-school' | 'my-level' | 'my-subjects' | 'all'
  cursor = null,         // ISO timestamp for pagination
  limit = 15,
  viewedPostIds = [],
  excludeIds = [],
} = body;
```

**For profile view, the request is:**
```json
{
  "mode": "user",
  "userId": "purged-user-id"  // The UUID of the profile being viewed
}
```

---

### Step 2: Route to Correct Mode (Line 308 onwards)

```typescript
if (mode === 'liked') {
  // ... handle liked posts
} else if (mode === 'bookmarked') {
  // ... handle bookmarked posts
} else {
  // Feed / Trending / User modes
  let query = supabase
    .from('social_posts')
    .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`);

  if (mode === 'user') {
    // STEP 3A: USER MODE (Viewing a profile)
    query = query.eq('author_id', userId)  // ← Filter to this user's posts only!
      .order('created_at', { ascending: false });
    
    if (cursor) {
      query = query.lt('created_at', cursor);
    }
```

**Expected Query:**
```sql
SELECT * FROM social_posts 
WHERE author_id = 'purged-user-id' 
ORDER BY created_at DESC;
```

**After purge:** Returns 0 rows ✓ (All posts deleted)

---

### Step 3B: Fetch the Data (Line 482-494)

```typescript
const actualFetchLimit = mode === 'trending' ? Math.max(100, fetchLimit) : fetchLimit;
const { data, error } = await query.limit(actualFetchLimit);
if (error) throw error;
postsData = data || [];  // ← Empty array! 0 rows
```

**Status:** `postsData = []`

---

### ⚠️ STEP 4: THE BUG - Fallback Logic (Line 499-513)

```typescript
// ← THIS IS THE CULPRIT!
if (postsData.length === 0) {
  const { data: fallback, error: fbErr } = await supabase
    .from('social_posts')
    .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`)
    .eq('privacy', 'public')
    .neq('author_id', userId)  // ← Fetch posts from OTHER users!
    .order('created_at', { ascending: false })
    .limit(fetchLimit);
  
  if (!fbErr && fallback && fallback.length > 0) {
    postsData = fallback;  // ← Now postsData has OTHER USERS' POSTS! 🔴
  }
}
```

**What it does:**
1. Checks if postsData is empty
2. If empty, runs fallback query: `WHERE privacy='public' AND author_id != userId`
3. Returns OTHER USERS' public posts as if they belong to the purged user

**Query executed:**
```sql
SELECT * FROM social_posts 
WHERE privacy = 'public' 
  AND author_id != 'purged-user-id'  -- ALL OTHER USERS!
ORDER BY created_at DESC;
```

**Result:** Shows different users' posts on the purged user's profile ❌

---

## 🎯 Why It Works With One Post

When user creates ONE post:
1. Initial query: `WHERE author_id = 'purged-user-id'` → Returns 1 row ✓
2. `postsData.length === 1` → Condition is `FALSE`
3. Fallback doesn't trigger ✓
4. Shows only that user's post ✓

---

## 🔴 The Root Cause

The fallback logic at **line 499** applies to ALL modes, but should ONLY apply to:
- `mode === 'feed'` → When trending fails, show fallback public posts
- `mode === 'trending'` → When trending is too empty, show fallback

It should NEVER apply to:
- `mode === 'user'` → Show empty state, not other users' posts!
- `mode === 'bookmarked'` → Show empty state, not other users' posts!
- `mode === 'liked'` → Show empty state, not other users' posts!

---

## 📊 Bug Flow Diagram

```
User visits: /profile/purged-user-id
     ↓
Frontend calls: get-social-feed({ mode: 'user', userId: 'purged-user-id' })
     ↓
Line 410: query = query.eq('author_id', 'purged-user-id')
     ↓
Line 482: postsData = await query → Returns [] (0 rows)
     ↓
Line 499: if (postsData.length === 0) { // ← TRUE!
     ↓
Line 502: Fallback query: WHERE privacy='public' AND author_id != 'purged-user-id'
     ↓
Line 511: postsData = fallback → Returns OTHER USERS' posts ❌
     ↓
Line 580: Return { posts: [user1, user2, user3, ...] } // ← WRONG USERS!
     ↓
Frontend displays OTHER USERS' posts on purged user's profile ❌
```

---

## 🔧 The Fix

**Location:** `supabase/functions/get-social-feed/index.ts` line 499

**Current (BUGGY):**
```typescript
if (postsData.length === 0) {
  // Fallback applies to ALL modes
  const { data: fallback, error: fbErr } = await supabase
    .from('social_posts')
    .select(...)
    .eq('privacy', 'public')
    .neq('author_id', userId)
    ...
}
```

**Should be:**
```typescript
// ONLY apply fallback to feed/trending modes, not user/bookmarked/liked
if (postsData.length === 0 && (mode === 'feed' || mode === 'trending')) {
  const { data: fallback, error: fbErr } = await supabase
    .from('social_posts')
    .select(...)
    .eq('privacy', 'public')
    .neq('author_id', userId)
    ...
}
// For other modes (user, bookmarked, liked), return empty result
```

---

## 🧪 Testing the Fix

### Test 1: Empty User Profile
```
1. Create user A
2. Purge user A (no posts)
3. Visit profile of user A
4. Expected: "No posts" or empty state
5. Before fix: Shows other users' posts ❌
6. After fix: Shows empty ✓
```

### Test 2: User With Posts
```
1. Create user B with 5 posts
2. Visit profile of user B
3. Expected: Shows only user B's 5 posts
4. Before fix: Works (fallback not triggered) ✓
5. After fix: Still works ✓
```

### Test 3: Feed Mode (Should Use Fallback)
```
1. User has no follows, feeds empty
2. View 'feed' mode with 'all' feedMode
3. Expected: Shows fallback public posts
4. Before fix: Shows fallback ✓
5. After fix: Still shows fallback ✓
```

---

## 📝 Continuous Fetches (Secondary Issue)

The infinite scroll issue (requests at line 546) is likely related:

```typescript
const allPostsByDate = postsData.slice(0, limit).sort(...)
const nextCursor = allPostsByDate.length > 0 
  ? allPostsByDate[0].created_at  // ← Oldest post = cursor for next fetch
  : null;
```

If the fallback is returning the same public posts repeatedly:
- Client fetches with no cursor → Gets OTHER USERS' posts
- Client scrolls → Uses created_at as cursor for next fetch
- Falls fetch again → Gets SAME other users' posts again
- Loop continues → Infinite fetching of same posts

**This explains the 15.4 kB responses repeating!**

Fix would also stop continuous fetches.

---

## 📋 Complete Fix Required

**File:** `supabase/functions/get-social-feed/index.ts`

**Lines:** 499-513

**Change:** Add mode check before applying fallback
