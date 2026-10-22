// src/components/quizzes/components/BadgesPanel.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/card';
import { Badge as UIBadge } from '../../ui/components/badge';
import {
  Award,
  CheckCircle2,
  Crown,
  Flame,
  Gem,
  Lock,
  Microscope,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Badge, Achievement } from '../../../types/Class';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/components/tooltip';

const badgeArtwork: Record<string, string> = {
  badge_adinkra: 'img_badge_adinkra_1787333607984.jpg',
  badge_oware: 'img_badge_oware_1787333621590.jpg',
  badge_spelling: 'img_badge_spelling_1787333633448.jpg',
  badge_black_star: 'img_badge_black_star_1787333645565.jpg',
  badge_scientist: 'img_badge_scientist_1787333657585.jpg',
  badge_streak: 'img_trophy_showcase_1786761343079.jpg',
  badge_speed: 'img_badge_adinkra_1787333607984.jpg',
  badge_all_round: 'img_trophy_showcase_1786761343079.jpg',
};

const badgeIconComponents: Record<string, React.ElementType> = {
  sparkles: Sparkles,
  fire: Flame,
  'shield-fire': Shield,
  crown: Crown,
  abacus: Award,
  bee: Award,
  star: Star,
  microscope: Microscope,
  zap: Zap,
  trophy: Trophy,
  'check-circle': CheckCircle2,
  target: Target,
  gem: Gem,
  award: Award,
  'crown-check': Crown,
};

const getBadgeTitle = (badge: Badge) => {
  const descriptionTitle = badge.description.match(/^(.+?)\s+[—–-]\s+/)?.[1]?.trim();
  if (descriptionTitle) return descriptionTitle;
  if (!/^badge_|^[a-z0-9_-]+$/.test(badge.name)) return badge.name;
  return badge.name
    .replace(/^badge_/, '')
    .split(/[_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const isEmojiIcon = (icon: string) => /[^\u0000-\u007f]/.test(icon) && !/^[a-z0-9_-]+$/i.test(icon);

const BadgeIcon: React.FC<{ badge: Badge }> = ({ badge }) => {
  const image = badgeArtwork[badge.name.toLowerCase()];
  if (image) {
    return <img src={`/mobile/${image}`} alt="" className="h-12 w-12 rounded-full object-cover" />;
  }

  if (isEmojiIcon(badge.icon)) {
    return <span aria-hidden="true">{badge.icon}</span>;
  }

  const Icon = badgeIconComponents[badge.icon.toLowerCase()] ?? Trophy;
  return <Icon aria-hidden="true" className="h-10 w-10 text-amber-500" />;
};

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
                        <div className="relative flex h-12 w-12 items-center justify-center text-4xl">
                          <BadgeIcon badge={badge} />
                          {!isEarned && (
                            <Lock className="absolute -top-1 -right-1 h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm line-clamp-1">
                            {getBadgeTitle(badge)}
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
                      <p className="font-semibold">{getBadgeTitle(badge)}</p>
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
