// src/components/courseLibrary/CourseFilterBar.tsx
// Education-context-based filter bar for the "For You" course tab.
// Shows curriculum, education level, and subject chips derived from user's education profile.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, BookOpen, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserEducationContext } from '@/types/Education';

export interface CourseFilterState {
  curriculumId: string | null;
  educationLevelId: string | null;
  countryId: string | null;
  subjectIds: string[];
}

interface CourseFilterBarProps {
  educationContext: UserEducationContext | null;
  filters: CourseFilterState;
  onFiltersChange: (filters: CourseFilterState) => void;
}

export const CourseFilterBar: React.FC<CourseFilterBarProps> = ({
  educationContext,
  filters,
  onFiltersChange,
}) => {
  if (!educationContext) return null;

  const { curriculum, educationLevel, country, subjects } = educationContext;

  const toggleSubject = (subjectId: string) => {
    const current = filters.subjectIds;
    const next = current.includes(subjectId)
      ? current.filter(id => id !== subjectId)
      : [...current, subjectId];
    onFiltersChange({ ...filters, subjectIds: next });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      curriculumId: null,
      educationLevelId: null,
      countryId: null,
      subjectIds: [],
    });
  };

  const hasActiveFilters =
    filters.curriculumId || filters.educationLevelId || filters.countryId || filters.subjectIds.length > 0;

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
          <GraduationCap className="w-4 h-4" />
          <span>Personalized Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-red-500"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Curriculum chip */}
        {curriculum && (
          <Badge
            variant={filters.curriculumId === curriculum.id ? 'default' : 'outline'}
            className="cursor-pointer transition-all hover:scale-105"
            onClick={() =>
              onFiltersChange({
                ...filters,
                curriculumId: filters.curriculumId === curriculum.id ? null : curriculum.id,
              })
            }
          >
            <BookOpen className="w-3 h-3 mr-1" />
            {curriculum.name}
          </Badge>
        )}

        {/* Education level chip */}
        {educationLevel && (
          <Badge
            variant={filters.educationLevelId === educationLevel.id ? 'default' : 'outline'}
            className="cursor-pointer transition-all hover:scale-105"
            onClick={() =>
              onFiltersChange({
                ...filters,
                educationLevelId:
                  filters.educationLevelId === educationLevel.id ? null : educationLevel.id,
              })
            }
          >
            <GraduationCap className="w-3 h-3 mr-1" />
            {educationLevel.short_name || educationLevel.name}
          </Badge>
        )}

        {/* Country chip */}
        {country && (
          <Badge
            variant={filters.countryId === country.id ? 'default' : 'outline'}
            className="cursor-pointer transition-all hover:scale-105"
            onClick={() =>
              onFiltersChange({
                ...filters,
                countryId: filters.countryId === country.id ? null : country.id,
              })
            }
          >
            {country.flag_emoji || '🌍'} {country.name}
          </Badge>
        )}
      </div>

      {/* Subject chips */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center text-xs text-muted-foreground mr-1">
            <Target className="w-3 h-3 mr-1" />
            Subjects:
          </span>
          {subjects.map((subject) => (
            <Badge
              key={subject.id}
              variant={filters.subjectIds.includes(subject.id) ? 'default' : 'secondary'}
              className="cursor-pointer text-xs transition-all hover:scale-105"
              onClick={() => toggleSubject(subject.id)}
            >
              {subject.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseFilterBar;
