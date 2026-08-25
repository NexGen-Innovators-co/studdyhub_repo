# Supabase Scheduled Function: quiz-scheduler

This scheduled function auto-advances all live quiz sessions in auto mode. It should be run every minute.

## How it works
- Finds all sessions with status = 'in_progress' and advance_mode = 'auto'.
- For each session:
  - Gets all questions for the session, ordered by question_index.
  - Finds the current question (the first one without an end_time).
  - If the current question's time is up, marks it as ended and starts the next question (if any).
  - If there are no more questions, marks the session as 'completed'.

## Setup
1. Deploy `quiz-scheduler.ts` to your Supabase Edge Functions.
2. Schedule it to run every minute using Supabase scheduled jobs:

```
# supabase/config.toml
[[jobs]]
name = "quiz-scheduler"
schedule = "* * * * *" # every minute
command = "supabase functions invoke quiz-scheduler"
```

3. Make sure your database tables have the required columns:
- live_quiz_sessions: id, status, advance_mode, ended_at
- live_quiz_questions: id, session_id, question_index, start_time, end_time, time_limit

## Notes
- This function is idempotent and safe to run frequently.
- Manual/host-advance sessions are not affected.
- If a host or participant reconnects, the UI will always reflect the latest state from the database.
