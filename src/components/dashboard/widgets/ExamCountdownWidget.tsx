// src/components/dashboard/widgets/ExamCountdownWidget.tsx
// Shows a countdown to the user's target examination date.

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, Clock } from 'lucide-react';
import type { UserEducationContext } from '@/types/Education';

interface ExamCountdownWidgetProps {
  educationContext: UserEducationContext;
}

export const ExamCountdownWidget: React.FC<ExamCountdownWidgetProps> = ({ educationContext }) => {
  const countdown = useMemo(() => {
    const examDate = educationContext.targetExamination?.typical_date;
    if (!examDate) return null;

    const target = new Date(examDate);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return { days: 0, isPast: true };

    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    return { days, weeks, months, isPast: false };
  }, [educationContext.targetExamination?.typical_date]);

  if (!countdown || !educationContext.targetExamination) return null;

  const urgencyColor = countdown.isPast
    ? 'text-gray-400'
    : countdown.days <= 30
      ? 'text-red-500'
      : countdown.days <= 90
        ? 'text-orange-500'
        : 'text-blue-500';

  return (
    <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <CalendarClock className="h-4 w-4 text-blue-500" />
          Exam Countdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className={`text-3xl font-bold ${urgencyColor}`}>
            {countdown.isPast ? 'Completed' : `${countdown.days}`}
          </div>
          {!countdown.isPast && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              days to {educationContext.targetExamination.name}
            </p>
          )}
          {!countdown.isPast && countdown.weeks > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              ({countdown.months > 0 ? `${countdown.months} months` : `${countdown.weeks} weeks`})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExamCountdownWidget;
