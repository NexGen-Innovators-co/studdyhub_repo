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
  SUGGESTED_USERS: 5,
  NOTIFICATIONS: 10,
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