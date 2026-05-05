# Dashboard Implementation Guide
## Step-by-Step Build Instructions

**Date**: March 14, 2026  
**Target**: Build Phase 1 foundation in 1 week  
**Owner**: [Team Assignment]

---

## PHASE 1: FOUNDATION ARCHITECTURE

### Step 1.1: Update User Profile Schema

Add these fields to `user_profiles` table:

```sql
-- Streak tracking
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_date DATE,
ADD COLUMN IF NOT EXISTS daily_activity_last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_level INT DEFAULT 1;

-- Create user_daily_activity table for tracking
CREATE TABLE IF NOT EXISTS user_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  activity_date DATE NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'chat', 'quiz', 'note', 'post', 'group_interaction'
  action_count INT DEFAULT 1,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_date, activity_type)
);

-- Enable RLS
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own activity
CREATE POLICY "Users can only access own activity"
ON user_daily_activity FOR ALL
USING (auth.uid() = user_id);

-- Trigger to update streaks when activity occurs
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last activity date
  UPDATE user_profiles
  SET last_activity_date = CURRENT_DATE,
      daily_activity_last_synced_at = now()
  WHERE id = NEW.user_id;
  
  -- Update active streak (handled by separate scheduled function)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_daily_activity_insert
AFTER INSERT ON user_daily_activity
FOR EACH ROW
EXECUTE FUNCTION update_user_streak();

-- Scheduled function to calculate streaks (runs nightly at 1 AM UTC)
CREATE OR REPLACE FUNCTION public.calculate_daily_streaks()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT id FROM user_profiles
    WHERE last_activity_date >= CURRENT_DATE - INTERVAL '30 days'
  LOOP
    -- Check if user had activity today
    IF EXISTS (
      SELECT 1 FROM user_daily_activity 
      WHERE user_id = user_record.id 
      AND activity_date = CURRENT_DATE
    ) THEN
      -- Increment streak or start new
      UPDATE user_profiles
      SET current_streak = COALESCE(current_streak, 0) + 1,
          longest_streak = GREATEST(longest_streak, COALESCE(current_streak, 0) + 1)
      WHERE id = user_record.id AND last_activity_date = CURRENT_DATE;
    ELSE
      -- No activity today, reset streak (unless already reset today)
      UPDATE user_profiles
      SET current_streak = 0
      WHERE id = user_record.id AND last_activity_date < CURRENT_DATE;
    END IF;
  END LOOP;
END;
$$;

-- Also create a function to log activity from app
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_xp_earned INT DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_daily_activity (user_id, activity_date, activity_type, xp_earned, action_count)
  VALUES (p_user_id, CURRENT_DATE, p_activity_type, p_xp_earned, 1)
  ON CONFLICT (user_id, activity_date, activity_type)
  DO UPDATE SET 
    action_count = user_daily_activity.action_count + 1,
    xp_earned = user_daily_activity.xp_earned + EXCLUDED.xp_earned,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_user_activity TO authenticated;
```

### Step 1.2: Create Hook for Dashboard Stats

