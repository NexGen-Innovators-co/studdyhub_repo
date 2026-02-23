import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import type { CourseFilterState } from '@/components/courseLibrary/CourseFilterBar';

export type Course = Database['public']['Tables']['courses']['Row'] & { school_name?: string | null };
export type CourseMaterial = Database['public']['Tables']['course_materials']['Row'];

export const useCourseLibrary = () => {
  const useCourses = (schoolFilter?: string | null, educationFilters?: CourseFilterState | null) => {
    return useQuery({
      queryKey: ['courses', schoolFilter, educationFilters],
      queryFn: async () => {
        let query = supabase
          .from('courses')
          .select('*')
          .order('code', { ascending: true });

        if (schoolFilter === 'global') {
          // Fetch global courses (where school_name is null or 'Global')
          query = query.or('school_name.is.null,school_name.eq.Global');
        } else if (schoolFilter === 'for-you') {
          // "For You" tab: apply education context filters
          if (educationFilters?.curriculumId) {
            query = query.eq('curriculum_id', educationFilters.curriculumId);
          }
          if (educationFilters?.educationLevelId) {
            query = query.eq('education_level_id', educationFilters.educationLevelId);
          }
          if (educationFilters?.countryId) {
            query = query.eq('country_id', educationFilters.countryId);
          }
          // If no education filters are active, fall back to all courses
        } else if (schoolFilter) {
          // Fetch courses for a specific school
          query = query.eq('school_name', schoolFilter);
        }
        // If schoolFilter is null/undefined, we might want to fetch ALL or handle differently.
        // For "Browse All", we just don't apply a filter.

        const { data, error } = await query;

        if (error) throw error;
        return data as Course[];
      },
    });
  };

  const useCourseMaterials = (courseId: string | null) => {
    return useQuery({
      queryKey: ['course_materials', courseId],
      queryFn: async () => {
        if (!courseId) return [];
        
        const { data, error } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as CourseMaterial[];
      },
      enabled: !!courseId,
    });
  };

  return {
    useCourses,
    useCourseMaterials,
  };
};
