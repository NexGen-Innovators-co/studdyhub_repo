# Database Schema & Foreign Key Constraints

## Overview

This document catalogs all database schema migration files and their associated CREATE TABLE statements, with special attention to foreign key constraints and ON DELETE clauses.

---

## Migration Files Location

**Supabase migrations:** [supabase/migrations/](../supabase/migrations/)
**SQL migrations:** [sql/](../sql/)

---

## Key Tables with Foreign Key Analysis

### 1. **profiles** (Core User Profile)

**File:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  learning_style TEXT CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading')),
  learning_preferences JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  user_role TEXT CHECK (user_role IN ('student', 'school_admin', 'tutor_affiliated', 'tutor_independent')),
  role_verified_at TIMESTAMPTZ,
  role_verification_status TEXT DEFAULT 'pending',
  role_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_rejection_reason TEXT,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_role ON profiles(user_role);
CREATE INDEX idx_profiles_onboarding_completed ON profiles(onboarding_completed);
CREATE INDEX idx_profiles_verification ON profiles(role_verification_status);
```

**Foreign Keys:**
- `id` → `auth.users(id)` — **ON DELETE CASCADE**
- `role_verified_by` → `auth.users(id)` — **ON DELETE SET NULL**
- `institution_id` → `institutions(id)` — **ON DELETE SET NULL**

**Migration Files:**
- [sql/20260222_add_onboarding_and_role_to_profiles.sql](../sql/20260222_add_onboarding_and_role_to_profiles.sql)
- [sql/20260223_role_verification_system.sql](../sql/20260223_role_verification_system.sql)
- [sql/20260304_add_profile_institution_id.sql](../sql/20260304_add_profile_institution_id.sql)

---

### 2. **notification_preferences** (User Notification Settings)

**Location:** Created via Supabase (no CREATE TABLE in migrations - likely set up via studio or RPC)

**Current Structure** from [sql/20260317_backfill_notification_preferences.sql](../sql/20260317_backfill_notification_preferences.sql):

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  schedule_reminders BOOLEAN DEFAULT true,
  social_notifications BOOLEAN DEFAULT true,
  quiz_reminders BOOLEAN DEFAULT true,
  assignment_reminders BOOLEAN DEFAULT true,
  reminder_time INTEGER DEFAULT 30,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  user_timezone VARCHAR(50) DEFAULT 'UTC',
  max_notifications_per_day INTEGER DEFAULT 3,
  daily_categories JSONB DEFAULT '{}',
  -- Extended columns (from 20260313_add_daily_notifications_tables.sql)
  daily_engagement_enabled BOOLEAN DEFAULT true,
  daily_engagement_time TIME DEFAULT '07:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Foreign Keys:**
- `user_id` → `auth.users(id)` — **PRIMARY KEY, ON DELETE CASCADE**

**Related Files:**
- [sql/20260317_backfill_notification_preferences.sql](../sql/20260317_backfill_notification_preferences.sql)
- [supabase/migrations/20260313_add_daily_notifications_tables.sql](../supabase/migrations/20260313_add_daily_notifications_tables.sql)

---

### 3. **notes** (User Notes/Documents)

**File:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_folder ON notes(folder_id);
```

**Foreign Keys:**
- `user_id` → `profiles(id)` — **ON DELETE CASCADE** (cascades from profiles → auth.users)
- `folder_id` → `folders(id)` — **ON DELETE SET NULL**

---

### 4. **quizzes** (Quiz Definitions)

**File:** [sql/live_quiz_schema.sql](../sql/live_quiz_schema.sql) (live quiz sessions reference quizzes)

```sql
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quizzes_user ON quizzes(user_id);
CREATE INDEX idx_quizzes_category ON quizzes(category);
```

**Foreign Keys:**
- `user_id` → `profiles(id)` — **ON DELETE CASCADE**

