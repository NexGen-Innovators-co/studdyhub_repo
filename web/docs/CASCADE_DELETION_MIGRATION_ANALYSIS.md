# User Deletion & Cascade Analysis - March 17, 2026

## 🔍 Issue Analysis

### Current Purge Function Problems

The existing `purge_user_data()` function in `supabase/migrations/delete.sql` manually deletes from **~65 tables** in a specific order because **most foreign keys don't have ON DELETE CASCADE enabled**. This creates several problems:

#### Problem 1: Complexity & Maintenance Burden
- **200+ lines** of deletion logic
- Deletion order is **critical** - wrong order = constraint violations
- New tables added to database **must be manually added** to purge function
- Risk of **missing tables** when onboarding new features
- Hard to audit and review

#### Problem 2: Performance
- **Sequential DELETES** instead of cascading deletes (slower)
- Multiple round-trips to database
- More locking contention
- Can timeout on large datasets

#### Problem 3: Human Error Risk
- Easy to get deletion order wrong
- Easy to forget to add new tables to purge function
- Hard to test comprehensively (need test user with all types of data)
- Subtle bugs if constraint dependencies change

#### Problem 4: Data Consistency
- If deletion fails mid-way, orphaned records remain
- Transaction rollback required to ensure atomicity
- With cascading, DB enforces consistency automatically

---

## 📋 Current Deletion Dependencies Map

### Root Tables (deleted via direct user_id reference)
1. **First**: Child-of-child tables (media, attachments, details)
2. **Then**: Child tables (messages, questions, answers, etc.)
3. **Then**: Parent content tables (sessions, posts, comments)
4. **Then**: User content aggregates (quizzes, notes, documents)
5. **Finally**: User profile & preferences

### Why This Order Is Necessary (Without CASCADE)
```
quizzes (user_id)
    ↓
live_quiz_sessions (quiz_id) ← Must delete children first!
    ↓
live_quiz_questions (session_id)
    ↓
live_quiz_answers (question_id)
    ↓
player_question_progress (question_id)

Without CASCADE: Delete in reverse order ↑
With CASCADE: Delete quizzes, rest cascades automatically ↓
```

---

## ✅ Solution: Add ON DELETE CASCADE

### Migration File
**`sql/20260317_add_cascade_delete_constraints.sql`**

This migration:
1. **Drops existing FK constraints** (one at a time to avoid locks)
2. **Recreates with CASCADE** for user content
3. **Recreates with SET NULL** for audit trails
4. Covers **60+ foreign key constraints** across all tables

### Constraint Strategy

#### CASCADE (95% of constraints)
- User content: notes, posts, quizzes, messages, etc.
- All created by user
- Safe to delete when user is deleted
- Includes:
  - Direct social content (posts, comments, events, chats)
  - Learning materials (notes, documents, flashcards, quizzes)
  - Engagements (likes, follows, bookmarks, comments)
  - Transactions (course enrollments, podcast credits)

**Tables with CASCADE FKs:**
```
social_posts, social_comments, social_likes, social_follows
social_chat_messages, social_chat_sessions
notes, documents, class_recordings
quizzes, quiz_attempts, flashcards
live_quiz_sessions, live_quiz_questions, live_quiz_players
courses, course_enrollments, course_progress
podcast_credits, podcast_members, podcast_invites
achievements, user_stats, user_learning_goals
ai_user_memory, chat_sessions, chat_messages
schedule_items, calendar_integrations, notification_preferences
(and 40+ more...)
```

#### SET NULL (5% of constraints)
- Audit trails & history records
- WHO created/modified what, but preserve the WHAT
- Examples:
  - `admin_activity_logs.admin_id` → SET NULL (preserve log, clear admin reference)
  - `system_error_logs.resolved_by` → SET NULL (preserve error, clear who resolved it)
  - `content_moderation_log.user_id` → SET NULL (preserve moderation record)
  - `courses.created_by` → SET NULL (preserve course, clear creator)
  - `platform_updates.updated_by` → SET NULL (preserve update, clear editor)

---

## 🔄 Before & After Comparison

