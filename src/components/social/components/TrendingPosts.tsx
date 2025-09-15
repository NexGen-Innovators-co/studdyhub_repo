import React from 'react';
import { PostCard } from './PostCard';
import { SocialPostWithDetails, SocialUserWithDetails, SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';
import { RefreshCw, TrendingUp } from 'lucide-react';

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
  onPostView: (postId: string) => Promise<void>;
  onClick?: (postId: string) => void;
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
  onClick,
}) => {
  // Loading state for initial load
  if (isLoading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
        <p className="text-slate-500 dark:text-gray-400 text-sm">Loading trending posts...</p>
      </div>
    );
  }

  // Empty state
  if (!isLoading && posts.length === 0) {
    return (
      <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-gray-700">
        <div className="max-w-md mx-auto">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
            No trending posts yet
          </h3>
          <p className="text-slate-600 dark:text-gray-300">
            Check back later to see what's trending in the community.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200">
            Trending Posts
          </h2>
          <span className="text-sm text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            {posts.length}
          </span>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {posts.map((post, index) => (
          <div key={`trending-${post.id}-${index}`} className="relative">
            {/* Trending indicator
            <div className="absolute -left-4 top-4 z-10">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-lg">
                <span className="text-white text-xs font-bold">#{index + 1}</span>
              </div>
            </div> */}

            <PostCard
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
              onPostView={onPostView}
              onClick={onClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};