**File**: `src/hooks/useDashboardStats.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabaseClient } from '@/integrations/supabase/client';

export interface DashboardStats {
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  currentLevel: number;
  lastActivityDate: string | null;
  todayActivityCount: number;
  weekActivityCount: number;
  notesCount: number;
  documentsCount: number;
  quizzesCount: number;
  messagesCount: number;
  isNewUser: boolean; // < 7 days old
}

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboardStats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user?.id) throw new Error('No user');

      // Get user profile with streak info
      const { data: profile, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select(`
          current_streak,
          longest_streak,
          total_xp,
          current_level,
          last_activity_date,
          created_at
        `)
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get today's activity count
      const { data: todayActivity } = await supabaseClient
        .from('user_daily_activity')
        .select('action_count')
        .eq('user_id', user.id)
        .eq('activity_date', new Date().toISOString().split('T')[0]);

      // Get this week activity count
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: weekActivity } = await supabaseClient
        .from('user_daily_activity')
        .select('action_count')
        .eq('user_id', user.id)
        .gte('activity_date', weekAgo.toISOString().split('T')[0]);

      // Get content counts
      const [
        notesCount,
        docsCount,
        quizzesCount,
        chatsCount,
      ] = await Promise.all([
        supabaseClient
          .from('notes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabaseClient
          .from('documents')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabaseClient
          .from('quiz_attempts')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        supabaseClient
          .from('chat_sessions')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
      ]);

      const userCreatedAt = new Date(profile?.created_at);
      const daysOld = Math.floor((Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
      const isNewUser = daysOld < 7;

      return {
        currentStreak: profile?.current_streak ?? 0,
        longestStreak: profile?.longest_streak ?? 0,
        totalXp: profile?.total_xp ?? 0,
        currentLevel: profile?.current_level ?? 1,
        lastActivityDate: profile?.last_activity_date,
        todayActivityCount: todayActivity?.[0]?.action_count ?? 0,
        weekActivityCount: weekActivity?.reduce((sum, a) => sum + a.action_count, 0) ?? 0,
        notesCount: notesCount.count ?? 0,
        documentsCount: docsCount.count ?? 0,
        quizzesCount: quizzesCount.count ?? 0,
        messagesCount: chatsCount.count ?? 0,
        isNewUser,
      };
    },
    enabled: !!user?.id,
  });
}
```

### Step 1.3: Create Mode-Based Dashboard Component

**File**: `src/components/dashboard/Dashboard.tsx` (Replace existing)

```typescript
import React, { useMemo } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import DashboardNewUser from './DashboardNewUser';
import DashboardReturningUser from './DashboardReturningUser';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  const mode = useMemo(() => {
    if (isLoading) return 'loading';
    if (!stats) return 'loading';
    // New user mode: < 7 days AND very low engagement
    if (stats.isNewUser && stats.todayActivityCount === 0) return 'new';
    // Onboarding recovery: New user with some engagement
    if (stats.isNewUser) return 'new';
    // New member: Recently created but doesn't feel new anymore
    if (stats.currentStreak === 0 && stats.todayActivityCount === 0) return 'lapsed';
    // Regular active user
    return 'active';
  }, [stats, isLoading]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Render based on mode
  switch (mode) {
    case 'new':
    case 'lapsed':
      return <DashboardNewUser stats={stats} />;
    case 'active':
      return <DashboardReturningUser stats={stats} />;
    default:
      return <DashboardNewUser stats={stats} />;
  }
}
```

### Step 1.4: New User Dashboard Component

**File**: `src/components/dashboard/DashboardNewUser.tsx`

