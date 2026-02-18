# Database Integration Status & Action Items

## Current Status

### ✅ Existing Tables (Already in your database)
- `social_notifications` - Social media notifications
- `schedule_items` - User schedules

### ❌ Missing Tables (Need migration)
The following tables from the notification & calendar integration system are **NOT yet in your database**:

1. **notifications** - Main notification system
2. **notification_subscriptions** - Push notification subscriptions
3. **notification_preferences** - User notification settings
4. **calendar_integrations** - Calendar OAuth tokens
5. **schedule_reminders** - Reminder settings for schedules

## Type Compatibility Issues

Your code is currently referencing tables that don't exist in your Supabase database. This will cause runtime errors when:
- Trying to save push subscriptions
- Fetching notifications
- Saving notification preferences
- Connecting calendars
- Setting up reminders

## Required Actions (In Order)

### Step 1: Apply the Database Migration

Run the migration to create the new tables:

```bash
# Navigate to your project
cd c:\Users\USER\Desktop\studdyhub\studdyhub_repo

# Make sure you're logged into Supabase CLI
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push
```

The migration file is located at:
`supabase/migrations/20240101000000_add_notifications_and_calendar.sql`

### Step 2: Regenerate TypeScript Types

After the migration is applied, regenerate your types:

```bash
# Generate types from your Supabase database
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/integrations/supabase/types.ts
```

This will update `src/integrations/supabase/types.ts` to include:
- `notifications` table types
- `notification_subscriptions` table types  
- `notification_preferences` table types
- `calendar_integrations` table types
- `schedule_reminders` table types

### Step 3: Verify the Types

Check that your types file now includes the new tables:

```bash
# Search for the new tables in types.ts
grep -A 5 "notification_subscriptions:" src/integrations/supabase/types.ts
grep -A 5 "notifications:" src/integrations/supabase/types.ts
grep -A 5 "notification_preferences:" src/integrations/supabase/types.ts
grep -A 5 "calendar_integrations:" src/integrations/supabase/types.ts
```

Or in PowerShell:
```powershell
Select-String -Path "src\integrations\supabase\types.ts" -Pattern "notification_subscriptions:"
Select-String -Path "src\integrations\supabase\types.ts" -Pattern "notifications:"
Select-String -Path "src\integrations\supabase\types.ts" -Pattern "notification_preferences:"
Select-String -Path "src\integrations\supabase\types.ts" -Pattern "calendar_integrations:"
```

### Step 4: Update Services to Use Database Types (Optional)

Once types are regenerated, you can optionally import from the database types instead of local types:

```typescript
// Before (current)
import type { Notification } from '@/types/Notification';

// After (using database types)
import type { Database } from '@/integrations/supabase/types';
type Notification = Database['public']['Tables']['notifications']['Row'];
```

## Temporary Workaround (NOT Recommended)

If you can't run the migration immediately, I've created a supplemental types file:
`src/integrations/supabase/notification-types-supplement.ts`

This contains the type definitions, but **the actual database tables still won't exist**, so the app will fail at runtime.

## Field Name Mappings

Make sure these field names match between your types and database:

### NotificationSubscription
- `p256dh_key` → Database column: `p256dh`
- `auth_key` → Database column: `auth`

### Notification
- `read` → Database column: `read`
- `created_at` → Database column: `created_at`

### NotificationPreferences
- `push_notifications` → Database column: `push_notifications`
- `email_notifications` → Database column: `email_notifications`
- `quiz_reminders` → Database column: `quiz_reminders`
- `assignment_reminders` → Database column: `assignment_reminders`
- `reminder_time` → Database column: `reminder_time`

## Testing After Migration

Once the migration is complete, test these features:

1. **Push Notifications**
   ```typescript
   const { subscribe } = useNotifications();
   await subscribe(); // Should save to notification_subscriptions table
   ```

2. **Notification Preferences**
   ```typescript
   const { updatePreferences } = useNotifications();
   await updatePreferences({ push_notifications: true }); // Should save to notification_preferences table
   ```

