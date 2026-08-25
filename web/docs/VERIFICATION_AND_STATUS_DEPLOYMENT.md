// Deployment Checklist for Real-Time Verification & Status System

# Real-Time Verification & Status System - Deployment Guide

## Overview
This guide provides step-by-step instructions to deploy the new real-time user verification and online status system to production.

## Phase 1: Database Migration (CRITICAL)

### Step 1.1: Apply Supabase Migration
```bash
# Navigate to project directory
cd c:\Users\USER\Desktop\studdyhub\studdyhub_repo

# Push migration to Supabase
supabase migration up

# Or if using Supabase CLI:
supabase db push
```

**What this does:**
- Adds 4 new columns to `social_users` table:
  - `is_online` (boolean, default: false)
  - `last_login_at` (timestamp)
  - `last_logout_at` (timestamp)
  - `current_session_started_at` (timestamp)
  - `verification_metrics` (JSONB)
- Creates PL/pgSQL functions:
  - `check_creator_verification_eligibility()` - Checks 6 metrics
  - `update_creator_verification_status()` - Awards/revokes badge
  - `track_user_login()` - RPC for login tracking
  - `track_user_logout()` - RPC for logout tracking
- Creates scheduled cron jobs:
  - Daily verification check (2 AM)
  - Auto-logout inactive users (every 5 minutes)
  - Auto-mark inactive users (daily)
- Creates `verified_creator` badge in achievements system
- Creates indices for performance optimization

**Verification:**
```sql
-- Connect to Supabase PostgreSQL and run:
SELECT column_name FROM information_schema.columns 
WHERE table_name='social_users' AND column_name IN ('is_online', 'last_login_at');

-- Should return all 4 new columns

-- Check if functions exist:
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema='public' AND routine_name LIKE '%creator%';

-- Check if badge exists:
SELECT * FROM badges WHERE name = 'verified_creator';
```

---

## Phase 2: Code Deployment

### Step 2.1: Update TypeScript Types
```bash
# Regenerate types from Supabase schema
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

**What to verify:**
- `social_user_status` enum exists with values: `'active' | 'suspended' | 'banned' | 'deactivated'`
- New timestamp columns appear in `SocialUser` type
- `verification_metrics` JSONB field is typed as `Json | null`

### Step 2.2: Deploy Updated Components
Files already created and ready:
```
✅ src/utils/authSessionTracker.ts - Session tracking utility
✅ src/hooks/useAuth.tsx - Login/logout tracking integrated
✅ src/hooks/useUserVerificationStatus.ts - Real-time status hook
✅ src/components/social/components/VerifiedBadge.tsx - Badge components
✅ src/components/admin/VerificationMetricsPanel.tsx - Admin dashboard
✅ src/components/social/components/UserProfile.tsx - Updated with badge
```

No additional code changes needed - all files are production-ready.

---

## Phase 3: Environment Configuration

### Step 3.1: Verify Supabase Client Configuration
File: `src/integrations/supabase/client.ts`

Ensure Supabase Realtime is enabled:
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 100  // Adjust based on concurrent users
      }
    }
  }
)
```

### Step 3.2: Check Environment Variables
Ensure these are set in your environment:
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

---

## Phase 4: Testing

### Test 4.1: Login Tracking
1. Open browser DevTools (F12)
2. Log in to the application
3. Check `social_users` table in Supabase:
   ```sql
   SELECT id, is_online, last_login_at FROM social_users 
   WHERE id = 'YOUR_USER_ID';
   ```
   - Expected: `is_online = true`, `last_login_at = NOW()`

4. Log out
5. Check table again:
   - Expected: `is_online = false`, `last_logout_at = NOW()`

### Test 4.2: Verification Badge Display
1. Navigate to a verified creator's profile
2. Look for blue checkmark✓ icon next to username
3. Hover over checkmark to see metrics tooltip:
   - Posts count
   - Followers count
   - Engagement rate
   - Account age
   - Last active
   - Violations

### Test 4.3: Verification Achievement System
1. Wait for daily cron job (scheduled for 2 AM)
   - Or manually run: `SELECT update_creator_verification_status();`
2. Check for users who now have `is_verified = true`:
   ```sql
   SELECT id, username, is_verified, verification_metrics 
   FROM social_users 
   WHERE is_verified = true
   ORDER BY last_login_at DESC;
   ```

### Test 4.4: Admin Metrics Panel
1. Go to Admin Dashboard (path: `/admin/dashboard` or similar)
2. Look for "Verification Metrics Panel"
3. Verify displays:
   - Online user count (real-time updates)
   - Verified creator count
   - User status table with all metrics
   - Green/yellow/red indicators for each criterion

### Test 4.5: Real-Time Updates
1. Open user's profile in browser
2. Log in as that user in another browser/tab
3. Profile page should show green dot next to checkmark
4. Green dot should indicate "Online"
5. Log out in other tab
6. Profile page should update to show gray dot = "Offline"

### Test 4.6: Auto-Logout Inactive
1. User logs in
2. Leave application idle for 30+ minutes
3. Check table: `is_online` should become `false`
4. Next session should update `current_session_started_at`

---

## Phase 5: Monitoring

### Monitor 5.1: Check Cron Job Status
```sql
-- View all scheduled cron jobs
SELECT jobname, schedule, active FROM cron.job;

-- View recent cron executions
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Monitor 5.2: Performance Metrics
Check database query performance:
```sql
-- Check if new indices are being used
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public' AND tablename = 'social_users';

