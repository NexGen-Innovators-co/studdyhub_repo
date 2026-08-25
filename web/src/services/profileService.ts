/**
 * Profile Service — User profile + related lookups via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  school: string | null;
  points_balance: number;
  academic_tier: string | null;
  academic_level: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  user_id: string;
  total_xp: number;
  level: number;
  quizzes_taken: number;
  avg_score: number;
  current_streak: number;
  longest_streak: number;
  credits_balance: number;
}

export const profileService = {
  /** Get current user's profile */
  async get(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('profile');
  },

  /** Update current user's profile */
  async update(updates: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('profile', updates);
  },

  /** Look up profiles by id or email */
  async lookup(params: { id?: string; email?: string }): Promise<UserProfile[]> {
    return apiClient.get<UserProfile[]>('profiles', params);
  },

  /** Upsert a profile (used during auth/sync) */
  async upsert(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    return apiClient.post<UserProfile>('profiles', profile);
  },

  /** Get user stats */
  async getStats(userId?: string): Promise<UserStats> {
    const params = userId ? { user_id: userId } : undefined;
    return apiClient.get<UserStats>('user-stats', params);
  },
};
