// Extended social types for the social feed components
import { SocialPostWithDetails, SocialUserWithDetails, SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';

export interface SocialFeedProps {
  userProfile: any;
}

export interface PostCardProps {
  post: SocialPostWithDetails;
  onLike: (postId: string, isLiked: boolean) => void;
  onBookmark: (postId: string, isBookmarked: boolean) => void;
  onShare: (post: SocialPostWithDetails) => void;
  onComment: () => void;
  isExpanded: boolean;
  comments: SocialCommentWithDetails[];
  isLoadingComments: boolean;
  newComment: string;
  onCommentChange: (content: string) => void;
  onSubmitComment: () => void;
  currentUser: SocialUserWithDetails | null;
  onClick?: (postId:string) => void; 
}

export interface CreatePostDialogProps {
  isOpen: boolean;
  onOpenChange: () => boolean;
  content: string;
  onContentChange: (content: string) => void;
  privacy: 'public' | 'followers' | 'private';
  onPrivacyChange: (privacy: 'public' | 'followers' | 'private') => void;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  isUploading: boolean;
  currentUser: SocialUserWithDetails | null;
}

export interface CommentSectionProps {
  postId: string;
  comments: SocialCommentWithDetails[];
  isLoading: boolean;
  newComment: string;
  onCommentChange: (content: string) => void;
  onSubmitComment: () => void;
  currentUser: SocialUserWithDetails | null;
}

// Enhanced interface for suggested users with recommendation scoring
export interface SuggestedUserWithScore extends SocialUserWithDetails {
  recommendation_score?: number;
}

export interface TrendingSidebarProps {
  hashtags: any[];
  suggestedUsers: SuggestedUserWithScore[];
  onFollowUser: (userId: string) => void;
}

// Enhanced interface for suggested users component
export interface SuggestedUsersProps {
  users: SuggestedUserWithScore[];
  onFollowUser: (userId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}

export interface PostActionsProps {
  post: SocialPostWithDetails;
  onLike: (postId: string, isLiked: boolean) => void;
  onComment: () => void;
  onShare: (post: SocialPostWithDetails) => void;
  onBookmark: (postId: string, isBookmarked: boolean) => void;
}

export interface MediaUploadProps {
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onFileSelect: () => void;
}

export interface HashtagBadgeProps {
  hashtag: { name: string };
  onClick?: () => void;
}

export type SortBy = 'newest' | 'popular' | 'trending';
export type FilterBy = 'all' | 'following' | 'groups';
export type Privacy = 'public' | 'followers' | 'private';

// New types for enhanced functionality
export interface RecommendationQuery {
  excludeIds: string[];
  userInterests: string[];
  limit: number;
  offset: number;
  minFollowers?: number;
  maxFollowers?: number;
  requireAvatar?: boolean;
  requireBio?: boolean;
  activeInDays?: number;
}

export interface PaginationState {
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  lastRefresh: Date | null;
}