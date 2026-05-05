# StudyHub Dashboard Redesign 2026
## Smooth Onboarding-to-Daily Engagement Transition

**Date**: March 14, 2026  
**Problem**: 0.6% DAU (2/323 users) despite strong AI Chat usage (663 sessions)  
**Goal**: Design a dashboard that makes users want to return daily by providing clear value, habit loops, and seamless navigation

---

## EXECUTIVE SUMMARY

### Current State Analysis
| Metric | Value | Implication |
|--------|-------|-------------|
| Daily Active Users | 0.6% (2/323) | **CRITICAL** - Activation funnel broken |
| AI Chat Sessions | 663 | ✅ **Strongest feature** - Use as engagement hook |
| Quiz Attempts | 16 lifetime | ❌ **Severely underutilized** |
| Social Posts | ~2/week | ❌ **Dormant** - Community not activated |
| Study Groups | 7 (inactive) | ❌ **Potential untapped** |
| Learning Consumption | High (docs, notes) | ✅ **Users engage with content** |

### Root Causes
1. **No clear Entry Point**: New users see empty dashboards (no notes, quizzes, or social activity yet)
2. **Missing Habit Loops**: No daily streaks, badges, or gamification
3. **Weak CTAs**: Dashboard widgets don't compel action
4. **Disconnected Features**: No seamless path from onboarding → AI Chat → Quizzes → Social
5. **No Progress Visibility**: Stats exist but aren't actionable or celebratory

---

## DESIGN PRINCIPLE: "Warm Handoff"

From onboarding completion → Dashboard should feel like a personal study assistant greeting you, not a blank canvas.

**Key Principles:**
- ✅ **Meet users where they are**: First-time visitors see different content than returning users
- ✅ **Celebrate small wins**: Show streaks, badges, and progress immediately
- ✅ **Reduce friction**: One-tap access to strongest feature (AI Chat)
- ✅ **Build daily habits**: Time-based content (morning study goals, afternoon quizzes, evening reviews)
- ✅ **Social proof**: Show peer activity and achievements to motivate action

---

## PHASE 1: ONBOARDING → DASHBOARD TRANSITION (Immediate)

### 1.1 Onboarding Exit Flow

**Current**: Onboarding completes → User sent to index/dashboard.tsx  
**Improved**: Add post-onboarding sequence

```
OnboardingWizard (Step 5: Finish)
  ↓
NEW: Post-Completion Screen (3-5 seconds)
  - "Welcome to StudyHub! 🚀"
  - Quick 3-step animation:
    1. "Create or upload your first note"
    2. "AI assistant ready to help you study"
    3. "Connect with study groups and friends"
  - CTA: "Take me to my dashboard" OR "Start with AI Chat"
  ↓
Dashboard with POST-ONBOARDING MODE active
  - Shows "You're all set!" checklist overlay
  - Guides through quick wins (create first note, try AI chat)
  - Dismissible, but stays visually prominent until next action
```

### 1.2 New User Dashboard Layout

**For users with < 1 week activity:**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: "Welcome Back, [Name]! Let's make today count." │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  YOUR STUDY GOALS FOR TODAY              [3 Quick Goals] │
│  ┌─ #1 Learn one new concept today                    ┐  │
│  │                                                      │  │
│  │  [Continue from yesterday] [Pick from suggestions] │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  TODAY'S TOP OPPORTUNITY              [AI Chat is ready]  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🤖 Your AI Study Assistant                          │  │
│  │ "Hey! Ready to work through that biology topic?"   │  │
│  │ → Smart quiz on last 5 documents                   │  │
│  │ → Learn new concept + practice                      │  │
│  │ → Practice for upcoming test                        │  │
│  │                                                    │  │
│  │ [Start AI Chat] or [Generate Quiz] ← 2 CTAs        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
│  QUICK START WIDGETS (First-time user setup)              │
│  ┌─────────────────┬──────────────┬──────────────┐        │
│  │ 📓 Create Note  │ 📤 Upload    │ 👥 Join a   │        │
│  │                │    Document  │     Group   │        │
│  │ Get feedback    │ Organize all│ Study with  │        │
│  │ from AI         │ your study  │ friends if  │        │
│  │                │ materials   │ needed      │        │
│  │ [Start] 2min   │ [Browse]    │ [Explore]   │        │
│  └─────────────────┴──────────────┴──────────────┘        │
│                                                             │
│ LEARNING STYLE REMINDER                                    │
│ Based on your profile: [Visual Learner]                   │
│ → Suggested next: "Diagrams & Mind Maps Course"           │
│ [Explore Courses]                                         │
│                                                             │
│ WHAT OTHERS ARE DOING (Social proof)                      │
│ • 45 people studied for 30+ min today                    │
│ • 12 new quizzes created this week                       │
│ "You've got this! 💪"                                    │
│                                                             │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Returning User Dashboard (7+ days activity)

