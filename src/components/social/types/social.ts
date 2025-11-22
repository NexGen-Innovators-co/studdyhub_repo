// Extended social types for the social feed components
import { SocialPostWithDetails, SocialCommentWithDetails, SocialGroup, SocialChatMessageMedia, SocialUser } from '../../../integrations/supabase/socialTypes';

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
  onClick?: (e) => void;
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
// Add these types to src/components/social/types/social.ts

export interface ChatSession {
  id: string;
  chat_type: 'group' | 'p2p';
  group_id?: string;
  user_id1?: string;
  user_id2?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionWithDetails extends ChatSession {
  group?: SocialGroup;
  user1?: SocialUserWithDetails;
  user2?: SocialUserWithDetails;
  last_message?: ChatMessageWithDetails;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatMessageWithDetails extends ChatMessage {
  sender: SocialUserWithDetails;
  media?: SocialChatMessageMedia[];
  resources?: ChatMessageResource[];
}

export interface ChatMessageResource {
  id: string;
  message_id: string;
  resource_id: string;
  resource_type: 'note' | 'document'|'post';
  created_at: string;
  note?: Note;
  document?: Document;
  post?: SocialPostWithDetails;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  user_id: string;
  created_at: string;
}

export type ChatType = 'group' | 'p2p';

export interface ChatMessage {
id: string;
session_id: string;
sender_id: string;
content: string;
created_at: string;
resource_id?: string;
resource_type?: 'note' | 'document';
}

export interface ChatMessageMedia {
id: string;
message_id: string;
type: 'image' | 'video' | 'document';
url: string;
filename: string;
size_bytes: number;
mime_type: string;
created_at: string;
}

export interface SocialUserWithDetails extends SocialUser {
is_following?: boolean;
is_followed_by?: boolean;
}