/**
 * RPC Service — Server-side PostgreSQL function calls via the API Gateway.
 * Replaces direct supabase.rpc() calls.
 */

import { apiClient } from './apiClient';

export const rpcService = {
  /** Award XP to a user (server calculates level + credits) */
  async awardXp(userId: string, xpAmount: number, reason: string): Promise<any> {
    return apiClient.rpc('award_xp', { p_user_id: userId, p_xp_amount: xpAmount, p_reason: reason });
  },

  /** Submit quiz result (server updates stats, XP, streak) */
  async submitQuizResult(userId: string, score: number, total: number, timeSeconds: number): Promise<any> {
    return apiClient.rpc('submit_quiz_result', { p_user_id: userId, p_score: score, p_total: total, p_time_seconds: timeSeconds });
  },

  /** Spend credits (atomic deduction) */
  async spendCredits(userId: string, cost: number, item: string): Promise<any> {
    return apiClient.rpc('spend_credits', { p_user_id: userId, p_cost: cost, p_item: item });
  },

  /** Record activity (streak update) */
  async recordActivity(userId: string): Promise<any> {
    return apiClient.rpc('record_activity', { p_user_id: userId });
  },

  /** Claim daily quest reward */
  async claimDailyQuest(userId: string, points: number): Promise<any> {
    return apiClient.rpc('claim_daily_quest', { p_user_id: userId, p_points: points });
  },

  /** Claim badge (+50 XP) */
  async claimBadge(userId: string, badgeName: string): Promise<any> {
    return apiClient.rpc('claim_badge', { p_user_id: userId, p_badge_name: badgeName });
  },

  /** Submit game result (stars + XP + progress) */
  async submitGameResult(userId: string, gameKey: string, level: number, score: number, total: number): Promise<any> {
    return apiClient.rpc('submit_game_result', { p_user_id: userId, p_game_key: gameKey, p_level: level, p_score: score, p_total: total });
  },

  /** Purchase streak freeze (atomic) */
  async purchaseStreakFreeze(userId: string, cost: number): Promise<any> {
    return apiClient.rpc('purchase_streak_freeze', { p_user_id: userId, p_cost: cost });
  },

  /** Generic RPC call for any server function */
  async call<T = any>(functionName: string, params?: Record<string, any>): Promise<T> {
    return apiClient.rpc<T>(functionName, params);
  },
};
