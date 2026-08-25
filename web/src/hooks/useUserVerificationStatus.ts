// src/hooks/useUserVerificationStatus.ts
// Hook to display user's verification status and real-time online status

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subscribeToUserStatus } from '@/utils/authSessionTracker';

export interface UserVerificationStatus {
  is_verified: boolean | null;
  status: 'active' | 'suspended' | 'banned' | 'deactivated' | 'inactive';
  is_online: boolean;
  last_login_at: string | null;
  last_logout_at: string | null;
  verification_metrics: {
    posts: number;
    followers: number;
    engagement_rate: number;
    account_age_days: number;
    last_active_days: number;
    violations: number;
    checked_at: string;
  } | null;
}

/**
 * Hook to get real-time user verification and status
 */
export function useUserVerificationStatus(userId: string | null) {
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setVerificationStatus(null);
      setLoading(false);
      return;
    }

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('social_users')
          .select('is_verified, status, is_online, last_login_at, last_logout_at, verification_metrics')
          .eq('id', userId)
          .single();

        if (error) throw error;

        setVerificationStatus({
          is_verified: data?.is_verified ?? null,
          status: data?.status ?? 'active',
          is_online: data?.is_online ?? false,
          last_login_at: data?.last_login_at ?? null,
          last_logout_at: data?.last_logout_at ?? null,
          verification_metrics: data?.verification_metrics ?? null,
        });
      } catch (err) {
        console.error('Error fetching verification status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUserStatus(userId, (status) => {
      setVerificationStatus((prev) =>
        prev
          ? {
              ...prev,
              is_online: status.is_online,
              status: status.status as any,
              last_login_at: status.last_login_at,
              // support updating verified state in real time
              is_verified: status.is_verified ?? prev.is_verified,
            }
          : null
      );
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { verificationStatus, loading };
}

/**
 * Determines if user can be shown the verified creator badge
 */
export function isVerifiedCreator(verificationStatus: UserVerificationStatus | null): boolean {
  return (verificationStatus?.is_verified ?? false) && verificationStatus?.status === 'active';
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'suspended':
      return 'Suspended';
    case 'banned':
      return 'Banned';
    case 'deactivated':
      return 'Deactivated';
    default:
      return status;
  }
}

/**
 * Get formatted last login text
 */
export function getLastLoginText(lastLoginAt: string | null): string {
  if (!lastLoginAt) return 'Never logged in';

  const lastLogin = new Date(lastLoginAt);
  const now = new Date();
  const diffMs = now.getTime() - lastLogin.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return lastLogin.toLocaleDateString();
}

/**
 * Get verification metric color based on requirement
 */
export function getMetricColor(
  metric: 'posts' | 'followers' | 'engagement_rate' | 'account_age_days' | 'last_active_days',
  value: number
): 'green' | 'yellow' | 'red' {
  switch (metric) {
    case 'posts':
      return value >= 50 ? 'green' : value >= 25 ? 'yellow' : 'red';
    case 'followers':
      return value >= 500 ? 'green' : value >= 250 ? 'yellow' : 'red';
    case 'engagement_rate':
      return value >= 2.0 ? 'green' : value >= 1.0 ? 'yellow' : 'red';
    case 'account_age_days':
      return value >= 30 ? 'green' : value >= 14 ? 'yellow' : 'red';
    case 'last_active_days':
      return value <= 15 ? 'green' : value <= 30 ? 'yellow' : 'red';
    default:
      return 'red';
  }
}
