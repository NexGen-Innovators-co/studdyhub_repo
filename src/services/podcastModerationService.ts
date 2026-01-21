import { supabase } from '@/integrations/supabase/client';
import { PlanType } from '@/hooks/useSubscription';

export interface PodcastCreationEligibility {
  canCreate: boolean;
  reason?: string;
  requirements: {
    hasSubscription: boolean;
    hasVerification: boolean;
    hasMinBadges: boolean;
    hasMinActivity: boolean;
  };
}

/**
 * Check if a user is eligible to create podcasts
 * Requires: Active subscription (Scholar or Genius) OR achievement milestones
 */
export async function checkPodcastCreationEligibility(
  userId: string
): Promise<PodcastCreationEligibility> {
  try {
    // Check if user is admin - admins have full access
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    const isAdmin = !!adminUser;

    // Admins can always create podcasts
    if (isAdmin) {
      return {
        canCreate: true,
        requirements: {
          hasSubscription: true,
          hasVerification: true,
          hasMinBadges: true,
          hasMinActivity: true,
        },
      };
    }

    // Check subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', userId)
      .single();

    const hasActiveSubscription =
      subscription &&
      subscription.status === 'active' &&
      (subscription.plan_type === 'scholar' || subscription.plan_type === 'genius');

    // Check badges/achievements
    const { data: badges, count: badgeCount } = await supabase
      .from('user_badges')
      .select('badge_id', { count: 'exact' })
      .eq('user_id', userId);

    const hasMinBadges = (badgeCount || 0) >= 3; // Require at least 3 badges

    // Check activity metrics
    const { count: notesCount } = await supabase
      .from('notes')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    const { count: quizzesCount } = await supabase
      .from('quizzes')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    const hasMinActivity = (notesCount || 0) >= 5 || (quizzesCount || 0) >= 3;

    // Check if user has verification badge (for free users with achievements)
    const { data: verificationBadge } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)
      .eq('badge_id', 'verified_creator') // Assuming a special badge exists
      .maybeSingle();

    const hasVerification = !!verificationBadge;

    // Determine eligibility
    const canCreate =
      hasActiveSubscription ||
      (hasMinBadges && hasMinActivity) ||
      hasVerification;

    let reason: string | undefined;
    if (!canCreate) {
      if (!hasActiveSubscription) {
        reason = 'Podcast creation requires an active Scholar or Genius subscription, or you can unlock it by earning achievements!';
      } else if (!hasMinBadges) {
        reason = 'Earn at least 3 badges to unlock podcast creation';
      } else if (!hasMinActivity) {
        reason = 'Create at least 5 notes or complete 3 quizzes to unlock podcast creation';
      }
    }

    return {
      canCreate,
      reason,
      requirements: {
        hasSubscription: hasActiveSubscription,
        hasVerification,
        hasMinBadges,
        hasMinActivity,
      },
    };
  } catch (error) {
    //console.error('Error checking podcast eligibility:', error);
    return {
      canCreate: false,
      reason: 'Unable to verify eligibility. Please try again.',
      requirements: {
        hasSubscription: false,
        hasVerification: false,
        hasMinBadges: false,
        hasMinActivity: false,
      },
    };
  }
}

/**
 * Get podcast action permissions for a user
 */
export async function getPodcastPermissions(userId: string, podcastUserId: string) {
  const isOwner = userId === podcastUserId;

  // Check if user is admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  const isAdmin = !!adminUser;

  // Check subscription for advanced features
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_type, status')
    .eq('user_id', userId)
    .maybeSingle();

  const hasActiveSub =
    subscription &&
    subscription.status === 'active' &&
    subscription.plan_type !== 'free';

  return {
    canDelete: isOwner || isAdmin,
    canEdit: isOwner || isAdmin,
    canReport: true, // Everyone can report
    canShare: hasActiveSub || isOwner || isAdmin, // Share requires subscription, ownership, or admin
    canDownload: hasActiveSub || isAdmin, // Download requires subscription or admin
    canInvite: (isOwner && hasActiveSub) || isAdmin, // Invite requires ownership + subscription, or admin
    canGoLive: hasActiveSub || isAdmin, // Live streaming requires subscription or admin
    isAdmin,
    isOwner,
  };
}
