-- Function to handle new user signup with promo code via Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_promo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if 'promo_code' exists in user metadata and matches
  -- Note: We expect the code to be stored as 'promo_code' in metadata
  IF (new.raw_user_meta_data->>'promo_code')::text = 'CODENIGHT2026' THEN
    
    -- Insert or update the subscription
    -- We use ON CONFLICT to handle cases where a subscription might be created by another trigger
    INSERT INTO public.subscriptions (user_id, plan_type, status, current_period_end)
    VALUES (new.id, 'genius', 'active', NOW() + INTERVAL '1 month')
    ON CONFLICT (user_id)
    DO UPDATE SET
      plan_type = 'genius',
      status = 'active',
      current_period_end = GREATEST(COALESCE(subscriptions.current_period_end, NOW()), NOW() + INTERVAL '1 month');
      
  END IF;
  
  RETURN new;
END;
$$;

-- Create the trigger on auth.users
-- This ensures that even if email verification is pending, the subscription is pre-provisioned
DROP TRIGGER IF EXISTS on_auth_user_created_promo ON auth.users;
CREATE TRIGGER on_auth_user_created_promo
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_promo();
