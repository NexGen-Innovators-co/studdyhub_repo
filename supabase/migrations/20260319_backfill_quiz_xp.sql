-- Migration: Backfill xp_earned in user_daily_activity for quiz attempts
-- Date: 2026-03-19

-- Compute XP per quiz attempt using the same formula as the app
-- and accumulate into daily totals.

WITH attempt_xp AS (
  SELECT
    user_id,
    DATE(created_at) AS activity_date,
    SUM(
      FLOOR(
        10 * total_questions * (
          CASE WHEN total_questions > 0 THEN (score::FLOAT / total_questions) ELSE 0 END
        )
        + (CASE WHEN time_taken_seconds < 300 THEN 5 ELSE 0 END)
        + (CASE WHEN score = total_questions THEN 20 ELSE 0 END)
      )
    ) AS xp
  FROM public.quiz_attempts
  WHERE user_id IS NOT NULL
  GROUP BY user_id, DATE(created_at)
)
UPDATE public.user_daily_activity uda
SET xp_earned = axp.xp
FROM attempt_xp axp
WHERE uda.user_id = axp.user_id
  AND uda.activity_date = axp.activity_date
  AND uda.activity_type = 'quiz';
