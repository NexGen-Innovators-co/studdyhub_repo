import React, { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw, Plus, Sparkles, Users, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PostCard } from '../PostCard';
import { ContentModerationFeedback, ContentGuidelines } from '../ContentModerationFeedback';
import { InFeedSuggestedStrip } from './InFeedSuggestedStrip';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';

interface FeedTabContentProps {
  // Posts data
  posts: SocialPostWithDetails[];
  isLoading: boolean;
  isLoadingMorePosts: boolean;
  feedObserverRef: RefObject<HTMLDivElement>;
  firstPostRef: React.MutableRefObject<HTMLDivElement | null>;

  // Current user
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

  // Filtering / search
  effectiveSearch: string;
  filterPosts: (posts: any[]) => any[];

  // Suggested strip
  uniqueSuggestedUsers: any[];
  hasMoreSuggestedUsers: boolean;
  isLoadingSuggestedUsers: boolean;
  loadMoreSuggestedUsers: () => void;
  suggestedStripScrollPositions: React.MutableRefObject<Map<string, number>>;
  onToggleFollow: (userId: string) => Promise<{ isNowFollowing: boolean }>;
  onSeeAllSuggested: () => void;

  // People search
  filteredUsers: any[];

  // Moderation
  moderationResult: any;
  onReviseModeration: () => void;
  showGuidelines: boolean;
  onToggleGuidelines: () => void;

  // Misc
  onShowPostDialog: () => void;
  onForceRefresh: () => void;

  // Post state setters for comment count updates
  setPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>;
  setTrendingPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>;
  setUserPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>;
}

export const FeedTabContent: React.FC<FeedTabContentProps> = ({
  posts,
  isLoading,
  isLoadingMorePosts,
  feedObserverRef,
  firstPostRef,
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
  effectiveSearch,
  filterPosts,
  uniqueSuggestedUsers,
  hasMoreSuggestedUsers,
  isLoadingSuggestedUsers,
  loadMoreSuggestedUsers,
  suggestedStripScrollPositions,
  onToggleFollow,
  onSeeAllSuggested,
  filteredUsers,
  moderationResult,
  onReviseModeration,
  showGuidelines,
  onToggleGuidelines,
  onShowPostDialog,
  onForceRefresh,
  setPosts,
  setTrendingPosts,
  setUserPosts,
}) => {
  const navigate = useNavigate();

  const renderPostCard = (post: SocialPostWithDetails, isFirst: boolean) => (
    <div key={post.id} ref={isFirst ? firstPostRef : undefined} data-first-post={isFirst || undefined} className="space-y-1 lg:space-y-4">
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
      items.push(renderPostCard(post, idx === 0));

      if ((idx + 1) % POSTS_BETWEEN_STRIPS === 0 && uniqueSuggestedUsers.length > 0) {
        const stripId = `suggest_strip_${stripCounter}`;
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

  return (
    <>
      {/* Moderation Feedback */}
      {moderationResult && !moderationResult.approved && (
        <div className="mb-4">
          <ContentModerationFeedback
            result={moderationResult}
            onRevise={onReviseModeration}
            onAppeal={() => {
              // toast imported in parent, using import here
              import('sonner').then(({ toast }) => toast.info('Appeal feature coming soon!'));
            }}
          />
        </div>
      )}

      {/* Educational Guidelines Banner */}
      {!showGuidelines && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <div>
                  <h4 className="font-semibold text-sm">Educational Content Platform</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Share knowledge, study resources, and learning experiences
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onToggleGuidelines}>
                View Guidelines
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guidelines Modal */}
      {showGuidelines && (
        <div className="mb-4">
          <ContentGuidelines onClose={onToggleGuidelines} />
        </div>
      )}

      {/* People Search Results */}
      {effectiveSearch.trim() && filteredUsers.length > 0 && (
        <PeopleSearchResults
          filteredUsers={filteredUsers}
          onToggleFollow={onToggleFollow}
          onSeeAll={onSeeAllSuggested}
        />
      )}

      {/* Posts */}
      {isLoading && posts.length === 0 ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No posts yet</h3>
          <p className="text-slate-600 mb-6 max-w-sm">
            Be the first to share something educational! Start a discussion, ask a question, or share your knowledge.
          </p>
          <Button onClick={onShowPostDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Create First Post
          </Button>
        </div>
      ) : (
        <>
          {renderPostsWithStrips()}
          <div ref={feedObserverRef as any} className="h-10" />
          {isLoadingMorePosts && <LoadingSpinner size="sm" />}
        </>
      )}
    </>
  );
};

/* ---- Sub components ---- */

const LoadingSpinner: React.FC<{ size?: 'default' | 'sm' }> = ({ size = 'default' }) => (
  <div className={`flex flex-col items-center justify-center ${size === 'default' ? 'py-12' : 'py-4'}`}>
    <Loader2 className={`${size === 'default' ? 'h-8 w-8' : 'h-6 w-6'} animate-spin text-blue-600`} />
    <p className="text-sm text-slate-500 mt-2">Loading posts...</p>
  </div>
);

const PeopleSearchResults: React.FC<{
  filteredUsers: any[];
  onToggleFollow: (userId: string) => Promise<{ isNowFollowing: boolean }>;
  onSeeAll: () => void;
}> = ({ filteredUsers, onToggleFollow, onSeeAll }) => {
  const navigate = useNavigate();

  return (
    <div className="mb-6 px-4 lg:px-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          People
        </h3>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredUsers.slice(0, 3).map((user) => (
            <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                onClick={() => navigate(`/social/profile/${user.id}`)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{user.display_name}</div>
                  <div className="text-xs text-slate-500 truncate">@{user.username}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs"
                onClick={() => onToggleFollow(user.id)}
              >
                Follow
              </Button>
            </div>
          ))}
        </div>
        {filteredUsers.length > 3 && (
          <button
            className="w-full py-2 text-xs text-blue-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800"
            onClick={onSeeAll}
          >
            View all {filteredUsers.length} people
          </button>
        )}
      </div>
    </div>
  );
};

export { LoadingSpinner };
