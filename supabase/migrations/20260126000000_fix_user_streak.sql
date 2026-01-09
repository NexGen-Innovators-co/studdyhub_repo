
-- Fix the get_user_streak function to correctly calculate streaks based on activity across multiple tables.
-- This creates a single view of activity and then counts consecutive days.

CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
RETURNS TABLE (
  current_streak INTEGER,
  max_streak INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_max_streak INTEGER := 0;
  v_dates DATE[];
BEGIN
  -- Get all unique dates with activity from various tables
  -- We prioritize 'created_at' or 'timestamp' columns
  
  SELECT ARRAY(
    SELECT DISTINCT date_trunc('day', activity_time)::DATE
    FROM (
      -- Notes
      SELECT created_at as activity_time FROM notes WHERE user_id = p_user_id
      UNION ALL
      -- Class Recordings
      SELECT created_at as activity_time FROM class_recordings WHERE user_id = p_user_id
      UNION ALL
      -- Documents
      SELECT created_at as activity_time FROM documents WHERE user_id = p_user_id
      UNION ALL
      -- Chat Messages
      SELECT timestamp as activity_time FROM chat_messages WHERE user_id = p_user_id
    ) all_activities
    WHERE activity_time IS NOT NULL
    ORDER BY date_trunc('day', activity_time)::DATE DESC
  ) INTO v_dates;

  -- Calculate streaks
  IF array_length(v_dates, 1) > 0 THEN
    -- Debug: Check if the most recent activity is today or yesterday
    -- If the latest activity is older than yesterday, streak is 0
    IF v_dates[1] >= (CURRENT_DATE - INTERVAL '1 day') THEN
        v_current_streak := 1;
        
        -- Iterate backwards to find consecutive days
        IF array_length(v_dates, 1) > 1 THEN
            FOR i IN 1..array_length(v_dates, 1) - 1 LOOP
                -- Difference between dates should be 1 day
                IF (v_dates[i] - v_dates[i+1]) = 1 THEN
                    v_current_streak := v_current_streak + 1;
                ELSE
                    -- If the gap is more than 1 day, the streak is broken
                     EXIT;
                END IF;
            END LOOP;
        END IF;
    ELSE
        -- Streak broke if no activity today or yesterday
        v_current_streak := 0;
    END IF;
  END IF;

  -- Calculate historical max streak
  DECLARE
    temp_streak INTEGER := 0;
    temp_max INTEGER := 0;
  BEGIN
    IF array_length(v_dates, 1) > 0 THEN
        temp_streak := 1;
        temp_max := 1;
        IF array_length(v_dates, 1) > 1 THEN
            FOR i IN 1..array_length(v_dates, 1) - 1 LOOP
                IF (v_dates[i] - v_dates[i+1]) = 1 THEN
                    temp_streak := temp_streak + 1;
                ELSE
                    if temp_streak > temp_max THEN
                        temp_max := temp_streak;
                    END IF;
                    temp_streak := 1;
                END IF;
            END LOOP;
            -- Check last streak
            if temp_streak > temp_max THEN
                temp_max := temp_streak;
            END IF;
        END IF;
        v_max_streak := temp_max;
    END IF;
  END;

  RETURN QUERY SELECT v_current_streak, v_max_streak;
END;
$$;
