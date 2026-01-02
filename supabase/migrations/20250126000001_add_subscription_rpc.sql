-- Create a secure function to handle subscription upserts
-- This bypasses RLS to allow claiming an existing endpoint (e.g. same device, new user)

CREATE OR REPLACE FUNCTION upsert_notification_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_type text,
  p_browser text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Upsert the subscription
  -- This handles the case where the endpoint exists but belongs to another user
  -- by updating the user_id to the current user.
  INSERT INTO notification_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    device_type,
    browser,
    updated_at
  )
  VALUES (
    v_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_device_type,
    p_browser,
    now()
  )
  ON CONFLICT (endpoint)
  DO UPDATE SET
    user_id = EXCLUDED.user_id, -- Claim ownership
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    device_type = EXCLUDED.device_type,
    browser = EXCLUDED.browser,
    updated_at = now()
  RETURNING json_build_object('id', id, 'user_id', user_id) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_notification_subscription TO authenticated;
