# Daily Engagement Notification Strategy - App Architecture Research
**Document Date**: March 13, 2026

---

## PART 1: WHAT ALREADY EXISTS

### 1.1 AI Insights System (Admin Dashboard)

**Location**: `src/components/admin/AIAdminInsights.tsx`  
**Backend**: `supabase/functions/admin-ai-insights/index.ts`

**Current Implementation**:
- ✅ Admin dashboard fetches real-time platform snapshot:
  - User counts (total, active 7d, active 30d, new today)
  - Content metrics (posts, comments, notes, documents, groups, podcasts, chat sessions, quizzes)
  - Moderation queue (pending reports, content review)
  - System health (errors, critical errors, top error sources)
  - Growth trends (users/posts week-over-week)
- ✅ Uses Gemini AI (with fallback models) for analysis
- ✅ Quick prompts available:
  - Platform Health Check
  - Growth Analysis
  - Error Patterns
  - Engagement Ideas
  - Performance Report
  - Feature Usage
- ✅ Conversation history maintained in UI (multi-turn chat)
- ✅ Real-time system context included with each query

**Key Insight**: This system CAN be used to generate personalized engagement insights, but currently it's admin-only and reactive (human-triggered).

---

### 1.2 Notification Infrastructure

#### Database Tables
**`notifications` Table**:
- `id` (UUID PK)
- `user_id` (FK to auth.users)
- `type` (enum): schedule_reminder | quiz_due | assignment_due | study_session | social_like | social_comment | social_follow | social_mention | podcast_share | ai_limit_warning | subscription_renewal | general
- `title`, `message`, `data` (JSONB), `read` (boolean)
- `action_url` (for deep linking)
- `created_at`, `scheduled_for` (optional)

**`notification_preferences` Table**:
- `id`, `user_id`, `email_notifications`, `push_notifications`, `schedule_reminders`, `social_notifications`, `quiz_reminders`, `assignment_reminders`
- `reminder_time` (int: minutes before event)
- `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`
- `created_at`, `updated_at`

**`notification_subscriptions` Table**:
- Stores Web Push endpoints per user per device
- `endpoint`, `p256dh_key`, `auth_key`, `device_type`
- Used by `send-notification` function

#### Edge Functions
**`send-notification`** (`supabase/functions/send-notification/index.ts`):
- Handles Web Push via VAPID protocol
- Respects user preferences:
  - Checks `quiet_hours` before sending
  - Checks notification type toggle (schedule_reminders, quiz_reminders, etc.)
- Supports batch notifications
- Can save to `notifications` table before sending push
- Gracefully handles subscription expiration (410/404)
- Set `requireInteraction: true` for important notifications

**`check-schedule-reminders`** (`supabase/functions/check-schedule-reminders/index.ts`):
- Runs periodically (designed for pg_cron, every minute)
- Scans `schedule_reminders` table for due items
- Calls `send-notification` for matching items
- Marks reminders as sent

#### Client Code
**`NotificationCenter` Component** (`src/components/notifications/NotificationCenter.tsx`):
- Bell icon in header with unread badge
- Popover dropdown showing up to 50 notifications
- Actions: mark as read, mark all as read, delete, navigate to action_url
- Settings button → opens `/dashboard?view=settings&tab=notifications`
- Manual push permission request
- Responsive UI with ScrollArea

**`useNotifications` Hook** (`src/hooks/useNotifications.ts`):
- Fetches notifications from `notifications` table
- Fetches user preferences from `notification_preferences`
- Real-time subscription via Supabase (if enabled)
- `markAsRead`, `markAllAsRead`, `deleteNotification` methods
- Auto-creates default preferences if missing
- Checks if user is push-subscribed

**Types** (`src/types/Notification.ts`):
- `Notification` interface
- `NotificationType` enum (12 types)
- `NotificationPreferences` interface
- `PushNotificationPayload` interface

**Notification Service** (`src/services/notificationInitService.ts`):
- Registers Service Worker
- Requests push permission
- Auto-subscribes if:
  - Browser supports Web Push
  - User granted permission
  - `push_notifications` preference is true
  - Called 1 second after login

---

### 1.3 Dashboard Insights Generation

**Location**: `supabase/functions/generate-dashboard-insights/index.ts`

**Current Implementation**:
- Generates insights for individual user dashboard
- Fetches user's education context (subject, level, curriculum)
- Generates personalized study tips, learning patterns, recommendations
- Uses Gemini AI with model fallback chain
- Returns markdown-formatted insights

