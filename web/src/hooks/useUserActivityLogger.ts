import { useCallback } from 'react';
import { apiClient } from '@/services/apiClient';

type ActivityType = 'chat' | 'quiz' | 'note' | 'recording' | 'document' | 'post' | 'group_interaction' | 'onboarding';

export function useUserActivityLogger() {
  const logUserActivity = useCallback(
    async (userId: string | undefined, activityType: ActivityType, xpEarned = 0) => {
      if (!userId) return;

      try {
        await apiClient.rpc('log_user_activity', {
          p_user_id: userId,
          p_activity_type: activityType,
          p_xp_earned: xpEarned,
        });
        return;
      } catch {
        // Fall back to lightweight touch endpoint if custom RPC is unavailable.
      }

      try {
        await apiClient.rpc('touch_user_activity', { p_user_id: userId });
      } catch {
        // Last fallback: keep last activity timestamp fresh for dashboard modeing.
        await apiClient.patch(`user-stats/${userId}`, {
          last_activity_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    },
    []
  );

  return { logUserActivity };
}
