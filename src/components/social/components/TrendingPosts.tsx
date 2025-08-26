// components/TrendingPosts.tsx
import React from 'react';
import { PostCard } from './PostCard';
import { SocialPostWithDetails, SocialUserWithDetails, SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';
import { RefreshCw } from 'lucide-react';

interface TrendingPostsProps {
  posts: SocialPostWithDetails[];
  isLoading: boolean;
  onLike: (postId: string, isLiked: boolean) => void;
  onBookmark: (postId: string, isBookmarked: boolean) => void;
  onShare: (post: SocialPostWithDetails) => void;
  onComment: (postId: string) => void;
  isPostExpanded: (postId: string) => boolean;
  getPostComments: (postId: string) => SocialCommentWithDetails[];
  isLoadingPostComments: (postId: string) => boolean;
  getNewCommentContent: (postId: string) => string;
  onCommentChange: (postId: string, content: string) => void;
  onSubmitComment: (postId: string) => void;
  currentUser: SocialUserWithDetails | null;
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
}) => {
  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white/60 backdrop-blur-sm rounded-lg border">
          <h3 className="text-lg font-semibold mb-2">No trending posts</h3>
          <p className="text-muted-foreground">
            There are no trending posts at the moment. Check back later!
          </p>
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
          />
        ))
      )}
    </div>
  );
};