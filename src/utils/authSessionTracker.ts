// src/utils/authSessionTracker.ts
// Tracks user login/logout and maintains real-time online status

import { supabase } from '@/integrations/supabase/client';

/**
 * Track user login - called when user authenticates
 */
export async function trackUserLogin(userId: string): Promise<void> {
  try {
    // Call RPC function to track login
    const { error } = await supabase.rpc('track_user_login', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('Failed to track login:', error.message);
      // Fallback: direct update
      await supabase
        .from('social_users')
        .update({
          is_online: true,
          last_login_at: new Date().toISOString(),
          current_session_started_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Error tracking login:', err);
  }
}

/**
 * Track user logout - called when user logs out or session ends
 */
export async function trackUserLogout(userId: string): Promise<void> {
  try {
    // Call RPC function to track logout
    const { error } = await supabase.rpc('track_user_logout', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('Failed to track logout:', error.message);
      // Fallback: direct update
      await supabase
        .from('social_users')
        .update({
          is_online: false,
          last_logout_at: new Date().toISOString(),
          current_session_started_at: null,
        })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Error tracking logout:', err);
  }
}

/**
 * Get user's current online status
 */
export async function getUserStatus(userId: string): Promise<{
  is_online: boolean;
  last_login_at: string | null;
  last_logout_at: string | null;
  status: string;
}> {
  try {
    const { data, error } = await supabase
      .from('social_users')
      .select('is_online, last_login_at, last_logout_at, status')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      is_online: data?.is_online ?? false,
      last_login_at: data?.last_login_at ?? null,
      last_logout_at: data?.last_logout_at ?? null,
      status: data?.status ?? 'active',
    };
  } catch (err) {
    console.error('Error getting user status:', err);
    return {
      is_online: false,
      last_login_at: null,
      last_logout_at: null,
      status: 'active',
    };
  }
}

/**
 * Subscribe to real-time user status changes using modern Supabase Realtime API
 */
export function subscribeToUserStatus(
  userId: string,
  callback: (status: {
    is_online: boolean;
    status: string;
    last_login_at: string | null;
    is_verified?: boolean | null;
  }) => void
): () => void {
  const channel = supabase
    .channel(`public:social_users:id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'social_users',
        filter: `id=eq.${userId}`,
      },
      (payload: any) => {
        if (payload.new) {
          callback({
            is_online: payload.new.is_online,
            status: payload.new.status,
            last_login_at: payload.new.last_login_at,
            is_verified: payload.new.is_verified,
          });
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get currently online users (for dashboard/real-time activity)
 */
export async function getOnlineUsersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('social_users')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true)
      .eq('status', 'active');

    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error('Error getting online users count:', err);
    return 0;
  }
}

/**
 * Get daily active users (logged in today)
 */
export async function getDailyActiveUsersCount(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('social_users')
      .select('*', { count: 'exact', head: true })
      .gte('last_login_at', today.toISOString())
      .eq('status', 'active');

    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error('Error getting daily active users:', err);
    return 0;
  }
}

/**
 * Get verification metrics for a user (from verification_metrics JSONB)
 */
export async function getUserVerificationMetrics(userId: string): Promise<{
  posts: number;
  followers: number;
  engagement_rate: number;
  account_age_days: number;
  last_active_days: number;
  violations: number;
  checked_at: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('social_users')
      .select('verification_metrics')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.verification_metrics ?? null;
  } catch (err) {
    console.error('Error getting verification metrics:', err);
    return null;
  }
}
