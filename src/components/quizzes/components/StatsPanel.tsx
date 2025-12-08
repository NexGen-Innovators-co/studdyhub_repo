// src/components/quizzes/components/StatsPanel.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Trophy, Star, Flame } from 'lucide-react';
import { UserStats } from '../../../types/EnhancedClasses';
import { Progress } from '../../ui/progress';

interface StatsPanelProps {
  stats: UserStats | null;
  isLoading: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="shadow-lg dark:bg-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="shadow-lg dark:bg-gray-800">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">No stats available yet. Start taking quizzes!</p>
        </CardContent>
      </Card>
    );
  }

  const nextLevelXP = Math.pow(stats.level, 2) * 100;
  const progressToNextLevel = (stats.total_xp / nextLevelXP) * 100;

  return (
    <Card className="shadow-lg dark:bg-gray-800 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Your Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500">Level</div>
            <div className="text-2xl font-bold">{stats.level}</div>
            <Progress value={progressToNextLevel} className="mt-2 h-2" />
            <div className="text-xs text-gray-400 mt-1">
              {stats.total_xp} / {nextLevelXP} XP
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-500">Streak</div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats.current_streak} <Flame className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-xs text-gray-400">Longest: {stats.longest_streak}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Avg Score</div>
            <div className="text-xl font-semibold">{Math.round(stats.average_score)}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Quizzes</div>
            <div className="text-xl font-semibold">{stats.total_quizzes_completed}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Badges</div>
            <div className="text-xl font-semibold">{stats.badges_earned.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Study Time</div>
            <div className="text-xl font-semibold">
              {Math.floor(stats.total_study_time_seconds / 3600)}h
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
