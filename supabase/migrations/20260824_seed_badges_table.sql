-- Migration: Seed default badges catalog
-- Populates public.badges table with standard milestones, streak achievements, and Explorer cultural badges.

INSERT INTO public.badges (
  name,
  description,
  icon,
  requirement_type,
  requirement_value,
  xp_reward,
  created_at
) VALUES
  (
    'first_quest',
    'First Quest Champion — Completed your first learning quest or game level!',
    'sparkles',
    'xp',
    50,
    50,
    NOW()
  ),
  (
    'badge_streak',
    'Streak Guardian — Maintained a 3-day active daily study streak!',
    'fire',
    'streak',
    3,
    180,
    NOW()
  ),
  (
    'streak_7',
    '7-Day Consistency Master — Kept the learning fire burning for 7 consecutive days!',
    'shield-fire',
    'streak',
    7,
    350,
    NOW()
  ),
  (
    'badge_adinkra',
    'Adinkra Sage — Scored 3 stars in the Kente Cultural Quiz (Wisdom & Heritage)!',
    'crown',
    'score',
    3,
    150,
    NOW()
  ),
  (
    'badge_oware',
    'Oware Grandmaster — Solved 20 quick addition and subtraction math quests!',
    'abacus',
    'quiz_count',
    20,
    200,
    NOW()
  ),
  (
    'badge_spelling',
    'Spelling Bee Ace — Spelled 15 words accurately in the National Word Bee!',
    'bee',
    'quiz_count',
    15,
    120,
    NOW()
  ),
  (
    'badge_black_star',
    'Black Star Legend — Completed all Social Studies independence and heritage lessons!',
    'star',
    'quiz_count',
    5,
    250,
    NOW()
  ),
  (
    'badge_scientist',
    'Junior Scientist — Completed 3 science lessons and natural world investigations!',
    'microscope',
    'quiz_count',
    3,
    100,
    NOW()
  ),
  (
    'badge_speed',
    'Chaskele Speedster — Completed a speed quiz battle round under 45 seconds!',
    'zap',
    'score',
    1,
    150,
    NOW()
  ),
  (
    'badge_all_round',
    'Black Star Trophy — Unlocked all 7 primary Explorer milestone badges!',
    'trophy',
    'xp',
    1000,
    500,
    NOW()
  ),
  (
    'quiz_ace_10',
    'Quiz Ace — Successfully completed 10 comprehensive academic quizzes!',
    'check-circle',
    'quiz_count',
    10,
    150,
    NOW()
  ),
  (
    'perfect_scholar',
    'Flawless Exam — Achieved a perfect 100% score on a full academic quiz!',
    'target',
    'perfect_score',
    1,
    200,
    NOW()
  ),
  (
    'xp_scholar_500',
    'Level 2 Milestone — Surpassed 500 Lifetime XP on StuddyHub!',
    'gem',
    'xp',
    500,
    100,
    NOW()
  ),
  (
    'xp_scholar_1000',
    'Grand Scholar — Surpassed 1,000 Lifetime XP on StuddyHub!',
    'award',
    'xp',
    1000,
    250,
    NOW()
  ),
  (
    'verified_creator',
    'Verified Creator — Recognized academic community content creator and study group leader!',
    'crown-check',
    'xp',
    250,
    250,
    NOW()
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value,
  xp_reward = EXCLUDED.xp_reward;
