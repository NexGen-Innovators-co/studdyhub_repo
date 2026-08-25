-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK & SEED ACADEMIC LEVELS
-- Run this in SQL Editor to see current state and assign defaults
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. See current distribution of academic_level
SELECT
  coalesce(academic_level, '(null)') AS level,
  count(*) AS count
FROM profiles
GROUP BY academic_level
ORDER BY count DESC;


-- 2. See current distribution of academic_tier
SELECT
  coalesce(academic_tier, '(null)') AS tier,
  count(*) AS count
FROM profiles
GROUP BY academic_tier
ORDER BY count DESC;


-- 3. See users without academic levels
SELECT
  count(*) AS users_without_level,
  count(*) FILTER (WHERE academic_level IS NULL) AS null_level,
  count(*) FILTER (WHERE academic_tier IS NULL) AS null_tier
FROM profiles;


-- ═══════════════════════════════════════════════════════════════════════════
-- ASSIGN DEFAULTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Default academic_level: infer from email domain or set 'University'
UPDATE profiles
SET academic_level = CASE
    WHEN email LIKE '%@st.umat.edu.gh' THEN 'University'
    WHEN email LIKE '%@umat.edu.gh' THEN 'University'
    WHEN email LIKE '%@stu%' THEN 'University'
    WHEN email LIKE '%@student%' THEN 'University'
    WHEN email LIKE '%@school%' THEN 'SHS'
    WHEN email LIKE '%@highschool%' THEN 'SHS'
    ELSE 'University'  -- Default for all others
  END,
  updated_at = now()
WHERE academic_level IS NULL;


-- Default academic_tier: 'explorer' for new users (lowest tier)
UPDATE profiles
SET academic_tier = 'explorer',
  updated_at = now()
WHERE academic_tier IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- SYNC TO SOCIAL_USERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Update user_stats if it exists (for XP/level tracking)
INSERT INTO user_stats (user_id, total_xp, level, quizzes_taken, avg_score, current_streak, longest_streak, credits_balance, created_at, updated_at)
SELECT
  id,
  coalesce(points_balance, 0),
  coalesce(points_balance, 0) / 500 + 1,
  0,
  0,
  0,
  0,
  coalesce(bonus_ai_credits, 0),
  coalesce(created_at, now()),
  now()
FROM profiles
ON CONFLICT (user_id) DO UPDATE SET
  total_xp = coalesce(EXCLUDED.total_xp, user_stats.total_xp),
  level = coalesce(EXCLUDED.level, user_stats.level),
  credits_balance = coalesce(EXCLUDED.credits_balance, user_stats.credits_balance),
  updated_at = now();


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY RESULTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Final distribution
SELECT
  coalesce(academic_level, '(null)') AS level,
  coalesce(academic_tier, '(null)') AS tier,
  count(*) AS count
FROM profiles
GROUP BY academic_level, academic_tier
ORDER BY count DESC;


-- Check user_stats populated
SELECT
  (SELECT count(*) FROM user_stats) AS total_user_stats,
  (SELECT count(*) FROM profiles) AS total_profiles;
