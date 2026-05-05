-- Migration: Create verified_creator badge
-- Purpose: Add the verified_creator badge that is awarded to content creators
--          who meet the verification criteria (50+ posts, 500+ followers, etc.)

INSERT INTO public.badges (
  name,
  description,
  icon,
  requirement_type,
  requirement_value,
  xp_reward,
  created_at
) VALUES (
  'verified_creator',
  'Verified Creator - Awarded to content creators who meet eligibility criteria (50+ posts, 500+ followers, 2%+ engagement, 30+ days old, active recently, no violations)',
  'crown-check',
  'xp',
  250,
  250,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Verify the badge was created
SELECT id, name, description FROM public.badges WHERE name = 'verified_creator';
