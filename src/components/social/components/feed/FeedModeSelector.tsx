// src/components/social/components/feed/FeedModeSelector.tsx
// Pill-based feed mode selector for education-aware social feed.
// Allows switching between: For You, My School, My Level, All, Trending.

import React from 'react';
import { Sparkles, School, GraduationCap, Globe, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserEducationContext } from '@/types/Education';

export type FeedMode = 'for-you' | 'my-school' | 'my-level' | 'all' | 'trending';

interface FeedModeSelectorProps {
  mode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  educationContext: UserEducationContext | null;
  className?: string;
}

interface ModeOption {
  id: FeedMode;
  label: string;
  icon: React.ReactNode;
  requiresEducation?: boolean;
  description?: string;
}

export const FeedModeSelector: React.FC<FeedModeSelectorProps> = ({
  mode,
  onModeChange,
  educationContext,
  className,
}) => {
  const modes: ModeOption[] = [
    {
      id: 'for-you',
      label: 'For You',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      requiresEducation: true,
      description: 'Posts matching your curriculum & subjects',
    },
    {
      id: 'my-school',
      label: educationContext?.institutionName
        ? educationContext.institutionName.length > 12
          ? educationContext.institutionName.slice(0, 12) + '…'
          : educationContext.institutionName
        : 'My School',
      icon: <School className="w-3.5 h-3.5" />,
      requiresEducation: true,
      description: 'Posts from your institution',
    },
    {
      id: 'my-level',
      label: educationContext?.educationLevel?.short_name || 'My Level',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      requiresEducation: true,
      description: 'Posts from your education level',
    },
    {
      id: 'all',
      label: 'All',
      icon: <Globe className="w-3.5 h-3.5" />,
      description: 'All posts',
    },
    {
      id: 'trending',
      label: 'Trending',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      description: 'Trending right now',
    },
  ];

  return (
    <div className={cn('flex gap-1.5 overflow-x-auto scrollbar-none pb-1', className)}>
      {modes.map((opt) => {
        const disabled = opt.requiresEducation && !educationContext;
        const active = mode === opt.id;

        return (
          <button
            key={opt.id}
            onClick={() => !disabled && onModeChange(opt.id)}
            disabled={disabled}
            title={opt.description}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              active
                ? opt.id === 'for-you'
                  ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white border-transparent shadow-md'
                  : 'bg-blue-600 text-white border-transparent shadow-md'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default FeedModeSelector;
