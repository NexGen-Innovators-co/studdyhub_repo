import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────
export type ResourceType = 'document' | 'quiz' | 'podcast' | 'note' | 'recording';

export interface CourseResource {
  id: string;
  course_id: string;
  resource_type: ResourceType;
  resource_id: string;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number;
  is_required: boolean;
  created_at: string;
  created_by: string | null;
}

// ── Hook ─────────────────────────────────────────────────────
export const useCourseResources = () => {
  const queryClient = useQueryClient();

  /**
   * Fetch all resources linked to a course.
   */
  const useResources = (courseId: string | null) => {
    return useQuery({
      queryKey: ['course_resources', courseId],
      queryFn: async () => {
        if (!courseId) return [];

        const { data, error } = await supabase
          .from('course_resources')
          .select('*')
          .eq('course_id', courseId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as CourseResource[];
      },
      enabled: !!courseId,
    });
  };

  /**
   * Fetch resources filtered by type.
   */
  const useResourcesByType = (courseId: string | null, type: ResourceType) => {
    return useQuery({
      queryKey: ['course_resources', courseId, type],
      queryFn: async () => {
        if (!courseId) return [];

        const { data, error } = await supabase
          .from('course_resources')
          .select('*')
          .eq('course_id', courseId)
          .eq('resource_type', type)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as CourseResource[];
      },
      enabled: !!courseId,
    });
  };

  /**
   * Get count of resources by type for a course.
   */
  const useResourceCounts = (courseId: string | null) => {
    return useQuery({
      queryKey: ['course_resource_counts', courseId],
      queryFn: async () => {
        if (!courseId) return { document: 0, quiz: 0, podcast: 0, note: 0, recording: 0 };

        const { data, error } = await supabase
          .from('course_resources')
          .select('resource_type')
          .eq('course_id', courseId);

        if (error) throw error;

        const counts: Record<ResourceType, number> = {
          document: 0,
          quiz: 0,
          podcast: 0,
          note: 0,
          recording: 0,
        };

        data?.forEach((r) => {
          if (r.resource_type in counts) {
            counts[r.resource_type as ResourceType]++;
          }
        });

        return counts;
      },
      enabled: !!courseId,
    });
  };

  /**
   * Add a resource to a course (admin only).
   */
  const useAddResource = () => {
    return useMutation({
      mutationFn: async (resource: {
        course_id: string;
        resource_type: ResourceType;
        resource_id: string;
        title: string;
        description?: string;
        category?: string;
        sort_order?: number;
        is_required?: boolean;
        created_by?: string;
      }) => {
        const { data, error } = await supabase
          .from('course_resources')
          .insert(resource)
          .select()
          .single();

        if (error) throw error;
        return data as CourseResource;
      },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['course_resources', data.course_id] });
        queryClient.invalidateQueries({ queryKey: ['course_resource_counts', data.course_id] });
      },
    });
  };

  /**
   * Remove a resource from a course (admin only).
   */
  const useRemoveResource = () => {
    return useMutation({
      mutationFn: async ({ resourceId, courseId }: { resourceId: string; courseId: string }) => {
        const { error } = await supabase
          .from('course_resources')
          .delete()
          .eq('id', resourceId);

        if (error) throw error;
        return courseId;
      },
      onSuccess: (courseId) => {
        queryClient.invalidateQueries({ queryKey: ['course_resources', courseId] });
        queryClient.invalidateQueries({ queryKey: ['course_resource_counts', courseId] });
      },
    });
  };

  return {
    useResources,
    useResourcesByType,
    useResourceCounts,
    useAddResource,
    useRemoveResource,
  };
};
