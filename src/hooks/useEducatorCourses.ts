// src/hooks/useEducatorCourses.ts
// Hook for educator course management — CRUD, publishing, analytics summary.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type { Course } from './useCourseLibrary';
import type { Course } from './useCourseLibrary';

export interface CreateCourseInput {
  title: string;
  code: string;
  description?: string;
  department?: string;
  level?: string;
  semester?: string;
  schoolName?: string;
  institutionId?: string;
  countryId?: string;
  educationLevelId?: string;
  curriculumId?: string;
  visibility?: 'public' | 'institution' | 'private';
}

export interface CourseAnalyticsSummary {
  courseId: string;
  totalEnrollments: number;
  totalMaterials: number;
  totalViews: number;
}

interface UseEducatorCoursesReturn {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCourse: (data: CreateCourseInput) => Promise<Course | null>;
  updateCourse: (courseId: string, updates: Partial<CreateCourseInput>) => Promise<boolean>;
  deleteCourse: (courseId: string) => Promise<boolean>;
  publishCourse: (courseId: string, publish: boolean) => Promise<boolean>;
  getAnalyticsSummary: (courseId: string) => Promise<CourseAnalyticsSummary | null>;
}

export function useEducatorCourses(institutionId?: string | null): UseEducatorCoursesReturn {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!user?.id) {
      setCourses([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('courses')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setCourses((data || []) as Course[]);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, institutionId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const createCourse = useCallback(
    async (data: CreateCourseInput): Promise<Course | null> => {
      if (!user?.id) return null;

      try {
        const { data: course, error: createError } = await supabase
          .from('courses')
          .insert({
            title: data.title,
            code: data.code,
            description: data.description || null,
            department: data.department || null,
            level: data.level || null,
            semester: data.semester || null,
            school_name: data.schoolName || null,
            institution_id: data.institutionId || null,
            country_id: data.countryId || null,
            education_level_id: data.educationLevelId || null,
            curriculum_id: data.curriculumId || null,
            visibility: data.visibility || 'public',
            created_by: user.id,
            is_published: false,
          } as any)
          .select('*')
          .single();

        if (createError) throw createError;

        toast.success('Course created!');
        await fetchCourses();
        return course as Course;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to create course');
        return null;
      }
    },
    [user?.id, fetchCourses]
  );

  const updateCourse = useCallback(
    async (courseId: string, updates: Partial<CreateCourseInput>): Promise<boolean> => {
      try {
        const updateObj: Record<string, any> = {};
        if (updates.title !== undefined) updateObj.title = updates.title;
        if (updates.code !== undefined) updateObj.code = updates.code;
        if (updates.description !== undefined) updateObj.description = updates.description;
        if (updates.department !== undefined) updateObj.department = updates.department;
        if (updates.level !== undefined) updateObj.level = updates.level;
        if (updates.semester !== undefined) updateObj.semester = updates.semester;
        if (updates.schoolName !== undefined) updateObj.school_name = updates.schoolName;
        if (updates.visibility !== undefined) updateObj.visibility = updates.visibility;
        if (updates.countryId !== undefined) updateObj.country_id = updates.countryId;
        if (updates.educationLevelId !== undefined) updateObj.education_level_id = updates.educationLevelId;
        if (updates.curriculumId !== undefined) updateObj.curriculum_id = updates.curriculumId;

        const { error: updateError } = await supabase
          .from('courses')
          .update(updateObj)
          .eq('id', courseId);

        if (updateError) throw updateError;

        toast.success('Course updated!');
        await fetchCourses();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to update course');
        return false;
      }
    },
    [fetchCourses]
  );

  const deleteCourse = useCallback(
    async (courseId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('courses')
          .delete()
          .eq('id', courseId);

        if (deleteError) throw deleteError;

        toast.success('Course deleted');
        await fetchCourses();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to delete course');
        return false;
      }
    },
    [fetchCourses]
  );

  const publishCourse = useCallback(
    async (courseId: string, publish: boolean): Promise<boolean> => {
      try {
        const { error: pubError } = await supabase
          .from('courses')
          .update({ is_published: publish } as any)
          .eq('id', courseId);

        if (pubError) throw pubError;

        toast.success(publish ? 'Course published!' : 'Course unpublished');
        await fetchCourses();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to update publish status');
        return false;
      }
    },
    [fetchCourses]
  );

  const getAnalyticsSummary = useCallback(
    async (courseId: string): Promise<CourseAnalyticsSummary | null> => {
      try {
        // Count materials
        const { count: materialsCount } = await supabase
          .from('course_materials')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', courseId);

        return {
          courseId,
          totalEnrollments: 0, // TODO: implement when enrollments table exists
          totalMaterials: materialsCount ?? 0,
          totalViews: 0, // TODO: implement when course views tracking exists
        };
      } catch {
        return null;
      }
    },
    []
  );

  return {
    courses,
    isLoading,
    error,
    refetch: fetchCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    publishCourse,
    getAnalyticsSummary,
  };
}
