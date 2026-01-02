import { supabase } from '@/integrations/supabase/client';

export interface ContentModerationResult {
  approved: boolean;
  isEducational: boolean;
  confidence: number;
  category?: string;
  reason?: string;
  suggestions?: string[];
  topics?: string[];
  educationalValue: {
    score: number;
    reasoning: string;
  };
}

export interface ContentModerationRequest {
  content: string;
  contentType: 'post' | 'comment' | 'document';
  strictness?: 'low' | 'medium' | 'high';
}

/**
 * Moderate content using AI to ensure it's educational
 */
export async function moderateContent(
  request: ContentModerationRequest
): Promise<ContentModerationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await supabase.functions.invoke('content-moderation', {
      body: {
        content: request.content,
        contentType: request.contentType,
        userId: session.user.id,
        strictness: request.strictness || 'medium'
      }
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data as ContentModerationResult;
  } catch (error: any) {
    console.error('Content moderation error:', error);
    throw error;
  }
}

/**
 * Check if user has been flagged for review
 */
export async function checkUserModerationStatus(userId: string): Promise<{
  flagged: boolean;
  recentRejections: number;
  canPost: boolean;
}> {
  try {
    // Check recent rejections
    const { data: rejections } = await supabase
      .from('content_moderation_log')
      .select('id')
      .eq('user_id', userId)
      .eq('decision', 'rejected')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check if user is in moderation queue
    const { data: queueItem } = await supabase
      .from('content_moderation_queue')
      .select('id, status')
      .eq('content_id', userId)
      .eq('content_type', 'user')
      .eq('status', 'pending')
      .maybeSingle();

    const recentRejections = rejections?.length || 0;
    const flagged = !!queueItem || recentRejections >= 5;
    const canPost = !queueItem || queueItem.status !== 'pending';

    return {
      flagged,
      recentRejections,
      canPost
    };
  } catch (error) {
    console.error('Error checking moderation status:', error);
    return { flagged: false, recentRejections: 0, canPost: true };
  }
}

/**
 * Get moderation statistics for admin dashboard
 */
export async function getModerationStats(days: number = 7) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: totalModerated, count: totalCount },
      { data: approved, count: approvedCount },
      { data: rejected, count: rejectedCount },
      { data: byCategory }
    ] = await Promise.all([
      supabase
        .from('content_moderation_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate),
      supabase
        .from('content_moderation_log')
        .select('*', { count: 'exact', head: true })
        .eq('decision', 'approved')
        .gte('created_at', startDate),
      supabase
        .from('content_moderation_log')
        .select('*', { count: 'exact', head: true })
        .eq('decision', 'rejected')
        .gte('created_at', startDate),
      supabase
        .from('content_moderation_log')
        .select('category, decision')
        .gte('created_at', startDate)
    ]);

    // Calculate category distribution
    const categoryStats: Record<string, { approved: number; rejected: number }> = {};
    byCategory?.forEach((item: any) => {
      const cat = item.category || 'Unknown';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { approved: 0, rejected: 0 };
      }
      if (item.decision === 'approved') {
        categoryStats[cat].approved++;
      } else {
        categoryStats[cat].rejected++;
      }
    });

    return {
      total: totalCount || 0,
      approved: approvedCount || 0,
      rejected: rejectedCount || 0,
      approvalRate: totalCount ? ((approvedCount || 0) / totalCount) * 100 : 0,
      categoryDistribution: categoryStats
    };
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      approvalRate: 0,
      categoryDistribution: {}
    };
  }
}

/**
 * Appeal a rejected post
 */
export async function appealModeration(
  contentId: string,
  contentType: 'post' | 'comment',
  reason: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('moderation_appeals').insert({
      user_id: user.id,
      content_id: contentId,
      content_type: contentType,
      reason: reason,
      status: 'pending'
    });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error submitting appeal:', error);
    throw error;
  }
}
