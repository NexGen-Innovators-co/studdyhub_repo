// src/components/userSettings/EducationSettingsTab.tsx
// Lets users view / edit their education context post-onboarding.

import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Globe, BookOpen, CalendarClock, School, Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useEducationFramework } from '@/hooks/useEducationFramework';
import { useEducationContext } from '@/hooks/useEducationContext';
import type { EducationStepData } from '@/components/onboarding/steps/EducationContextStep';
import type {
  EducationFrameworkLevel,
  EducationFrameworkCurriculum,
  Subject,
} from '@/types/Education';

export const EducationSettingsTab: React.FC = () => {
  const { user } = useAuth();
  const { educationContext, refetch } = useEducationContext();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local form state
  const [formData, setFormData] = useState<EducationStepData>({
    countryId: null,
    countryCode: null,
    educationLevelId: null,
    curriculumId: null,
    examinationId: null,
    selectedSubjectIds: [],
    institutionName: '',
    yearOrGrade: '',
  });

  // Populate from existing context
  useEffect(() => {
    if (educationContext) {
      setFormData({
        countryId: educationContext.country?.id ?? null,
        countryCode: educationContext.country?.code ?? null,
        educationLevelId: educationContext.educationLevel?.id ?? null,
        curriculumId: educationContext.curriculum?.id ?? null,
        examinationId: educationContext.targetExamination?.id ?? null,
        selectedSubjectIds: educationContext.subjects.map((s) => s.id),
        institutionName: educationContext.institutionName ?? '',
        yearOrGrade: educationContext.yearOrGrade ?? '',
      });
    }
  }, [educationContext]);

  const { countries, framework, isLoadingCountries, isLoadingFramework } =
    useEducationFramework(formData.countryCode);

  // Derived data
  const levels: EducationFrameworkLevel[] = framework?.education_levels ?? [];
  const selectedLevel = levels.find((l) => l.id === formData.educationLevelId) ?? null;
  const curricula: EducationFrameworkCurriculum[] = selectedLevel?.curricula ?? [];
  const selectedCurriculum = curricula.find((c) => c.id === formData.curriculumId) ?? null;
  const examinations = selectedCurriculum?.examinations ?? [];
  const subjects: Subject[] = selectedCurriculum?.subjects ?? [];
  const coreSubjects = subjects.filter((s) => s.category === 'core');
  const electiveSubjects = subjects.filter((s) => s.category === 'elective');

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { data: eduProfile, error: profileError } = await supabase
        .from('user_education_profiles')
        .upsert(
          {
            user_id: user.id,
            country_id: formData.countryId,
            education_level_id: formData.educationLevelId,
            curriculum_id: formData.curriculumId,
            target_examination_id: formData.examinationId,
            institution_name: formData.institutionName.trim() || null,
            year_or_grade: formData.yearOrGrade.trim() || null,
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();

      if (profileError) throw profileError;

      // Sync user_subjects
      if (eduProfile) {
        await supabase.from('user_subjects').delete().eq('user_education_profile_id', eduProfile.id);
        if (formData.selectedSubjectIds.length > 0) {
          await supabase.from('user_subjects').insert(
            formData.selectedSubjectIds.map((subjectId) => ({
              user_education_profile_id: eduProfile.id,
              subject_id: subjectId,
            }))
          );
        }
      }

      // Sync school on profiles
      if (formData.institutionName.trim()) {
        await supabase
          .from('profiles')
          .update({ school: formData.institutionName.trim() })
          .eq('id', user.id);
      }

      await refetch();
      setSaveSuccess(true);
      toast.success('Education settings saved!');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save education settings');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, formData, refetch]);

  // ── Helpers ──
  const SelectButton = ({
    label,
    selected,
    onClick,
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-xl border-2 text-left text-sm transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
        {selected && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
      </div>
    </button>
  );

  return (
    <CardContent className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Education Profile
          </h2>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {/* Country */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
          <Globe className="h-4 w-4" /> Country
        </label>
        {isLoadingCountries ? (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {countries.map((c) => (
              <SelectButton
                key={c.id}
                label={`${c.flag_emoji ?? ''} ${c.name}`}
                selected={formData.countryId === c.id}
                onClick={() =>
                  setFormData({
                    ...formData,
                    countryId: c.id,
                    countryCode: c.code,
                    educationLevelId: null,
                    curriculumId: null,
                    examinationId: null,
                    selectedSubjectIds: [],
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Education Level */}
      {formData.countryCode && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            <BookOpen className="h-4 w-4" /> Education Level
          </label>
          {isLoadingFramework ? (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {levels.map((l) => (
                <SelectButton
                  key={l.id}
                  label={l.name}
                  selected={formData.educationLevelId === l.id}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      educationLevelId: l.id,
                      curriculumId: null,
                      examinationId: null,
                      selectedSubjectIds: [],
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Curriculum */}
      {selectedLevel && curricula.length > 1 && (
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
            Curriculum
          </label>
          <div className="grid grid-cols-2 gap-2">
            {curricula.map((c) => (
              <SelectButton
                key={c.id}
                label={c.name}
                selected={formData.curriculumId === c.id}
                onClick={() =>
                  setFormData({
                    ...formData,
                    curriculumId: c.id,
                    examinationId: null,
                    selectedSubjectIds: [],
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Examination */}
      {selectedCurriculum && examinations.length > 0 && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            <CalendarClock className="h-4 w-4" /> Target Exam
          </label>
          <div className="grid grid-cols-2 gap-2">
            {examinations.map((ex) => (
              <SelectButton
                key={ex.id}
                label={`${ex.name}${ex.typical_date ? ` (${ex.typical_date})` : ''}`}
                selected={formData.examinationId === ex.id}
                onClick={() => setFormData({ ...formData, examinationId: ex.id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Subjects */}
      {selectedCurriculum && subjects.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
            Subjects
          </label>
          {coreSubjects.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Core</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {coreSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const ids = new Set(formData.selectedSubjectIds);
                      ids.has(s.id) ? ids.delete(s.id) : ids.add(s.id);
                      setFormData({ ...formData, selectedSubjectIds: Array.from(ids) });
                    }}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${
                      formData.selectedSubjectIds.includes(s.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {formData.selectedSubjectIds.includes(s.id) && (
                      <Check className="inline h-3 w-3 mr-1" />
                    )}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {electiveSubjects.length > 0 && (
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Elective</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {electiveSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const ids = new Set(formData.selectedSubjectIds);
                      ids.has(s.id) ? ids.delete(s.id) : ids.add(s.id);
                      setFormData({ ...formData, selectedSubjectIds: Array.from(ids) });
                    }}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${
                      formData.selectedSubjectIds.includes(s.id)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {formData.selectedSubjectIds.includes(s.id) && (
                      <Check className="inline h-3 w-3 mr-1" />
                    )}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* School & Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            <School className="h-4 w-4" /> School / Institution
          </label>
          <input
            type="text"
            value={formData.institutionName}
            onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
            placeholder="e.g. Achimota School"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
            Year / Grade
          </label>
          <input
            type="text"
            value={formData.yearOrGrade}
            onChange={(e) => setFormData({ ...formData, yearOrGrade: e.target.value })}
            placeholder="e.g. SHS 3"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </CardContent>
  );
};

export default EducationSettingsTab;
