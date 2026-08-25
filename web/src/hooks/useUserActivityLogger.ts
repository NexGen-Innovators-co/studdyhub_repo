import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ActivityType = 'chat' | 'quiz' | 'note' | 'recording' | 'document' | 'post' | 'group_interaction' | 'onboarding';

export function useUserActivityLogger() {
  const logUserActivity = useCallback(
    async (userId: string | undefined, activityType: ActivityType, xpEarned = 0) => {
      if (!userId) return;

      try {
        const { error } = await supabase.rpc('log_user_activity', {
          p_user_id: userId,
          p_activity_type: activityType,
          p_xp_earned: xpEarned,
        });

        if (!error) return;
      } catch {
        // Fall back to lightweight touch endpoint if custom RPC is unavailable.
      }

      try {
        await supabase.rpc('touch_user_activity', { p_user_id: userId });
      } catch {
        // Last fallback: keep last activity timestamp fresh for dashboard modeing.
        await supabase
          .from('user_stats')
          .update({
            last_activity_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
    },
    []
  );

  return { logUserActivity };
}
