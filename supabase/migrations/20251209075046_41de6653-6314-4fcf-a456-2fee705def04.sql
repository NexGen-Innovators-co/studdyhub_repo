-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'scholar', 'genius')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'expired')),
  current_period_end TIMESTAMP WITH TIME ZONE,
  paystack_sub_code TEXT,
  paystack_customer_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  reward_granted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referee_id)
);

-- Add referral columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_ai_credits INTEGER DEFAULT 0;

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Enable RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view referrals they made"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view referrals they received"
ON public.referrals FOR SELECT
USING (auth.uid() = referee_id);

CREATE POLICY "System can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update referrals"
ON public.referrals FOR UPDATE
USING (true);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to assign referral code on signup
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := public.generate_referral_code();
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate referral code
CREATE TRIGGER on_profile_created_assign_referral
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.assign_referral_code();

-- Function to process referral reward
CREATE OR REPLACE FUNCTION public.process_referral_reward(p_referee_id UUID, p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_current_sub RECORD;
BEGIN
  -- Find referrer by code
  SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = p_referral_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if already referred
  IF EXISTS(SELECT 1 FROM public.referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already referred');
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referee_id, status)
  VALUES (v_referrer_id, p_referee_id, 'completed')
  RETURNING id INTO v_referral_id;
  
  -- Grant +10 AI credits to referee
  UPDATE public.profiles
  SET bonus_ai_credits = COALESCE(bonus_ai_credits, 0) + 10
  WHERE id = p_referee_id;
  
  -- Grant +3 days Scholar to referrer
  SELECT * INTO v_current_sub FROM public.subscriptions WHERE user_id = v_referrer_id;
  
  IF v_current_sub IS NULL THEN
    -- Create new subscription with 3 days Scholar
    INSERT INTO public.subscriptions (user_id, plan_type, status, current_period_end)
    VALUES (v_referrer_id, 'scholar', 'active', now() + interval '3 days');
  ELSE
    -- Extend existing subscription
    UPDATE public.subscriptions
    SET 
      plan_type = CASE WHEN plan_type = 'free' THEN 'scholar' ELSE plan_type END,
      current_period_end = GREATEST(COALESCE(current_period_end, now()), now()) + interval '3 days',
      status = 'active'
    WHERE user_id = v_referrer_id;
  END IF;
  
  -- Update referrer stats
  UPDATE public.profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = v_referrer_id;
  
  -- Mark referral as reward granted
  UPDATE public.referrals SET reward_granted = true WHERE id = v_referral_id;
  
  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$$;

-- Create updated_at trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();