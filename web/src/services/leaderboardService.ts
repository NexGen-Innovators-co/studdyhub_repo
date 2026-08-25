/**
 * Leaderboard Service — Rankings via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  school: string;
  points_balance: number;
  avatar_url: string | null;
  academic_tier: string;
  total_xp: number;
}

export const leaderboardService = {
  async list(options?: { tier?: string; school?: string; academic_level?: string; limit?: number }): Promise<LeaderboardEntry[]> {
    const params: Record<string, string> = {};
    if (options?.tier) params.tier = options.tier;
    if (options?.school) params.school = options.school;
    if (options?.academic_level) params.academic_level = options.academic_level;
    if (options?.limit) params.limit = String(options.limit);
    return apiClient.get<LeaderboardEntry[]>('leaderboard', Object.keys(params).length ? params : undefined);
  },
};
