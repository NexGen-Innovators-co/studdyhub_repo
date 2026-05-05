# Daily Engagement Notification Strategy - "Toothbrush Test"
**Objective**: Turn StuddyHub into a daily habit (like brushing teeth) through personalized, value-driven notifications.

---

## Executive Summary

### Current State (Admin Dashboard - Mar 13, 2026)
| Metric | Value | Status |
|--------|-------|--------|
| **Total Users** | 323 | 1 new today |
| **Daily Active Users** | 2 (0.6%) | 🔴 Critical |
| **Monthly Active Users** | 130 (40%) | 🟡 Concerning |
| **7-day Engagement Rate** | 6% | 🔴 Critical |
| **Quiz Attempts Lifetime** | 16 | 🔴 Severely Underutilized |
| **Social Posts This Week** | ~2 | 🔴 Dormant |
| **Study Groups** | 7 | 🟡 Underactivated |
| **AI Chats** | 663 sessions | ✅ Healthy |
| **Documents** | 1,232 | ✅ Healthy (passive) |
| **Notes** | 363 | ✅ Healthy (passive) |

**Core Problem**: High consumption (documents, notes, AI chats) but **extremely low creation** (quiz attempts, posts) and **poor daily return rates** (only 2/323 users active today).

**Solution**: 5-category notification system targeting different user motivations + behaviors to drive daily activation.

---

## Strategy: 5 Notification Categories

### Category 1: Personalized Daily Study Planning & AI Chat Prompt
**Purpose**: Establish AI Chat as daily learning companion  
**Target Cohort**: All users (especially with active chats)  
**Timing**: 7-9 AM (morning)  
**Frequency**: Daily for active cohort; 3x/week for cold cohort

**Why It Works**: 
- Meets users at start of day when motivation peaks
- Leverages existing strength (663 AI chat sessions)
- Low friction—just one tap to start planning
- Personalizes to user's actual learning pattern

**Message Examples**:
```
Good morning, [Name]! What are your top study goals for today? 
Your AI assistant is ready to help you plan. ✨

---

Start your day strong! Your AI has personalized study tips based on 
your recent notes on [Topic]. Ready to review?

---

Your AI assistant spotted gaps in [Recent Topic]. Take a 5-min 
guided lesson now? 🎯
```

**Deep Link**: `/chat?context=daily-planning&recent_topic=[topic]`  
**Conversion Goal**: 25% open rate, 15% start chat session

---

### Category 2: Quick Knowledge Reinforcement & Quiz Challenge
**Purpose**: Drive quiz attempts (currently 16 lifetime = critical gap)  
**Target Cohort**: Users with notes/documents (363 + 1,232)  
**Timing**: 12-2 PM or 3-5 PM (mid-day)  
**Frequency**: 2-3x per week

**Why It Works**:
- Addresses lowest engagement metric (quiz = only 16 attempts lifetime)
- Gamifies learning (streak, challenge, scoring)
- FOMO + urgency ("your streak depends on it")
- Micro-quizzes are low-friction (2-5 min)

**Message Examples**:
```
🧠 Quick brain exercise! Review 5 flashcards from 
"[Latest Topic Based On Notes]". Can you get a perfect score?

---

Test your knowledge! 2-minute quiz on "[Document Name]". 
You're on a [X]-day learning streak—keep it going! 🔥

---

You studied "[Subject]" last week but haven't been quizzed. 
Take a quick challenge now! [5 min]
```

**Deep Link**: `/quizzes?auto-generate=true&source=notes&topic=[topic]&difficulty=auto`  
**Conversion Goal**: 20% open rate, 40% quiz completion

**Implementation Note**: Today's quiz system needs friction reduction:
- Auto-generate from user's notes (don't make them pick)
- Pre-fill difficulty based on their level
- Show time estimate (set expectations)
- Show streak/progress immediately after completion

---

