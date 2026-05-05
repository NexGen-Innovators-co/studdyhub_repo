-- Function to apply Code Night promo (1 month free Genius plan)
-- Updated to validate code server-side
CREATE OR REPLACE FUNCTION apply_code_night_promo(p_user_id UUID, p_promo_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: Ensure the user is applying it to their own account
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate Promo Code Server-Side
  IF UPPER(TRIM(p_promo_code)) <> 'CODENIGHT2026' THEN
    RAISE EXCEPTION 'Invalid promo code';
  END IF;

  -- Insert or update the subscription for the user
  INSERT INTO subscriptions (user_id, plan_type, status, current_period_end)
  VALUES (p_user_id, 'genius', 'active', NOW() + INTERVAL '1 month')
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan_type = 'genius',
    status = 'active',
    -- Extend current period if already valid, or set to 1 month from now
    current_period_end = GREATEST(COALESCE(subscriptions.current_period_end, NOW()), NOW() + INTERVAL '1 month');
END;
$$;
