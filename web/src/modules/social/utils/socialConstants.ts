// Social network constants and enums

export const PRIVACY_OPTIONS = {
  PUBLIC: 'public' as const,
  FOLLOWERS: 'followers' as const,
  PRIVATE: 'private' as const,
} as const;

export const SORT_OPTIONS = {
  NEWEST: 'newest' as const,
  POPULAR: 'popular' as const,
  TRENDING: 'trending' as const,
} as const;

export const FILTER_OPTIONS = {
  ALL: 'all' as const,
  FOLLOWING: 'following' as const,
  GROUPS: 'groups' as const,
} as const;

export const NOTIFICATION_TYPES = {
  LIKE: 'like' as const,
  COMMENT: 'comment' as const,
  SHARE: 'share' as const,
  FOLLOW: 'follow' as const,
  GROUP_INVITE: 'group_invite' as const,
  MENTION: 'mention' as const,
} as const;

export const MEDIA_TYPES = {
  IMAGE: 'image' as const,
  VIDEO: 'video' as const,
  DOCUMENT: 'document' as const,
} as const;

export const DEFAULT_LIMITS = {
  POSTS_PER_PAGE: 20,
  COMMENTS_PER_PAGE: 10,
  TRENDING_HASHTAGS: 10,
  SUGGESTED_USERS: 5, // Reduced for better UX with pagination
  NOTIFICATIONS: 10,
  GROUPS_PER_PAGE: 10,
  MAX_SUGGESTED_USERS_TOTAL: 100, // Maximum number of users to suggest in total
} as const;

export const FILE_CONSTRAINTS = {
  MAX_POST_LENGTH: 500,
  MAX_FILES_PER_POST: 4,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

export const SUPPORTED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEOS: ['video/mp4', 'video/webm', 'video/ogg'],
  DOCUMENTS: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const;

// Recommendation scoring weights
export const RECOMMENDATION_WEIGHTS = {
  COMMON_INTERESTS: 10,
  RECENT_ACTIVITY: 5,
  FOLLOWER_COUNT_BONUS: 5,
  POST_ACTIVITY_BONUS: 3,
  PROFILE_COMPLETENESS: 1,
  VERIFIED_BONUS: 2,
} as const;

// Time-based constants for recommendations
export const RECOMMENDATION_TIME = {
  RECENT_ACTIVITY_DAYS: 30,
  STALE_SUGGESTIONS_MINUTES: 60, // Refresh suggestions after 1 hour
} as const;

// User interest categories for better matching
export const INTEREST_CATEGORIES = {
  TECHNOLOGY: ['technology', 'programming', 'ai', 'web development', 'mobile development', 'data science'],
  LEARNING: ['learning', 'education', 'studying', 'research', 'academic', 'knowledge'],
  CREATIVE: ['art', 'design', 'photography', 'writing', 'music', 'creative'],
  BUSINESS: ['business', 'entrepreneurship', 'marketing', 'finance', 'startups'],
  LIFESTYLE: ['fitness', 'health', 'travel', 'food', 'fashion', 'lifestyle'],
  ENTERTAINMENT: ['gaming', 'movies', 'books', 'sports', 'entertainment'],
} as const;