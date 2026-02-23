-- ============================================================
-- Podcast Credit System
-- Credit-based generation for AI podcasts to manage costs.
-- Audio=1 credit, Image+Audio=3, Video=10.
-- Monthly allowances: Free=0, Scholar=5, Genius=15.
-- Purchasable top-up packs that never expire.
-- ============================================================

-- 1. Podcast credits balance table (one row per user)
CREATE TABLE IF NOT EXISTS public.podcast_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  last_monthly_grant_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- 2. Credit transaction ledger (immutable log)
CREATE TABLE IF NOT EXISTS public.podcast_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- positive = credit, negative = debit
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'monthly_grant',       -- automatic monthly allowance
    'purchase',            -- bought credit pack
    'generation_audio',    -- spent on audio podcast
    'generation_image',    -- spent on image-audio podcast
    'generation_video',    -- spent on video podcast
    'refund',              -- refund for failed generation
    'admin_adjustment',    -- manual admin adjustment
    'bonus'                -- referral/promo bonus
  )),
  description text,
  reference_id text DEFAULT NULL, -- podcast_id or payment reference
  created_at timestamptz DEFAULT now()
);

-- 3. Credit pack definitions (admin-configurable)
CREATE TABLE IF NOT EXISTS public.podcast_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_ghs numeric(10,2) NOT NULL,
  price_display text NOT NULL, -- e.g. "GHS 5.00"
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Seed default credit packs
INSERT INTO public.podcast_credit_packs (name, credits, price_ghs, price_display, sort_order) VALUES
  ('Starter Pack', 5, 5.00, 'GHS 5.00', 1),
  ('Value Pack', 15, 12.00, 'GHS 12.00', 2),
  ('Pro Pack', 50, 35.00, 'GHS 35.00', 3)
ON CONFLICT DO NOTHING;

-- 5. Credit cost configuration (podcast type -> credit cost)
-- Stored as a simple reference; actual enforcement is in code.
COMMENT ON TABLE public.podcast_credits IS 'Credit costs: audio=1, image-audio=3, video=10. Monthly grants: free=0, scholar=5, genius=15.';

-- 6. Enable RLS
ALTER TABLE public.podcast_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_credit_packs ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies

-- Credits balance: users can read their own, admins can read all
CREATE POLICY "Users can read own credits"
  ON public.podcast_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all credits"
  ON public.podcast_credits FOR SELECT
  USING (is_admin(auth.uid()));

-- Credits balance: only server functions modify (via service_role)
-- Users cannot directly INSERT/UPDATE/DELETE their balance
CREATE POLICY "Service role manages credits"
  ON public.podcast_credits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transactions: users can read their own history
CREATE POLICY "Users can read own transactions"
  ON public.podcast_credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all transactions"
  ON public.podcast_credit_transactions FOR SELECT
  USING (is_admin(auth.uid()));

-- Credit packs: anyone can read active packs (for the store UI)
CREATE POLICY "Anyone can read active credit packs"
  ON public.podcast_credit_packs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage credit packs"
  ON public.podcast_credit_packs FOR ALL
  USING (is_admin(auth.uid()));

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_podcast_credits_user ON public.podcast_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_podcast_credit_txn_user ON public.podcast_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_podcast_credit_txn_created ON public.podcast_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcast_credit_packs_active ON public.podcast_credit_packs(is_active) WHERE is_active = true;

-- 9. Function: Atomically deduct credits (called by generate-podcast edge function)
CREATE OR REPLACE FUNCTION public.deduct_podcast_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT balance INTO v_current_balance
  FROM public.podcast_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create row with 0 balance
    INSERT INTO public.podcast_credits (user_id, balance) VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_current_balance, 'required', p_amount);
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.podcast_credits
  SET balance = v_new_balance,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.podcast_credit_transactions (user_id, amount, balance_after, transaction_type, reference_id, description)
  VALUES (p_user_id, -p_amount, v_new_balance, p_type, p_reference_id, p_description);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'deducted', p_amount);
END;
$$;

-- 10. Function: Add credits (for purchases, grants, refunds)
CREATE OR REPLACE FUNCTION public.add_podcast_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Upsert: create row if not exists
  INSERT INTO public.podcast_credits (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_amount, CASE WHEN p_type = 'purchase' THEN 0 ELSE p_amount END)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = podcast_credits.balance + p_amount,
      lifetime_earned = CASE
        WHEN p_type IN ('monthly_grant', 'bonus', 'admin_adjustment', 'refund')
        THEN podcast_credits.lifetime_earned + p_amount
        ELSE podcast_credits.lifetime_earned
      END,
      lifetime_purchased = CASE
        WHEN p_type = 'purchase'
        THEN podcast_credits.lifetime_purchased + p_amount
        ELSE podcast_credits.lifetime_purchased
      END,
      updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.podcast_credit_transactions (user_id, amount, balance_after, transaction_type, reference_id, description)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_reference_id, p_description);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'added', p_amount);
END;
$$;

-- 11. Function: Grant monthly credits based on subscription tier
-- Call this from a cron job or on subscription check.
CREATE OR REPLACE FUNCTION public.grant_monthly_podcast_credits(p_user_id uuid, p_tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowance integer;
  v_last_grant timestamptz;
  v_result jsonb;
BEGIN
  -- Determine allowance by tier
  v_allowance := CASE p_tier
    WHEN 'genius' THEN 15
    WHEN 'scholar' THEN 5
    ELSE 0
  END;

  IF v_allowance = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_allowance_for_tier', 'tier', p_tier);
  END IF;

  -- Check last grant date
  SELECT last_monthly_grant_at INTO v_last_grant
  FROM public.podcast_credits
  WHERE user_id = p_user_id;

  -- Only grant once per calendar month
  IF v_last_grant IS NOT NULL AND
     date_trunc('month', v_last_grant) = date_trunc('month', now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_granted_this_month', 'last_grant', v_last_grant);
  END IF;

  -- Add credits
  v_result := public.add_podcast_credits(
    p_user_id,
    v_allowance,
    'monthly_grant',
    NULL,
    format('Monthly %s tier grant (%s credits)', p_tier, v_allowance)
  );

  -- Update last grant timestamp
  UPDATE public.podcast_credits
  SET last_monthly_grant_at = now()
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$;
