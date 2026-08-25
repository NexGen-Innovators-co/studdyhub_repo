import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { RECOMMENDATION_WEIGHTS, INTEREST_CATEGORIES } from './socialConstants';


/**
 * Gets the appropriate color class for a recommendation badge
 */
export const getRecommendationBadgeColor = (reason: string): string => {
  const colorMap: Record<string, string> = {
    'Verified': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Popular': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
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