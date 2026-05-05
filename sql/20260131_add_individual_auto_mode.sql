-- 1. Add quiz_mode column to live_quiz_sessions
ALTER TABLE live_quiz_sessions
ADD COLUMN IF NOT EXISTS quiz_mode VARCHAR(20) DEFAULT 'synchronized';

-- 2. Add individual progress columns to live_quiz_players
ALTER TABLE live_quiz_players
ADD COLUMN IF NOT EXISTS current_question_idx INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS individual_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS individual_end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS questions_attempted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'playing';

-- 3. Create player_question_progress table
CREATE TABLE IF NOT EXISTS player_question_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES live_quiz_sessions(id),
  player_id UUID REFERENCES auth.users(id),
  question_id UUID REFERENCES live_quiz_questions(id),
  question_index INTEGER NOT NULL,
  selected_option INTEGER,
  is_correct BOOLEAN,
  points_awarded INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add necessary indexes for performance
CREATE INDEX IF NOT EXISTS idx_pqp_session_id ON player_question_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_pqp_player_id ON player_question_progress(player_id);
CREATE INDEX IF NOT EXISTS idx_pqp_question_id ON player_question_progress(question_id);
CREATE INDEX IF NOT EXISTS idx_pqp_status ON player_question_progress(status);