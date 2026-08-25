/**
 * Course Progress Tracking Service
 * 
 * Provides fire-and-forget helpers that existing features can call
 * to automatically mark course resources as completed.
 * 
 * These functions are safe to call even when:
 * - The user isn't enrolled in any course
 * - The resource isn't linked to any course
 * - The user is not logged in
 * 
 * They silently no-op in those cases.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a resource (by its original ID and type) is linked to any course
 * the current user is enrolled in. If so, mark progress.
 * 
 * @param userId - The user's auth ID
 * @param resourceType - 'document' | 'quiz' | 'podcast' | 'note' | 'recording'
 * @param resourceId - The original resource's UUID (e.g., quiz.id, ai_podcasts.id)
 * @param options - Optional: score for quizzes
 */
export async function trackCourseResourceCompletion(
  userId: string,
  resourceType: string,
  resourceId: string,
  options?: { score?: number; completed?: boolean }
): Promise<void> {
  try {
    // 1. Find all course_resources rows matching this resource
    const { data: courseResources, error: crError } = await supabase
      .from('course_resources')
      .select('id, course_id')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId);

    if (crError || !courseResources || courseResources.length === 0) return;

    // 2. For each matching course_resource, check if user is enrolled
    for (const cr of courseResources) {
      const { data: enrollment, error: enError } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', cr.course_id)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (enError || !enrollment) continue;

      // 3. Upsert progress
      const completed = options?.completed !== false; // default true
      const { error: progError } = await supabase
        .from('course_progress')
        .upsert(
          {
            enrollment_id: enrollment.id,
            resource_id: cr.id,
            completed,
            completed_at: completed ? new Date().toISOString() : null,
            score: options?.score ?? null,
            last_accessed_at: new Date().toISOString(),
          },
          { onConflict: 'enrollment_id,resource_id' }
        );

      if (progError) {
        console.warn('[courseProgress] upsert failed:', progError.message);
      }
    }
  } catch (err) {
    // Silently fail — this is best-effort tracking
    console.warn('[courseProgress] tracking error:', err);
  }
}

/**
 * Record that a user accessed (but didn't necessarily complete) a course resource.
 */
export async function trackCourseResourceAccess(
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  return trackCourseResourceCompletion(userId, resourceType, resourceId, {
    completed: false,
  });
}
