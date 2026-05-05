-- Live Quiz Sessions (Kahoot-style)
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

-- Indexes for fast lookups and joins
CREATE INDEX idx_live_quiz_sessions_quiz_id ON public.live_quiz_sessions(quiz_id);
CREATE INDEX idx_live_quiz_sessions_join_code ON public.live_quiz_sessions(join_code);
CREATE INDEX idx_live_quiz_players_session_id ON public.live_quiz_players(session_id);
CREATE INDEX idx_live_quiz_players_user_id ON public.live_quiz_players(user_id);
CREATE INDEX idx_live_quiz_questions_session_id ON public.live_quiz_questions(session_id);
CREATE INDEX idx_live_quiz_questions_question_index ON public.live_quiz_questions(question_index);
CREATE INDEX idx_live_quiz_answers_session_id ON public.live_quiz_answers(session_id);
CREATE INDEX idx_live_quiz_answers_question_id ON public.live_quiz_answers(question_id);
CREATE INDEX idx_live_quiz_answers_user_id ON public.live_quiz_answers(user_id);