**Key Insight**: This system can generate personalized insights per user. We could leverage this for email/push notification content.

---

## PART 2: WHAT NEEDS TO BE CREATED

### 2.1 Missing Database Tables

#### `user_activity_tracking`
```sql
CREATE TABLE user_activity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  last_active TIMESTAMPTZ DEFAULT now(),
  last_chat_at TIMESTAMPTZ,
  last_note_at TIMESTAMPTZ,
  last_quiz_at TIMESTAMPTZ,
  last_post_at TIMESTAMPTZ,
  last_group_interaction_at TIMESTAMPTZ,
  last_podcast_play_at TIMESTAMPTZ,
  chat_sessions_count INT DEFAULT 0,
  notes_count INT DEFAULT 0,
  documents_count INT DEFAULT 0,
  quiz_attempts_count INT DEFAULT 0,
  quiz_streak INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  group_interactions_count INT DEFAULT 0,
  engagement_tier VARCHAR(20) DEFAULT 'cold',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_activity_engagement_tier 
  ON user_activity_tracking(engagement_tier, last_active DESC);
```

**Purpose**: Denormalized activity data for efficient filtering in scheduled jobs

---

#### `daily_notification_log`
```sql
CREATE TABLE daily_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type VARCHAR(100),
  category INT (1-5),
  scheduled_send_at TIMESTAMPTZ,
  actually_sent_at TIMESTAMPTZ,
  opened_by_user BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  deep_link_clicked BOOLEAN DEFAULT false,
  deep_link_clicked_at TIMESTAMPTZ,
  action_taken BOOLEAN DEFAULT false,
  action_taken_at TIMESTAMPTZ,
  personalization_data JSONB,
  message_template VARCHAR(500),
  deep_link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_notification_log_user 
  ON daily_notification_log(user_id, created_at DESC);
CREATE INDEX idx_daily_notification_log_category 
  ON daily_notification_log(category, opened_by_user);
```

**Purpose**: Analytics and ROI tracking for notification campaign

---

#### Extend `notification_preferences`
```sql
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  daily_categories JSONB DEFAULT '{"study_planning":true,"quiz_challenge":true,"group_nudge":true,"podcast_discovery":true,"progress_tracking":true}';

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  preferred_notification_times JSONB DEFAULT '{"study_planning":"08:00","quiz_challenge":"14:00","group_nudge":"17:00","podcast_discovery":"19:00","progress_tracking":"flexible"}';

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  max_notifications_per_day INT DEFAULT 3;

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS
  user_timezone VARCHAR(100) DEFAULT 'UTC';
```

---

### 2.2 New Edge Function: `daily-notifications-engine`

**Purpose**: Scheduled function (runs daily) to:
1. Query active/warm/cold user cohorts
2. Build personalized notifications per cohort
3. Use AI to generate message variations
4. Save to `daily_notification_log` for tracking
5. Call `send-notification` for actual delivery

**Architecture**:
```
Input: Daily schedule trigger (6 AM UTC default)
↓
1. Fetch all users + activity tracking + preferences
↓
2. For each user:
   - Determine engagement tier
   - Build notification payload per enabled category
   - Use AI to personalize message (optional)
   - Check max per day, quiet hours, preferences
↓
3. Insert into daily_notification_log
↓
4. Call send-notification for each payload
↓
Output: Success/error report with counts
```

**Key Feature**: Leverage existing `generate-dashboard-insights` to create personalized AI messages

---

### 2.3 Triggers for Activity Tracking

Update existing feature functions to increment `user_activity_tracking`:

**When chat created**: `chat_sessions_count += 1, last_chat_at = now()`  
**When note created**: `notes_count += 1, last_note_at = now()`  
**When quiz attempted**: `quiz_attempts_count += 1, quiz_streak += 1, last_quiz_at = now()`  
**When post created**: `posts_count += 1, last_post_at = now()`  
**When group interaction**: `group_interactions_count += 1, last_group_interaction_at = now()`  
**When podcast played**: `last_podcast_play_at = now()`  

These can be done via:
- Supabase Triggers (automatic DB-level)
- Or update in existing edge functions before returning

---

### 2.4 Frontend UI Extensions

#### Notification Preferences Component
**Location**: `src/components/settings/NotificationSettings.tsx` (extend existing)

