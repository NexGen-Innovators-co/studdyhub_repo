# Schema Analysis: User Verification & Activity Tracking

## 📊 Existing Tables & Their Purpose

### 1. **profiles** table (Educational/User Identity)
```
id → User UUID (auth.users.id)
role_verification_status → 'pending' | 'verified' | 'rejected' (EDUCATOR ROLE VERIFICATION)
role_verified_at → Timestamp when role was verified
role_verified_by → Admin who verified
user_role → 'student' | 'school_admin' | 'tutor_affiliated' | 'tutor_independent'
points_balance → Gamification points
referral_count → Number of referrals
onboarding_completed → Boolean
```

⚠️ **INSIGHT**: `profiles` is for educational/institutional role verification, NOT social verification

---

### 2. **social_users** table (Social Platform User)
```
id → User UUID (primary key for social features)
is_verified → Boolean (CURRENTLY UNUSED - WE WILL USE THIS!)
is_contributor → Boolean
status → Enum ('active' | 'suspended' | 'banned' | 'deactivated') [JUST ADDED]
last_active → Timestamp (already tracked!)
posts_count → Number of posts (auto-maintained)
followers_count → Number of followers (auto-maintained)
created_at → Account creation timestamp
updated_at → Last update timestamp
```

✅ **KEY INSIGHTS**:
- `last_active` already exists! Can be used for activity tracking
- `posts_count` and `followers_count` are already maintained
- `is_verified` field exists but is currently null/unused
- `status` enum we just added is perfect for account state
- **No `last_login_at` field** - only `last_active` exists

---

### 3. **achievements** table (Badge System - PERFECT!)
```
id → UUID
user_id → References profiles.id
badge_id → References badges.id
earned_at → Timestamp when earned
```

✅ **INSIGHT**: We can create a "verified_creator" badge and use the achievements table!

---

### 4. **badges** table (Badge Definitions)
```
id → UUID
name → Badge name (e.g., "verified_creator")
description → What it means
icon → Icon URL/name
requirement_type → How to earn it
requirement_value → Numeric threshold
xp_reward → XP gained
```

✅ **INSIGHT**: Create "verified_creator" badge here with metrics:
```json
{
  "name": "verified_creator",
  "requirement_type": "composite_metrics",
  "requirements": {
    "min_posts": 50,
    "min_followers": 500,
    "min_account_age_days": 30,
    "min_engagement_rate": 2.0,
    "max_violations": 0
  }
}
```

---

### 5. **social_posts** table (Content Analytics)
```
id → UUID
author_id → References social_users.id
created_at → Post creation time
likes_count → Total likes (auto-maintained)
comments_count → Total comments
shares_count → Total shares
views_count → Total views
```

✅ **INSIGHT**: We have aggregate counts! No need to count individual records every time

---

### 6. **social_likes** table (Engagement Tracking)
```
id → UUID
user_id → Who liked
post_id → Which post
comment_id → Which comment
created_at → When liked
```

✅ **INSIGHT**: Can calculate daily/monthly engagement from this

---

## 🎯 Recommended Architecture (Based on Schema)

### **Option A: Leverage Existing Achievements System** ✅ BEST
```
1. Create "verified_creator" badge in badges table
2. Use achievements table to track when user earns it
3. Check achievements JOIN badges in queries
4. Set is_verified = true when achievement earned
5. Keep is_verified as denormalized cache for performance
```

**Migration needed**:
- Add "verified_creator" badge
- Add function to check metrics and award badge
- Sync `is_verified` from achievements

---

### **Option B: Add Dedicated Verification Columns** (Hybrid)
```
Add to social_users:
- is_verified_achievement BOOLEAN DEFAULT false
- verified_creator_at TIMESTAMP
- verification_metrics JSONB (cache of metrics)
- last_login_at TIMESTAMP (currently using last_active)
```

---

## 📈 Available Metrics (NO ADDITIONAL QUERIES NEEDED!)

Since data is already aggregated in `social_users`:

