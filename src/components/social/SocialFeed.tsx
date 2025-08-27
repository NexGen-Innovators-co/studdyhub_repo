import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, RefreshCw, Bell, TrendingUp, Users, User, SortDesc
} from 'lucide-react';
import { toast } from 'sonner';

// Import hooks
import { useSocialData } from './hooks/useSocialData';
import { useSocialActions } from './hooks/useSocialActions';
import { useSocialComments } from './hooks/useSocialComments';
import { useSocialNotifications } from './hooks/useSocialNotifications';
import { useSocialPostViews } from './hooks/useSocialPostViews';

// Import components
import { PostCard } from './components/PostCard';
import { CreatePostDialog } from './components/CreatePostDialog';
import { TrendingSidebar } from './components/TrendingSidebar';
import { UserProfile } from './components/UserProfile';
import { TrendingPosts } from './components/TrendingPosts';
import { GroupsSection } from './components/GroupsSection';
import { NotificationsSection } from './components/NotificationsSection';

// Import types
import { SocialFeedProps, SortBy, FilterBy, Privacy } from './types/social';
import { SocialPostWithDetails, SocialUserWithDetails } from '../../integrations/supabase/socialTypes';

export const SocialFeed: React.FC<SocialFeedProps> = ({ userProfile }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showPostDialog, setShowPostDialog] = useState(false);

  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Custom hooks
  const {
    posts,
    setPosts,
    trendingPosts,
    setTrendingPosts,
    userPosts,
    setUserPosts,
    groups,
    setGroups,
    currentUser,
    setCurrentUser,
    trendingHashtags,
    suggestedUsers,
    setSuggestedUsers,
    isLoading,
    isLoadingGroups,
    isLoadingUserPosts,
    refetchPosts,
    refetchGroups,
    refetchUserPosts,
  } = useSocialData(userProfile, sortBy, filterBy);

  const {
    createPost,
    updateProfile,
    toggleLike,
    toggleBookmark,
    sharePost,
    followUser,
    joinGroup,
    isUploading,
  } = useSocialActions(currentUser, posts, setPosts, setSuggestedUsers, setGroups, setCurrentUser);

  const {
    fetchComments,
    addComment,
    updateNewComment,
    togglePostExpanded,
    isPostExpanded,
    getPostComments,
    isLoadingPostComments,
    getNewCommentContent,
  } = useSocialComments(currentUser, posts);

  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useSocialNotifications();

  const { trackPostView, cleanup } = useSocialPostViews(setPosts, setTrendingPosts, setUserPosts);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handler functions
  const handleCreatePost = async () => {
    const success = await createPost(newPostContent, selectedPrivacy, selectedFiles);
    if (success) {
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
      refetchUserPosts(); // Refresh user posts after creating a new post
    }
  };

  const handleCommentSubmit = (postId: string) => {
    addComment(postId);
  };

  const handleRefresh = () => {
    if (activeTab === 'groups') {
      refetchGroups();
    } else if (activeTab === 'profile') {
      refetchUserPosts();
    } else {
      refetchPosts();
    }
  };

  const handlePostDialogChange = () => {
    setShowPostDialog(!showPostDialog);
    return !showPostDialog;
  };

  // Filter posts based on search query
  const filteredPosts = posts.filter(post => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      post.content.toLowerCase().includes(searchLower) ||
      post.author?.display_name?.toLowerCase().includes(searchLower) ||
      post.author?.username?.toLowerCase().includes(searchLower) ||
      post.hashtags?.some(hashtag => hashtag.name.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full ">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-5  dark:bg-gray-900 backdrop-blur-sm">
                  <TabsTrigger value="feed" className="text-xs text-slate-600 dark:text-gray-200 ">Feed</TabsTrigger>
                  <TabsTrigger value="trending" className="text-xs text-slate-600 dark:text-gray-200">Trending</TabsTrigger>
                  <TabsTrigger value="groups" className="text-xs text-slate-600 dark:text-gray-200">Groups</TabsTrigger>
                  <TabsTrigger value="profile" className="text-xs text-slate-600 dark:text-gray-200">Profile</TabsTrigger>
                  <TabsTrigger value="notifications" className="text-xs text-slate-600 dark:text-gray-200">Notifications</TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading || isLoadingGroups || isLoadingUserPosts}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading || isLoadingGroups || isLoadingUserPosts ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
                    onClick={() => setActiveTab('notifications')}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search posts, users, hashtags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-700"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                  <SelectTrigger className="w-32 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <SortDesc className="h-3 w-3 text-slate-600 dark:text-gray-300" />
                        Newest
                      </div>
                    </SelectItem>
                    <SelectItem value="trending">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-slate-600 dark:text-gray-300" />
                        Trending
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
                  <SelectTrigger className="w-32 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
                    <SelectItem value="all">All Posts</SelectItem>
                    <SelectItem value="following">Following</SelectItem>
                    <SelectItem value="groups">Groups</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="feed" className="mt-0">
                <div className="space-y-6">
                  <CreatePostDialog
                    isOpen={showPostDialog}
                    onOpenChange={handlePostDialogChange}
                    content={newPostContent}
                    onContentChange={setNewPostContent}
                    privacy={selectedPrivacy}
                    onPrivacyChange={setSelectedPrivacy}
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    onSubmit={handleCreatePost}
                    isUploading={isUploading}
                    currentUser={currentUser}
                  />
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <Button onClick={() => setShowPostDialog(true)} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                        Create your first post
                      </Button>
                      {filteredPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLike={toggleLike}
                          onBookmark={toggleBookmark}
                          onShare={sharePost}
                          onComment={() => togglePostExpanded(post.id)}
                          isExpanded={isPostExpanded(post.id)}
                          comments={getPostComments(post.id)}
                          isLoadingComments={isLoadingPostComments(post.id)}
                          newComment={getNewCommentContent(post.id)}
                          onCommentChange={(content) => updateNewComment(post.id, content)}
                          onSubmitComment={() => handleCommentSubmit(post.id)}
                          currentUser={currentUser}
                          onPostView={trackPostView}
                        />
                      ))}
                      {filteredPosts.length === 0 && !isLoading && (
                        <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-gray-700">
                          <div className="max-w-md mx-auto">
                            {searchQuery ? (
                              <>
                                <Search className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">No posts found</h3>
                                <p className="text-slate-600 dark:text-gray-300">
                                  Try adjusting your search terms or filters to find what you're looking for.
                                </p>
                              </>
                            ) : posts.length === 0 ? (
                              <>
                                <User className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">Welcome to the community!</h3>
                                <p className="text-slate-600 dark:text-gray-300 mb-4">
                                  Be the first to share something amazing with the community.
                                </p>
                                <Button onClick={() => setShowPostDialog(true)} className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                                  Create your first post
                                </Button>
                              </>
                            ) : (
                              <>
                                <User className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">No posts match your filters</h3>
                                <p className="text-slate-600 dark:text-gray-300">
                                  Try changing your filter settings to see more posts.
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trending" className="mt-0">
                <TrendingPosts
                  posts={trendingPosts}
                  isLoading={isLoading}
                  onLike={toggleLike}
                  onBookmark={toggleBookmark}
                  onShare={sharePost}
                  onComment={togglePostExpanded}
                  isPostExpanded={isPostExpanded}
                  getPostComments={getPostComments}
                  isLoadingPostComments={isLoadingPostComments}
                  getNewCommentContent={getNewCommentContent}
                  onCommentChange={updateNewComment}
                  onSubmitComment={handleCommentSubmit}
                  currentUser={currentUser}
                  onPostView={trackPostView}
                />
              </TabsContent>

              <TabsContent value="groups" className="mt-0">
                <GroupsSection
                  groups={groups}
                  isLoading={isLoadingGroups}
                  onJoinGroup={joinGroup}
                  currentUser={currentUser}
                />
              </TabsContent>

              <TabsContent value="profile" className="mt-0">
                <UserProfile
                  user={currentUser}
                  isOwnProfile={true}
                  onEditProfile={updateProfile}
                  posts={userPosts}
                  isLoadingPosts={isLoadingUserPosts}
                  onLike={toggleLike}
                  onBookmark={toggleBookmark}
                  onShare={sharePost}
                  onComment={togglePostExpanded}
                  isPostExpanded={isPostExpanded}
                  getPostComments={getPostComments}
                  isLoadingPostComments={isLoadingPostComments}
                  getNewCommentContent={getNewCommentContent}
                  onCommentChange={updateNewComment}
                  onSubmitComment={handleCommentSubmit}
                  currentUser={currentUser}
                  refetchPosts={refetchUserPosts}
                  onPostView={trackPostView}
                />
              </TabsContent>

              <TabsContent value="notifications" className="mt-0">
                <NotificationsSection
                  notifications={notifications}
                  unreadCount={unreadCount}
                  markNotificationAsRead={markNotificationAsRead}
                  markAllNotificationsAsRead={markAllNotificationsAsRead}
                  deleteNotification={deleteNotification}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-6">
              <TrendingSidebar
                hashtags={trendingHashtags}
                suggestedUsers={suggestedUsers}
                onFollowUser={followUser}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};