-- Migration: Create class_recordings, quizzes, live_quiz_sessions, live_quiz_questions, live_quiz_players, live_quiz_answers, and quiz_attempts tables.

CREATE TABLE IF NOT EXISTS public.class_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    duration INT DEFAULT 1800,
    audio_url TEXT DEFAULT '',
    transcript TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    processing_status TEXT DEFAULT 'completed',
    date_millis BIGINT,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  class_id uuid null,
  title text not null,
  questions jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  source_type text null default 'recording'::text,
  constraint quizzes_pkey primary key (id),
  constraint quizzes_class_id_fkey foreign KEY (class_id) references class_recordings (id) on delete CASCADE,
  constraint quizzes_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint quizzes_source_type_check check (
    (
      source_type = any (
        array[
          'recording'::text,
          'notes'::text,
          'ai'::text,
          'live_custom'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.live_quiz_sessions (
  id uuid not null default gen_random_uuid (),
  quiz_id uuid not null,
  host_user_id uuid not null,
  status text not null default 'waiting'::text,
  start_time timestamp with time zone null,
  end_time timestamp with time zone null,
  join_code text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  host_role text not null default 'participant'::text,
  advance_mode text not null default 'auto'::text,
  config jsonb null default '{"auto_advance": true, "question_time_limit": 30}'::jsonb,
  quiz_mode character varying null default 'synchronized'::character varying,
  scheduled_start_time timestamp with time zone null,
  allow_late_join boolean null default true,
  constraint live_quiz_sessions_pkey primary key (id),
  constraint live_quiz_sessions_host_user_id_fkey foreign KEY (host_user_id) references auth.users (id) on delete CASCADE,
  constraint live_quiz_sessions_quiz_id_fkey foreign KEY (quiz_id) references quizzes (id) on delete CASCADE,
  constraint live_quiz_sessions_status_check check (
    (
      status = any (
        array[
          'waiting'::text,
          'in_progress'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.live_quiz_questions (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  question_index integer not null,
  question_text text not null,
  options jsonb not null,
  correct_answer integer not null,
  explanation text null,
  start_time timestamp with time zone null,
  end_time timestamp with time zone null,
  time_limit integer null default 30,
  status text null default 'pending'::text,
  constraint live_quiz_questions_pkey primary key (id),
  constraint live_quiz_questions_session_id_fkey foreign KEY (session_id) references live_quiz_sessions (id) on delete CASCADE
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.live_quiz_players (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  user_id uuid not null,
  display_name text null,
  join_time timestamp with time zone null default now(),
  score integer null default 0,
  is_host boolean null default false,
  last_answered_at timestamp with time zone null,
  is_playing boolean null default true,
  is_mediator boolean null default false,
  current_question_idx integer null default 0,
  individual_start_time timestamp with time zone null,
  individual_end_time timestamp with time zone null,
  questions_attempted integer null default 0,
  questions_correct integer null default 0,
  total_time_spent integer null default 0,
  status character varying null default 'playing'::character varying,
  constraint live_quiz_players_pkey primary key (id),
  constraint live_quiz_players_session_id_fkey foreign KEY (session_id) references live_quiz_sessions (id) on delete CASCADE,
  constraint live_quiz_players_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.live_quiz_answers (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  question_id uuid not null,
  user_id uuid not null,
  answer_index integer not null,
  answered_at timestamp with time zone null default now(),
  is_correct boolean null,
  points_awarded integer null default 0,
  selected_option integer null,
  time_taken integer null,
  status text null default 'answered'::text,
  constraint live_quiz_answers_pkey primary key (id),
  constraint live_quiz_answers_question_user_key unique (question_id, user_id),
  constraint live_quiz_answers_question_id_fkey foreign KEY (question_id) references live_quiz_questions (id) on delete CASCADE,
  constraint live_quiz_answers_session_id_fkey foreign KEY (session_id) references live_quiz_sessions (id) on delete CASCADE,
  constraint live_quiz_answers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid not null default gen_random_uuid (),
  quiz_id uuid not null,
  user_id uuid not null,
  score integer not null,
  total_questions integer not null,
  percentage integer not null,
  time_taken_seconds integer not null,
  answers jsonb not null default '[]'::jsonb,
  xp_earned integer not null default 0,
  created_at timestamp with time zone not null default now(),
  live_results jsonb null,
  constraint quiz_attempts_pkey primary key (id),
  constraint quiz_attempts_quiz_id_fkey foreign KEY (quiz_id) references quizzes (id) on update CASCADE on delete CASCADE,
  constraint quiz_attempts_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint quiz_attempts_total_questions_check check ((total_questions > 0)),
  constraint quiz_attempts_score_check check ((score >= 0)),
  constraint quiz_attempts_percentage_check check (
    (
      (percentage >= 0)
      and (percentage <= 100)
    )
  ),
  constraint quiz_attempts_time_taken_seconds_check check ((time_taken_seconds >= 0))
) TABLESPACE pg_default;

-- Triggers
DROP TRIGGER IF EXISTS update_live_quiz_sessions_updated_at ON public.live_quiz_sessions;
CREATE TRIGGER update_live_quiz_sessions_updated_at BEFORE
UPDATE ON public.live_quiz_sessions FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_activity_on_quiz_attempt_trigger ON public.quiz_attempts;
CREATE TRIGGER update_activity_on_quiz_attempt_trigger
AFTER INSERT ON public.quiz_attempts FOR EACH ROW
EXECUTE FUNCTION public.update_activity_on_quiz_attempt();