```typescript
import React from 'react';
import { DashboardStats } from '@/hooks/useDashboardStats';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface DashboardNewUserProps {
  stats: DashboardStats;
}

export default function DashboardNewUser({ stats }: DashboardNewUserProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 md:p-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Welcome to StudyHub, learner! 🚀
        </h1>
        <p className="text-blue-100 text-lg">
          Let's make your learning journey awesome. Start with any of these:
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Main CTA: AI Chat */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-8 border-none">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-4xl mb-3">🤖</div>
                <h2 className="text-2xl font-bold mb-2">Start with AI Study Assistant</h2>
                <p className="text-purple-100 mb-4">
                  Get personalized study help, quiz yourself, or explore new topics. 
                  63 other users are learning with AI right now.
                </p>
                <ul className="text-purple-100 space-y-2 text-sm mb-6">
                  <li>✨ Generate custom quizzes from your notes</li>
                  <li>📚 Get explanations you understand</li>
                  <li>🎯 Learn at your own pace</li>
                </ul>
                <Button
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-purple-50 font-bold"
                  onClick={() => navigate('/chat')}
                >
                  Start AI Chat Session →
                </Button>
              </div>
              <div className="hidden md:block text-6xl opacity-20">💬</div>
            </div>
          </Card>
        </div>

        {/* Quick Start Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Quick Start Setup (2-5 min each)</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <QuickStartCard
              icon="📓"
              title="Create Your First Note"
              description="Turn your ideas into organized study material"
              action="Create Note"
              onClick={() => navigate('/notes?action=new')}
            />
            <QuickStartCard
              icon="📤"
              title="Upload Study Materials"
              description="PDFs, images, documents - organize everything"
              action="Upload"
              onClick={() => navigate('/documents?action=upload')}
            />
            <QuickStartCard
              icon="👥"
              title="Join a Study Group"
              description="Learn with friends, ask questions, help others"
              action="Explore Groups"
              onClick={() => navigate('/social?tab=groups')}
            />
          </div>
        </div>

        {/* Learning Style Card */}
        <div className="mb-8">
          <Card className="p-6 border-2 border-blue-200 bg-blue-50 dark:bg-slate-800 dark:border-blue-900">
            <h3 className="text-lg font-bold mb-2">📚 Personalized for You</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We know you're a visual learner. Check out resources with lots of diagrams, 
              mind maps, and visual explanations.
            </p>
            <Button variant="outline" onClick={() => navigate('/library')}>
              Browse Recommended Courses
            </Button>
          </Card>
        </div>

        {/* Social Proof */}
        <div className="mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">📊 What Others Are Doing</h3>
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <StatBox label="Users Active Today" value={stats.todayActivityCount ? '45+' : '45+'} />
              <StatBox label="Quizzes Created" value="127" />
              <StatBox label="Study Groups Active" value="7" />
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-4 text-sm">
              You've got this! Join thousands learning together 💪
            </p>
          </Card>
        </div>

        {/* Content Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="font-bold mb-3">🎧 Today's Podcast</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              "Learning Fundamentals" - Perfect for beginners (8 min)
            </p>
            <Button variant="outline" className="w-full">
              Listen Now
            </Button>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold mb-3">💡 Pro Tip</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Quiz yourself 2 hours after studying to boost retention by 40%
            </p>
            <Button variant="outline" className="w-full">
              Learn More
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickStartCard({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{description}</p>
      <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0">
        {action} →
      </Button>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
```

### Step 1.5: Returning User Dashboard Component

**File**: `src/components/dashboard/DashboardReturningUser.tsx`

