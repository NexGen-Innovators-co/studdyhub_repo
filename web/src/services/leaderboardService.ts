/**
 * Leaderboard Service — Rankings via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  school: string;
  avatar_url: string | null;
  academic_tier: string | null;
  total_xp: number;
  level: number;
  rank: number;
}

export const leaderboardService = {
  /** List leaderboard — defaults to 'all' (all users regardless of tier) */
  async list(options?: {
    tier?: string;       // 'all', 'explorer', 'achiever', 'scholar'
    school?: string;
    academic_level?: string;
    limit?: number;
    offset?: number;
  }): Promise<LeaderboardEntry[]> {
    const params: Record<string, string> = {};
    if (options?.tier) params.tier = options.tier;
    if (options?.school) params.school = options.school;
    if (options?.academic_level) params.academic_level = options.academic_level;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);
    // Default to 'all' — show all users regardless of tier
    if (!params.tier) params.tier = 'all';
    return apiClient.get<LeaderboardEntry[]>('leaderboard', params);
  },
};
