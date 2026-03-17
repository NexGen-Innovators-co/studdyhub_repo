# Post-Purge Social Feed Bug: Investigation & Fix Guide

**Issue:** After purging a user, when visiting their profile, you see OTHER users' posts instead of the purged user's posts, and the feed continuously fetches as you scroll.

**Status:** 🔴 CRITICAL - Data integrity issue

---

## 📋 Investigation Checklist

### Step 1: Verify Purge Actually Worked
```sql
-- Run: sql/20260317_diagnose_social_feed_issue.sql
-- Check if purged user's posts are actually deleted from database
```

**Possible Outcomes:**
- ✅ **Good:** Posts are deleted (0 rows) → Issue is in UI/RLS
- ❌ **Bad:** Posts still exist → CASCADE delete didn't work

**If posts still exist after purge:**
- Check if CASCADE constraint was actually applied to social_posts
- May need to manually delete orphaned records first
- Then re-run CASCADE migration

---

### Step 2: Check Browser Cache

The UI might be showing cached posts from before purge.

**In Chrome DevTools:**
1. Open DevTools (F12)
2. Network tab → filter "get-social-feed"
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard refresh profile page (Ctrl+F5)
5. Check if same posts appear

**If posts disappear after cache clear:**
- Issue is caching, not database
- Fix: Add cache-busting headers to get-social-feed endpoint

---

### Step 3: Check get-social-feed Logic

The RPC function might have bugs in the query logic.

**Key issues found:**

#### Bug #1: User Mode Doesn't Filter by User ID
```typescript
// supabase/functions/get-social-feed/index.ts (line 404)
if (mode === 'user') {
  query = query.eq('author_id', userId)  // ← Should be MODE param, not userId!
}
```

**Problem:** The mode checks for `mode === 'user'` but should distinguish between:
- Viewing MY posts (filter by auth.uid())
- Viewing ANOTHER user's posts (filter by requested userId)

**Hypothesis:** The function is returning all posts instead of filtered posts for the profile user.

#### Bug #2: RLS Policy too Permissive
```sql
-- Current RLS (20260210_comprehensive_rls_hardening.sql line 379)
CREATE POLICY social_posts_select_auth ON public.social_posts FOR SELECT
  USING (auth.role() = 'authenticated');
-- ↑ This allows ANY authenticated user to see ALL posts
-- Privacy filtering relies on app level (which has bugs)
```

#### Bug #3: Infinite Scroll Cursor Logic
The `cursor` parameter (for pagination in infinite scroll) might be:
- Not advancing correctly
- Looping to same results
- Fetching duplicate results

---

### Step 4: Check Profile Component

The UI component showing posts might be:
- Using wrong user ID
- Caching old user data
- Not updating when profile changes

**File to check:** `src/components/social/UserProfile.tsx` or similar

---

## 🔧 Quick Fixes (In Order of Likelihood)

### Fix #1: Clear Cache (Fastest)
```bash
# Client-side cache clear
# Open DevTools → Application → Storage → Clear All

# Server-side cache clear
# If using Redis or similar, clear key: `social-feed:*`
```

**Expected:** If issue goes away, it's a caching problem

---

### Fix #2: Hard Refresh Profile After Purge
```javascript
// In admin panel after purge:
window.location.href = '/'; // Go to homepage
window.location.reload(true); // Hard refresh
// Wait a few seconds
// Then navigate back to profile
```

---

### Fix #3: Fix Infinite Scroll Cursor Logic

**Location:** `supabase/functions/get-social-feed/index.ts`

**Current problematic code:**
```typescript
for (let i = 0; i < requests.length; i++) {
  const { data, error } = await supabase
    .from('social_posts')
    .select(...)
    .limit(limit)
    .offset(offset + i * limit); // ← Offset-based pagination is inefficient
}
```

**Problem:** Offset-based pagination:
- Gets slower as you scroll (fetches all previous rows)
- Can skip/duplicate rows if data changes between requests
- Returns same results in infinite scroll

**Better approach:**
```typescript
// Use cursor-based pagination (created_at timestamp)
if (cursor) {
  query = query.lt('created_at', cursor);
}
query = query.order('created_at', { ascending: false })
  .limit(limit + 1); // Fetch one extra to check if more exist

// Return last item as next cursor
const nextCursor = results.length > limit ? results[limit].created_at : null;
```

---

