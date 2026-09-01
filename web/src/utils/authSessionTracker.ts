// src/utils/authSessionTracker.ts
// Tracks user login/logout and maintains real-time online status

import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/services/apiClient';

/**
 * Track user login - called when user authenticates
 */
export async function trackUserLogin(userId: string): Promise<void> {
  try {
    // Call RPC function to track login
    await apiClient.rpc('track_user_login', {
      p_user_id: userId,
    });
  } catch (err) {
    console.warn('Failed to track login, using fallback:', err);
    // Fallback: direct update
    try {
      await apiClient.patch(`social-users/${userId}`, {
        is_online: true,
        last_login_at: new Date().toISOString(),
        current_session_started_at: new Date().toISOString(),
      });
    } catch (fallbackErr) {
      console.error('Error tracking login:', fallbackErr);
    }
  }
}

/**
 * Track user logout - called when user logs out or session ends
 */
export async function trackUserLogout(userId: string): Promise<void> {
  try {
    // Call RPC function to track logout
    await apiClient.rpc('track_user_logout', {
      p_user_id: userId,
    });
  } catch (err) {
    console.warn('Failed to track logout, using fallback:', err);
    // Fallback: direct update
    try {
      await apiClient.patch(`social-users/${userId}`, {
        is_online: false,
        last_logout_at: new Date().toISOString(),
        current_session_started_at: null,
      });
    } catch (fallbackErr) {
      console.error('Error tracking logout:', fallbackErr);
    }
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
    const data = await apiClient.get(`social-users/${userId}`);

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
    const data = await apiClient.get('social-users', { is_online: true, status: 'active' });
    return Array.isArray(data) ? data.length : 0;
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

    const data = await apiClient.get('social-users', { 
      last_login_at: `gte.${today.toISOString()}`, 
      status: 'active' 
    });
    return Array.isArray(data) ? data.length : 0;
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
    const data = await apiClient.get(`social-users/${userId}`);
    return data?.verification_metrics ?? null;
  } catch (err) {
    console.error('Error getting verification metrics:', err);
    return null;
  }
}