```typescript
import React from 'react';
import { DashboardStats } from '@/hooks/useDashboardStats';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';

interface DashboardReturningUserProps {
  stats: DashboardStats;
}

export default function DashboardReturningUser({ stats }: DashboardReturningUserProps) {
  const navigate = useNavigate();
  const xpToNextLevel = (stats.currentLevel * 500) - stats.totalXp;
  const xpProgress = ((stats.totalXp % 500) / 500) * 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Streak & Daily Status */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-orange-400 to-red-500 text-white border-none">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-4xl font-bold">{stats.currentStreak}🔥</div>
              <p className="text-orange-100">Day Streak</p>
            </div>
            {stats.currentStreak > 0 && (
              <div className="text-sm bg-black/20 px-3 py-1 rounded-full">
                +{stats.currentStreak > 7 ? '🌟' : '⭕'} Today
              </div>
            )}
          </div>
          <Button
            className="w-full bg-white text-orange-600 hover:bg-orange-50"
            onClick={() => navigate('/dashboard?tab=goals')}
          >
            Maintain Streak
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Level {stats.currentLevel}</h3>
          <div className="text-3xl font-bold mb-3">{stats.totalXp.toLocaleString()} XP</div>
          <Progress value={xpProgress} className="mb-2" />
          <p className="text-xs text-gray-600">{xpToNextLevel} XP to level up</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">This Week</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Study Sessions</span>
              <span className="font-bold">{stats.weekActivityCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Badges Earned</span>
              <span className="font-bold">3</span>
            </div>
            <Button variant="ghost" className="w-full mt-2 text-blue-600">
              View Analytics →
            </Button>
          </div>
        </Card>
      </div>

      {/* Daily Goals */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Today's Learning Goals</h2>
          <div className="text-sm text-gray-600">2 of 3 completed</div>
        </div>
        <div className="space-y-3">
          <GoalItem completed label="Complete one AI chat session" xp="+25 XP" />
          <GoalItem completed label="Review Chapter 5" xp="+50 XP" />
          <GoalItem
            label="Help someone in study group"
            xp="+75 XP"
            onClick={() => navigate('/social?tab=groups')}
          />
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: AI Chat & Quizzes */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Chat Widget */}
          <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-none">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-3xl mb-2">🤖</div>
                <h3 className="text-xl font-bold mb-1">AI Study Session</h3>
                <p className="text-purple-100 text-sm">
                  Your assistant is ready to help. 63 others chatting right now.
                </p>
              </div>
            </div>
            <div className="bg-black/10 rounded p-3 mb-4">
              <p className="text-sm">
                "You studied Binary Trees 3 days ago. Ready for a deep-dive or quick quiz?"
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button
                className="bg-white text-purple-600 hover:bg-purple-50 flex-1"
                onClick={() => navigate('/chat')}
              >
                Continue Chat →
              </Button>
              <Button
                variant="secondary"
                className="bg-purple-400 text-white hover:bg-purple-300 flex-1"
                onClick={() => navigate('/quizzes?action=generate')}
              >
                Quiz Me
              </Button>
            </div>
          </Card>

          {/* Quick Quizzes */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">📊 Quick Knowledge Check</h3>
            <div className="space-y-3">
              <QuizOption
                topic="Binary Trees"
                lastStudied="3 days ago"
                onClick={() => navigate('/quizzes?topic=binary-trees')}
              />
              <QuizOption
                topic="Organic Chemistry"
                lastStudied="Yesterday"
                onClick={() => navigate('/quizzes?topic=organic-chem')}
              />
              <div className="pt-3 border-t">
                <Button variant="outline" className="w-full">
                  View All Topics
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Stats & Social */}
        <div className="space-y-6">
          {/* Study Groups */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">👥 Your Groups (7)</h3>
            <div className="space-y-3">
              <GroupCard
                name="Biology 101"
                status="🔥 Active now"
                count="3 members online"
                onClick={() => navigate('/social?group=bio101')}
              />
              <GroupCard
                name="Calculus Help"
                status="Quiet"
                count="Last post 10d ago"
              />
            </div>
            <Button variant="outline" className="w-full mt-4">
              Browse All
            </Button>
          </Card>

          {/* Achievements */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">🏆 Recent Badges</h3>
            <div className="flex gap-2 flex-wrap">
              <Badge emoji="🔥" label="Streak 7" />
              <Badge emoji="🧠" label="Quiz Master" />
              <Badge emoji="🙌" label="Helpful" />
            </div>
            <Button variant="ghost" className="w-full mt-3 text-blue-600">
              View All Achievements
            </Button>
          </Card>

          {/* Content Recommendation */}
          <Card className="p-6 bg-blue-50 dark:bg-blue-900">
            <h3 className="font-bold mb-2">💡 Recommended</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              "Advanced Calculus" - Matches your level
            </p>
            <Button variant="outline" className="w-full">
              Start Course
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GoalItem({
  completed = false,
  label,
  xp,
  onClick,
}: {
  completed?: boolean;
  label: string;
  xp: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center p-3 rounded border ${
        completed
          ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700'
          : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
      } cursor-pointer hover:shadow-sm transition`}
      onClick={onClick}
    >
      <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
        completed
          ? 'bg-green-500 border-green-500 text-white'
          : 'border-gray-400'
      }`}>
        {completed && '✓'}
      </div>
      <div className="flex-1">
        <p className={completed ? 'text-green-700 line-through dark:text-green-300' : ''}>
          {label}
        </p>
      </div>
      <span className="text-sm font-bold text-blue-600">{xp}</span>
    </div>
  );
}

function QuizOption({
  topic,
  lastStudied,
  onClick,
}: {
  topic: string;
  lastStudied: string;
  onClick: () => void;
}) {
  return (
    <div
      className="p-3 rounded border border-gray-200 hover:border-blue-400 cursor-pointer hover:shadow-sm transition"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{topic}</p>
          <p className="text-xs text-gray-600">Last studied: {lastStudied}</p>
        </div>
        <span className="text-blue-600">→</span>
      </div>
    </div>
  );
}

function GroupCard({
  name,
  status,
  count,
  onClick,
}: {
  name: string;
  status: string;
  count: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="p-3 rounded border border-gray-200 hover:shadow-sm transition cursor-pointer"
      onClick={onClick}
    >
      <p className="font-semibold text-sm">{name}</p>
      <p className="text-xs text-gray-600">{status}</p>
      <p className="text-xs text-gray-500">{count}</p>
    </div>
  );
}

function Badge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded bg-white dark:bg-slate-700">
      <div className="text-2xl">{emoji}</div>
      <p className="text-xs font-semibold text-center">{label}</p>
    </div>
  );
}
```

