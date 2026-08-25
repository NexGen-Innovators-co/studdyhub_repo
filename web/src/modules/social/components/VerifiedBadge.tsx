// src/components/social/components/VerifiedBadge.tsx
// Component to display verified creator badge with tooltip and online status

import React, { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { UserVerificationStatus, getLastLoginText } from '@/hooks/useUserVerificationStatus';

interface VerifiedBadgeProps {
  verificationStatus: UserVerificationStatus | null;
  showOnlineIndicator?: boolean;
  className?: string;
}

/**
 * Displays verified creator badge with optional tooltip
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  verificationStatus,
  showOnlineIndicator = true,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!verificationStatus) {
    return null;
  }

  const isVerified = verificationStatus.is_verified && verificationStatus.status === 'active';
  const isOnline = verificationStatus.is_online;

  if (!isVerified) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Verified Badge */}
        <div className="flex items-center gap-0.5">
          <Check className="w-4 h-4 text-blue-500" strokeWidth={3} />
        </div>

        {/* Online Indicator */}
        {showOnlineIndicator && (
          <div
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={isOnline ? 'Online now' : 'Offline'}
          />
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-max shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-3 h-3 text-blue-400" />
              <span className="font-semibold">Verified Creator</span>
            </div>

            {/* Status Line */}
            <div className="flex items-center gap-2 text-gray-300 text-xs mb-2">
              <Clock className="w-3 h-3" />
              <span>{getLastLoginText(verificationStatus.last_login_at)}</span>
            </div>

            {/* Metrics if available */}
            {verificationStatus.verification_metrics ? (
              (() => {
                const metrics = verificationStatus.verification_metrics;
                const hasNonZeroMetric =
                  (!!metrics.posts && metrics.posts > 0) ||
                  (!!metrics.followers && metrics.followers > 0) ||
                  (!!metrics.engagement_rate && metrics.engagement_rate > 0) ||
                  (!!metrics.account_age_days && metrics.account_age_days > 0);

                if (!hasNonZeroMetric) {
                  return (
                    <div className="border-t border-gray-700 pt-2 mt-2 text-xs text-gray-300">
                      Verification metrics not available
                    </div>
                  );
                }

                return (
                  <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Posts:</span>{' '}
                        <span className="text-white">
                          {metrics.posts ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Followers:</span>{' '}
                        <span className="text-white">
                          {metrics.followers ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Engagement:</span>{' '}
                        <span className="text-white">
                          {((metrics.engagement_rate ?? 0) as number).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Account Age:</span>{' '}
                        <span className="text-white">
                          {metrics.account_age_days ?? 0}d
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="border-t border-gray-700 pt-2 mt-2 text-xs text-gray-300">
                Verification metrics not available
              </div>
            )}
          </div>

          {/* Tooltip arrow */}
          <div className="absolute -bottom-1 left-2 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Displays account status badge (Active, Suspended, Banned, etc.)
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const statusConfig = {
    active: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Active',
    },
    inactive: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: 'Inactive',
    },
    suspended: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'Suspended',
    },
    banned: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Banned',
    },
    deactivated: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      label: 'Deactivated',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${config.bg.replace('100', '600')}`} />
      {config.label}
    </span>
  );
};

interface OnlineIndicatorProps {
  isOnline: boolean;
  lastLoginAt: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Displays online status indicator with optional tooltip
 */
export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
  isOnline,
  lastLoginAt,
  size = 'md',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizeConfig = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className="relative inline-block" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <div
        className={`${sizeConfig[size]} rounded-full ${
          isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        } ${className}`}
      />

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
            {isOnline ? 'Online' : getLastLoginText(lastLoginAt)}
          </div>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
};
