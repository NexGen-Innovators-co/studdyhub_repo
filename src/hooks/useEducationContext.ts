// src/hooks/useEducationContext.ts
// Fetches the authenticated user's resolved education context.
// Single query with joins — cached in state. Used by AppContext.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserEducationContext } from '@/types/Education';
import { useAuth } from './useAuth';

export function useEducationContext(onboardingCompleted?: boolean) {
  const { user } = useAuth();
  const [educationContext, setEducationContext] = useState<UserEducationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEducationContext = useCallback(async () => {
    if (!user?.id) {
      setEducationContext(null);
      setIsLoading(false);
      return;
    }

    // Skip the query during onboarding — no education profile exists yet
    if (onboardingCompleted === false) {
      setEducationContext(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('user_education_profiles')
        .select(`
          id,
          institution_name,
          year_or_grade,
          expected_completion,
          goals,
          metadata,
          country:countries ( id, code, name, flag_emoji ),
          education_level:education_levels ( id, code, name, short_name, category ),
          curriculum:curricula ( id, code, name, governing_body ),
          target_examination:examinations ( id, code, name, typical_date ),
          user_subjects (
            subject:subjects ( id, code, name, category )
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (queryError) {
        // Table may not exist yet — degrade gracefully
        if (queryError.code === '42P01' || queryError.message?.includes('does not exist')) {
          setEducationContext(null);
          setIsLoading(false);
          return;
        }
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      if (data) {
        setEducationContext({
          profileId: data.id,
          country: data.country as any,
          educationLevel: data.education_level as any,
          curriculum: data.curriculum as any,
          targetExamination: data.target_examination as any,
          institutionName: data.institution_name,
          yearOrGrade: data.year_or_grade,
          expectedCompletion: data.expected_completion,
          subjects: (data.user_subjects as any[])?.map((us: any) => us.subject).filter(Boolean) ?? [],
          goals: data.goals ?? [],
          metadata: data.metadata ?? {},
        });
      } else {
        setEducationContext(null);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load education context');
      setEducationContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, onboardingCompleted]);

  useEffect(() => {
    fetchEducationContext();
  }, [fetchEducationContext]);

  return {
    educationContext,
    isLoading,
    error,
    refetch: fetchEducationContext,
  };
}