```
┌─────────────────────────────────────────────────────────┐
│ LIVE STREAK CELEBRATION & DAILY GOALS                   │
│ 🔥 7-Day Streak! | 🎯 4/5 Goals Today | +200 XP         │
├─────────────────────────────────────────────────────────┤
│ TODAY'S MOMENTUM                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ✅ Completed: 2 AI chats | 1 Quiz | Added 2 notes   │ │
│ │ ⏳ In Progress: Biology prep (30 min remaining)      │ │
│ │ 💪 Just one more study goal to keep your 7-day      │ │
│ │    streak alive! [See challenges]                   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ DASHBOARD TABS (Standard view)                            │
│ [Overview] [Analytics] [Activity] [Goals] [Social]       │
│                                                           │
│ SECTION 1: AI ASSISTANT (Persistent favorite)            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🤖 AI Study Session                                  │ │
│ │ "You've learned about [Topic]. Ready to quiz?"      │ │
│ │ OR                                                   │ │
│ │ "Your group [Name] has new questions. Help out?"   │ │
│ │                                                      │ │
│ │ [Continue Previous Chat] [New Chat Topic]           │ │
│ │ [Quiz Yourself] [Practice Problem]                 │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ SECTION 2: YOUR PROGRESS (Gamification hub)              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ BADGES & ACHIEVEMENTS                                │ │
│ │ 🏆 [Streak 7] [Quiz Master] [Helpful] [Guide]       │ │
│ │ Next badge: 10-day streak (3 more days!)           │ │
│ │                                                      │ │
│ │ WEEKLY STATS                                         │ │
│ │ 📊 Study Time: 4h 30m (avg 50m/day) ↑ 20% vs week  │ │
│ │ 🧠 Quizzes: 9 completed (85% avg score)            │ │
│ │ 🎯 Learning Goals: 5/7 completed this week         │ │
│ │ [View Full Analytics]                               │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ SECTION 3: WHAT'S DUE / UPCOMING (Context)              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📅 COMING UP                                         │ │
│ │ • Your Biology quiz (Thursday) - Start prep now     │ │
│ │ • Study group meeting (Today 6 PM) - 3 others       │ │
│ │ • Review: Chapter 5 (You haven't visited in 7 days) │ │
│ │ [Schedule] [Join Group] [Review Now]                │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ SECTION 4: YOUR NETWORK (Social activation)              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 65 followers | 23 following | 7 groups               │ │
│ │                                                      │ │
│ │ RECENT FROM YOUR NETWORK                             │ │
│ │ • [Friend] posted "Help! Thermodynamics?!"          │ │
│ │ • [Group: Biology 101] 2 new questions              │ │
│ │ • [Trending] "Best study music playlists" (234 👍)  │ │
│ │                                                      │ │
│ │ [Browse Feed] [Suggest Study Buddy]                 │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ SECTION 5: LEARN SOMETHING NEW (Content hook)            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🎧 PODCAST: "Biochemistry Explained" (12 min)        │ │
│ │ 📚 COURSE: "Advanced Calculus" (2 new modules)       │ │
│ │ 🎯 CHALLENGE: "5-Minute Brain Boost" (daily)         │ │
│ │ [Explore]                                            │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ FOOTER: Time-based tip                                    │
│ 💡 Tip: Best time to quiz is 2 hours after studying    │ │
│         Your next optimal time: 4:30 PM today          │ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## PHASE 2: GAMIFICATION & HABIT LOOPS (Weeks 1-2)

### 2.1 Daily Streak System

**Visual Representation**:
```
🔥 7-Day Streak  [Status: On Track] [+1 Today] [Maintain]
[🔥][🔥][🔥][🔥][🔥][🔥][⭕]  ← Visual chain