**Add**:
```tsx
// Section: Daily Engagement Notifications
<h3>Daily Engagement Notifications</h3>

{/* Category toggles */}
<Checkbox id="study_planning" label="📚 Morning Study Planning" />
<Checkbox id="quiz_challenge" label="🧠 Quiz Challenges" />
<Checkbox id="group_nudge" label="💬 Study Group Activity" />
<Checkbox id="podcast_discovery" label="🎧 Podcast Discovery" />
<Checkbox id="progress_tracking" label="🔥 Progress & Re-engagement" />

{/* Time preferences */}
<TimePicker label="Study Planning Time" defaultValue="08:00" />
<TimePicker label="Quiz Challenge Time" defaultValue="14:00" />
{/* ... more */}

{/* Timezone selector */}
<Select label="Your Timezone" value={userData.timezone} />

{/* Max per day */}
<Slider label="Max Notifications/Day" min={0} max={5} defaultValue={3} />
```

#### Notification Analytics Dashboard
**Location**: `src/pages/admin/NotificationAnalytics.tsx` (new)

**Display**:
- KPI cards (sent count, open rate, conversion rate, DAU lift)
- Per-category performance (bar chart: opens, clicks, actions)
- Cohort breakdown (table: tier, users, notifs sent, % opened, actions)
- Time-series: daily sends vs opens vs conversions
- A/B test results (if running variants)

---

## PART 3: INTEGRATION POINTS

### 3.1 Leverage Existing Admin Insights for Notifications

**Current Flow**:
```
Admin sees insights in dashboard → Decides to notify users → Manually creates campaign
```

**Proposed Flow**:
```
System recognizes users need engagement nudge
  ↓
Uses admin-ai-insights logic to generate recommendations
  ↓
Generates personalized daily notifications
  ↓
Tracks response in daily_notification_log
  ↓
Admin can review analytics in NotificationAnalytics dashboard
```

**Implementation**:
- Reuse `admin-ai-insights` function logic to generate per-user insights
- Use `generate-dashboard-insights` template for personalized messages
- Instead of "Platform has 330 posts, low engagement" → "You haven't quizzed in 5 days, let's test what you learned"

---

### 3.2 Enhanced Notification Types

**Extend `NotificationType`** in `src/types/Notification.ts`:

```ts
export type NotificationType =
  | ... // existing types
  | 'daily_study_planning'        // Category 1: Morning AI Chat prompt
  | 'daily_quiz_challenge'        // Category 2: Quiz challenge
  | 'daily_group_nudge'           // Category 3: Group activity
  | 'daily_podcast_discovery'     // Category 4: Podcast suggestion
  | 'daily_progress_tracking'     // Category 5: Progress celebration/re-engagement
```

---

### 3.3 Deep Linking Strategy

Each notification should open app to contextual page:

| Category | Deep Link | Behavior |
|----------|-----------|----------|
| Study Planning | `/chat?context=daily-planning&recent_topic=[topic]` | Open chat, pre-fill greeting |
| Quiz Challenge | `/quizzes?auto-generate=true&source=notes&topic=[topic]` | Auto-generate quiz from notes |
| Group Nudge | `/social/groups/[group_id]?focus=new-posts` | Show group with latest posts first |
| Podcast | `/podcasts/[podcast_id]?auto_play=true` | Auto-start playback |
| Progress | `/social/profile?show=learning-summary` | Show user's dashboard with stats |

**Note**: Deep links must be validated before sending (prevent 404s)

---

## PART 4: USER PREFERENCE MANAGEMENT

### Current User Preferences
In `UserSettings.tsx`, users can already configure:
- ✅ Email notifications (on/off)
- ✅ Push notifications (on/off)
- ✅ Schedule reminders (on/off)
- ✅ Social notifications (on/off)
- ✅ Quiz reminders (on/off)
- ✅ Assignment reminders (on/off)
- ✅ Quiet hours (time range)
- ✅ Reminder timing (5 min to 1 day before)

### New Preferences (to add)
- ☐ Daily category toggles (5 categories)
- ☐ Preferred notification times (per category)
- ☐ Timezone
- ☐ Max notifications per day

**No Breaking Changes**: All new fields default to enabling the feature (opt-out model).

---

## PART 5: ANALYTICS & METRICS

### Tracking in `daily_notification_log`

