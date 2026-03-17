// src/components/admin/VerificationMetricsPanel.tsx
// Panel to display user verification metrics and real-time status

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VerifiedBadge, StatusBadge, OnlineIndicator } from '@/components/social/components/VerifiedBadge';
import { getMetricColor } from '@/hooks/useUserVerificationStatus';
import { Check, X, AlertCircle, Eye, Users } from 'lucide-react';

interface VerificationMetric {
  id: string;
  username: string;
  is_verified: boolean;
  status: string;
  is_online: boolean;
  last_login_at: string | null;
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
 * Dashboard panel showing verification metrics for all users
 */
export const VerificationMetricsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<VerificationMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase
          .from('social_users')
          .select('id, username, is_verified, status, is_online, last_login_at, verification_metrics')
          .order('last_login_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        setMetrics(data || []);

        // Calculate stats
        const online = (data || []).filter((u) => u.is_online).length;
        const verified = (data || []).filter((u) => u.is_verified && u.status === 'active').length;

        setOnlineCount(online);
        setVerifiedCount(verified);
      } catch (err) {
        console.error('Error fetching verification metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading verification metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Check className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Verified Creators</p>
              <p className="text-2xl font-bold text-blue-900">{verifiedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm text-green-600 font-medium">Online Now</p>
              <p className="text-2xl font-bold text-green-900">{onlineCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">User Verification Status</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Online</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Posts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Followers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Engagement</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Active</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((user) => {
                const metrics = user.verification_metrics;
                const isVerified = user.is_verified && user.status === 'active';

                return (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{user.username}</p>
                        </div>
                        {isVerified && (
                          <Check className="w-4 h-4 text-blue-500" strokeWidth={3} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3">
                      <OnlineIndicator
                        isOnline={user.is_online}
                        lastLoginAt={user.last_login_at}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {metrics ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {metrics.posts}
                          </span>
                          {metrics.posts >= 50 && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {metrics.posts < 50 && metrics.posts >= 25 && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {metrics.posts < 25 && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {metrics ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {metrics.followers}
                          </span>
                          {metrics.followers >= 500 && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {metrics.followers < 500 && metrics.followers >= 250 && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {metrics.followers < 250 && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {metrics ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {((metrics.engagement_rate ?? 0) as number).toFixed(1)}%
                          </span>
                          {(metrics.engagement_rate ?? 0) >= 2.0 && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {(metrics.engagement_rate ?? 0) < 2.0 && (metrics.engagement_rate ?? 0) >= 1.0 && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {(metrics.engagement_rate ?? 0) < 1.0 && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {metrics ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {metrics.account_age_days ?? 0}d
                          </span>
                          {(metrics.account_age_days ?? 0) >= 30 && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {(metrics.account_age_days ?? 0) < 30 && (metrics.account_age_days ?? 0) >= 14 && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {(metrics.account_age_days ?? 0) < 14 && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {metrics ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {metrics.last_active_days ?? 0}d
                          </span>
                          {(metrics.last_active_days ?? 0) <= 15 && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {(metrics.last_active_days ?? 0) > 15 && (metrics.last_active_days ?? 0) <= 30 && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {(metrics.last_active_days ?? 0) > 30 && <X className="w-4 h-4 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm font-semibold text-blue-900 mb-2">Verification Criteria</p>
        <div className="grid grid-cols-2 gap-3 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>Meets requirement</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span>Approaching requirement</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-red-500" />
            <span>Below requirement</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✓ 50+ Posts</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✓ 500+ Followers</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✓ 2%+ Engagement</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✓ 30+ days old</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✓ Active in 15 days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationMetricsPanel;
