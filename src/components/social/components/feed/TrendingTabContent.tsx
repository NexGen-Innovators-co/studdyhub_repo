import React, { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, TrendingUp, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '../PostCard';
import { InFeedSuggestedStrip } from './InFeedSuggestedStrip';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';

interface TrendingTabContentProps {
  posts: SocialPostWithDetails[];
  isLoading: boolean;
  isLoadingMorePosts: boolean;
  trendingObserverRef: RefObject<HTMLDivElement>;
  currentUser: any;

  // Post actions
  onLike: (postId: string, isLiked: boolean) => void;
  onBookmark: (postId: string, isBookmarked: boolean) => void;
  onShare: (post: SocialPostWithDetails) => void;
  onShareToChat: (post: SocialPostWithDetails) => void;
  onDeletePost: (postId: string) => Promise<boolean>;
  onEditPost: (postId: string, content: string) => Promise<boolean>;
  onPostView: (postId: string) => void;

  // Comments
  onComment: (postId: string) => void;
  isPostExpanded: (postId: string) => boolean;
  getPostComments: (postId: string) => any[];
  isLoadingPostComments: (postId: string) => boolean;
  getNewCommentContent: (postId: string) => string;
  onCommentChange: (postId: string, content: string) => void;
  isAddingComment: (postId: string) => boolean;
  onSubmitComment: (postId: string) => Promise<void>;

  // Suggested strip
  uniqueSuggestedUsers: any[];
  hasMoreSuggestedUsers: boolean;
  isLoadingSuggestedUsers: boolean;
  loadMoreSuggestedUsers: () => void;
  suggestedStripScrollPositions: React.MutableRefObject<Map<string, number>>;
  onToggleFollow: (userId: string) => Promise<{ isNowFollowing: boolean }>;
  onSeeAllSuggested: () => void;

  // Filtering
  filterPosts: (posts: any[]) => any[];

  // Misc
  onShowPostDialog: () => void;
  onForceRefresh: () => void;
}

export const TrendingTabContent: React.FC<TrendingTabContentProps> = ({
  posts,
  isLoading,
  isLoadingMorePosts,
  trendingObserverRef,
  currentUser,
  onLike,
  onBookmark,
  onShare,
  onShareToChat,
  onDeletePost,
  onEditPost,
  onPostView,
  onComment,
  isPostExpanded,
  getPostComments,
  isLoadingPostComments,
  getNewCommentContent,
  onCommentChange,
  isAddingComment,
  onSubmitComment,
  uniqueSuggestedUsers,
  hasMoreSuggestedUsers,
  isLoadingSuggestedUsers,
  loadMoreSuggestedUsers,
  suggestedStripScrollPositions,
  onToggleFollow,
  onSeeAllSuggested,
  filterPosts,
  onShowPostDialog,
  onForceRefresh,
}) => {
  const navigate = useNavigate();

  const renderPostsWithStrips = () => {
    if (isLoading && posts.length === 0) return <LoadingSpinner />;

    if (posts.length === 0 && !isLoading) {
      return (
        <div className="text-center py-12">
          <div className="text-slate-400 text-lg">No posts found</div>
          <Button onClick={onForceRefresh} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      );
    }

    const items: JSX.Element[] = [];
    const POSTS_BETWEEN_STRIPS = 6;
    const filtered = filterPosts(posts);
    let stripCounter = 0;

    filtered.forEach((post, idx) => {
      items.push(
        <div key={post.id} className="space-y-1 lg:space-y-4">
          <PostCard
            post={post}
            currentUser={currentUser}
            onLike={onLike}
            onBookmark={onBookmark}
            onShare={onShare}
            onComment={() => onComment(post.id)}
            isExpanded={isPostExpanded(post.id)}
            comments={getPostComments(post.id)}
            isLoadingComments={isLoadingPostComments(post.id)}
            newComment={getNewCommentContent(post.id)}
            onCommentChange={(c) => onCommentChange(post.id, c)}
            isAddingComment={isAddingComment(post.id)}
            onSubmitComment={async () => onSubmitComment(post.id)}
            onPostView={onPostView}
            onClick={() => navigate(`/social/post/${post.id}`)}
            onDeletePost={onDeletePost}
            onEditPost={onEditPost}
            onShareToChat={onShareToChat}
          />
        </div>
      );

      if ((idx + 1) % POSTS_BETWEEN_STRIPS === 0 && uniqueSuggestedUsers.length > 0) {
        const stripId = `trending_strip_${stripCounter}`;
        items.push(
          <InFeedSuggestedStrip
            key={stripId}
            users={uniqueSuggestedUsers}
            offset={stripCounter}
            stripId={stripId}
            saveScroll={(id, pos) => suggestedStripScrollPositions.current.set(id, pos)}
            getSavedScroll={(id) => suggestedStripScrollPositions.current.get(id) || 0}
            hasMoreSuggestedUsers={hasMoreSuggestedUsers}
            isLoadingSuggestedUsers={isLoadingSuggestedUsers}
            loadMoreSuggestedUsers={loadMoreSuggestedUsers}
            onFollow={onToggleFollow}
            onSeeAll={onSeeAllSuggested}
          />
        );
        stripCounter++;
      }
    });

    return items;
  };

  if (isLoading && posts.length === 0) return <LoadingSpinner />;

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No featured discussions yet</h3>
        <p className="text-slate-600 mb-6 max-w-sm">
          Featured discussions appear here based on engagement. Start creating and interacting with posts to see them featured!
        </p>
        <Button onClick={onShowPostDialog} variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          Create Post
        </Button>
      </div>
    );
  }

  return (
    <>
      {renderPostsWithStrips()}
      <div ref={trendingObserverRef as any} className="h-10" />
      {isLoadingMorePosts && <LoadingSpinner size="sm" />}
    </>
  );
};

const LoadingSpinner: React.FC<{ size?: 'default' | 'sm' }> = ({ size = 'default' }) => (
  <div className={`flex flex-col items-center justify-center ${size === 'default' ? 'py-12' : 'py-4'}`}>
    <Loader2 className={`${size === 'default' ? 'h-8 w-8' : 'h-6 w-6'} animate-spin text-blue-600`} />
    <p className="text-sm text-slate-500 mt-2">Loading posts...</p>
  </div>
);
