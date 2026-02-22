// src/components/aiChat/Components/EducationContextBadge.tsx
import React from 'react';
import { GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEducation } from '@/hooks/useAppContext';

/**
 * Subtle badge shown in the AI chat panel indicating
 * that responses are tuned to the user's educational context.
 */
export function EducationContextBadge() {
  const { educationContext, educationLoading } = useEducation();

  if (educationLoading || !educationContext?.curriculum) return null;

  const label = [
    educationContext.curriculum.name,
    educationContext.educationLevel?.short_name,
  ]
    .filter(Boolean)
    .join(' · ');

  const subjects = educationContext.subjects.map((s) => s.name).join(', ');

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-[10px] gap-1 px-2 py-0.5 cursor-default select-none shrink-0 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/20"
          >
            <GraduationCap className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium mb-1">AI tuned to your education profile</p>
          {educationContext.country && (
            <p>
              {educationContext.country.flag_emoji} {educationContext.country.name}
            </p>
          )}
          {educationContext.targetExamination && (
            <p>Target: {educationContext.targetExamination.name}</p>
          )}
          {subjects && <p>Subjects: {subjects}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