-- Monitor query execution times
EXPLAIN ANALYZE 
SELECT * FROM social_users WHERE is_online = true LIMIT 10;
```

### Monitor 5.3: Error Tracking
Monitor application logs for errors:
- `[useAuth] Failed to track login` - Login tracking RPC failed
- `[useAuth] Failed to track logout` - Logout tracking RPC failed
- `[authSessionTracker]` - Session utility errors

Check Supabase function logs:
```
Supabase Dashboard → Functions → Logs
```

---

## Phase 6: Rollback Plan (If Needed)

### Rollback 6.1: Database
If migration causes issues:
```bash
# Revert migration
supabase migration down --version 20260317_user_verification_and_realtime_status

# Or manually delete columns and functions via Supabase SQL editor:
ALTER TABLE social_users DROP COLUMN IF EXISTS is_online CASCADE;
ALTER TABLE social_users DROP COLUMN IF EXISTS last_login_at CASCADE;
ALTER TABLE social_users DROP COLUMN IF EXISTS last_logout_at CASCADE;
ALTER TABLE social_users DROP COLUMN IF EXISTS current_session_started_at CASCADE;
ALTER TABLE social_users DROP COLUMN IF EXISTS verification_metrics CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS check_creator_verification_eligibility(UUID);
DROP FUNCTION IF EXISTS update_creator_verification_status();
DROP FUNCTION IF EXISTS track_user_login(UUID);
DROP FUNCTION IF EXISTS track_user_logout(UUID);

-- Drop cron jobs
SELECT cron.unschedule('update_creator_verification_daily');
SELECT cron.unschedule('auto_logout_inactive_users');
SELECT cron.unschedule('auto_mark_inactive_users');
```

### Rollback 6.2: Code
All code changes are backward compatible. Simply remove the imports/calls:
- Remove import of `useUserVerificationStatus` from `UserProfile.tsx`
- Remove `<VerifiedBadge>` component
- Remove imports of `trackUserLogin`/`trackUserLogout` from `useAuth.tsx`
- Revert to old Badge component display

---

## Post-Deployment Checklist

- [ ] Migration applied successfully
- [ ] Types regenerated with new fields
- [ ] Verified badge displays correctly on creator profiles
- [ ] Online indicator shows real-time status
- [ ] Admin metrics panel displays correctly
- [ ] Login/logout tracking working (check `last_login_at`)
- [ ] Cron jobs executing (check `cron.job_run_details`)
- [ ] No console errors related to auth tracking
- [ ] Real-time subscriptions working (online status updates)
- [ ] Verification metrics tooltip displays on badge hover
- [ ] Admin can see user verification status in dashboard
- [ ] Performance acceptable (query times < 500ms)

---

## Support & Troubleshooting

### Issue: RPC Functions Return 404
**Solution:** Ensure migration ran successfully. Check if functions exist:
```sql
SELECT * FROM information_schema.routines 
WHERE routine_name LIKE 'track_user_%';
```

### Issue: is_online Not Updating
**Solution:** Check useAuth hook is calling `trackUserLogin()` on SIGNED_IN event
```typescript
// Should see this in useAuth.tsx:
if (event === 'SIGNED_IN' && session?.user?.id) {
  trackUserLogin(session.user.id).catch(...)
}
```

### Issue: Verification Badge Not Showing
**Solutions:**
1. Verify user meets all 6 criteria
2. Check daily cron job ran: `SELECT * FROM cron.job_run_details LIMIT 5;`
3. Manually run verification check:
   ```sql
   SELECT check_creator_verification_eligibility('user-id'::UUID);
   ```
4. Check achievement exists:
   ```sql
   SELECT * FROM achievements WHERE user_id = 'user-id' AND badge_id = (SELECT id FROM badges WHERE name = 'verified_creator');
   ```

### Issue: Metrics Always Null
**Solution:** Cron job hasn't run yet. Run manually:
```sql
SELECT update_creator_verification_status();
```

---

## Files Modified/Created

**New Files:**
- `src/utils/authSessionTracker.ts`
- `src/hooks/useUserVerificationStatus.ts`
- `src/components/social/components/VerifiedBadge.tsx`
- `src/components/admin/VerificationMetricsPanel.tsx`
- `supabase/migrations/20260317_user_verification_and_realtime_status.sql`

**Modified Files:**
- `src/hooks/useAuth.tsx` - Added login/logout tracking
- `src/components/social/components/UserProfile.tsx` - Updated to use VerifiedBadge

**Auto-Generated:**
- `src/integrations/supabase/types.ts` - Regenerate from schema

---

## Success Criteria

Your deployment is successful when:
1. ✅ All 4 new columns exist in `social_users` table
2. ✅ Login/logout updates `is_online` and timestamp fields
3. ✅ Verified badge appears for users meeting all 6 criteria
4. ✅ Admin dashboard shows real-time online count
5. ✅ Verification metrics display with green/yellow/red indicators
6. ✅ No console errors in browser DevTools
7. ✅ Cron jobs are scheduled and executing

---

## Questions?

Refer to:
- /memories/repo/dashboard-rpc-fallback-pattern.md - Error handling patterns
- docs/NOTIFICATION_SYSTEM_ARCHITECTURE.md - Real-time patterns
- docs/GLOBAL_SEARCH_INTEGRATION.md - Supabase real-time examples
