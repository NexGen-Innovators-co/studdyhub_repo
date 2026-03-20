import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ── Types ────────────────────────────────────────────────────
export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  enrolled_at: string;
  progress_percent: number;
  last_accessed_at: string | null;
  status: 'active' | 'completed' | 'dropped';
}

// ── Hook ─────────────────────────────────────────────────────
export const useCourseEnrollment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Check if the current user is enrolled in a specific course.
   * Returns the enrollment row or null.
   */
  const useEnrollment = (courseId: string | null) => {
    return useQuery({
      queryKey: ['course_enrollment', courseId, user?.id],
      queryFn: async () => {
        if (!courseId || !user?.id) return null;

        const { data, error } = await supabase
          .from('course_enrollments')
          .select('*')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        return data as CourseEnrollment | null;
      },
      enabled: !!courseId && !!user?.id,
    });
  };

  /**
   * Get all courses the current user is enrolled in.
   */
  const useMyEnrollments = () => {
    return useQuery({
      queryKey: ['my_enrollments', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];

        const { data, error } = await supabase
          .from('course_enrollments')
          .select('*, courses(*)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('last_accessed_at', { ascending: false, nullsFirst: false });

        if (error) throw error;
        return data;
      },
      enabled: !!user?.id,
    });
  };

  /**
   * Get total enrollment count for a course.
   */
  const useEnrollmentCount = (courseId: string | null) => {
    return useQuery({
      queryKey: ['course_enrollment_count', courseId],
      queryFn: async () => {
        if (!courseId) return 0;

        const { count, error } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('status', 'active');

        if (error) throw error;
        return count ?? 0;
      },
      enabled: !!courseId,
    });
  };

  /**
   * Enroll the current user in a course.
   */
  const useEnrollInCourse = () => {
    return useMutation({
      mutationFn: async (courseId: string) => {
        if (!user?.id) throw new Error('Must be logged in to enroll');

        const { data, error } = await supabase
          .from('course_enrollments')
          .insert({
            course_id: courseId,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data as CourseEnrollment;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['course_enrollment', data.course_id] });
        queryClient.invalidateQueries({ queryKey: ['course_enrollment_count', data.course_id] });
        queryClient.invalidateQueries({ queryKey: ['my_enrollments'] });
      },
    });
  };

  /**
   * Unenroll (drop) from a course.
   */
  const useUnenrollFromCourse = () => {
    return useMutation({
      mutationFn: async ({ courseId }: { courseId: string }) => {
        if (!user?.id) throw new Error('Must be logged in');

        const { error } = await supabase
          .from('course_enrollments')
          .delete()
          .eq('course_id', courseId)
          .eq('user_id', user.id);

        if (error) throw error;
        return courseId;
      },
      onSuccess: (courseId) => {
        queryClient.invalidateQueries({ queryKey: ['course_enrollment', courseId] });
        queryClient.invalidateQueries({ queryKey: ['course_enrollment_count', courseId] });
        queryClient.invalidateQueries({ queryKey: ['my_enrollments'] });
      },
    });
  };

  /**
   * Update last_accessed_at for an enrollment (call when user opens course dashboard).
   */
  const useUpdateLastAccessed = () => {
    return useMutation({
      mutationFn: async (enrollmentId: string) => {
        const { error } = await supabase
          .from('course_enrollments')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', enrollmentId);

        if (error) throw error;
      },
    });
  };

  return {
    useEnrollment,
    useMyEnrollments,
    useEnrollmentCount,
    useEnrollInCourse,
    useUnenrollFromCourse,
    useUpdateLastAccessed,
  };
};
