// components/TrendingPosts.tsx
import React from 'react';
import { PostCard } from './PostCard';
import { SocialPostWithDetails, SocialUserWithDetails, SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';
import { RefreshCw } from 'lucide-react';

export interface TrendingPostsProps {
  posts: SocialPostWithDetails[];
  isLoading: boolean;
  onLike: (postId: string, isLiked: boolean) => Promise<void>;
  onBookmark: (postId: string, isBookmarked: boolean) => Promise<void>;
  onShare: (post: SocialPostWithDetails) => Promise<void>;
  onComment: (postId: string) => void;
  isPostExpanded: (postId: string) => boolean;
  getPostComments: (postId: string) => SocialCommentWithDetails[];
  isLoadingPostComments: (postId: string) => boolean;
  getNewCommentContent: (postId: string) => string;
  onCommentChange: (postId: string, content: string) => void;
  onSubmitComment: (postId: string) => void;
  currentUser: SocialUserWithDetails | null;
  onPostView: (postId: string) => Promise<void>; // Add this line
}

export const TrendingPosts: React.FC<TrendingPostsProps> = ({
  posts,
  isLoading,
  onLike,
  onBookmark,
  onShare,
  onComment,
  isPostExpanded,
  getPostComments,
  isLoadingPostComments,
  getNewCommentContent,
  onCommentChange,
  onSubmitComment,
  currentUser,
  onPostView,
}) => {
  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={onLike}
            onBookmark={onBookmark}
            onShare={onShare}
            onComment={() => onComment(post.id)}
            isExpanded={isPostExpanded(post.id)}
            comments={getPostComments(post.id)}
            isLoadingComments={isLoadingPostComments(post.id)}
            newComment={getNewCommentContent(post.id)}
            onCommentChange={(content) => onCommentChange(post.id, content)}
            onSubmitComment={() => onSubmitComment(post.id)}
            currentUser={currentUser}
            onPostView={onPostView} // Pass the prop to PostCard
          />
        ))
      )}
    </div>
  );
};