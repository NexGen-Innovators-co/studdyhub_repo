-- ═══════════════════════════════════════════════════════════════════════════
-- 1. REVERT: Set academic_tier back to NULL for users who had it set to 'explorer'
--    by our script (only revert users with 0 XP who were auto-assigned)
-- ═══════════════════════════════════════════════════════════════════════════

-- Revert explorer tier for users with 0 XP (they were auto-assigned)
UPDATE profiles
SET academic_tier = NULL,
  updated_at = now()
WHERE academic_tier = 'explorer'
  AND id IN (
    SELECT user_id FROM user_stats WHERE total_xp = 0
    UNION
    SELECT id FROM profiles WHERE id NOT IN (SELECT user_id FROM user_stats)
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. VERIFY: Check tier distribution after revert
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  coalesce(academic_tier, '(no tier)') AS tier,
  count(*) AS count
FROM profiles
GROUP BY academic_tier
ORDER BY count DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ALL-TIME LEADERBOARD: Shows ALL users regardless of tier
--    This is what the /v1/leaderboard endpoint should use
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the old tier-scoped leaderboard and create an all-time one
CREATE OR REPLACE FUNCTION public.get_all_time_leaderboard(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  school text,
  total_xp bigint,
  level integer,
  academic_tier text,
  rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    coalesce(p.full_name, 'Scholar') AS full_name,
    p.avatar_url,
    p.school,
    coalesce(us.total_xp, 0) AS total_xp,
    coalesce(us.level, 1) AS level,
    p.academic_tier,
    row_number() OVER (ORDER BY coalesce(us.total_xp, 0) DESC) AS rank
  FROM profiles p
  LEFT JOIN user_stats us ON us.user_id = p.id
  ORDER BY coalesce(us.total_xp, 0) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- Test it
SELECT * FROM get_all_time_leaderboard(10, 0);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ALSO: Update the API Gateway leaderboard route to use this function
--    (The gateway currently scopes by tier — we want an "all" option)
-- ═══════════════════════════════════════════════════════════════════════════

-- Verify the function works
SELECT count(*) AS total_users_in_leaderboard FROM get_all_time_leaderboard(1000, 0);
