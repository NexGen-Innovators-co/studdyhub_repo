import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { RECOMMENDATION_WEIGHTS, INTEREST_CATEGORIES } from './socialConstants';

/**
 * Calculates a recommendation score for a user based on multiple factors
 */
export const calculateRecommendationScore = (
  candidate: SocialUserWithDetails,
  currentUserInterests: string[] = []
): number => {
  let score = 0;

  // Factor 1: Common interests (highest weight)
  const commonInterests = candidate.interests?.filter(interest => 
    currentUserInterests.includes(interest)
  ) || [];
  score += commonInterests.length * RECOMMENDATION_WEIGHTS.COMMON_INTERESTS;

  // Factor 2: Similar interest categories
  const candidateCategories = getCategoriesForInterests(candidate.interests || []);
  const userCategories = getCategoriesForInterests(currentUserInterests);
  const commonCategories = candidateCategories.filter(cat => userCategories.includes(cat));
  score += commonCategories.length * 3; // Moderate bonus for category overlap

  // Factor 3: Recent activity (users active in last 30 days)
  const lastActive = new Date(candidate.last_active);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (lastActive > thirtyDaysAgo) {
    score += RECOMMENDATION_WEIGHTS.RECENT_ACTIVITY;
  }

  // Factor 4: Follower count (moderate weight - popular but not overwhelming)
  const followerBonus = Math.min(
    (candidate.followers_count || 0) / 100, 
    RECOMMENDATION_WEIGHTS.FOLLOWER_COUNT_BONUS
  );
  score += followerBonus;

  // Factor 5: Post activity (users who create content)
  const postBonus = Math.min(
    (candidate.posts_count || 0) / 10, 
    RECOMMENDATION_WEIGHTS.POST_ACTIVITY_BONUS
  );
  score += postBonus;

  // Factor 6: Profile completeness
  let completenessScore = 0;
  if (candidate.avatar_url) completenessScore += 1;
  if (candidate.bio && candidate.bio !== 'New to the community!') completenessScore += 1;
  if (candidate.interests && candidate.interests.length > 0) completenessScore += 1;
  score += completenessScore * RECOMMENDATION_WEIGHTS.PROFILE_COMPLETENESS;

  // Factor 7: Verified users get a small boost
  if (candidate.is_verified) {
    score += RECOMMENDATION_WEIGHTS.VERIFIED_BONUS;
  }

  // Factor 8: Contributors get a bonus
  if (candidate.is_contributor) {
    score += 1;
  }

  return score;
};

/**
 * Maps interests to broader categories for better matching
 */
export const getCategoriesForInterests = (interests: string[]): string[] => {
  const categories = new Set<string>();
  
  interests.forEach(interest => {
    const lowerInterest = interest.toLowerCase();
    
    Object.entries(INTEREST_CATEGORIES).forEach(([category, keywords]) => {
      if (keywords.some(keyword => lowerInterest.includes(keyword))) {
        categories.add(category);
      }
    });
  });

  return Array.from(categories);
};

/**
 * Determines why a user is recommended
 */
export const getRecommendationReason = (
  user: SocialUserWithDetails,
  currentUserInterests: string[] = []
): string => {
  if (user.is_verified) return 'Verified';
  
  const commonInterests = user.interests?.filter(interest => 
    currentUserInterests.includes(interest)
  ) || [];
  
  if (commonInterests.length > 0) return 'Similar Interests';
  if ((user.followers_count || 0) > 1000) return 'Popular';
  if ((user.posts_count || 0) > 50) return 'Active Creator';
  if (user.is_contributor) return 'Contributor';
  
  return 'New Member';
};

/**
 * Formats large numbers for display (1.2K, 2.5M, etc.)
 */
export const formatEngagementCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toString();
};

/**
 * Gets the appropriate color class for a recommendation badge
 */
export const getRecommendationBadgeColor = (reason: string): string => {
  const colorMap: Record<string, string> = {
    'Verified': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Popular': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'Active Creator': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'Similar Interests': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'Contributor': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    'New Member': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  };

  return colorMap[reason] || colorMap['New Member'];
};

/**
 * Checks if suggestions need to be refreshed based on timestamp
 */
export const shouldRefreshSuggestions = (lastRefresh: Date | null): boolean => {
  if (!lastRefresh) return true;
  
  const now = new Date();
  const timeDiff = now.getTime() - lastRefresh.getTime();
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  
  return timeDiff > oneHour;
};

/**
 * Builds a complex query for finding suggested users
 * This would be used in more advanced scenarios with PostgreSQL functions
 */
export const buildSuggestedUsersQuery = (
  excludeIds: string[],
  userInterests: string[],
  limit: number,
  offset: number
) => {
  return {
    excludeIds,
    userInterests,
    limit,
    offset,
    // Additional query parameters for advanced filtering
    minFollowers: 0,
    maxFollowers: 50000, // Don't suggest mega-influencers to new users
    requireAvatar: false,
    requireBio: false,
    activeInDays: 90,
  };
};