### Category 3: Study Group & Community Interaction Nudge
**Purpose**: Revitalize social features (0 posts this week, 7 dormant groups)  
**Target Cohort**: Users in study groups  
**Timing**: 4-6 PM (afterschool/early evening)  
**Frequency**: When there's actual activity (not daily spam)

**Why It Works**:
- Social proof (someone needs help/answered your question)
- FOMO (conversation happening without you)
- Low barrier to entry (just reply, don't create)
- Builds community → retention

**Message Examples**:
```
New activity in [Group Name]! Someone asked: 
"[Question snippet]". Help them out—bonus: spot what you 
might be weak on! 💬

---

[Group Name] Question of the Day: "[Question]". 
Only 2 people answered. What's your take?

---

Your group [Group Name] just hit 20 members! 
See what's trending. 🎉
```

**Deep Link**: `/social/groups/[group_id]?focus=new-posts`  
**Conversion Goal**: 15% open rate, 30% reply/interaction

---

### Category 4: AI Podcast & Content Discovery
**Purpose**: Promote passive learning (56 podcasts, underutilized)  
**Target Cohort**: All users (escalate for inactive)  
**Timing**: 7-9 AM or 6-8 PM (commute/relaxation windows)  
**Frequency**: 2-3x per week

**Why It Works**:
- Passive = low cognitive load (can listen while commuting)
- Audio format = fills underutilized time slots
- Discovery reduces decision fatigue (we pick for you)
- Escalating for inactive users brings them back gently

**Message Examples**:
```
🎧 Your daily bite: New AI Podcast on [Relevant Topic]. 
12 min perfect for your commute. [PLAY]

---

We discovered a podcast on "[Topic From Your Interests]". 
Save it or tap to listen now.

---

[Name], you haven't listened to podcasts yet. 
Try this 8-minute intro on [Beginner-Friendly Topic]. 🎧
```

**Deep Link**: `/podcasts/[podcast_id]?auto_play=true`  
**Conversion Goal**: 18% open rate, 25% playlist add or listen-through completion

---

### Category 5: Progress Tracking & Smart Re-engagement
**Purpose**: Celebrate active users; gently re-engage inactive ones  
**Target Cohort**: 
- **Active Users** (last_active < 24h): Weekly celebration
- **At-Risk Users** (last_active 7-30d): Triggered re-engagement
  
**Timing**: Flexible (triggered based on inactivity, or Sunday for active users)  
**Frequency**: Weekly for active; triggered for at-risk

**Why It Works**:
- Positive reinforcement (celebration) → habit formation
- Soft nudge with no shame (we "missed you", not "you're lazy")
- Shows progress → dopamine hit → motivation to continue
- Contextual (specific unfinished items) = relevant

**Message Examples (Active Users)**:
```
🔥 Amazing week! You've created [X] notes, 
[Y] quiz attempts, and helped [Z] people. Keep the momentum! 🚀

---

Your learning summary: [Stats graphic]. 
You're in the top [%] of StuddyHub learners! 💪

---

Your [Longest Streak]-day streak is strong! 
Come back today to keep it going. 🔥
```

**Message Examples (At-Risk Users)**:
```
We missed you! Your AI assistant has [X] new study tips 
waiting to help you pick up. [RESUME LEARNING]

---

Your "[Unfinished Quiz]" is waiting—you were [X%] done. 
Pick up where you left off? ⏱️

---

You haven't checked your '[Topic]' document in 2 weeks. 
Let's quiz what you remember! 🧠
```

**Deep Link**:
- Active: `/social/profile?show=learning-summary`
- At-Risk: `/[last_accessed_feature]` (graceful fallback)

**Conversion Goal**: 30% open rate, 25% session start (active); 20% re-engagement (at-risk)

---

## Implementation Architecture

### Phase 1: Database Schema

#### 1. User Activity Tracking Table
```sql
CREATE TABLE IF NOT EXISTS user_activity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  last_active TIMESTAMPTZ DEFAULT now(),
  last_chat_at TIMESTAMPTZ,
  last_note_at TIMESTAMPTZ,
  last_quiz_at TIMESTAMPTZ,
  last_post_at TIMESTAMPTZ,
  last_group_interaction_at TIMESTAMPTZ,
  last_podcast_play_at TIMESTAMPTZ,
  
  -- Counts (denormalized for query performance)
  chat_sessions_count INT DEFAULT 0,
  notes_count INT DEFAULT 0,
  documents_count INT DEFAULT 0,
  quiz_attempts_count INT DEFAULT 0,
  quiz_streak INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  group_interactions_count INT DEFAULT 0,
  
  -- Derived engagement tier
  engagement_tier VARCHAR(20) DEFAULT 'cold',
  -- cold: last_active > 30d
  -- warm: last_active 7-30d
  -- active: last_active < 7d
  -- very_active: last_active < 24h
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for scheduled function queries
CREATE INDEX idx_user_activity_tracking_engagement_tier 
  ON user_activity_tracking(engagement_tier, last_active DESC);
```

#### 2. Extend Notification Preferences
```sql
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  daily_categories JSONB DEFAULT '{
    "study_planning": true,
    "quiz_challenge": true,
    "group_nudge": true,
    "podcast_discovery": true,
    "progress_tracking": true
  }';

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  preferred_notification_times JSONB DEFAULT '{
    "study_planning": ["07:00", "09:00"],
    "quiz_challenge": ["12:00", "14:00", "15:00"],
    "group_nudge": ["16:00", "18:00"],
    "podcast_discovery": ["07:00", "19:00"],
    "progress_tracking": "flexible"
  }';

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS 
  max_notifications_per_day INT DEFAULT 3;

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS
  user_timezone VARCHAR(100) DEFAULT 'UTC';
```

#### 3. Daily Notification Log
```sql
CREATE TABLE IF NOT EXISTS daily_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  notification_type VARCHAR(100), -- study_planning, quiz_challenge, etc.
  category INT (1-5),
  
  scheduled_send_at TIMESTAMPTZ,
  actually_sent_at TIMESTAMPTZ,
  
  -- Engagement tracking
  opened_by_user BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  deep_link_clicked BOOLEAN DEFAULT false,
  deep_link_clicked_at TIMESTAMPTZ,
  action_taken BOOLEAN DEFAULT false, -- Did user complete the action? (quiz, post, etc.)
  action_taken_at TIMESTAMPTZ,
  
  -- Metadata
  personalization_data JSONB, -- {topic, group_name, quiz_difficulty, etc.}
  message_template VARCHAR(500),
  deep_link_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics
CREATE INDEX idx_daily_notification_log_user 
  ON daily_notification_log(user_id, created_at DESC);
CREATE INDEX idx_daily_notification_log_category 
  ON daily_notification_log(category, opened_by_user);
```

### Phase 2: Scheduled Function (Supabase Edge)

**File**: `supabase/functions/daily-notifications-engine/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.195.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface UserContext {
  user_id: string;
  timezone: string;
  engagement_tier: 'cold' | 'warm' | 'active' | 'very_active';
  last_active: string;
  chat_sessions_count: number;
  quiz_attempts_count: number;
  posts_count: number;
  group_interactions_count: number;
}

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  action_url: string;
}

// Main handler
serve(async (req: Request) => {
  try {
    // 1. Fetch all active users with their preferences
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select(`
        id,
        email,
        raw_user_meta_data->>'user_timezone' as timezone,
        notification_preferences(
          daily_categories,
          preferred_notification_times,
          max_notifications_per_day
        ),
        user_activity_tracking(
          engagement_tier,
          last_active,
          chat_sessions_count,
          quiz_attempts_count,
          posts_count,
          group_interactions_count
        )
      `)
      .eq('notification_preferences.push_notifications', true);

    if (usersError) throw usersError;

    // 2. For each user, determine which notifications to send
    const notifications: NotificationPayload[] = [];

    for (const user of users || []) {
      const userContext: UserContext = {
        user_id: user.id,
        timezone: user.timezone || 'UTC',
        engagement_tier: user.user_activity_tracking[0]?.engagement_tier || 'cold',
        last_active: user.user_activity_tracking[0]?.last_active,
        chat_sessions_count: user.user_activity_tracking[0]?.chat_sessions_count || 0,
        quiz_attempts_count: user.user_activity_tracking[0]?.quiz_attempts_count || 0,
        posts_count: user.user_activity_tracking[0]?.posts_count || 0,
        group_interactions_count: user.user_activity_tracking[0]?.group_interactions_count || 0,
      };

      const prefs = user.notification_preferences[0];
      const enabledCategories = prefs?.daily_categories || {};
      const sendTimes = prefs?.preferred_notification_times || {};
      const maxPerDay = prefs?.max_notifications_per_day || 3;

      // 3. Category 1: Study Planning (7-9 AM)
      if (enabledCategories.study_planning && userContext.chat_sessions_count > 0) {
        const shouldSend = shouldSendInTimeWindow(
          userContext.timezone,
          sendTimes.study_planning?.[0] || '08:00'
        );
        if (shouldSend) {
          notifications.push(
            buildStudyPlanningNotification(userContext)
          );
        }
      }

      // 4. Category 2: Quiz Challenge (2-5 PM)
      if (
        enabledCategories.quiz_challenge &&
        (userContext.quiz_attempts_count < 5 || 
         Math.random() < 0.3 // 30% of active users
        )
      ) {
        const shouldSend = shouldSendInTimeWindow(
          userContext.timezone,
          sendTimes.quiz_challenge?.[0] || '14:00'
        );
        if (shouldSend) {
          notifications.push(
            await buildQuizChallengeNotification(userContext, supabase)
          );
        }
      }

      // 5. Category 3: Group Nudge (4-6 PM) - only send if group has activity
      if (enabledCategories.group_nudge) {
        const pendingNotif = await buildGroupNudgeNotification(userContext, supabase);
        if (pendingNotif) notifications.push(pendingNotif);
      }

      // 6. Category 4: Podcast Discovery (7-9 AM or 6-8 PM)
      if (enabledCategories.podcast_discovery) {
        const times = Array.isArray(sendTimes.podcast_discovery)
          ? sendTimes.podcast_discovery
          : ['19:00'];
        for (const time of times) {
          if (shouldSendInTimeWindow(userContext.timezone, time)) {
            notifications.push(
              await buildPodcastDiscoveryNotification(userContext, supabase)
            );
            break; // Only send once per day
          }
        }
      }

      // 7. Category 5: Progress Tracking (flexible)
      if (enabledCategories.progress_tracking) {
        const progressNotif = await buildProgressTrackingNotification(userContext, supabase);
        if (progressNotif) notifications.push(progressNotif);
      }

      // Enforce max per day limit
      const userNotifs = notifications.filter(n => n.user_id === user.id);
      if (userNotifs.length > maxPerDay) {
        // Keep highest priority, drop lowest
        userNotifs.splice(maxPerDay);
      }
    }

    // 8. Insert into daily_notification_log
    const { error: logError } = await supabase
      .from('daily_notification_log')
      .insert(
        notifications.map(n => ({
          user_id: n.user_id,
          notification_type: n.type,
          title: n.title,
          message: n.message,
          deep_link_url: n.action_url,
          personalization_data: n.data,
          scheduled_send_at: new Date().toISOString(),
        }))
      );

    if (logError) throw logError;

    // 9. Trigger send-notification edge function for each
    for (const notif of notifications) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: notif.user_id,
          title: notif.title,
          message: notif.message,
          action_url: notif.action_url,
          data: notif.data,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Check if current time is within send window
function shouldSendInTimeWindow(timezone: string, targetTime: string): boolean {
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const [hour, minute] = targetTime.split(':').map(Number);
  
  const windowStart = new Date(userTime);
  windowStart.setHours(hour, minute, 0);
  
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(hour + 1, minute); // 1-hour window
  
  return userTime >= windowStart && userTime < windowEnd;
}

// Notification builders
function buildStudyPlanningNotification(userContext: UserContext): NotificationPayload {
  const messages = [
    `Good morning! What are your top study goals for today? Your AI is ready to help plan. ✨`,
    `Start your day strong! Your AI has personalized tips based on your recent notes.`,
    `Ready to learn? Your AI can help you review and plan your studies today.`,
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    user_id: userContext.user_id,
    type: 'study_planning',
    title: '📚 Daily Study Plan',
    message: msg,
    data: { category: 1 },
    action_url: '/chat?context=daily-planning',
  };
}

// ... similar builders for other categories
```

### Phase 3: Supabase Cron Job

**Update**: `supabase/config.toml`

```toml
[[jobs]]
name = "daily-notifications-engine"
schedule = "0 6 * * *"  # Daily at 6 AM UTC
command = "supabase functions invoke daily-notifications-engine"
```

### Phase 4: Frontend Extensions

#### Update Notification Preferences UI
**File**: `src/components/settings/UserSettings.tsx` (extend notifications section)

```tsx
// Add these sections to notification preferences card:

<div className="space-y-4 mt-6">
  <h3 className="font-semibold">Daily Engagement Notifications</h3>
  
  {/* Category toggles */}
  <label className="flex items-center gap-3">
    <input type="checkbox" defaultChecked={preferences.daily_categories?.study_planning} />
    <span>📚 Morning Study Planning (AI Chat Reminder)</span>
  </label>
  
  <label className="flex items-center gap-3">
    <input type="checkbox" defaultChecked={preferences.daily_categories?.quiz_challenge} />
    <span>🧠 Quiz Challenges (Mid-day Knowledge Tests)</span>
  </label>
  
  <label className="flex items-center gap-3">
    <input type="checkbox" defaultChecked={preferences.daily_categories?.group_nudge} />
    <span>💬 Study Group Activity (Community Nudges)</span>
  </label>
  
  <label className="flex items-center gap-3">
    <input type="checkbox" defaultChecked={preferences.daily_categories?.podcast_discovery} />
    <span>🎧 Podcast Discovery (Audio Learning)</span>
  </label>
  
  <label className="flex items-center gap-3">
    <input type="checkbox" defaultChecked={preferences.daily_categories?.progress_tracking} />
    <span>🔥 Progress & Re-engagement (Motivation Boosts)</span>
  </label>
  
  {/* Time preferences */}
  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded">
    <label className="block font-medium text-sm mb-2">Preferred Times</label>
    <TimePicker
      label="Study Planning (Morning)"
      value={preferences.preferred_notification_times?.study_planning?.[0]}
      onChange={(time) => updateTime('study_planning', time)}
    />
    <TimePicker
      label="Quiz Challenge (Afternoon)"
      value={preferences.preferred_notification_times?.quiz_challenge?.[0]}
      onChange={(time) => updateTime('quiz_challenge', time)}
    />
    {/* ... more time pickers */}
  </div>
  
  {/* Max per day */}
  <SliderInput
    label="Max Notifications Per Day"
    min={0}
    max={5}
    value={preferences.max_notifications_per_day}
    onChange={(max) => updatePreference('max_notifications_per_day', max)}
  />
</div>
```

#### Analytics Dashboard

**File**: `src/pages/admin/NotificationAnalytics.tsx`

```tsx
// New admin page showing:
export const NotificationAnalytics: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Notifications Sent"
          value="1,247"
          subtitle="This week"
          trend="+23%"
        />
        <KPICard
          title="Open Rate (CTR)"
          value="22.3%"
          subtitle="vs 8% industry avg"
          trend="✅ Excellent"
        />
        <KPICard
          title="Deep Link Conversion"
          value="43.2%"
          subtitle="% of clicks → action"
          trend="+15% from launch"
        />
        <KPICard
          title="DAU Lift"
          value="+245%"
          subtitle="From 2 → 7 daily active"
          trend="🚀 Major impact"
        />
      </div>

      {/* Per-Category Performance */}
      <ChartCard
        title="Performance by Category"
        chart={
          <BarChart data={[
            { category: 'Study Planning', opens: 34, clicks: 12, actions: 5 },
            { category: 'Quiz Challenge', opens: 28, clicks: 11, actions: 8 },
            { category: 'Group Nudge', opens: 15, clicks: 6, actions: 4 },
            { category: 'Podcast', opens: 22, clicks: 8, actions: 3 },
            { category: 'Progress', opens: 41, clicks: 18, actions: 9 },
          ]} />
        }
      />

      {/* Cohort Breakdown */}
      <TableCard
        title="Engagement Cohort Status"
        columns={['Tier', 'Users', 'Last Active', 'This Week Notifs', 'Opened', 'Actions']}
        rows={[
          ['Very Active', '15', '< 1 day', 89, 65, 42],
          ['Active', '34', '< 7 days', 167, 125, 71],
          ['Warm', '52', '7-30 days', 203, 78, 31],
          ['Cold', '222', '> 30 days', 788, 134, 42],
        ]}
      />
    </div>
  );
};
```

---

## Success Metrics & KPIs

### Primary Engagement Metrics
| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| **Daily Active Users (DAU)** | 20% (65 users) | 0.6% (2 users) | 🎯 32x |
| **7-day Engagement** | 25% | 6% | 🎯 4x |
| **Quiz Attempts/Week** | 50+ | 3-4 | 🎯 12x |
| **Social Posts/Week** | 25+ | ~2 | 🎯 12x |
| **Group Interactions/Week** | 20+ | ~2 | 🎯 10x |

### Notification-Specific KPIs
| Metric | Target | Notes |
|--------|--------|-------|
| **Open Rate (CTR)** | 20%+ | Industry avg 8-12%; we can do better with personalization |
| **Deep Link Conversion** | 40%+ | % of openers who click the call-to-action link |
| **Action Completion** | 30%+ | % of clickers who actually take the desired action (quiz, post, etc.) |
| **Opt-Out Rate** | <5% | Sign of notification fatigue; adjust if exceeds |
| **Unsubscribe Rate** | <2% | Major problem if notifs are unwanted |
| **Quiet Hours Compliance** | 98%+ | Tech reliability for respecting user preferences |

### Cohort-Specific Goals
| Cohort | Target Impact | Metric |
|--------|---------------|--------|
| **Very Active** (< 24h) | Maintain habit | 95% retention over 60d |
| **Active** (< 7d) | Deepen engagement | Move 60% of warm cohort here |
| **Warm** (7-30d) | Reactivate | Move 40% back to active |
| **Cold** (> 30d) | Win-back | Move 25% to warm in first 30d |

---

## Rollout Plan

### Phase 1: MVP (Week 1-2)
**Scope**: Categories 1 & 5 only; 10% user cohort (n=32)

**Tasks**:
- [ ] Create `user_activity_tracking` table + triggers
- [ ] Extend `notification_preferences` schema
- [ ] Build `daily-notifications-engine` function (study planning + progress only)
- [ ] Integrate with existing `send-notification` function
- [ ] Create `daily_notification_log` for tracking
- [ ] Deploy cron job (6 AM UTC daily)
- [ ] Beta launch to 10% random cohort
- [ ] Monitor: CTR, unsubscribe, notification compliance

**Success Criteria**:
- ✅ Notifications sending without errors
- ✅ CTR > 15%
- ✅ Unsubscribe rate < 3%
- ✅ Timezone/quiet hours working correctly

### Phase 2: Expansion (Week 3-4)
**Scope**: Add Categories 2, 3, 4; expand to 50% users; build settings UI

**Tasks**:
- [ ] Implement quiz challenge builder (auto-generate from notes)
- [ ] Implement group activity detection + notifications
- [ ] Implement podcast discovery algorithm
- [ ] Build notification preferences UI (category toggles + time selection)
- [ ] A/B test message templates (2 variants per category)
- [ ] Expand to 50% of users
- [ ] Analyze beta data; iterate on messages if CTR < 15%

**Success Criteria**:
- ✅ CTR maintained > 15% across all categories
- ✅ Group nudge driving 10+ group interactions/week
- ✅ Quiz notifications driving 20+ attempts/week
- ✅ No major complaints; <2% disable

### Phase 3: Optimization & Full Rollout (Week 5+)
**Scope**: 100% rollout; ML optimization; analytics dashboard

**Tasks**:
- [ ] Deploy analytics dashboard (admin panel)
- [ ] Implement ML optimal send time (per-user learning)
- [ ] Add sentiment analysis feedback loop (improve copy)
- [ ] Build re-engagement campaigns for cold cohort
- [ ] Consider email fallback (if push fails)
- [ ] 100% rollout to all users

**Success Criteria**:
- ✅ DAU reaches 20% target (65+ daily active)
- ✅ Quiz attempts 50+/week (12x baseline)
- ✅ Notification fatigue metrics stable (<3% opt-out)
- ✅ Analytics dashboard showing clear ROI per category

---

## Technical Guardrails

### Data Privacy & GDPR
- ✅ All notifications respect user `notification_preferences` (opt-in)
- ✅ Quiet hours enforced server-side (not client-side)
- ✅ No third-party tracking in notification data
- ✅ Delete notification logs with user data (GDPR compliance)

### Reliability
- ✅ Idempotent scheduled function (safe to retry)
- ✅ Error handling + logging (Sentry/DataDog integration)
- ✅ Rate limiting on send-notification edge function
- ✅ Deep links validated before sending (no 404s)
- ✅ Graceful fallback if feature is deleted (e.g., quiz removed but notif sent)

### Performance
- ✅ Batch notifications (not 1 per user sequentially)
- ✅ Indexed queries on `user_activity_tracking` (engagement_tier, last_active)
- ✅ `daily_notification_log` partitioned by date for analytics

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Notification Fatigue** | High | Low (users disable) | Hard cap 3/day; monitor unsubscribe |
| **Deep Link Breakage** | Medium | Medium (404s frustrate) | Validate links before sending; graceful fallback |
| **Timezone Bugs** | Medium | Medium (send at wrong time) | Thorough testing; fallback to UTC if invalid |
| **Preference Sync Issues** | Low | High (wrong users targeted) | Cache preferences; double-check before send |
| **Cold Cohort Over-targeting** | Medium | Low (some delete app) | Escalate gently; give them a full week before 3rd notif |

---

## Long-Term Vision (Q2-Q3 2026)

1. **Adaptive Personalization**: ML learns each user's ideal send time + message style
2. **Streaks & Gamification**: "7-day learning streak" badges in notifications
3. **Cross-Platform**: Email/SMS fallbacks when push fails
4. **Dynamic Content**: AI generates notification copy (vs. templates)
5. **In-App Timing**: Contextual notifications within app (not just push)
6. **Predictive Win-Back**: Identify users about to churn; send targeted win-back campaigns

---

## Summary

By launching this 5-category daily notification system, you'll transform StuddyHub from a "use it when you think about it" app into a daily habit. The current 0.6% DAU → 20% DAU target is achievable because:

1. **High-value features exist** — 663 AI chats, 363 notes, 1,232 documents, 7 groups
2. **Low friction** — Notifications are light-touch (not demanding), actionable (deep links), and personalized
3. **Psychological drivers** — Habit (morning routine), FOMO (group posts), gamification (streaks), celebration (progress)
4. **Data respect** — User preferences enforced; no spam

**Next Step**: Create a task board with the Phase 1 items and begin database schema work. Start with study planning + progress notifications (highest ROI per effort). Launch to 10% in Week 1, measure for 2 weeks, iterate, then expand.