Daily Streak Maintenance:
- At least 1 "Learning Action" per day = +1 day
- Learning Actions: AI Chat, Quiz, Note Creation, Group Contribution
- Miss a day? Streak resets to 0
- Warn users at 12 PM if no activity yet that day
- Missed streak? "Reclaim my streak" option (use 5 bonus points to restore)
```

**Notification Integration**:
- 7 AM: "Good morning! Your 7-day streak is going strong! 🔥 One learning action today keeps it alive."
- 5 PM: "Still on track? 1 more action today to maintain your streak! [Quick Quiz] [Review]"
- 10 PM: "Great job today! You've maintained your 7-day streak. See you tomorrow! 😴"

### 2.2 Achievement Badges & Levels

**Badge Tiers** (Progressive unlocking):

| Badge | Unlock Condition | Visual | Reward |
|-------|-----------------|--------|--------|
| **Streak 3** | 3-day active streak | 🔥x3 | +50 XP, Profile badge |
| **Streak 7** | 7-day streak | 🔥 Flame | +200 XP |
| **Streak 30** | 30-day streak | 🌟 Star | +1000 XP, "Dedicated Learner" title |
| **Quiz Master** | 50 quizzes completed | 🧠 Brain | +300 XP |
| **Social Butterfly** | 20 posts/comments | 🦋 Butterfly | +100 XP, "Community Leader" |
| **First Note** | Create first note | 📝 Pen | +25 XP |
| **Helpful** | Help others (5 answers) | 🙌 Hands | +150 XP, Featured on leaderboard |
| **Night Owl** | Study after 10 PM (3x) | 🌙 Moon | +75 XP |
| **Early Bird** | Study before 8 AM (3x) | ☀️ Sun | +75 XP |
| **Knowledge Seeker** | Complete course module | 🎓 Grad Cap | +250 XP |
| **Podcast Fan** | Listen to 5 podcasts | 🎧 Headphones | +100 XP |
| **Top Scorer** | Quiz average > 90% | 🏆 Trophy | +400 XP, Leaderboard position |

**Display**: Achievement wall in user profile + dashboard progress section

### 2.3 XP & Leveling System

**Mechanics**:
```
XP Earned Per Action:
- Chat session: +10 XP (per 5 min, max 50)
- Quiz attempted: +25 XP + (score % ÷ 5)
- Question answered in group: +15 XP
- Post created: +20 XP
- Note created: +30 XP
- Daily login streak: +5 XP
- Helpful comment approved: +25 XP

Levels (Every 500 XP):
Level 1: 0 XP
Level 2: 500 XP
Level 3: 1000 XP
...
Level 50: 24,500 XP → "Master Learner"

Perks per level:
- Levels 1-5: Cosmetic badges only
- Levels 6-10: Unlock Discord community perks
- Levels 11-20: Priority support access
- Levels 21+: Featured in leaderboard, recommendation priority
```

### 2.4 Daily Goals System

**Three-Tier Daily Challenges**:

```
TODAY'S GOALS (Refreshes at 8 AM)

🎯 LIGHT (Easy - 5 min)
□ Open app and check dashboard    → +5 XP
□ Read one podcast summary         → +10 XP

🎯 MEDIUM (Normal - 20 min)
□ Complete one AI chat session     → +25 XP
□ Create a note or add flashcards  → +30 XP
□ Answer one group question        → +15 XP

🎯 INTENSE (Challenge - 45+ min)
□ Complete a practice quiz          → +25 XP + bonuses
□ Study for 30 minutes              → +50 XP
□ Complete a course module          → +100 XP
□ Teach someone: Write an answer    → +75 XP

