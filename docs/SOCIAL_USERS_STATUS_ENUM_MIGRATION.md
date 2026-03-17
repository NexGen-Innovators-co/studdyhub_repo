## Social Users Status Enum Migration - Impact Analysis

### Current State
- `social_users.is_verified: boolean | null` is being misused as an "account active" flag
- When admin activates user → sets `is_verified = true`
- When admin suspends user → sets `is_verified = false`
- Frontend displays "Verified" badge when `is_verified = true`

### Proposed Change
Replace `is_verified` (boolean) with `status` enum:
```sql
CREATE TYPE social_user_status AS ENUM ('active', 'suspended', 'banned', 'deactivated');
```

---

## 📍 AFFECTED AREAS - HIGH PRIORITY

### 1. **UserManagement Component**
**File:** `src/components/admin/UserManagement.tsx`

**Usage Patterns:**
- Line 165-173: Toggle activation logic
  ```ts
  .update({ is_verified: makeActive }) // becomes status: 'active' | 'suspended'
  ```
- Line 249-250: Filter by status
  ```ts
  (filterStatus === 'active' && u.is_verified) ||
  (filterStatus === 'suspended' && !u.is_verified)
  // becomes
  (filterStatus === 'active' && u.status === 'active') ||
  (filterStatus === 'suspended' && u.status === 'suspended')
  ```
- Line 329: Badge display
  ```tsx
  <Badge variant={u.is_verified ? 'default' : 'destructive'}>
    {u.is_verified ? 'Active' : 'Suspended'}
  </Badge>
  // becomes
  <Badge variant={getStatusVariant(u.status)}>
    {u.status}
  </Badge>
  ```
- Line 460: Suspend dialog label
  ```tsx
  {selectedUser?.is_verified ? 'Suspend' : 'Activate'}
  // becomes
  {selectedUser?.status === 'active' ? 'Suspend' : 'Activate'}
  ```

**Changes Required:** 7-10 modifications

---

### 2. **ReportsManagement Component**
**File:** `src/components/admin/ReportsManagement.tsx`

**Usage Pattern:**
- Line 200: User banning/suspension
  ```ts
  .update({ is_verified: false }) // becomes status: 'banned'
  ```
- Opportunity: Can now differentiate between `'suspended'` (admin action) vs `'banned'` (moderation action)

**Changes Required:** 1-2 modifications

---

### 3. **Social UI Components (User Verification Badge)**

#### a. UserProfile.tsx
**File:** `src/components/social/components/UserProfile.tsx`
- Line 454: Badge display
  ```tsx
  {profileUser.is_verified && <Badge>Verified</Badge>}
  // becomes
  {profileUser.status === 'active' && <Badge>Verified</Badge>}
  ```

#### b. SuggestedUsers.tsx
**File:** `src/components/social/components/SuggestedUsers.tsx`
- Line 221: Badge/indicator display
  ```tsx
  {user.is_verified && <CheckIndicator />}
  // becomes
  {user.status === 'active' && <CheckIndicator />}
  ```

#### c. PostCard.tsx
**File:** `src/components/social/components/PostCard.tsx`
- Lines 837, 1062: Verified checkmark on author name
  ```tsx
  {(post.author as any)?.is_verified && <Check />}
  // becomes
  {(post.author as any)?.status === 'active' && <Check />}
  ```

#### d. Recommendation.ts
**File:** `src/components/social/utils/Recomendation.ts`
- Line 55, 93: User ranking boosting
  ```ts
  if (candidate.is_verified) score += VERIFIED_BOOST
  // becomes
  if (candidate.status === 'active') score += VERIFIED_BOOST
  ```

**Changes Required:** 6-8 modifications

---

### 4. **Type Definitions**

#### a. Database Types
**File:** `src/integrations/supabase/types.ts`
- Lines 4705-4763: `social_users` table definition
  ```ts
  is_verified: boolean | null → status: Database['public']['Enums']['social_user_status']
  ```
- Requires enum import/definition in types file

#### b. Social Types
**File:** `src/integrations/supabase/socialTypes.ts`
- Line 12: `SocialUser` interface
  ```ts
  is_verified: boolean → status: 'active' | 'suspended' | 'banned' | 'deactivated'
  ```

**Changes Required:** 2 files

---

### 5. **Other Components/Services**

#### a. SEO Handler API
**File:** `api/seo/[type]/[id].js`
- Line 92, 113: Social data serialization
  ```js
  isVerified: user.is_verified → statusIsActive: user.status === 'active'
  ```

#### b. Schema Documentation
**File:** `supabase/functions/gemini-chat/db_schema.ts`
- Line 695: DB schema documentation
  ```ts
  - is_verified: boolean → - status: 'active' | 'suspended' | 'banned' | 'deactivated'
  ```

**Changes Required:** 2 modifications

---

## 🔄 SCALABILITY CONSIDERATIONS

### Future Status Values Already Planned:
1. `active` - Normal user account
2. `suspended` - Admin suspension (can be re-activated)
3. `banned` - Moderation ban (permanent or temporary)
4. `deactivated` - User self-deactivation

### Additional Future Features Enabled:
- **Temporary bans** with expiration timestamps
- **Suspension categories** (content violation, spam, etc.)
- **Ban history tracking** in admin_activity_logs
- **Different UI treatments** per status

### Integration Points for Future Enhancement:
- Create `user_status_history` table for audit trail
- Add `status_changed_at` and `status_changed_by` to `social_users`
- Implement ban expirations with scheduled tasks
- Create RLS policies that check `status` for content visibility

---

## 📊 SUMMARY OF CHANGES

| Component | Type | Location | Changes |
|-----------|------|----------|---------|
| UserManagement | Component | src/components/admin/ | 7-10 |
| ReportsManagement | Component | src/components/admin/ | 1-2 |
| UserProfile | Component | src/components/social/ | 1 |
| SuggestedUsers | Component | src/components/social/ | 1 |
| PostCard | Component | src/components/social/ | 2 |
| Recommendation | Utility | src/components/social/utils/ | 2 |
| types.ts | Types | src/integrations/supabase/ | 1 |
| socialTypes.ts | Types | src/integrations/supabase/ | 1 |
| SEO API | API | api/seo/ | 1 |
| DB Schema Docs | Documentation | supabase/functions/ | 1 |

**Total Changes: ~20-25 modifications**

---

## 🗂️ MIGRATION STEPS (When Ready)

1. **Create enum in Supabase** (Migrations)
   - Add `social_user_status` enum type
   - Add `status` column to `social_users`

2. **Data Migration**
   - `is_verified = true` → `status = 'active'`
   - `is_verified = false` → `status = 'suspended'`
   - `is_verified = null` → `status = 'active'` (default)

3. **Update Database Types**
   - Regenerate `src/integrations/supabase/types.ts`
   - Update `src/integrations/supabase/socialTypes.ts`

4. **Update Components** (in order of dependency)
   - Type files first
   - Admin components
   - Social UI components
   - API/Utilities

5. **Testing**
   - Admin activation/suspension
   - User filtering
   - Badge display
   - Report handling with bans

6. **Cleanup** (after 1-2 weeks verification)
   - Remove `is_verified` column from `social_users`
   - Remove deprecated code branches

---

## ⚠️ BACKWARD COMPATIBILITY NOTES

- The boolean `is_verified` field will be replaced (not removed immediately)
- Frontend can use a utility function for gradual transition:
  ```ts
  function getUserStatus(user: any): 'active' | 'suspended' {
    return user.status ?? (user.is_verified ? 'active' : 'suspended')
  }
  ```
- This allows deploying frontend changes before the migration completes