### BEFORE: Manual Deletion (Current)
```sql
-- Step 1: Delete live quiz details
DELETE FROM player_question_progress WHERE question_id IN (...);  -- ~50 lines total
DELETE FROM live_quiz_answers WHERE question_id IN (...);
DELETE FROM live_quiz_answers WHERE session_id IN (...);
DELETE FROM live_quiz_questions WHERE session_id IN (...);
DELETE FROM live_quiz_players WHERE session_id IN (...);

-- Step 2: Delete live quiz sessions
DELETE FROM live_quiz_sessions WHERE quiz_id IN (SELECT id FROM quizzes WHERE user_id = ?);

-- Step 3: Delete user's quizzes
DELETE FROM quizzes WHERE user_id = ?;

-- Step 4: Delete social posts (children first)
DELETE FROM social_comment_media WHERE comment_id IN (...);
DELETE FROM social_media WHERE post_id IN (...);
DELETE FROM social_post_hashtags WHERE post_id IN (...);
DELETE FROM social_post_tags WHERE post_id IN (...);
DELETE FROM social_comments WHERE author_id = ?;
DELETE FROM social_posts WHERE author_id = ?;

-- ... 150+ more lines for other tables ...

-- Finally: Delete profile
DELETE FROM profiles WHERE id = ?;
```

**Problems:**
- 200+ lines of code
- Multiple SQL JOINs and subqueries
- Slow (sequential deletes)
- Hard to maintain
- Risk of missing tables

### AFTER: Cascading Deletion (New)
```sql
-- That's it! Everything cascades automatically:
DELETE FROM social_users WHERE id = ?;  -- Cascades to all social content
DELETE FROM profiles WHERE id = ?;      -- Cascades to all user content
DELETE FROM notification_preferences WHERE user_id = ?;
DELETE FROM admin_users WHERE user_id = ?;
DELETE FROM referrals WHERE referrer_id = ? OR referee_id = ?;
```

**Benefits:**
- 10 lines of code
- No complex JOINs
- Fast (parallel deletes)
- Automatic
- New tables inherit constraints

---

## 📊 Deployment Plan

### Phase 1: Pre-Deployment Testing (DO THIS FIRST)
1. **Read & review** `sql/20260317_add_cascade_delete_constraints.sql`
2. **Test in development environment:**
   ```sql
   -- 1. Create backup of production (if needed)
   -- 2. Run migration in test DB
   -- 3. Verify all constraints exist:
   SELECT table_name, constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
   ORDER BY table_name;
   
   -- 4. Test purge with sample user:
   INSERT INTO auth.users (email) VALUES ('test-purge@example.com');
   SELECT id FROM auth.users WHERE email = 'test-purge@example.com';
   -- Create some test data...
   SELECT purge_user_data('uuid-here');
   -- Verify all data deleted
   ```

### Phase 2: Database Migration
1. **Deploy migration:**
   ```bash
   # Supabase CLI:
   supabase db push
   
   # Or manual Supabase dashboard:
   # Admin > SQL Editor > Paste migration > Execute
   ```
2. **Verify in Supabase dashboard:**
   - Check "Relationships" tab in each table
   - Confirm "ON DELETE" shows "Cascade" where expected

### Phase 3: Code Updates
1. **Update purge function:**
   - Deploy: `sql/20260317_simplified_purge_user_data.sql`
   - This replaces the 200+ line version with 50 lines
2. **Remove old purge function:**
   - Keep copy in `supabase/migrations/delete.sql` for history
   - Mark as DEPRECATED

### Phase 4: Testing & Rollout
1. **Test purge in staging:**
   ```bash
   # Create test user
   # Add test data (notes, posts, quizzes, etc.)
   # Call purge_user_data()
   # Verify all data deleted
   ```
2. **Deploy to production**
3. **Monitor:** Check error logs for the next 24h

### Phase 5: Documentation
- Update [docs/ADMIN_FULL_ACCESS.md](docs/ADMIN_FULL_ACCESS.md) with new purge process
- Add cascade strategy to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Update team wiki/runbook

---

