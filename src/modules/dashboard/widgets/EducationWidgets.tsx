// src/components/dashboard/widgets/EducationWidgets.tsx
// Renders education-context-aware widgets on the dashboard.
// Only visible when the user has filled in their education profile.

import React from 'react';
import type { UserEducationContext } from '@/types/Education';
import { ExamCountdownWidget } from './ExamCountdownWidget';
import { SubjectProgressWidget } from './SubjectProgressWidget';
import { CurriculumResourcesWidget } from './CurriculumResourcesWidget';

interface EducationWidgetsProps {
  educationContext: UserEducationContext | null;
}

export const EducationWidgets: React.FC<EducationWidgetsProps> = ({ educationContext }) => {
  if (!educationContext) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Education profile summary — always shown when context exists */}
      <CurriculumResourcesWidget educationContext={educationContext} />

      {/* Exam countdown — only when target exam is set with a date */}
      {educationContext.targetExamination?.typical_date && (
        <ExamCountdownWidget educationContext={educationContext} />
      )}

      {/* Subjects — only when subjects are selected */}
      {educationContext.subjects.length > 0 && (
        <SubjectProgressWidget educationContext={educationContext} />
      )}
    </div>
  );
};

export default EducationWidgets;
