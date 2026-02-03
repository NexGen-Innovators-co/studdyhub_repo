// supabase/functions/quiz-scheduler.ts
// Scheduled function to auto-advance quizzes in auto mode
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export default async function handler(req: Request) {
  // 1. Find all in-progress sessions with auto-advance
  const { data: sessions, error } = await supabase
    .from('live_quiz_sessions')
    .select('*')
    .eq('status', 'in_progress')
    .eq('advance_mode', 'auto');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let updated = 0;
  for (const session of sessions || []) {
    // 2. Get all questions for the session ordered by index
    const { data: questions } = await supabase
      .from('live_quiz_questions')
      .select('*')
      .eq('session_id', session.id)
      .order('question_index', { ascending: true });

    if (!questions || questions.length === 0) continue;

    const now = new Date();

    // Find the currently active question: has a start_time but no end_time,
    // OR has an end_time that is now in the past (needs advancing).
    const current = questions.find(q => {
      if (!q.start_time) return false;
      // Active: started but not ended
      if (!q.end_time) return true;
      // Timed out: end_time is in the past
      return new Date(q.end_time).getTime() <= now.getTime();
    });

    if (!current) continue;

    // 3. Check whether this question's time is actually up
    const endTime = current.end_time ? new Date(current.end_time) : null;

    // If no end_time at all, this question was started without a deadline —
    // set one now based on the session's configured time limit so it can be
    // picked up on the next cron tick.
    if (!endTime) {
      const timeLimit = current.time_limit || session.config?.question_time_limit || 30;
      const computedEnd = new Date(new Date(current.start_time).getTime() + timeLimit * 1000);

      // If we're already past the computed deadline, treat it as timed out.
      if (now.getTime() >= computedEnd.getTime()) {
        // Fall through to the advance logic below using computedEnd.
      } else {
        // Not yet timed out — persist the end_time so the frontend can use it,
        // then continue to the next session.
        await supabase
          .from('live_quiz_questions')
          .update({ end_time: computedEnd.toISOString() })
          .eq('id', current.id);
        continue;
      }
    } else if (endTime.getTime() > now.getTime()) {
      // end_time exists but hasn't arrived yet — nothing to do.
      continue;
    }

    // 4. Time is up — end the current question
    await supabase
      .from('live_quiz_questions')
      .update({ end_time: now.toISOString(), status: 'completed' })
      .eq('id', current.id);

    // 5. Start the next question if one exists
    const next = questions.find(q => q.question_index === current.question_index + 1);

    if (next) {
      const timeLimit = next.time_limit || session.config?.question_time_limit || 30;
      const nextEnd = new Date(now.getTime() + timeLimit * 1000);

      // FIX: set BOTH start_time AND end_time on the next question so the
      // frontend timer has a concrete deadline immediately.
      await supabase
        .from('live_quiz_questions')
        .update({
          start_time: now.toISOString(),
          end_time: nextEnd.toISOString(),
          status: 'active',
        })
        .eq('id', next.id);
    } else {
      // No more questions — mark session as completed
      await supabase
        .from('live_quiz_sessions')
        .update({ status: 'completed', ended_at: now.toISOString() })
        .eq('id', session.id);
    }

    updated++;
  }

  return new Response(JSON.stringify({ updated }), { status: 200 });
}