Today: 2/3 goals complete
[Next: Medium goal - AI Chat] [View Leaderboard]
```

**Adaptive Goals**:
- New users: Show only Light/Medium
- Returning users: Mix based on past behavior
- Inactive users (7+ days): Show 1 very easy goal to re-engage

---

## PHASE 3: FEATURE ACTIVATION WIDGETS (Weeks 2-3)

### 3.1 AI Chat as Dashboard Widget

**Current Problem**: Users must navigate to chat tab. Solution: Sticky widget on dashboard.

```
STICKY WIDGET (Bottom Right, Mobile-style)
┌─────────────────────────┐
│ 🤖 Study with AI        │
├─────────────────────────┤
│ "What topic do you want │
│ to master today?"       │
│                         │
│ Quick prompts:          │
│ [Quiz me] [Explain]    │
│ [Practice] [Learn New]  │
│                         │
│ [Open Chat] [Close]     │
└─────────────────────────┘
History shows: Last 3 topics
Hover: "63 others are chatting now"
```

### 3.2 Quiz Generation Card

```
┌─────────────────────────────────────────┐
│ 🧠 QUICK KNOWLEDGE QUIZ                 │
├─────────────────────────────────────────┤
│ Auto-generate from your recent notes:   │
│                                         │
│ Last studied:                           │
│ • Chapter 5 (Binary Trees) - 3 days ago │
│ • Organic Chemistry - yesterday         │
│ • Calculus II - this morning            │
│                                         │
│ [Quiz me on Binary Tree] ← Recommended  │
│ [Custom Quiz] [Flashcards]              │
│                                         │
│ Personal record: 85% (12 quizzes)       │
│ Today's streak: 2 quizzes completed     │
└─────────────────────────────────────────┘
```

### 3.3 Study Group Activation Card

```
┌──────────────────────────────────────────┐
│ 👥 YOUR STUDY GROUPS (7 groups)         │
├──────────────────────────────────────────┤
│                                          │
│ 🔥 Biology 101 (ACTIVE NOW)             │
│    3 members online | 2 new posts       │
│    Latest: "How to tackle photosynthesis?"
│    [Join Discussion]                    │
│                                          │
│ Biology Lab Prep (Last active 2d ago)   │
│ "Hey! Who wants to review Tuesday's exp?"
│ [See 4+ comments]                       │
│                                          │
│ Calculus Help (Quiet - last post 10d)   │
│ Reviive this group? [Invite members]    │
│                                          │
│ [View All Groups] [Create Group]        │
└──────────────────────────────────────────┘
```

### 3.4 Network Activity (Social Proof)

```
┌──────────────────────────────────────────┐
│ 👥 NETWORK ACTIVITY (Last 24 hours)     │
├──────────────────────────────────────────┤
│                                          │
│ "Sarah helped [Unknown] with Calculus" │
│ "12 people completed their 3-day streak"
│ "New: 'Organic Chemistry Tips' podcast" │
│ "Maya joined [Prep Group]"              │
│                                          │
│ Suggested for you:                      │
│ "Alex" (Studying: Organic Chemistry)   │
│ Add as study buddy? [Yes] [Later]       │
│                                          │
│ [Browse Activity Feed]                  │
└──────────────────────────────────────────┘
```

---

## PHASE 4: PERSONALIZED CONTENT RECOMMENDATIONS (Week 3)

### 4.1 Learning Style-Based Dashboard Variations

**Visual Learner** → Emphasis on:
- Diagrams, mind maps in recommendations
- Video podcasts, visual course materials
- "Visual study guide of the day"

**Auditory Learner** → Emphasis on:
- Podcasts, audio explanations
- "Podcast study session" widget
- Voice note options for notes

**Kinesthetic Learner** → Emphasis on:
- Interactive quizzes, practice problems
- "Try this problem" challenges
- "Learn by doing" course modules

**Reading/Writing** → Emphasis on:
- Note-taking widgets
- Document organization
- Written explanations and summaries

### 4.2 Content Recommendation Engine

```
RECOMMENDED FOR YOU
Based on: Your learning style, recent studies, peer activity

📚 COURSES
"Advanced Organic Chemistry" (Your peer Alex loved this)
22 modules | 8.5/10 rating | Start learning

🎧 PODCAST THIS WEEK
"Mitochondria Explained" (12 min) - Matches your biology interests
► Play

💡 STUDY TIP
"Spaced repetition: Why you should quiz yourself 2 hours after studying"

