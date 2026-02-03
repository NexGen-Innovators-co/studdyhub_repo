-- Policies for live_quiz_sessions
-- Allow: Host can insert, update, delete their own sessions; anyone can select sessions with 'waiting' or 'in_progress' status
CREATE POLICY "Allow host to manage their sessions" ON public.live_quiz_sessions
  FOR ALL
  USING (host_user_id = auth.uid());

CREATE POLICY "Allow select for joinable sessions" ON public.live_quiz_sessions
  FOR SELECT
  USING (status IN ('waiting', 'in_progress'));

-- Policies for live_quiz_players
-- Allow: Anyone in the session can select; users can insert themselves; only self can update/delete
CREATE POLICY "Allow player to join session" ON public.live_quiz_players
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow player to view session players" ON public.live_quiz_players
  FOR SELECT
  USING (session_id IN (SELECT id FROM public.live_quiz_sessions WHERE status IN ('waiting', 'in_progress')));

CREATE POLICY "Allow player to update/delete self" ON public.live_quiz_players
  FOR UPDATE, DELETE
  USING (user_id = auth.uid());

-- Policies for live_quiz_questions
-- Allow: Only host can insert/update/delete; anyone in session can select
CREATE POLICY "Allow host to manage questions" ON public.live_quiz_questions
  FOR ALL
  USING (session_id IN (SELECT id FROM public.live_quiz_sessions WHERE host_user_id = auth.uid()));

CREATE POLICY "Allow players to view questions" ON public.live_quiz_questions
  FOR SELECT
  USING (session_id IN (SELECT id FROM public.live_quiz_sessions WHERE status IN ('waiting', 'in_progress')));

-- Policies for live_quiz_answers
-- Allow: Only player can insert/update/delete their own answers; anyone in session can select
CREATE POLICY "Allow player to answer" ON public.live_quiz_answers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow player to update/delete own answer" ON public.live_quiz_answers
  FOR UPDATE, DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Allow players to view answers" ON public.live_quiz_answers
  FOR SELECT
  USING (session_id IN (SELECT id FROM public.live_quiz_sessions WHERE status IN ('waiting', 'in_progress', 'completed')));
