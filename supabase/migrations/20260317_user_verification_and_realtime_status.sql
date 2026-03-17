-- STEP 1: Add session tracking columns to social_users
ALTER TABLE public.social_users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_session_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_metrics JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_users_is_online 
  ON public.social_users(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_social_users_last_login 
  ON public.social_users(last_login_at);

-- STEP 3: Function to check verification eligibility
CREATE OR REPLACE FUNCTION public.check_creator_verification_eligibility(
  p_user_id UUID
) RETURNS TABLE (
  eligible BOOLEAN,
  posts_count INT,
  followers_count INT,
  account_age_days INT,
  engagement_rate FLOAT,
  last_active_days INT,
  violation_count INT,
  metrics JSONB
) AS $$
DECLARE
  v_posts INT;
  v_followers INT;
  v_account_age_days INT;
  v_engagement_rate FLOAT;
  v_last_active_days INT;
  v_violations INT;
  v_metrics JSONB;
BEGIN
  SELECT 
    COALESCE((SELECT COUNT(*) FROM public.social_posts sp WHERE sp.author_id = p_user_id), 0),
    COALESCE((SELECT COUNT(*) FROM public.social_follows sf WHERE sf.following_id = p_user_id), 0),
    EXTRACT(DAY FROM NOW() - su.created_at)::INT
  INTO v_posts, v_followers, v_account_age_days
  FROM public.social_users su WHERE su.id = p_user_id;

  SELECT COALESCE(
    (COUNT(DISTINCT sl.id)::FLOAT 
     / NULLIF(COUNT(DISTINCT sp.id), 0)
    ) * CASE WHEN v_followers > 0 THEN (100.0 / v_followers) ELSE 0 END,
    0
  )
  INTO v_engagement_rate
  FROM public.social_posts sp
  LEFT JOIN public.social_likes sl ON sp.id = sl.post_id
  WHERE sp.author_id = p_user_id;

  SELECT CASE WHEN su.status IN ('suspended', 'banned') THEN 1 ELSE 0 END
  INTO v_violations
  FROM public.social_users su
  WHERE su.id = p_user_id;

  SELECT EXTRACT(DAY FROM NOW() - COALESCE(su.last_active, su.created_at))::INT
  INTO v_last_active_days
  FROM public.social_users su WHERE su.id = p_user_id;

  v_metrics := jsonb_build_object(
    'posts', v_posts,
    'followers', v_followers,
    'account_age_days', v_account_age_days,
    'engagement_rate', ROUND(v_engagement_rate::NUMERIC, 2),
    'last_active_days', v_last_active_days,
    'violations', v_violations,
    'checked_at', NOW()
  );

  RETURN QUERY SELECT
    (v_posts >= 50 AND v_followers >= 500 AND v_account_age_days >= 30 AND 
     v_engagement_rate >= 2.0 AND v_last_active_days <= 15 AND v_violations = 0)::BOOLEAN,
    v_posts,
    v_followers,
    v_account_age_days,
    ROUND(v_engagement_rate::NUMERIC, 2)::FLOAT,
    v_last_active_days,
    v_violations,
    v_metrics;
END;
$$ LANGUAGE plpgsql STABLE;

-- STEP 4: Function to update user verification status
CREATE OR REPLACE FUNCTION public.update_creator_verification_status()
RETURNS TABLE (
  users_checked INT,
  newly_verified INT,
  newly_unverified INT
) AS $$
DECLARE
  v_badge_id UUID;
  v_users_checked INT := 0;
  v_newly_verified INT := 0;
  v_newly_unverified INT := 0;
  v_user_row RECORD;
BEGIN
  SELECT id INTO v_badge_id FROM public.badges WHERE name = 'verified_creator' LIMIT 1;
  
  IF v_badge_id IS NULL THEN
    INSERT INTO public.badges (name, description, icon, requirement_type, requirement_value, xp_reward)
    VALUES ('verified_creator', 'Verified Creator', 'crown-check', 'composite_metrics', 1, 250)
    RETURNING id INTO v_badge_id;
  END IF;
  
  FOR v_user_row IN 
    SELECT 
      su.id,
      su.is_verified,
      (cv.eligible)::BOOLEAN as eligible,
      cv.metrics
    FROM public.social_users su
    CROSS JOIN LATERAL public.check_creator_verification_eligibility(su.id) cv
    WHERE su.status = 'active'
  LOOP
    v_users_checked := v_users_checked + 1;
    
    IF v_user_row.eligible AND NOT v_user_row.is_verified THEN
      INSERT INTO public.achievements (user_id, badge_id)
      VALUES (v_user_row.id, v_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      UPDATE public.social_users 
      SET 
        is_verified = true,
        verification_metrics = v_user_row.metrics,
        updated_at = NOW()
      WHERE id = v_user_row.id;
      v_newly_verified := v_newly_verified + 1;

    ELSIF NOT v_user_row.eligible AND v_user_row.is_verified THEN
      DELETE FROM public.achievements 
      WHERE user_id = v_user_row.id AND badge_id = v_badge_id;

      UPDATE public.social_users 
      SET 
        is_verified = false,
        verification_metrics = v_user_row.metrics,
        updated_at = NOW()
      WHERE id = v_user_row.id;
      v_newly_unverified := v_newly_unverified + 1;

    ELSIF v_user_row.eligible AND v_user_row.is_verified THEN
      UPDATE public.social_users 
      SET verification_metrics = v_user_row.metrics
      WHERE id = v_user_row.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_users_checked, v_newly_verified, v_newly_unverified;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Login tracking
CREATE OR REPLACE FUNCTION public.track_user_login(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.social_users
  SET 
    is_online = true,
    last_login_at = NOW(),
    current_session_started_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Logout tracking
CREATE OR REPLACE FUNCTION public.track_user_logout(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.social_users
  SET 
    is_online = false,
    last_logout_at = NOW(),
    current_session_started_at = NULL
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: Daily verification check
SELECT cron.schedule(
  'check_creator_verification_daily',
  '0 2 * * *',
  'SELECT public.update_creator_verification_status()'
);

-- STEP 8: Auto-logout inactive sessions
SELECT cron.schedule(
  'auto_logout_inactive_sessions',
  '*/5 * * * *',
  'UPDATE public.social_users 
   SET is_online = false, last_logout_at = NOW()
   WHERE is_online = true 
   AND EXTRACT(EPOCH FROM (NOW() - current_session_started_at)) > 1800'
);

-- STEP 9: Auto-mark inactive users
SELECT cron.schedule(
  'auto_mark_inactive_users',
  '0 3 * * *',
  'UPDATE public.social_users 
   SET status = ''inactive''
   WHERE status = ''active'' 
   AND last_login_at < NOW() - INTERVAL ''180 days'''
);

-- STEP 10: Trigger to sync last_active with login
CREATE OR REPLACE FUNCTION public.sync_last_active_on_login()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_online AND OLD.last_login_at IS DISTINCT FROM NEW.last_login_at THEN
    NEW.last_active := NEW.last_login_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_last_active_on_login ON public.social_users;
CREATE TRIGGER trigger_sync_last_active_on_login
BEFORE UPDATE ON public.social_users
FOR EACH ROW
EXECUTE FUNCTION public.sync_last_active_on_login();

-- STEP 11: Indexes for achievements (ok as-is)
CREATE INDEX IF NOT EXISTS idx_achievements_badge_id 
  ON public.achievements(badge_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id 
  ON public.achievements(user_id);