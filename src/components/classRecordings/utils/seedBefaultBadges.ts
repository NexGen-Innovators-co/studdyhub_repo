// src/components/classRecordings/utils/seedDefaultBadges.ts
import { supabase } from '../../../integrations/supabase/client';
import { Badge } from '../../../types/EnhancedClasses';

const DEFAULT_BADGES: Omit<Badge, 'id'>[] = [
  {
    name: 'First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    requirement_type: 'quiz_count',
    requirement_value: 1,
    xp_reward: 50
  },
  {
    name: 'Quiz Master',
    description: 'Complete 10 quizzes',
    icon: '📚',
    requirement_type: 'quiz_count',
    requirement_value: 10,
    xp_reward: 200
  },
  {
    name: 'Quiz Legend',
    description: 'Complete 50 quizzes',
    icon: '👑',
    requirement_type: 'quiz_count',
    requirement_value: 50,
    xp_reward: 500
  },
  {
    name: 'On Fire!',
    description: 'Maintain a 3-day study streak',
    icon: '🔥',
    requirement_type: 'streak',
    requirement_value: 3,
    xp_reward: 100
  },
  {
    name: 'Consistency King',
    description: 'Maintain a 7-day study streak',
    icon: '⚡',
    requirement_type: 'streak',
    requirement_value: 7,
    xp_reward: 300
  },
  {
    name: 'Dedication Champion',
    description: 'Maintain a 30-day study streak',
    icon: '💎',
    requirement_type: 'streak',
    requirement_value: 30,
    xp_reward: 1000
  },
  {
    name: 'Sharp Mind',
    description: 'Achieve 80% average score',
    icon: '🧠',
    requirement_type: 'score',
    requirement_value: 80,
    xp_reward: 250
  },
  {
    name: 'Perfect Scholar',
    description: 'Get 5 perfect scores (100%)',
    icon: '⭐',
    requirement_type: 'perfect_score',
    requirement_value: 5,
    xp_reward: 400
  },
  {
    name: 'XP Enthusiast',
    description: 'Earn 1,000 total XP',
    icon: '🎊',
    requirement_type: 'xp',
    requirement_value: 1000,
    xp_reward: 100
  },
  {
    name: 'XP Master',
    description: 'Earn 10,000 total XP',
    icon: '🏆',
    requirement_type: 'xp',
    requirement_value: 10000,
    xp_reward: 1000
  }
];

export const seedDefaultBadges = async (): Promise<boolean> => {
  try {
    // Check if badges already exist
    const { data: existingBadges, error: checkError } = await supabase
      .from('badges')
      .select('id')
      .limit(1);

    if (checkError) throw checkError;

    // If badges exist, don't seed again
    if (existingBadges && existingBadges.length > 0) {

      return true;
    }

    // Insert default badges
    const { error: insertError } = await supabase
      .from('badges')
      .insert(DEFAULT_BADGES);

    if (insertError) throw insertError;


    return true;
  } catch (error) {

    return false;
  }
};

export const getAllBadges = async (): Promise<Badge[]> => {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {

    return [];
  }
};

export const getUserAchievements = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*, badge:badges(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {

    return [];
  }
};