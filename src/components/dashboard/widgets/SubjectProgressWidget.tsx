// src/components/dashboard/widgets/SubjectProgressWidget.tsx
// Shows the user's enrolled subjects with a quick visual status.

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import type { UserEducationContext } from '@/types/Education';

interface SubjectProgressWidgetProps {
  educationContext: UserEducationContext;
}

export const SubjectProgressWidget: React.FC<SubjectProgressWidgetProps> = ({ educationContext }) => {
  const core = educationContext.subjects.filter((s) => s.category === 'core');
  const elective = educationContext.subjects.filter((s) => s.category === 'elective');

  if (educationContext.subjects.length === 0) return null;

  return (
    <Card className="rounded-2xl border shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          My Subjects ({educationContext.subjects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {core.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                Core
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {core.map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {elective.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                Elective
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {elective.map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubjectProgressWidget;