📄 TRENDING IN YOUR GROUPS
"How to structure organic chemistry essays" (23👍 from Bio group)
```

---

## PHASE 5: NOTIFICATION SYNC (Ongoing)

**Dashboard integrates with Daily Engagement Notification Strategy**:

### 5.1 Notification Types & Dashboard CTAs

| Category | Timing | Dashboard Signal | CTA |
|----------|--------|------------------|-----|
| **Daily Study Goal** | 7-9 AM | "Your AI has today's plan" | [Open Chat] |
| **Quiz Challenge** | 12-2 PM | "2-min quiz ready!" | [Quiz Now] |
| **Group Nudge** | 4-6 PM | "Sarah asked a question" | [Join Group] |
| **Podcast** | 6-8 PM | "Perfect for your commute" | [Listen] |
| **Streak Reminder** | 5/10 PM | "Don't break your streak!" | [Complete Goal] |
| **Progress Celebration** | Weekly | "Amazing week! 🔥" | [View Stats] |

### 5.2 Push Notification Deep Linking

```
Notification Payload:
{
  "title": "Your 7-day streak is alive! 🔥",
  "body": "1 quiz away from keeping it. Ready?",
  "deepLink": "/dashboard?scroll=goals&highlight=quick-quiz",
  "context": {
    "suggestedAction": "quiz",
    "topicContext": "Binary Trees"
  }
}

Dashboard receives context and:
- Scrolls to appropriate widget
- Highlights suggested action
- Pre-populates quiz with context
```

---

## INFORMATION ARCHITECTURE: SEAMLESS NAVIGATION

### 6.1 Updated Tab Structure (from TabContent.tsx)

Current order (problem: dashboard is 5th, hard to find):
```
[Dashboard] [Notes] [Recordings] [Quizzes] [Schedule] [Chat] [Documents] [Social] [Podcasts] [Library]
```

**Recommended New Order** (frequency-based):
```
[Dashboard] [Chat] [Quizzes] [Notes] [Social] [Documents] [Recordings] [Schedule] [Podcasts] [Library] [Settings]
```

**Mobile**: Show top 5, "More" menu with rest

### 6.2 Quick Access Navigation

```
Mobile Bottom Tab Bar (Always visible):
[📊 Dashboard] [🤖 Chat] [📝 Notes] [📱 Social] [⚙️ Menu]

Desktop Sidebar (Context-aware):
📊 Dashboard
├─ Overview
├─ Analytics
└─ Goals

🤖 Saved Chats (Recent 3)

📝 My Notes (Recent 5)

📱 Social (Unread count)
├─ Feed
├─ My Groups (7)
└─ Messages

┗ More [▼]
```

---

## SPECIFIC DESIGN IMPROVEMENTS BY ROLE

### 7.1 Student Dashboard (Primary Focus)

**New Sections**:
1. **Morning Ritual Section** (7-9 AM optimal time)
   - Daily goal input
   - AI chat suggestion
   - "Let's make today productive" tone

2. **Momentum Tracker** (Real-time)
   - Streak counter
   - Goal progress bar
   - Today's XP earned
   - Time studied (auto-tracked via sessions)

3. **Decision Tree Widget**
   - "What do you want to do?"
   - → Learn something new → AI Chat or Course
   - → Practice what you know → Quizzes or Review
   - → Help others → Group or Q&A
   - → Discover content → Podcasts or Library

4. **Weekly Digest** (Sundays)
   - Stats summary
   - Badge unlocks
   - Peer comparisons (top learners)
   - What to focus on next week

### 7.2 Educator Dashboard Improvements

**New Sections**:
1. **Class Today** (Time-sensitive)
   - Scheduled classes/sessions
   - Pending student questions
   - Assignment due soon

2. **Student Progress Overview**
   - Quiz completion rates
   - Most struggling topics
   - Recommended interventions

3. **Content Performance**
   - Most popular resources
   - Engagement metrics by material
   - Student feedback summary

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)
- [ ] Create Dashboard.tsx redesign with new layout
- [ ] Add post-onboarding flow to OnboardingWizard
- [ ] Implement "new user mode" vs "returning user mode" logic
- [ ] Add streak tracking to user_profiles table

### Phase 2: Gamification (Week 2)
- [ ] Implement badge system (add achievements table)
- [ ] Add XP tracking and leveling
- [ ] Create daily goals system
- [ ] Build achievement display
- [ ] Update dashboard to show streaks/XP

### Phase 3: Widgets (Week 2-3)
- [ ] Build AI Chat sticky widget
- [ ] Create Quiz generation card
- [ ] Add Study group activation card
- [ ] Network activity feed widget
- [ ] Personalized recommendation engine

### Phase 4: Personalization (Week 3)
- [ ] Learning style-based dashboard variants
- [ ] Content recommendation algorithm
- [ ] Adaptive goal difficulty
- [ ] Personalized content feeds

### Phase 5: Notifications (Week 4)
- [ ] Integrate with notification strategy
- [ ] Add deep-linking logic
- [ ] Dashboard notification panel
- [ ] Integrate daily-notifications-engine function

### Phase 6: Analytics & Polish (Week 4-5)
- [ ] A/B test new dashboard vs old
- [ ] Dashboard engagement metrics
- [ ] Polish animations and UX
- [ ] Mobile responsiveness
- [ ] Performance optimization

---

## SUCCESS METRICS

**Tracking Dashboard Impact**:

| Metric | Current | Target (30 days) | Target (60 days) |
|--------|---------|------------------|------------------|
| DAU | 0.6% (2) | 5% (16) | 15% (49) |
| MAU | 40% (130) | 50% (165) | 65% (210) |
| Avg Session Time | 8 min | 15 min | 25 min |
| Quiz Attempts | 16 total | 200 total | 500 total |
| Social Posts | 2/week | 10/week | 25/week |
| Return Rate (7-day) | 6% | 25% | 45% |
| Avg Streak Length | N/A | 3.5 days | 7+ days |
| Feature Adoption | AI Chat only | + Quizzes, Groups | All features |

**KPIs to Monitor**:
- Dashboard session duration (should increase)
- Feature click-through from dashboard (should increase)
- Time from dashboard landing to first action (should decrease)
- Repeat visit rate (should increase)
- New user conversion rate (% completing first quiz, question, or group interaction)

---

## TECHNICAL IMPLEMENTATION NOTES

### Database Changes Needed

```sql
-- New streak tracking
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_level INT DEFAULT 1;