3. **Calendar Integration**
   ```typescript
   const { connectGoogle } = useCalendarIntegration();
   await connectGoogle(); // Should save to calendar_integrations table
   ```

## What Gets Created by Migration

The migration creates:

### Tables (5)
- notifications
- notification_subscriptions
- notification_preferences
- calendar_integrations
- schedule_reminders

### Indexes (7)
- idx_notification_subscriptions_user_id
- idx_notifications_user_id
- idx_notifications_user_read
- idx_notifications_created_at
- idx_notifications_type
- idx_calendar_integrations_user_id
- idx_schedule_reminders_schedule_id
- idx_schedule_reminders_pending

### Functions (4)
- mark_notification_read()
- mark_all_notifications_read()
- cleanup_old_notifications()
- update_updated_at_column()

### RLS Policies (15+)
All tables have Row Level Security enabled with policies for:
- SELECT (users can view own data)
- INSERT (users can insert own data)
- UPDATE (users can update own data)
- DELETE (users can delete own data)

### Triggers (3)
- Auto-update timestamps on notification_subscriptions
- Auto-update timestamps on notification_preferences
- Auto-update timestamps on calendar_integrations

## Next Steps After Migration

1. ✅ Verify tables exist in Supabase Dashboard
2. ✅ Regenerate TypeScript types
3. ✅ Test notification subscription
4. ✅ Test calendar integration
5. ✅ Deploy edge functions
6. ✅ Set up environment variables

## Support

If you encounter errors during migration:
- Check Supabase logs in Dashboard
- Verify you have the latest Supabase CLI
- Ensure database has sufficient permissions
- Check for conflicting table names

---

**Status**: ⚠️ Migration Required
**Priority**: 🔴 HIGH - Code references non-existent tables
**Estimated Time**: 5-10 minutes

---

## AI Feed Migration

### Migration File
`sql/20260215_ai_feed_columns.sql`

### Status: ⚠️ Pending

### What Gets Created

#### Columns Added to `social_posts`
- `ai_categories text[]` — AI-assigned content categories (up to 3)
- `ai_sentiment text` — positive, neutral, negative, or mixed
- `ai_quality_score smallint` — 1–10 educational quality rating

#### Columns Added to `social_users`
- `ai_preferred_categories jsonb DEFAULT '{}'` — learned category preferences
- `ai_preferred_authors text[] DEFAULT '{}'` — frequently engaged authors
- `ai_profile_updated_at timestamptz` — last preference computation

#### New Table: `social_user_signals`
Tracks interaction signals for preference learning:
- `id UUID PRIMARY KEY`
- `user_id UUID` (FK → auth.users)
- `post_id UUID` (FK → social_posts)
- `signal_type TEXT` — like, comment, share, bookmark, view, skip, hide
- `weight REAL DEFAULT 1.0`
- `created_at TIMESTAMPTZ`
- `UNIQUE(user_id, post_id, signal_type)`

#### Indexes (3)
- `idx_social_user_signals_user` — on `user_id`
- `idx_social_user_signals_post` — on `post_id`
- `idx_social_user_signals_created` — on `created_at DESC`

#### Trigger Functions (6)
- `record_like_signal()` — on social_post_likes INSERT
- `record_unlike_signal()` — on social_post_likes DELETE
- `record_bookmark_signal()` — on social_post_saves INSERT
- `record_comment_signal()` — on social_post_comments INSERT
- `record_share_signal()` — on social_post_shares INSERT
- `record_view_signal()` — on social_post_views INSERT

#### RLS Policies
- Users can read their own signals
- Users can insert their own signals
- Users can update their own signals

### How to Apply

```sql
-- Run via Supabase SQL Editor or psql
-- File: sql/20260215_ai_feed_columns.sql
```

### Post-Migration Steps
1. Deploy AI edge functions (`ai-categorize-post`, `ai-rank-feed`)
2. Redeploy updated functions (`get-social-feed`, `get-suggested-users`, `create-social-post`)
3. Optionally run batch categorization: call `ai-categorize-post` with `{ "batchUncategorized": true }`
