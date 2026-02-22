// src/components/onboarding/steps/EducationContextStep.tsx
// Cascading selection: Country → Level → Curriculum → Exam → Subjects → School/Year
// Used inside OnboardingWizard as step 2 (after Welcome).

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Globe,
  BookOpen,
  CalendarClock,
  School,
  Check,
  Loader2,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useEducationFramework } from '@/hooks/useEducationFramework';
import type {
  Country,
  EducationFrameworkLevel,
  EducationFrameworkCurriculum,
  Examination,
  Subject,
} from '@/types/Education';

// ─── Props ──────────────────────────────────────────────────────
export interface EducationStepData {
  countryId: string | null;
  countryCode: string | null;
  educationLevelId: string | null;
  curriculumId: string | null;
  examinationId: string | null;
  selectedSubjectIds: string[];
  institutionName: string;
  yearOrGrade: string;
}

interface EducationContextStepProps {
  data: EducationStepData;
  onChange: (data: EducationStepData) => void;
}

// ─── Helpers ────────────────────────────────────────────────────
function SelectCard({
  label,
  selected,
  onClick,
  extra,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  extra?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{label}</span>
        {selected && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
      </div>
      {extra && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{extra}</p>}
    </button>
  );
}

function SubjectChip({
  subject,
  selected,
  onClick,
}: {
  subject: Subject;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800'
      }`}
    >
      {selected && <Check className="inline w-3 h-3 mr-1" />}
      {subject.name}
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────
export const EducationContextStep: React.FC<EducationContextStepProps> = ({
  data,
  onChange,
}) => {
  const { countries, framework, isLoadingCountries, isLoadingFramework } = useEducationFramework(
    data.countryCode
  );

  const [countrySearch, setCountrySearch] = useState('');

  // Derived lists from framework
  const levels: EducationFrameworkLevel[] = framework?.education_levels ?? [];

  const selectedLevel = useMemo(
    () => levels.find((l) => l.id === data.educationLevelId) ?? null,
    [levels, data.educationLevelId]
  );

  const curricula: EducationFrameworkCurriculum[] = selectedLevel?.curricula ?? [];

  const selectedCurriculum = useMemo(
    () => curricula.find((c) => c.id === data.curriculumId) ?? null,
    [curricula, data.curriculumId]
  );

  const examinations: Examination[] = selectedCurriculum?.examinations ?? [];
  const subjects: Subject[] = selectedCurriculum?.subjects ?? [];

  // Auto-select when there's only one option
  useEffect(() => {
    if (curricula.length === 1 && !data.curriculumId) {
      onChange({ ...data, curriculumId: curricula[0].id });
    }
  }, [curricula, data.curriculumId]);

  useEffect(() => {
    if (examinations.length === 1 && !data.examinationId) {
      onChange({ ...data, examinationId: examinations[0].id });
    }
  }, [examinations, data.examinationId]);

  // Reset downstream when upstream changes
  const setCountry = (country: Country) => {
    onChange({
      ...data,
      countryId: country.id,
      countryCode: country.code,
      educationLevelId: null,
      curriculumId: null,
      examinationId: null,
      selectedSubjectIds: [],
    });
  };

  const setLevel = (levelId: string) => {
    onChange({
      ...data,
      educationLevelId: levelId,
      curriculumId: null,
      examinationId: null,
      selectedSubjectIds: [],
    });
  };

  const setCurriculum = (curriculumId: string) => {
    onChange({
      ...data,
      curriculumId,
      examinationId: null,
      selectedSubjectIds: [],
    });
  };

  const setExam = (examId: string) => {
    onChange({ ...data, examinationId: examId });
  };

  const toggleSubject = (subjectId: string) => {
    const current = new Set(data.selectedSubjectIds);
    if (current.has(subjectId)) current.delete(subjectId);
    else current.add(subjectId);
    onChange({ ...data, selectedSubjectIds: Array.from(current) });
  };

  // Filter countries by search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, countrySearch]);

  // ─── Rendering ────────────────────────────────────────────────
  return (
    <div className="px-4 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-2">
        <GraduationCap className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Your Education
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        This helps us tailor quizzes, AI responses, and the dashboard to your curriculum.
      </p>

      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {/* ── 1. Country ── */}
        <section>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            <Globe className="h-4 w-4" /> Country
          </label>

          {isLoadingCountries ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading countries…
            </div>
          ) : (
            <>
              {countries.length > 5 && (
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {filteredCountries.map((c) => (
                  <SelectCard
                    key={c.id}
                    label={`${c.flag_emoji ?? ''} ${c.name}`}
                    selected={data.countryId === c.id}
                    onClick={() => setCountry(c)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── 2. Education Level ── */}
        {data.countryCode && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              <BookOpen className="h-4 w-4" /> Education Level
            </label>

            {isLoadingFramework ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading levels…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {levels.map((level) => (
                  <SelectCard
                    key={level.id}
                    label={level.name}
                    extra={level.short_name ?? undefined}
                    selected={data.educationLevelId === level.id}
                    onClick={() => setLevel(level.id)}
                  />
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ── 3. Curriculum (auto-skip if single) ── */}
        {selectedLevel && curricula.length > 1 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              <BookOpen className="h-4 w-4" /> Curriculum
            </label>
            <div className="grid grid-cols-2 gap-2">
              {curricula.map((cur) => (
                <SelectCard
                  key={cur.id}
                  label={cur.name}
                  extra={cur.governing_body ?? undefined}
                  selected={data.curriculumId === cur.id}
                  onClick={() => setCurriculum(cur.id)}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* ── 4. Target Examination (optional) ── */}
        {selectedCurriculum && examinations.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              <CalendarClock className="h-4 w-4" /> Target Exam
            </label>
            <div className="grid grid-cols-2 gap-2">
              {examinations.map((ex) => (
                <SelectCard
                  key={ex.id}
                  label={ex.name}
                  extra={ex.typical_date ? `Date: ${ex.typical_date}` : undefined}
                  selected={data.examinationId === ex.id}
                  onClick={() => setExam(ex.id)}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* ── 5. Subjects ── */}
        {selectedCurriculum && subjects.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
              Subjects <span className="text-gray-400 font-normal">(select all that apply)</span>
            </label>

            {/* Core subjects */}
            {subjects.filter((s) => s.category === 'core').length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Core</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {subjects
                    .filter((s) => s.category === 'core')
                    .map((s) => (
                      <SubjectChip
                        key={s.id}
                        subject={s}
                        selected={data.selectedSubjectIds.includes(s.id)}
                        onClick={() => toggleSubject(s.id)}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Elective subjects */}
            {subjects.filter((s) => s.category === 'elective').length > 0 && (
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Elective</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {subjects
                    .filter((s) => s.category === 'elective')
                    .map((s) => (
                      <SubjectChip
                        key={s.id}
                        subject={s}
                        selected={data.selectedSubjectIds.includes(s.id)}
                        onClick={() => toggleSubject(s.id)}
                      />
                    ))}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* ── 6. School / Year ── */}
        {data.countryCode && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                <School className="h-4 w-4" /> School / Institution
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={data.institutionName}
                onChange={(e) => onChange({ ...data, institutionName: e.target.value })}
                placeholder="e.g. Achimota School"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
                Year / Grade <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={data.yearOrGrade}
                onChange={(e) => onChange({ ...data, yearOrGrade: e.target.value })}
                placeholder="e.g. SHS 3, Year 2"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
};

export default EducationContextStep;