---

## INTEGRATION POINTS: Activity Logging

### Update your main features to log activity

**In AiChat.tsx** - After successful message/exchange:
```typescript
import { supabaseClient } from '@/integrations/supabase/client';

// After chat session completes
const logChatActivity = async (userId: string) => {
  await supabaseClient.rpc('log_user_activity', {
    p_user_id: userId,
    p_activity_type: 'chat',
    p_xp_earned: 10 // Per 5 minutes of chat
  });
};
```

**In Quizzes.tsx** - After quiz completion:
```typescript
const logQuizActivity = async (userId: string, score: number) => {
  const xpEarned = 25 + Math.floor((score / 5)); // Bonus for score
  await supabaseClient.rpc('log_user_activity', {
    p_user_id: userId,
    p_activity_type: 'quiz',
    p_xp_earned: xpEarned
  });
};
```

**In NoteEditor.tsx** - After create/update:
```typescript
const logNoteActivity = async (userId: string) => {
  await supabaseClient.rpc('log_user_activity', {
    p_user_id: userId,
    p_activity_type: 'note',
    p_xp_earned: 30
  });
};
```

---

## TESTING CHECKLIST

- [ ] New user sees DashboardNewUser component with all CTAs
- [ ] Returning user sees DashboardReturningUser with streak/goals
- [ ] Streak increments correctly on daily activity
- [ ] XP calculation adds up properly
- [ ] Navigation to features works from all dashboard widgets
- [ ] Stats update in real-time as user interacts
- [ ] Responsive design on mobile
- [ ] Dark mode support

---

## ROLLOUT PLAN

1. **Day 1**: Deploy database changes + hooks
2. **Day 2-3**: Deploy new dashboard components
3. **Day 4**: Enable for 10% of users (A/B test)
4. **Day 5-6**: Monitor metrics, fix bugs
5. **Day 7**: Roll out to 100% if metrics improve
6. **Week 2**: Begin Phase 2 (gamification enhancements)

---

## EXPECTED METRICS UPLIFT

| Metric | Now | Week 1 | Week 2 | Month 1 |
|--------|-----|--------|--------|---------|
| Dashboard CTR | N/A | 35% | 50% | 65% |
| AI Chat Daily | 5 | 12 | 25 | 40 |
| Quiz Attempts | 16 total | 50+ | 150+ | 300+ |
| Avg Session | 8 min | 12 min | 18 min | 25 min |

Start building! 🚀