**Related Tables:**
- [live_quiz_sessions](#live-quiz-tables) — references `quizzes(id)`
- [quiz_attempts](#quiz-attempts) — references `quizzes(id)` indirectly

---

### 5. **social_posts** (Social Feed Posts)

**File:** [sql/20260215_ai_feed_columns.sql](../sql/20260215_ai_feed_columns.sql)

```sql
-- Base table (created elsewhere, but altered in this file)
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS ai_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_sentiment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_quality_score smallint DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_ai_categories 
  ON social_posts USING GIN (ai_categories);

-- Related: social_user_signals table
CREATE TABLE IF NOT EXISTS social_user_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  signal_value real DEFAULT 1.0,
  categories text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_social_user_signals_user 
  ON social_user_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_user_signals_categories 
  ON social_user_signals USING GIN (categories);
```

**Foreign Keys:**
- `social_user_signals.user_id` → `social_users(id)` — **ON DELETE CASCADE**
- `social_user_signals.post_id` → `social_posts(id)` — **ON DELETE CASCADE**

---

## Migration Files by Category

### Educational Context Schema

**File:** [sql/20260301_educational_context_schema.sql](../sql/20260301_educational_context_schema.sql)

Creates the foundational educational framework:

#### **countries**
```sql
CREATE TABLE IF NOT EXISTS countries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  flag_emoji         text,
  official_languages text[] DEFAULT '{}',
  metadata           jsonb DEFAULT '{}',
  is_active          boolean DEFAULT true,
  sort_order         integer DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);
```

#### **education_levels**
```sql
CREATE TABLE IF NOT EXISTS education_levels (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id             uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  code                   text NOT NULL UNIQUE,
  name                   text NOT NULL,
  short_name             text,
  category               text NOT NULL,
  sort_order             integer DEFAULT 0,
  typical_start_age      integer,
  typical_duration_years integer,
  metadata               jsonb DEFAULT '{}',
  is_active              boolean DEFAULT true,
  created_at             timestamptz DEFAULT now()
);

-- Foreign Keys
-- country_id → countries(id) ON DELETE CASCADE
```

#### **curricula**
```sql
CREATE TABLE IF NOT EXISTS curricula (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id         uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  education_level_id uuid NOT NULL REFERENCES education_levels(id) ON DELETE CASCADE,
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  description        text,
  governing_body     text,
  metadata           jsonb DEFAULT '{}',
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- Foreign Keys
-- country_id → countries(id) ON DELETE CASCADE
-- education_level_id → education_levels(id) ON DELETE CASCADE
```

#### **examinations**
```sql
CREATE TABLE IF NOT EXISTS examinations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id  uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  typical_date   date,
  recurrence     text DEFAULT 'annual',
  metadata       jsonb DEFAULT '{}',
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- Foreign Keys
-- curriculum_id → curricula(id) ON DELETE CASCADE
```

#### **subjects**
```sql
CREATE TABLE IF NOT EXISTS subjects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id  uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  code           text NOT NULL,
  name           text NOT NULL,
  category       text DEFAULT 'core',
  sort_order     integer DEFAULT 0,
  metadata       jsonb DEFAULT '{}',
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(curriculum_id, code)
);

-- Foreign Keys
-- curriculum_id → curricula(id) ON DELETE CASCADE
```

#### **user_education_profiles**
```sql
CREATE TABLE IF NOT EXISTS user_education_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id             uuid REFERENCES countries(id),
  education_level_id     uuid REFERENCES education_levels(id),
  curriculum_id          uuid REFERENCES curricula(id),
  target_examination_id  uuid REFERENCES examinations(id),
  institution_name       text,
  year_or_grade          text,
  expected_completion    date,
  goals                  jsonb DEFAULT '[]',
  metadata               jsonb DEFAULT '{}',
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE CASCADE
-- country_id → countries(id) (no constraint)
-- education_level_id → education_levels(id) (no constraint)
-- curriculum_id → curricula(id) (no constraint)
-- target_examination_id → examinations(id) (no constraint)
```

#### **user_subjects**
```sql
CREATE TABLE IF NOT EXISTS user_subjects (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_education_profile_id uuid NOT NULL REFERENCES user_education_profiles(id) ON DELETE CASCADE,
  subject_id                uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_primary                boolean DEFAULT false,
  created_at                timestamptz DEFAULT now(),
  UNIQUE(user_education_profile_id, subject_id)
);

-- Foreign Keys
-- user_education_profile_id → user_education_profiles(id) ON DELETE CASCADE
-- subject_id → subjects(id) ON DELETE CASCADE
```

---

### Educator Platform Schema

**File:** [sql/20260301_educator_platform_schema.sql](../sql/20260301_educator_platform_schema.sql)

#### **institutions**
```sql
CREATE TABLE IF NOT EXISTS institutions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    slug                text NOT NULL UNIQUE,
    type                text NOT NULL DEFAULT 'school',
    country_id          uuid REFERENCES countries(id),
    education_level_id  uuid REFERENCES education_levels(id),
    address             text,
    city                text,
    region              text,
    website             text,
    logo_url            text,
    description         text,
    verification_status text NOT NULL DEFAULT 'unverified',
    verified_by         uuid REFERENCES admin_users(id),
    verified_at         timestamptz,
    settings            jsonb DEFAULT '{}'::jsonb,
    metadata            jsonb DEFAULT '{}'::jsonb,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);
```

**Foreign Keys:**
- `country_id` → `countries(id)` (no constraint)
- `education_level_id` → `education_levels(id)` (no constraint)
- `verified_by` → `admin_users(id)` (no constraint)

#### **institution_members**
```sql
CREATE TABLE IF NOT EXISTS institution_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'student',
    status          text NOT NULL DEFAULT 'pending',
    title           text,
    department      text,
    invited_by      uuid REFERENCES auth.users(id),
    invite_code     text,
    joined_at       timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE(institution_id, user_id)
);

-- Foreign Keys
-- institution_id → institutions(id) ON DELETE CASCADE
-- user_id → auth.users(id) ON DELETE CASCADE
-- invited_by → auth.users(id) (no constraint)
```

#### **institution_invites**
```sql
CREATE TABLE IF NOT EXISTS institution_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    email           text NOT NULL,
    role            text NOT NULL DEFAULT 'educator',
    invited_by      uuid NOT NULL REFERENCES auth.users(id),
    status          text NOT NULL DEFAULT 'pending',
    token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at      timestamptz DEFAULT (now() + interval '7 days'),
    created_at      timestamptz DEFAULT now(),
    UNIQUE(institution_id, email, status)
);

-- Foreign Keys
-- institution_id → institutions(id) ON DELETE CASCADE
-- invited_by → auth.users(id) (no constraint)
```

---

### Live Quiz Schema

**File:** [sql/live_quiz_schema.sql](../sql/live_quiz_schema.sql)

#### **live_quiz_sessions**
```sql
CREATE TABLE public.live_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
  host_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  join_code text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Foreign Keys
-- quiz_id → quizzes(id) (no constraint specified)
-- host_user_id → auth.users(id) (no constraint specified)
```

#### **live_quiz_players**
```sql
CREATE TABLE public.live_quiz_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_quiz_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  display_name text,
  join_time timestamp with time zone DEFAULT now(),
  score integer DEFAULT 0,
  is_host boolean DEFAULT false,
  last_answered_at timestamp with time zone,
  CONSTRAINT unique_player_per_session UNIQUE (session_id, user_id)
);

-- Foreign Keys
-- session_id → live_quiz_sessions(id) ON DELETE CASCADE
-- user_id → auth.users(id) (no constraint specified)
```

#### **live_quiz_questions**
```sql
CREATE TABLE public.live_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_quiz_sessions(id) ON DELETE CASCADE,
  question_index integer NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer integer NOT NULL,
  explanation text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  CONSTRAINT unique_question_per_session UNIQUE (session_id, question_index)
);

-- Foreign Keys
-- session_id → live_quiz_sessions(id) ON DELETE CASCADE
```

#### **live_quiz_answers**
```sql
CREATE TABLE public.live_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_quiz_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.live_quiz_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  answer_index integer NOT NULL,
  answered_at timestamp with time zone DEFAULT now(),
  is_correct boolean,
  points_awarded integer DEFAULT 0,
  CONSTRAINT unique_answer_per_user_per_question UNIQUE (question_id, user_id)
);

-- Foreign Keys
-- session_id → live_quiz_sessions(id) ON DELETE CASCADE
-- question_id → live_quiz_questions(id) ON DELETE CASCADE
-- user_id → auth.users(id) (no constraint specified)
```

---

### Course Integration Schema

**File:** [sql/course_integration_phase1.sql](../sql/course_integration_phase1.sql)

#### **course_enrollments**
```sql
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_accessed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  UNIQUE(course_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON public.course_enrollments(status);

-- Foreign Keys
-- course_id → courses(id) ON DELETE CASCADE
-- user_id → profiles(id) ON DELETE CASCADE
```

#### **course_resources**
```sql
CREATE TABLE IF NOT EXISTS public.course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'quiz', 'podcast', 'note', 'recording')),
  resource_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(course_id, resource_type, resource_id)
);

-- Foreign Keys
-- course_id → courses(id) ON DELETE CASCADE
-- created_by → profiles(id) (no constraint specified)
```

#### **course_progress**
```sql
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.course_resources(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, resource_id)
);

-- Foreign Keys
-- enrollment_id → course_enrollments(id) ON DELETE CASCADE
-- resource_id → course_resources(id) ON DELETE CASCADE
```

---

### Activity Tracking & Notifications

**File:** [supabase/migrations/20260313_add_daily_notifications_tables.sql](../supabase/migrations/20260313_add_daily_notifications_tables.sql)

#### **user_activity_tracking**
```sql
CREATE TABLE IF NOT EXISTS public.user_activity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE CASCADE (UNIQUE)
```

#### **daily_notification_log**
```sql
CREATE TABLE IF NOT EXISTS public.daily_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  category INT CHECK (category >= 1 AND category <= 5),
  scheduled_send_at TIMESTAMPTZ NOT NULL,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_user
  ON public.daily_notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_category
  ON public.daily_notification_log(category, opened_by_user);

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE CASCADE
```

---

### Podcast & Audio Systems

**File:** [sql/20260222_podcast_credit_system.sql](../sql/20260222_podcast_credit_system.sql)

#### **podcast_credits**
```sql
CREATE TABLE IF NOT EXISTS public.podcast_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  last_monthly_grant_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE CASCADE (UNIQUE)
```

#### **podcast_credit_transactions**
```sql
CREATE TABLE IF NOT EXISTS public.podcast_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'monthly_grant', 'purchase', 'generation_audio', 'generation_image',
    'generation_video', 'refund', 'admin_adjustment', 'bonus'
  )),
  description text,
  reference_id text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE CASCADE
```

#### **podcast_credit_packs**
```sql
CREATE TABLE IF NOT EXISTS public.podcast_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_ghs numeric(10,2) NOT NULL,
  price_display text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- No foreign keys
```

---

### System Logging & Error Handling

**File:** [sql/20260223_system_error_logs.sql](../sql/20260223_system_error_logs.sql)

#### **system_error_logs**
```sql
CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity      TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  source        TEXT NOT NULL,
  component     TEXT,
  error_code    TEXT,
  message       TEXT NOT NULL,
  details       JSONB DEFAULT '{}'::jsonb,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id    TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Keys
-- user_id → auth.users(id) ON DELETE SET NULL
-- resolved_by → auth.users(id) ON DELETE SET NULL
```

---

### Platform Updates & Admin

**File:** [sql/20260303_platform_updates.sql](../sql/20260303_platform_updates.sql)

#### **platform_updates**
```sql
CREATE TABLE IF NOT EXISTS public.platform_updates (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title  TEXT NOT NULL,
  body   TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Keys
-- created_by → auth.users(id) ON DELETE CASCADE
-- updated_by → auth.users(id) ON DELETE SET NULL
```

#### **platform_update_reads**
```sql
CREATE TABLE IF NOT EXISTS public.platform_update_reads (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id      UUID NOT NULL REFERENCES public.platform_updates(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign Keys
-- update_id → platform_updates(id) ON DELETE CASCADE
-- user_id → auth.users(id) ON DELETE CASCADE
```

---

## Summary of Foreign Key Patterns

### ON DELETE CASCADE
Used when child records have no meaning without their parent:

- User-created content: `notes`, `quizzes`, `podcasts`, `documents`
- Activity tracking: `user_activity_tracking`, `daily_notification_log`
- Enrollment/participation: `course_enrollments`, `institution_members`
- Session data: `live_quiz_sessions`, `live_quiz_answers`
- Credits & transactions: `podcast_credits`, `podcast_credit_transactions`
- Educational framework hierarchies: `education_levels` → `countries`

**Guideline:** ✅ Use CASCADE when the child record is exclusively owned by the parent

### ON DELETE SET NULL
Used when preserving data history and audit trails:

- Role verification: `profiles.role_verified_by`
- Platform updates: `platform_updates.updated_by` (last editor)
- Error logs: `system_error_logs.resolved_by` (keeps error history)
- Optional references: `notes.folder_id`, `institutions.verified_by`

**Guideline:** ✅ Use SET NULL when you want to preserve audit history or allow optional relationships

### No Constraint Specified
Many current migrations don't specify ON DELETE behavior, likely relying on:

- Supabase RLS policies to prevent orphaned records
- Application-level cascade logic
- Future migration to add explicit constraints

**Current Tables without explicit constraints:**
- `live_quiz_sessions.quiz_id`, `live_quiz_sessions.host_user_id`
- `live_quiz_players.user_id`
- `course_resources.created_by`
- `institutions.verified_by`

---

## Files Index

| File Path | Purpose | Key Tables |
|-----------|---------|-----------|
| [sql/20260222_podcast_credit_system.sql](../sql/20260222_podcast_credit_system.sql) | Podcast credit system | `podcast_credits`, `podcast_credit_transactions`, `podcast_credit_packs` |
| [sql/20260223_system_error_logs.sql](../sql/20260223_system_error_logs.sql) | System error tracking | `system_error_logs` |
| [sql/20260301_educational_context_schema.sql](../sql/20260301_educational_context_schema.sql) | Educational framework | `countries`, `education_levels`, `curricula`, `examinations`, `subjects`, `user_education_profiles`, `user_subjects` |
| [sql/20260301_educator_platform_schema.sql](../sql/20260301_educator_platform_schema.sql) | Educator/institution platform | `institutions`, `institution_members`, `institution_invites` |
| [sql/20260303_platform_updates.sql](../sql/20260303_platform_updates.sql) | Platform updates & announcements | `platform_updates`, `platform_update_reads` |
| [sql/course_integration_phase1.sql](../sql/course_integration_phase1.sql) | Course system | `course_enrollments`, `course_resources`, `course_progress` |
| [sql/live_quiz_schema.sql](../sql/live_quiz_schema.sql) | Live quiz/kahoot system | `live_quiz_sessions`, `live_quiz_players`, `live_quiz_questions`, `live_quiz_answers` |
| [supabase/migrations/20260313_add_daily_notifications_tables.sql](../supabase/migrations/20260313_add_daily_notifications_tables.sql) | Daily notifications system | `user_activity_tracking`, `daily_notification_log` |
| [sql/20260317_backfill_notification_preferences.sql](../sql/20260317_backfill_notification_preferences.sql) | Notification preferences setup | `notification_preferences` (backfill) |

---

## Next Steps

- ✅ Document all CREATE TABLE statements with foreign keys
- ⚠️ **TODO:** Audit tables without explicit ON DELETE constraints
- ⚠️ **TODO:** Add ON DELETE CASCADE/SET NULL to tables missing constraints
- ⚠️ **TODO:** Create database diagram with all relationships
- ⚠️ **TODO:** Document RLS policies alongside schema

