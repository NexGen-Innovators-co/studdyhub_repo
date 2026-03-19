import React from 'react';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Calendar, Zap } from 'lucide-react';
import { useDailyActivity } from '@/hooks/useDailyActivity';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

interface DailyProgressWidgetProps {
  userId?: string;
  onAction: () => void;
}

const DAILY_ACTION_GOAL = 3;

export const DailyProgressWidget: React.FC<DailyProgressWidgetProps> = ({ userId, onAction }) => {
  const { todayXp, todayActions, streakDays, loading, error } = useDailyActivity(userId);

  const progress = Math.min(100, Math.round((todayActions / DAILY_ACTION_GOAL) * 100));
  const actionsRemaining = Math.max(0, DAILY_ACTION_GOAL - todayActions);

  const { isFree, tier } = useFeatureAccess();
  const freeDailyLimit = 3;
  const reachedFreeLimit = isFree && todayActions >= freeDailyLimit;

  return (
    <div className="bg-white/80 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Progress</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Build your streak by completing actions today.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-blue-50 dark:bg-blue-900 p-2">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="rounded-full bg-green-50 dark:bg-green-900 p-2">
            <Calendar className="h-5 w-5 text-green-600 dark:text-green-300" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Today’s XP</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '…' : `${todayXp}`}</p>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Current Streak</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '…' : `${streakDays}d`}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Daily actions</p>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{todayActions}/{DAILY_ACTION_GOAL}</p>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading
              ? 'Loading activity…'
              : error
                ? 'Could not load activity.'
                : reachedFreeLimit
                  ? 'Free users can log up to 3 actions per day. Upgrade for unlimited daily progress.'
                  : actionsRemaining === 0
                    ? 'Goal reached! Great work today.'
                    : `Do ${actionsRemaining} more action${actionsRemaining === 1 ? '' : 's'} to keep your streak.`
            }
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Button
            onClick={onAction}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            disabled={reachedFreeLimit}
          >
            <Sparkles className="h-4 w-4" />
            {reachedFreeLimit ? 'Upgrade to continue' : (actionsRemaining === 0 ? 'Keep Going' : 'Do an action')}
          </Button>
          {reachedFreeLimit && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Upgrade to unlock unlimited daily streak actions.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-500">{error}</div>
      )}
    </div>
  );
};