```
✅ posts_count          → Total posts (auto-maintained)
✅ followers_count      → Total followers (auto-maintained)
✅ created_at           → Account age (exists)
✅ last_active          → Last activity (already tracked - rename to last_login_at?)
✅ is_contributor       → Already marked

Need to calculate:
📊 engagement_rate = (total_likes / total_posts) / followers_count * 100
📊 violation_count = (suspension + ban history)
```

---

## 🔍 Current Data Tracking Gaps

### **What we HAVE** ✅
- Account creation date (`created_at`)
- Last activity timestamp (`last_active`)
- Post count (`posts_count`)
- Follower count (`followers_count`)
- Engagement history (via `social_posts` and `social_likes`)
- Achievement badge system (`achievements` + `badges`)

### **What we NEED to ADD** ❌
- `last_login_at` (distinct from `last_active`)
- `is_online` boolean (real-time status)
- `current_session_started_at` (session tracking)
- `last_logout_at` (session end time)
- `verification_violations_count` (cache for performance)

---

## 🗄️ Recommended Migration

### **Option A: Minimal (Use Achievements System)**
```sql
-- Add to badges if not exists
INSERT INTO badges (name, description, requirement_type, xp_reward, icon)
VALUES (
  'verified_creator',
  'Achieved through consistent high-quality content and engagement',
  'composite_metrics',
  100,
  'verified-badge-icon'
);

-- Function to check eligibility
CREATE OR REPLACE FUNCTION check_creator_verification_eligibility(p_user_id UUID)
RETURNS BOOLEAN AS $$
-- Use existing social_users columns + social_likes for engagement
$$

-- Sync is_verified with achievements
UPDATE social_users su
SET is_verified = EXISTS(
  SELECT 1 FROM achievements a 
  JOIN badges b ON a.badge_id = b.id
  WHERE a.user_id = su.id AND b.name = 'verified_creator'
)
```

### **Option B: Comprehensive (New Fields + Achievements)**
```sql
-- Add session tracking
ALTER TABLE social_users ADD COLUMNS (
  last_login_at TIMESTAMP,
  last_logout_at TIMESTAMP,
  current_session_started_at TIMESTAMP,
  is_online BOOLEAN DEFAULT false,
  verification_violations_count INT DEFAULT 0
);

-- Then add achievement sync as above
```

---

## 📋 Migration Recommendation

**I recommend OPTION A (Minimal)** because:

1. ✅ Achievements system already exists
2. ✅ You already have posts_count, followers_count
3. ✅ Badges provide a reusable achievement framework
4. ✅ You can use `last_active` for current activity (just rename if needed)
5. ✅ Minimal schema changes = less risk
6. ✅ Can add `last_login_at` later if needed for detailed analytics

**Migration steps**:
1. Add "verified_creator" badge definition
2. Create eligibility check function
3. Create scheduled task to check + award badge daily
4. Sync `is_verified` from achievements table
5. Update UI to show badge
6. (Optional) Add `last_login_at`, `is_online` columns in Phase 2

---

## 🎨 UI Display Logic

```tsx
// Show Verified Creator Badge
{profileUser.is_verified && (
  <Badge className="bg-blue-100 text-blue-700">✓ Verified Creator</Badge>
)}

// Show Account Status
<Badge variant={getStatusColorVariant(profileUser.status)}>
  {profileUser.status}
</Badge>

// Admin: Show Last Activity
Last seen: {new Date(profileUser.last_active).toLocaleDateString()}

// Admin: Show Metrics Cache
{profileUser.verification_metrics && (
  <div>
    Posts: {profileUser.verification_metrics.posts}
    Followers: {profileUser.verification_metrics.followers}
    Engagement: {profileUser.verification_metrics.engagement}%
  </div>
)}
```

---

## ✅ Next Steps

**Before migration, confirm**:
1. Should we use badges system for "verified_creator"?
2. Do you want `last_login_at` separate from `last_active`?
3. Do you want real-time `is_online` status?
4. Should verification be auto-awarded daily or user-initiated check?

**My recommendation**: Start with Option A (minimal, leverage achievements), add session tracking (Option B) in Phase 2 if needed.

Ready to proceed?