-- Daily goals
CREATE TABLE IF NOT EXISTS daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  goal_date DATE DEFAULT CURRENT_DATE,
  goal_type VARCHAR(50), -- 'light', 'medium', 'intense'
  goal_description TEXT,
  xp_reward INT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, goal_date, goal_type)
);

-- Achievements/Badges
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_id VARCHAR(100), -- 'streak_3', 'quiz_master', etc
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  display_on_profile BOOLEAN DEFAULT true,
  UNIQUE(user_id, badge_id)
);

-- Activity log for streak/goal tracking
CREATE TABLE user_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  activity_date DATE DEFAULT CURRENT_DATE,
  activity_type VARCHAR(50), -- 'chat', 'quiz', 'note', 'post'
  action_count INT DEFAULT 1,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_date, activity_type)
);
```

### Component Structure

```
components/dashboard/
├── Dashboard.tsx (Main component - MODE logic)
├── DashboardNewUser.tsx (0-7 days)
├── DashboardReturningUser.tsx (7+ days)
├── DashboardWidgets/
│   ├── StreakTracker.tsx
│   ├── DailyGoals.tsx
│   ├── AIChatWidget.tsx
│   ├── QuizGenerator.tsx
│   ├── StudyGroupCard.tsx
│   ├── NetworkActivity.tsx
│   ├── AchievementsBadges.tsx
│   ├── XPLeveling.tsx
│   └── ContentRecommendations.tsx
├── hooks/
│   ├── useDashboardStats.ts (Update: add streaks, XP)
│   ├── useUserAchievements.ts
│   ├── useDailyGoals.ts
│   └── useStreakTracking.ts
└── utils/
    └── streakCalculator.ts
```

---

## CONCLUSION

This redesign transforms the dashboard from a **blank canvas** problem into a **personalized companion** that:

1. **Welcomes new users** with clear value and next steps
2. **Builds daily habits** through streaks, badges, and goals
3. **Activates weak features** (quizzes, social) through prominent widgets
4. **Leverages strongest feature** (AI Chat) as the entry point
5. **Creates FOMO-driven engagement** through peer activity and leaderboards
6. **Syncs with notifications** to drive repeated visits

**Expected Impact**: Moving from 0.6% → 15% DAU within 60 days by solving the activation funnel that currently exists.

---

## NEXT STEPS

1. **Review & Feedback**: Share this design with team
2. **Prioritize**: Phase 1 (foundation) is critical before other work
3. **Design**: Create Figma mockups for each user flow
4. **Develop**: Start with Phase 1 components
5. **Measure**: Track engagement metrics from day 1

Let's build a dashboard that makes users want to come back daily.
