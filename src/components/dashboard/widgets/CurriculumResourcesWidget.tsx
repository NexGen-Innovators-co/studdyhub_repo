// src/components/dashboard/widgets/CurriculumResourcesWidget.tsx
// Shows the user's current curriculum and education level at a glance.

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Globe, School } from 'lucide-react';
import type { UserEducationContext } from '@/types/Education';

interface CurriculumResourcesWidgetProps {
  educationContext: UserEducationContext;
}

export const CurriculumResourcesWidget: React.FC<CurriculumResourcesWidgetProps> = ({
  educationContext,
}) => {
  return (
    <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <GraduationCap className="h-4 w-4 text-green-500" />
          Education Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {educationContext.country && (
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                {educationContext.country.flag_emoji} {educationContext.country.name}
              </span>
            </div>
          )}
          {educationContext.educationLevel && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                {educationContext.educationLevel.name}
              </span>
            </div>
          )}
          {educationContext.curriculum && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-3.5 text-center">📚</span>
              <span className="text-gray-600 dark:text-gray-300">
                {educationContext.curriculum.name}
              </span>
            </div>
          )}
          {educationContext.institutionName && (
            <div className="flex items-center gap-2">
              <School className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                {educationContext.institutionName}
              </span>
            </div>
          )}
          {educationContext.yearOrGrade && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-3.5 text-center">📅</span>
              <span className="text-gray-600 dark:text-gray-300">
                {educationContext.yearOrGrade}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CurriculumResourcesWidget;
