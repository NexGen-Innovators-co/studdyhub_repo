-- ============================================================
-- Backfill Podcast Credits for Existing Users
-- Grants initial credits based on current subscription tier.
-- Safe to run multiple times (idempotent via ON CONFLICT).
-- ============================================================

-- 1. Create a podcast_credits row for EVERY existing user (balance 0)
--    This ensures every user has a row, even free-tier users.
INSERT INTO public.podcast_credits (user_id, balance, lifetime_earned, lifetime_purchased, lifetime_spent)
SELECT id, 0, 0, 0, 0
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. Grant monthly tier credits to scholar users who don't have them yet
--    Scholar = 5 credits
WITH scholar_users AS (
  SELECT s.user_id
  FROM public.subscriptions s
  WHERE s.plan_type = 'scholar'
    AND s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.podcast_credit_transactions t
      WHERE t.user_id = s.user_id
        AND t.transaction_type IN ('monthly_grant', 'admin_adjustment')
    )
)
UPDATE public.podcast_credits pc
SET balance = pc.balance + 5,
    lifetime_earned = pc.lifetime_earned + 5,
    last_monthly_grant_at = now(),
    updated_at = now()
FROM scholar_users su
WHERE pc.user_id = su.user_id;

-- Log the scholar grants
INSERT INTO public.podcast_credit_transactions (user_id, amount, balance_after, transaction_type, description)
SELECT pc.user_id, 5, pc.balance, 'admin_adjustment', 'Initial credit backfill for scholar tier (5 credits)'
FROM public.podcast_credits pc
JOIN public.subscriptions s ON s.user_id = pc.user_id
WHERE s.plan_type = 'scholar'
  AND s.status = 'active'
  AND pc.last_monthly_grant_at >= now() - interval '5 seconds';  -- only the ones we just updated

-- 3. Grant monthly tier credits to genius users who don't have them yet
--    Genius = 15 credits
WITH genius_users AS (
  SELECT s.user_id
  FROM public.subscriptions s
  WHERE s.plan_type = 'genius'
    AND s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.podcast_credit_transactions t
      WHERE t.user_id = s.user_id
        AND t.transaction_type IN ('monthly_grant', 'admin_adjustment')
    )
)
UPDATE public.podcast_credits pc
SET balance = pc.balance + 15,
    lifetime_earned = pc.lifetime_earned + 15,
    last_monthly_grant_at = now(),
    updated_at = now()
FROM genius_users gu
WHERE pc.user_id = gu.user_id;

-- Log the genius grants
INSERT INTO public.podcast_credit_transactions (user_id, amount, balance_after, transaction_type, description)
SELECT pc.user_id, 15, pc.balance, 'admin_adjustment', 'Initial credit backfill for genius tier (15 credits)'
FROM public.podcast_credits pc
JOIN public.subscriptions s ON s.user_id = pc.user_id
WHERE s.plan_type = 'genius'
  AND s.status = 'active'
  AND pc.last_monthly_grant_at >= now() - interval '5 seconds';  -- only the ones we just updated

-- 4. Helper function: bulk backfill for admins to run on demand
--    Usage: SELECT backfill_podcast_credits_for_all_users();
CREATE OR REPLACE FUNCTION public.backfill_podcast_credits_for_all_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scholar_count integer := 0;
  v_genius_count  integer := 0;
  v_free_count    integer := 0;
  v_rec record;
BEGIN
  -- Ensure every auth user has a podcast_credits row
  INSERT INTO public.podcast_credits (user_id, balance)
  SELECT id, 0 FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;

  -- Grant credits to paid users who haven't received any yet
  FOR v_rec IN
    SELECT s.user_id, s.plan_type
    FROM public.subscriptions s
    WHERE s.status = 'active'
      AND s.plan_type IN ('scholar', 'genius')
      AND NOT EXISTS (
        SELECT 1 FROM public.podcast_credit_transactions t
        WHERE t.user_id = s.user_id
          AND t.transaction_type IN ('monthly_grant', 'admin_adjustment')
      )
  LOOP
    DECLARE
      v_amount integer;
    BEGIN
      v_amount := CASE v_rec.plan_type WHEN 'genius' THEN 15 WHEN 'scholar' THEN 5 ELSE 0 END;

      IF v_amount > 0 THEN
        PERFORM public.add_podcast_credits(
          v_rec.user_id,
          v_amount,
          'admin_adjustment',
          NULL,
          format('Backfill credit grant for %s tier (%s credits)', v_rec.plan_type, v_amount)
        );

        IF v_rec.plan_type = 'genius' THEN v_genius_count := v_genius_count + 1;
        ELSE v_scholar_count := v_scholar_count + 1;
        END IF;

        -- Mark as granted so monthly grant logic doesn't double-grant
        UPDATE public.podcast_credits
        SET last_monthly_grant_at = now()
        WHERE user_id = v_rec.user_id;
      END IF;
    END;
  END LOOP;

  -- Count free users (rows created with 0 balance)
  SELECT count(*) INTO v_free_count
  FROM public.podcast_credits pc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = pc.user_id AND s.status = 'active' AND s.plan_type IN ('scholar', 'genius')
  );

  RETURN jsonb_build_object(
    'success', true,
    'scholar_granted', v_scholar_count,
    'genius_granted', v_genius_count,
    'free_users', v_free_count,
    'total_users_with_credits', (SELECT count(*) FROM public.podcast_credits)
  );
END;
$$;

-- 5. Verify results
DO $$
DECLARE
  v_total integer;
  v_with_balance integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.podcast_credits;
  SELECT count(*) INTO v_with_balance FROM public.podcast_credits WHERE balance > 0;
  RAISE NOTICE 'Backfill complete: % total credit rows, % users with balance > 0', v_total, v_with_balance;
END $$;
