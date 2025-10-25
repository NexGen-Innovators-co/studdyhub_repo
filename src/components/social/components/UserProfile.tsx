import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { SocialUserWithDetails, SocialPostWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { EditProfileModal } from './EditProfileModal';
import { SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';
import { PostCard } from './PostCard';
import { RefreshCw, User, Calendar, Heart, MessageCircle, Bookmark, Eye, Users, Globe, Lock } from 'lucide-react';
import { formatEngagementCount, getTimeAgo } from '../utils/postUtils';
import { useNavigate } from 'react-router-dom';

export interface UserProfileProps {
  user: SocialUserWithDetails | null;
  isOwnProfile: boolean;
  onEditProfile: (updates: {
    display_name?: string;
    username?: string;
    bio?: string;
    avatar_file?: File;
    interests?: string[];
  }) => Promise<boolean>;
  posts: SocialPostWithDetails[];
  isLoadingPosts: boolean;
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
  refetchPosts: () => Promise<void>;
  onPostView: (postId: string) => Promise<void>;
  onClick?: (postId: string) => void;
  hasMorePosts?: boolean;
  onLoadMorePosts?: () => void;
  isLoadingMorePosts?: boolean;
  userGroups?: SocialGroupWithDetails[];
  onDeletePost?: (postId: string) => Promise<boolean>;
  onEditPost?: (postId: string, content: string) => Promise<boolean>;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  isOwnProfile,
  onEditProfile,
  posts,
  isLoadingPosts,
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
  refetchPosts,
  onPostView,
  onClick,
  hasMorePosts = false,
  onLoadMorePosts,
  isLoadingMorePosts = false,
  userGroups = [],
  onDeletePost,
  onEditPost,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'bookmarks' | 'groups'>('posts');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMorePosts || !hasMorePosts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePosts && !isLoadingMorePosts) {
          onLoadMorePosts();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMorePosts, isLoadingMorePosts, onLoadMorePosts]);

  if (!user) {
    return (
      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardContent className="p-6 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
          <p className="text-slate-600 dark:text-gray-300">User not found</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate user stats
  const totalLikes = posts.reduce((sum, post) => sum + post.likes_count, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments_count, 0);
  const totalViews = posts.reduce((sum, post) => sum + post.views_count, 0);

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      study: '📚',
      project: '💻',
      discussion: '💬',
      'exam-prep': '📝',
      research: '🔬',
      other: '🎯'
    };
    return emojiMap[category] || '🎯';
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
        {/* Cover Photo Placeholder */}
        <div className="h-32 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-800 relative">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <CardContent className="p-6 relative">
          {/* Avatar */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4 -mt-16">
              <Avatar className="w-24 h-24 ring-4 ring-white dark:ring-gray-800 shadow-lg">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-2xl">
                  {user.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="mt-12">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                    {user.display_name}
                  </h2>
                  {user.is_verified && (
                    <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="h-3 w-3 bg-white rounded-full"></div>
                    </div>
                  )}
                  {user.is_contributor && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Contributor
                    </Badge>
                  )}
                </div>
                <p className="text-slate-500 dark:text-gray-400 mb-2">@{user.username}</p>
                {user.bio && (
                  <p className="text-slate-600 dark:text-gray-300 max-w-md">{user.bio}</p>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <Button
                onClick={() => setIsEditModalOpen(true)}
                variant="outline"
                className="bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Edit Profile
              </Button>
            )}
          </div>

          {/* Profile Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Joined {getTimeAgo(user.created_at)}</span>
            </div>
          </div>

          {/* Interests */}
          {user.interests && user.interests.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-600 dark:text-gray-300 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                {formatEngagementCount(posts.length)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                {formatEngagementCount(user.followers_count || 0)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                {formatEngagementCount(user.following_count || 0)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Following</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                {formatEngagementCount(totalLikes)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Likes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-gray-200">
                {formatEngagementCount(userGroups.length)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Groups</p>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
              <MessageCircle className="h-4 w-4" />
              <span>{formatEngagementCount(totalComments)} comments received</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
              <Eye className="h-4 w-4" />
              <span>{formatEngagementCount(totalViews)} total views</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Section with Tabs */}
      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 overflow-x-auto">
              <div className="flex border rounded-lg bg-slate-100 dark:bg-gray-700">
                <Button
                  variant={activeTab === 'posts' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('posts')}
                  className="text-xs"
                >
                  Posts ({posts.length})
                </Button>
                {isOwnProfile && (
                  <>
                    <Button
                      variant={activeTab === 'likes' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('likes')}
                      className="text-xs"
                    >
                      <Heart className="h-3 w-3 mr-1" />
                      Liked
                    </Button>
                    <Button
                      variant={activeTab === 'bookmarks' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('bookmarks')}
                      className="text-xs"
                    >
                      <Bookmark className="h-3 w-3 mr-1" />
                      Saved
                    </Button>
                  </>
                )}
                <Button
                  variant={activeTab === 'groups' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('groups')}
                  className="text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Groups ({userGroups.length})
                </Button>
              </div>
            </div>
            {activeTab === 'posts' && (
              <Button
                variant="outline"
                size="sm"
                onClick={refetchPosts}
                disabled={isLoadingPosts}
                className="bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingPosts ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div>
              {isLoadingPosts && posts.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-slate-500 dark:text-gray-400">Loading posts...</p>
                  </div>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                    {isOwnProfile ? "You haven't posted anything yet" : `${user.display_name} hasn't posted anything yet`}
                  </h3>
                  <p className="text-slate-600 dark:text-gray-300">
                    {isOwnProfile ? "Share your first thought with the community!" : "Check back later for new posts."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {posts.map((post, index) => (
                    <PostCard
                      key={`profile-${post.id}-${index}`}
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
                      onDeletePost={isOwnProfile ? onDeletePost : undefined}
                      onEditPost={isOwnProfile ? onEditPost : undefined}
                    />
                  ))}

                  {/* Infinite scroll trigger */}
                  {hasMorePosts && (
                    <div ref={loadMoreRef} className="py-4 flex justify-center">
                      {isLoadingMorePosts ? (
                        <div className="flex items-center space-y-3">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                          <span className="text-sm text-slate-500 dark:text-gray-400">Loading more posts...</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={onLoadMorePosts}
                          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
                        >
                          Load More Posts
                        </Button>
                      )}
                    </div>
                  )}

                  {/* End of posts indicator */}
                  {!hasMorePosts && posts.length > 3 && (
                    <div className="text-center py-4 border-t border-slate-200 dark:border-gray-700">
                      <p className="text-sm text-slate-400 dark:text-gray-500">
                        You've reached the end of the posts
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Liked Posts Tab */}
          {activeTab === 'likes' && isOwnProfile && (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                Liked Posts
              </h3>
              <p className="text-slate-600 dark:text-gray-300">
                Posts you've liked will appear here.
              </p>
            </div>
          )}

          {/* Bookmarked Posts Tab */}
          {activeTab === 'bookmarks' && isOwnProfile && (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                Saved Posts
              </h3>
              <p className="text-slate-600 dark:text-gray-300">
                Posts you've bookmarked will appear here.
              </p>
            </div>
          )}

          {/* Groups Tab */}
          {activeTab === 'groups' && (
            <div>
              {userGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
                    {isOwnProfile ? "You haven't joined any groups yet" : `${user.display_name} hasn't joined any groups yet`}
                  </h3>
                  <p className="text-slate-600 dark:text-gray-300 mb-4">
                    {isOwnProfile ? "Join study groups to collaborate with others!" : ""}
                  </p>
                  {isOwnProfile && (
                    <Button
                      onClick={() => navigate('/social/groups')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Browse Groups
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userGroups.map((group) => (
                    <Card
                      key={group.id}
                      onClick={() => navigate(`/social/group/${group.id}`)}
                      className="hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar className="h-12 w-12 flex-shrink-0 border-2 border-blue-500 dark:border-blue-400">
                            <AvatarImage src={group.avatar_url} alt={group.name} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-lg font-bold">
                              {getCategoryEmoji(group.category)} {group.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {group.name}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-400 mt-1">
                              {group.privacy === 'public' ? (
                                <Globe className="h-3 w-3" />
                              ) : (
                                <Lock className="h-3 w-3" />
                              )}
                              <span>{group.privacy}</span>
                              {group.member_role && (
                                <>
                                  <span>•</span>
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    {group.member_role}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-gray-300 line-clamp-2 mb-3">
                          {group.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {formatEngagementCount(group.members_count)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {formatEngagementCount(group.posts_count)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={onEditProfile}
        user={user}
        isUploading={isLoadingPosts}
      />
    </div>
  );
};