### Fix #4: Fix get-social-feed User Mode

**Location:** `supabase/functions/get-social-feed/index.ts` (lines 404-410)

**Current:**
```typescript
if (mode === 'user') {
  query = query.eq('author_id', userId)
    .order('created_at', { ascending: false });
  // NO privacy check!
}
```

**Should be:**
```typescript
if (mode === 'user') {
  // userId is the profile owner, auth.uid() is the viewer
  const isOwnProfile = auth.uid() === userId;
  
  query = query.eq('author_id', userId);
  
  if (!isOwnProfile) {
    // Only show public posts to other users
    query = query.eq('privacy', 'public');
  }
  // If own profile, show all: public + followers + private
  
  query = query.order('created_at', { ascending: false });
}
```

---

## 🧪 Testing Steps

### Test 1: Verify Purge Deleted Posts
```sql
-- Note the purged user UUID
-- Run diagnostic query
SELECT COUNT(*) FROM social_posts 
WHERE author_id = 'purged-user-uuid';
-- Expected: 0
```

### Test 2: Check Profile Shows No Posts
```javascript
// In browser console on profile page:
const posts = document.querySelectorAll('[data-testid="social-post"]');
console.log('Posts visible:', posts.length); // Should be 0
```

### Test 3: Verify No Orphaned Records
```sql
-- Check for social posts with deleted authors
SELECT COUNT(*) FROM social_posts sp
WHERE sp.author_id NOT IN (SELECT id FROM social_users);
-- Expected: 0
```

### Test 4: Pagination Works Correctly
```javascript
// Open DevTools Network tab
// Scroll down on feed
// Check get-social-feed requests
// Should show DIFFERENT posts each request, NOT duplicates
```

---

## 🔍 Root Cause Assessment

### Most Likely Scenario (60% probability)
**Cache Issue:** Browser is showing cached posts from before purge
- **Fix:** Clear browser cache + hard refresh
- **Time to fix:** < 1 minute
- **Evidence:** Posts disappear after F5 with cache clear

### Second Most Likely (30% probability)
**Infinite Scroll Bug:** Pagination cursor is broken, showing same posts repeatedly
- **Fix:** Replace offset-based pagination with cursor-based
- **Time to fix:** 1-2 hours (code change + test)
- **Evidence:** Same posts appear multiple times as you scroll

### Least Likely (10% probability)
**Purge Incomplete:** CASCADE delete didn't work
- **Fix:** Run diagnostic, recover missing profiles, then delete orphans
- **Time to fix:** 30 minutes
- **Evidence:** Purged user's posts still exist in DB

---

## 📝 Step-by-Step Action Plan

1. **FIRST:** Run diagnostic query to check if posts deleted
   ```bash
   # Paste into Supabase SQL Editor:
   sql/20260317_diagnose_social_feed_issue.sql
   ```

2. **SECOND:** Clear browser cache and hard refresh
   ```bash
   # DevTools → Application → Storage → Clear All
   # OR: Ctrl+Shift+Delete
   # Then: Ctrl+F5 on profile page
   ```

3. **THIRD:** If still showing posts:
   - Check if infinite scroll is fetching duplicates (Network tab)
   - Review get-social-feed function logic
   - Check RLS policies

4. **FOURTH:** If database still has posts:
   - Verify CASCADE constraint exists
   - Check if orphaned records exist
   - May need manual cleanup

5. **FIFTH:** Apply fixes in order of likelihood

---

## 🎯 Expected Final State

After fixes:
```
✅ Purged user's profile shows 0 posts
✅ Scrolling doesn't cause continuous fetches
✅ No orphaned social records
✅ Cache headers prevent future issues
✅ RLS + app-level filter work together
```

---

## 📊 Monitoring

After fix, monitor:
```sql
-- Daily check for orphaned records
SELECT COUNT(*) FROM social_posts sp
WHERE sp.author_id NOT IN (SELECT id FROM social_users);
-- Alert if > 0

-- Check for duplicate posts in feed
SELECT content, COUNT(*) FROM social_posts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY content
HAVING COUNT(*) > 5;
-- Alert if duplicates appear
```

---

## 💡 Prevention

Add to CASCADE migration plan:
1. Add FK constraint verification tests
2. Test purge with real user + real data
3. Add infinite scroll integration tests
4. Move privacy enforcement to RLS (not app level)
5. Add monitoring for orphaned records post-deployment
