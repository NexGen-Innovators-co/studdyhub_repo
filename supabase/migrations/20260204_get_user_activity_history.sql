
CREATE OR REPLACE FUNCTION get_user_activity_history(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_interval TEXT DEFAULT 'day'
)
RETURNS TABLE (
  period TIMESTAMPTZ,
  notes_count BIGINT,
  recordings_count BIGINT,
  documents_count BIGINT,
  quizzes_count BIGINT,
  messages_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH periods AS (
    SELECT generate_series(
      date_trunc(p_interval, p_start_date),
      date_trunc(p_interval, NOW()),
      ('1 ' || p_interval)::INTERVAL
    ) AS period_start
  ),
  notes_agg AS (
    SELECT date_trunc(p_interval, created_at) AS period, COUNT(*) as cnt
    FROM notes
    WHERE user_id = p_user_id AND created_at >= p_start_date
    GROUP BY 1
  ),
  recordings_agg AS (
    SELECT date_trunc(p_interval, created_at) AS period, COUNT(*) as cnt
    FROM class_recordings
    WHERE user_id = p_user_id AND created_at >= p_start_date
    GROUP BY 1
  ),
  documents_agg AS (
    SELECT date_trunc(p_interval, created_at) AS period, COUNT(*) as cnt
    FROM documents
    WHERE user_id = p_user_id AND created_at >= p_start_date
    GROUP BY 1
  ),
  quizzes_agg AS (
    SELECT date_trunc(p_interval, created_at) AS period, COUNT(*) as cnt
    FROM quiz_attempts
    WHERE user_id = p_user_id AND created_at >= p_start_date
    GROUP BY 1
  ),
  messages_agg AS (
     -- Join with chat_sessions to check ownership if needed, but chat_messages usually has user_id
     -- Schema says chat_messages.user_id references profiles(id) which references auth.users(id)
    SELECT date_trunc(p_interval, timestamp) AS period, COUNT(*) as cnt
    FROM chat_messages
    WHERE user_id = p_user_id AND timestamp >= p_start_date
    GROUP BY 1
  )
  SELECT
    p.period_start,
    COALESCE(n.cnt, 0),
    COALESCE(r.cnt, 0),
    COALESCE(d.cnt, 0),
    COALESCE(q.cnt, 0),
    COALESCE(m.cnt, 0)
  FROM periods p
  LEFT JOIN notes_agg n ON p.period_start = n.period
  LEFT JOIN recordings_agg r ON p.period_start = r.period
  LEFT JOIN documents_agg d ON p.period_start = d.period
  LEFT JOIN quizzes_agg q ON p.period_start = q.period
  LEFT JOIN messages_agg m ON p.period_start = m.period
  ORDER BY p.period_start;
END;
$$;
