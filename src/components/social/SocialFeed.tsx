import React, { useState, useEffect, useRef } from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, RefreshCw, Bell, TrendingUp, Users, User, SortDesc, Loader2
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
import { SortBy, FilterBy, Privacy } from './types/social';
import { SocialPostWithDetails, SocialUserWithDetails } from '../../integrations/supabase/socialTypes';

interface SocialFeedProps {
  userProfile: any;
  activeTab?: string;
  postId?: string;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({ userProfile, activeTab: initialActiveTab, postId }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications'>(initialActiveTab as any || 'feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showPostDialog, setShowPostDialog] = useState(false);

  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Intersection Observer refs for infinite scroll
  const feedObserverRef = useRef<HTMLDivElement>(null);
  const trendingObserverRef = useRef<HTMLDivElement>(null);
  const profileObserverRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null); // New ref for feed container

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
    isLoadingSuggestedUsers,
    isLoadingMorePosts,
    hasMorePosts,
    hasMoreTrendingPosts,
    hasMoreUserPosts,
    hasMoreSuggestedUsers,
    hasMoreGroups,
    refetchPosts,
    refetchTrendingPosts,
    refetchGroups,
    refetchUserPosts,
    refetchSuggestedUsers,
    loadMorePosts,
    loadMoreTrendingPosts,
    loadMoreUserPosts,
    loadMoreGroups,
    loadMoreSuggestedUsers,
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

  const navigate = useNavigate();
  const { tab: routeTab, postId: routePostId } = useParams<{ tab?: string; postId?: string }>();

  // Setup intersection observers for infinite scroll
  useEffect(() => {
    const observers = [];

    // Feed observer
    if (feedObserverRef.current) {
      const feedObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMorePosts && !isLoadingMorePosts) {
            loadMorePosts();
          }
        },
        {
          threshold: 0.1,
          rootMargin: '200px',
        }
      );

      feedObserver.observe(feedObserverRef.current);
      observers.push(feedObserver);
    }

    // Trending observer
    if (trendingObserverRef.current) {
      const trendingObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMoreTrendingPosts && !isLoadingMorePosts) {
            loadMoreTrendingPosts();
          }
        },
        {
          threshold: 0.1,
          rootMargin: '200px',
        }
      );

      trendingObserver.observe(trendingObserverRef.current);
      observers.push(trendingObserver);
    }

    // Profile observer
    if (profileObserverRef.current) {
      const profileObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMoreUserPosts && !isLoadingUserPosts) {
            loadMoreUserPosts();
          }
        },
        {
          threshold: 0.1,
          rootMargin: '200px',
        }
      );

      profileObserver.observe(profileObserverRef.current);
      observers.push(profileObserver);
    }

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [
    activeTab,
    hasMorePosts,
    hasMoreTrendingPosts,
    hasMoreUserPosts,
    isLoadingMorePosts,
    isLoadingUserPosts,
    loadMorePosts,
    loadMoreTrendingPosts,
    loadMoreUserPosts
  ]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab as any);
    }
  }, [initialActiveTab]);

  // Handler functions
  const handleCreatePost = async () => {
    const success = await createPost(newPostContent, selectedPrivacy, selectedFiles);
    if (success) {
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
      refetchUserPosts();
      // Instead of refetching all posts, rely on useSocialActions to update posts state
      // Scroll to top to show new post
      if (feedContainerRef.current) {
        feedContainerRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      toast.success('Post created successfully!');
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
    } else if (activeTab === 'trending') {
      refetchTrendingPosts();
    } else {
      refetchPosts();
    }
    toast.success('Content refreshed!');
  };

  const handlePostDialogChange = () => {
    setShowPostDialog(!showPostDialog);
    return !showPostDialog;
  };

  const handleFollowUser = async (userId: string) => {
    await followUser(userId);
    refetchSuggestedUsers();
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

  const filteredTrendingPosts = trendingPosts.filter(post => {
    if (!searchQuery.trim()) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      post.content.toLowerCase().includes(searchLower) ||
      post.author?.display_name?.toLowerCase().includes(searchLower) ||
      post.author?.username?.toLowerCase().includes(searchLower) ||
      post.hashtags?.some(hashtag => hashtag.name.toLowerCase().includes(searchLower))
    );
  });

  const handlePostClick = (postId: string) => {
    navigate(`/social/post/${postId}`);
  };

  // If postId is present, display only that post
  const postToDisplay = routePostId
    ? [...posts, ...trendingPosts, ...userPosts].find((post) => post.id === routePostId)
    : null;

  // Loading component
  const LoadingSpinner = ({ text = "Loading..." }: { text?: string }) => (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      <p className="text-sm text-slate-500 dark:text-gray-400">{text}</p>
    </div>
  );

  // Load more trigger component
  const LoadMoreTrigger = ({ 
    hasMore, 
    isLoading, 
    onLoadMore, 
    observerRef 
  }: { 
    hasMore: boolean; 
    isLoading: boolean; 
    onLoadMore: () => void; 
    observerRef: React.RefObject<HTMLDivElement>; 
  }) => {
    if (!hasMore) return null;

    return (
      <div ref={observerRef} className="py-4 flex justify-center">
        {isLoading ? (
          <LoadingSpinner text="Loading more..." />
        ) : (
          <Button
            variant="outline"
            onClick={onLoadMore}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
          >
            Load More
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main content */}
          <div className="lg:col-span-8">
            {/* Search and filters */}
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-4 mb-6 border border-slate-200 dark:border-gray-700 sticky top-4 z-10">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search posts, users, or hashtags..."
                    className="pl-10 bg-white/50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                  <SelectTrigger className="w-[180px] bg-white/50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="trending">Trending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
                  <SelectTrigger className="w-[180px] bg-white/50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600">
                    <SelectValue placeholder="Filter by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="following">Following</SelectItem>
                    <SelectItem value="groups">Groups</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  className="bg-white/50 dark:bg-gray-700/50 border-slate-200 dark:border-gray-600"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Tabs */}
            {routePostId ? (
              // Single post view if postId is in URL
              <div>
                {postToDisplay ? (
                  <PostCard
                    post={postToDisplay}
                    onLike={toggleLike}
                    onBookmark={toggleBookmark}
                    onShare={sharePost}
                    onComment={() => togglePostExpanded(postToDisplay.id)}
                    isExpanded={true} // Always expanded for single view
                    comments={getPostComments(postToDisplay.id)}
                    isLoadingComments={isLoadingPostComments(postToDisplay.id)}
                    newComment={getNewCommentContent(postToDisplay.id)}
                    onCommentChange={(content) => updateNewComment(postToDisplay.id, content)}
                    onSubmitComment={() => handleCommentSubmit(postToDisplay.id)}
                    currentUser={currentUser}
                    onPostView={trackPostView}
                    onClick={() => {}}
                  />
                ) : (
                  <div className="text-center py-12">Post not found</div>
                )}
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
                <TabsList className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-1 border border-slate-200 dark:border-gray-700 grid grid-cols-5">
                  <TabsTrigger value="feed" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                    <SortDesc className="h-4 w-4 mr-2" />
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="trending" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Trending
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                    <Users className="h-4 w-4 mr-2" />
                    Groups
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 relative">
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 transform translate-x-1/2 -translate-y-1/2">
                        {unreadCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="mt-0" ref={feedContainerRef}>
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

                    {isLoading && posts.length === 0 ? (
                      <LoadingSpinner text="Loading your feed..." />
                    ) : (
                      <div className="space-y-6">
                        <Button 
                          onClick={() => setShowPostDialog(true)} 
                          className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 py-3"
                        >
                          What's on your mind?
                        </Button>
                        
                        {filteredPosts.map((post, index) => (
                          <PostCard
                            key={`${post.id}-${index}`}
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
                            onClick={() => handlePostClick(post.id)}
                          />
                        ))}

                        {/* Infinite scroll trigger for feed */}
                        <LoadMoreTrigger
                          hasMore={hasMorePosts}
                          isLoading={isLoadingMorePosts}
                          onLoadMore={loadMorePosts}
                          observerRef={feedObserverRef}
                        />

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
                  <div className="space-y-6">
                    {isLoading && trendingPosts.length === 0 ? (
                      <LoadingSpinner text="Loading trending posts..." />
                    ) : (
                      <>
                        <TrendingPosts
                          posts={filteredTrendingPosts}
                          isLoading={false}
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
                          onClick={handlePostClick}
                        />
                        
                        {/* Infinite scroll trigger for trending */}
                        <LoadMoreTrigger
                          hasMore={hasMoreTrendingPosts}
                          isLoading={isLoadingMorePosts}
                          onLoadMore={loadMoreTrendingPosts}
                          observerRef={trendingObserverRef}
                        />
                      </>
                    )}
                  </div>
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
                  <div className="space-y-6">
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
                      onClick={handlePostClick}
                    />
                    
                    {/* Infinite scroll trigger for user posts */}
                    <LoadMoreTrigger
                      hasMore={hasMoreUserPosts}
                      isLoading={isLoadingUserPosts}
                      onLoadMore={loadMoreUserPosts}
                      observerRef={profileObserverRef}
                    />
                  </div>
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
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-6">
              <TrendingSidebar
                hashtags={trendingHashtags}
                suggestedUsers={suggestedUsers}
                onFollowUser={handleFollowUser}
                isLoadingSuggestedUsers={isLoadingSuggestedUsers}
                hasMoreSuggestedUsers={hasMoreSuggestedUsers}
                onLoadMoreSuggestedUsers={loadMoreSuggestedUsers}
                onRefreshSuggestedUsers={refetchSuggestedUsers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};