**Per Notification**:
- `category` (1-5)
- `scheduled_send_at` vs `actually_sent_at` (delivery lag)
- `opened_by_user` + `opened_at` (CTR calculation)
- `deep_link_clicked` + `deep_link_clicked_at` (conversion stage 1)
- `action_taken` + `action_taken_at` (conversion stage 2)
- `personalization_data` (context for segmentation analysis)

**Queries for Admin Dashboard**:
```sql
-- Overall CTR
SELECT 
  COUNT(*) as total_sent,
  SUM(CASE WHEN opened_by_user THEN 1 ELSE 0 END) as total_opened,
  ROUND(100.0 * SUM(CASE WHEN opened_by_user THEN 1 ELSE 0 END) / COUNT(*), 2) as ctr_percent
FROM daily_notification_log
WHERE created_at >= now() - interval '7 days'
```

```sql
-- Per-category performance
SELECT 
  category,
  COUNT(*) as sent,
  ROUND(100.0 * SUM(CASE WHEN opened_by_user THEN 1 ELSE 0 END) / COUNT(*), 2) as open_rate,
  ROUND(100.0 * SUM(CASE WHEN deep_link_clicked THEN 1 ELSE 0 END) / COUNT(*), 2) as click_rate,
  ROUND(100.0 * SUM(CASE WHEN action_taken THEN 1 ELSE 0 END) / COUNT(*), 2) as action_rate
FROM daily_notification_log
WHERE created_at >= now() - interval '7 days'
GROUP BY category
```

---

## PART 6: IMPLEMENTATION PLAN (NO REDUNDANCY)

### Phase 1: Foundation (Week 1-2)
- [ ] Create `user_activity_tracking` table + triggers
- [ ] Extend `notification_preferences` schema
- [ ] Create `daily_notification_log` table
- [ ] Build triggers to auto-update activity tracking
- [ ] **No new edge function yet** — test data pipeline first

### Phase 2: Daily Engine (Week 3-4)
- [ ] Build `daily-notifications-engine` edge function
  - Start with 2 categories only (Study Planning + Progress)
  - Hardcoded messages (no AI generation yet)
- [ ] Test with 10% beta cohort
- [ ] Monitor: sends, delivery lag, errors

### Phase 3: AI Personalization (Week 5-6)
- [ ] Integrate AI message generation (use `generate-dashboard-insights` pattern)
- [ ] Add Categories 2, 3, 4
- [ ] Expand to 50% of users
- [ ] A/B test message templates

### Phase 4: UI & Analytics (Week 7-8)
- [ ] Build notification preferences UI
- [ ] Build admin analytics dashboard
- [ ] 100% rollout with dashboard monitoring

---

## PART 7: WHAT NOT TO RECREATE

**DON'T rebuild**:
- ❌ `send-notification` — already handles Web Push + respects preferences
- ❌ `NotificationCenter` — already shows notifications in header
- ❌ `notification_subscriptions` — already manages push endpoints
- ❌ Quiet hours logic — already in `send-notification`
- ❌ User authentication — use existing `useAuth` hook
- ❌ Real-time subscriptions — Supabase already handles this

**DO reuse**:
- ✅ `send-notification` edge function for actual delivery
- ✅ `admin-ai-insights` logic for message generation
- ✅ `generate-dashboard-insights` function for personalization
- ✅ `notification_preferences` table (extend, don't replace)
- ✅ `useNotifications` hook (extend, don't replace)

---

## SUMMARY: QUICK REFERENCE

| Component | Exists? | Status |
|-----------|---------|--------|
| Notification tables | ✅ | Ready |
| send-notification function | ✅ | Ready to use |
| NotificationCenter UI | ✅ | Ready |
| useNotifications hook | ✅ | Ready |
| User preferences UI | ✅ | Need to extend |
| Admin AI insights | ✅ | Can leverage |
| **Daily scheduler** | ❌ | Build new |
| **Activity tracking table** | ❌ | Build new |
| **Daily notification log** | ❌ | Build new |
| **Daily engine function** | ❌ | Build new |
| **Analytics dashboard** | ❌ | Build new |

**Total Effort**: 
- DB: 3 migrations (small)
- Backend: 1 new edge function (~400 lines)
- Frontend: 1 settings extension (~100 lines), 1 dashboard (~300 lines)
- Integration: ~50 lines of triggers

**Estimated Timeline**: 4-6 weeks with proper phasing