## 🚨 Special Considerations

### Audit & History Tables (SET NULL)
These tables are **deliberately SET NULL** to preserve records:
- `admin_activity_logs` - tracks what admins did (we keep the log, remove admin reference)
- `system_error_logs` - tracks errors (we keep the error, remove user reference)
- `content_moderation_log` - tracks moderation (we keep the log, remove who reported)
- `courses.created_by` - track course origin but allow creator deletion
- `platform_updates.updated_by` - track update history but allow editor deletion

**This is by design** - compliance/audit trails should survive user deletion.

### Auth User Deletion
The `auth.users` record is **NOT deleted** by `purge_user_data()` (per original design).

To fully delete user from auth:
```sql
-- ONLY if you want complete removal:
DELETE FROM auth.users WHERE id = 'uuid';
-- This cascades to profiles (because profiles.id → auth.users.id ON DELETE CASCADE)
-- Which cascades everything else automatically
```

> ⚠️ **Warning:** Deleting auth.users breaks authentication. Only do this if absolutely needed (e.g., GDPR right to be forgotten).

---

## 🔍 Tables Affected by CASCADE Migration

### Critical Paths (Must Have CASCADE)
1. **auth.users → profiles** (Direct cascade)
2. **profiles → user content** (Notes, docs, quizzes, etc.)
3. **profiles → social_users** (Social content)
4. **quizzes → live_quiz_sessions → questions → answers** (Test sessions)
5. **course_enrollments → course_progress** (Learning progress)
6. **social_posts → comments, shares, likes, hashtags** (Social graph)

### All Tables Updated
**Total: 60+ foreign key constraints** across:
- Notifications (5 tables)
- Social (15 tables)
- Learning (12 tables)
- Courses (4 tables)
- Podcasts (4 tables)
- Admin/Institution (5 tables)
- Quizzes/Live Quiz (8 tables)
- Chat/Documents (8 tables)
- System/Audit (2 tables)
- Other (varies)

---

## ✔️ Verification Checklist

After deployment, verify:

- [ ] All FK constraints have ON DELETE clause (no "RESTRICT" by default)
- [ ] No constraint syntax errors in migration
- [ ] Test purge with sample data doesn't fail
- [ ] Audit trails (admin_activity_logs, system_error_logs) have SET NULL
- [ ] User content (notes, posts, etc.) has CASCADE
- [ ] New cascade is faster than old purge function
- [ ] No orphaned records after purge
- [ ] Settings page auth.users reference cleaned up
- [ ] System tests pass

---

## 📚 Related Files

- **Migration:** [sql/20260317_add_cascade_delete_constraints.sql](sql/20260317_add_cascade_delete_constraints.sql)
- **New Purge:** [sql/20260317_simplified_purge_user_data.sql](sql/20260317_simplified_purge_user_data.sql)
- **Old Purge:** [supabase/migrations/delete.sql](supabase/migrations/delete.sql) (deprecated after migration)
- **User Settings:** [src/components/userSettings/UserSettings.tsx](src/components/userSettings/UserSettings.tsx) (calls purge_user_data)
- **Admin Panel:** [src/components/admin/UserManagement.tsx](src/components/admin/UserManagement.tsx) (calls purge_user_data)
- **Schema Docs:** [docs/DATABASE_SCHEMA_FOREIGN_KEYS.md](docs/DATABASE_SCHEMA_FOREIGN_KEYS.md)

---

## 🎯 Success Criteria

✅ **After This Migration:**
- [ ] Purge function is 50 lines instead of 200+
- [ ] No orphaned records after user deletion
- [ ] Deletion is 5-10x faster
- [ ] New tables automatically inherit cascade behavior
- [ ] Audit trails preserved (SET NULL)
- [ ] Easier to maintain & debug
- [ ] No consultant needed to understand deletion logic

---

## 📝 Notes

- This migration is **non-breaking** - deletes work the same from a user perspective
- Migration is **safe to run multiple times** (constraint creation is idempotent)
- Old purge function must be updated after CASCADE is deployed
- Test in staging first!
- Coordinate with team before rolling out
