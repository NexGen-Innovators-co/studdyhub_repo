import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────
export interface CourseProgress {
  id: string;
  enrollment_id: string;
  resource_id: string;
  completed: boolean;
  completed_at: string | null;
  score: number | null;
  time_spent_seconds: number;
  last_accessed_at: string | null;
}

// ── Hook ─────────────────────────────────────────────────────
export const useCourseProgress = () => {
  const queryClient = useQueryClient();

  /**
   * Fetch all progress records for an enrollment.
   */
  const useProgress = (enrollmentId: string | null) => {
    return useQuery({
      queryKey: ['course_progress', enrollmentId],
      queryFn: async () => {
        if (!enrollmentId) return [];

        const { data, error } = await supabase
          .from('course_progress')
          .select('*')
          .eq('enrollment_id', enrollmentId);

        if (error) throw error;
        return data as CourseProgress[];
      },
      enabled: !!enrollmentId,
    });
  };

  /**
   * Get progress for a single resource.
   */
  const useResourceProgress = (enrollmentId: string | null, resourceId: string | null) => {
    return useQuery({
      queryKey: ['course_progress', enrollmentId, resourceId],
      queryFn: async () => {
        if (!enrollmentId || !resourceId) return null;

        const { data, error } = await supabase
          .from('course_progress')
          .select('*')
          .eq('enrollment_id', enrollmentId)
          .eq('resource_id', resourceId)
          .maybeSingle();

        if (error) throw error;
        return data as CourseProgress | null;
      },
      enabled: !!enrollmentId && !!resourceId,
    });
  };

  /**
   * Mark a resource as completed (upsert).
   */
  const useMarkComplete = () => {
    return useMutation({
      mutationFn: async ({
        enrollmentId,
        resourceId,
        score,
      }: {
        enrollmentId: string;
        resourceId: string;
        score?: number;
      }) => {
        // Try to upsert — if exists, update; if not, insert
        const { data, error } = await supabase
          .from('course_progress')
          .upsert(
            {
              enrollment_id: enrollmentId,
              resource_id: resourceId,
              completed: true,
              completed_at: new Date().toISOString(),
              score: score ?? null,
              last_accessed_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,resource_id' }
          )
          .select()
          .single();

        if (error) throw error;
        return data as CourseProgress;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['course_progress', data.enrollment_id] });
        // Also refresh the enrollment to get updated progress_percent
        queryClient.invalidateQueries({ queryKey: ['course_enrollment'] });
        queryClient.invalidateQueries({ queryKey: ['my_enrollments'] });
      },
    });
  };

  /**
   * Record that a user accessed a resource (upsert, updates last_accessed_at).
   */
  const useRecordAccess = () => {
    return useMutation({
      mutationFn: async ({
        enrollmentId,
        resourceId,
      }: {
        enrollmentId: string;
        resourceId: string;
      }) => {
        const { data, error } = await supabase
          .from('course_progress')
          .upsert(
            {
              enrollment_id: enrollmentId,
              resource_id: resourceId,
              last_accessed_at: new Date().toISOString(),
            },
            { onConflict: 'enrollment_id,resource_id' }
          )
          .select()
          .single();

        if (error) throw error;
        return data as CourseProgress;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['course_progress', data.enrollment_id] });
      },
    });
  };

  return {
    useProgress,
    useResourceProgress,
    useMarkComplete,
    useRecordAccess,
  };
};
