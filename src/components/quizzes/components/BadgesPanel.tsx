// src/components/quizzes/components/BadgesPanel.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge as UIBadge } from '../../ui/badge';
import { Trophy, Lock } from 'lucide-react';
import { Badge, Achievement } from '../../../types/EnhancedClasses';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface BadgesPanelProps {
  allBadges: Badge[];
  earnedAchievements: Achievement[];
  isLoading?: boolean;
}

export const BadgesPanel: React.FC<BadgesPanelProps> = ({
  allBadges,
  earnedAchievements,
  isLoading
}) => {
  const earnedBadgeIds = new Set(earnedAchievements.map(a => a.badge_id));

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Badges & Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Badges & Achievements
          </CardTitle>
          <UIBadge variant="secondary">
            {earnedAchievements.length} / {allBadges.length}
          </UIBadge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 gap-3 max-h-screen-50 overflow-y-scroll">
          {allBadges.map((badge) => {
            const isEarned = earnedBadgeIds.has(badge.id);
            const achievement = earnedAchievements.find(a => a.badge_id === badge.id);

            return (
              <TooltipProvider key={badge.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        relative p-4 rounded-lg border-2 transition-all cursor-pointer
                        ${isEarned
                          ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 hover:shadow-lg'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-60'
                        }
                      `}
                    >
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div className="text-4xl relative">
                          {badge.icon || '🏆'}
                          {!isEarned && (
                            <Lock className="absolute -top-1 -right-1 h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm line-clamp-1">
                            {badge.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            +{badge.xp_reward} XP
                          </p>
                        </div>
                      </div>
                      {isEarned && achievement && (
                        <div className="absolute top-1 right-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs dark:bg-slate- bg-slate-50">
                    <div className="space-y-1">
                      <p className="font-semibold">{badge.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {badge.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requirement: {badge.requirement_type === 'quiz_count' && `Complete ${badge.requirement_value} quizzes`}
                        {badge.requirement_type === 'streak' && `Maintain ${badge.requirement_value}-day streak`}
                        {badge.requirement_type === 'xp' && `Earn ${badge.requirement_value} XP`}
                        {badge.requirement_type === 'score' && `Achieve ${badge.requirement_value}% average score`}
                        {badge.requirement_type === 'perfect_score' && `Get ${badge.requirement_value} perfect scores`}
                      </p>
                      {isEarned && achievement && (
                        <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                          Earned: {new Date(achievement.earned_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
