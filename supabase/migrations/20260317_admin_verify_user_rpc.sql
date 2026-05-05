-- Migration: Add admin-only RPC to verify users
-- Purpose: Allow admins to grant verified_creator badge without client-side RLS violations

CREATE OR REPLACE FUNCTION public.admin_verify_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id UUID;
  v_admin_user_id UUID;
  v_metrics JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can verify users';
  END IF;

  SELECT au.id INTO v_admin_user_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid()
  LIMIT 1;

  SELECT b.id INTO v_badge_id
  FROM public.badges b
  WHERE b.name = 'verified_creator'
  LIMIT 1;

  IF v_badge_id IS NULL THEN
    RAISE EXCEPTION 'verified_creator badge not found';
  END IF;

  -- Compute verification metrics so tooltip has data immediately
  SELECT (metrics)::JSONB INTO v_metrics
  FROM public.check_creator_verification_eligibility(p_user_id)
  LIMIT 1;

  INSERT INTO public.achievements (user_id, badge_id)
  VALUES (p_user_id, v_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  UPDATE public.social_users
  SET is_verified = true,
      verification_metrics = COALESCE(v_metrics, verification_metrics),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.admin_activity_logs (admin_id, action, target_type, target_id, details)
    VALUES (
      v_admin_user_id,
      'verify_user',
      'user',
      p_user_id,
      jsonb_build_object('verified_by_admin', true)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'badge_id', v_badge_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_user(UUID) TO authenticated;
