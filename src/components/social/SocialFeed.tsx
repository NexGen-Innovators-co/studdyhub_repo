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
  Search, RefreshCw, Bell, TrendingUp, Users, User, SortDesc, Loader2, ChevronDown, X
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
import { GroupDetailPage } from './components/GroupDetail';

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
  const [showFilters, setShowFilters] = useState(false); // For mobile filter toggle

  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Intersection Observer refs for infinite scroll
  const feedObserverRef = useRef<HTMLDivElement>(null);
  const trendingObserverRef = useRef<HTMLDivElement>(null);
  const profileObserverRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

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
    isLoadingMoreGroups,
    // ADD THESE:
    likedPosts,
    bookmarkedPosts,
    isLoadingLikedPosts,
    isLoadingBookmarkedPosts,
    refetchLikedPosts,
    refetchBookmarkedPosts,
  } = useSocialData(userProfile, sortBy, filterBy);

  const {
    createPost,
    updateProfile,
    toggleLike,
    toggleBookmark,
    sharePost,
    followUser,
    isUploading,
    createGroup,
    joinGroup,
    leaveGroup,
    deletePost,  // ADD THIS
    editPost,
  } = useSocialActions(
    currentUser,
    posts,
    setPosts,
    setSuggestedUsers,
    groups,
    setGroups,
    setCurrentUser,
  );

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
  const { tab: routeTab, postId: routePostId, groupId: routeGroupId } = useParams<{ tab?: string; postId?: string; groupId?: string }>();

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
    if (routeTab) {
      setActiveTab(routeTab as any);
    } else if (initialActiveTab) {
      setActiveTab(initialActiveTab as any);
    }
  }, [routeTab, initialActiveTab]);

  // Handler functions
  const handleCreatePost = async () => {
    const success = await createPost(newPostContent, selectedPrivacy, selectedFiles);
    if (success) {
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
      refetchUserPosts();
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

  // NEW GROUP HANDLERS
  const handleCreateGroup = (data: any) => createGroup(data);
  const handleJoinGroup = (groupId: string, privacy: 'public' | 'private') => joinGroup(groupId, privacy);
  const handleLeaveGroup = (groupId: string) => leaveGroup(groupId);
  // Function to insert inline suggestions at intervals
  const getSortedSuggestedUsers = (users: (SocialUserWithDetails & { recommendation_score?: number })[]) => {
    return [...users].sort((a, b) => {
      const scoreA = a.recommendation_score === undefined ? -1 : a.recommendation_score;
      const scoreB = b.recommendation_score === undefined ? -1 : b.recommendation_score;
      return scoreB - scoreA;
    });
  };
  const sortedSuggestedUsers = React.useMemo(() => {
    return getSortedSuggestedUsers(suggestedUsers);
  }, [suggestedUsers]);

  const getPostsWithInlineSuggestions = (postsList: any[]) => {
    const result: any[] = [];
    const usersPerSuggestion = 3; // Show 3 users per suggestion card
    let userIndex = 0;
    let hashtagIndex = 0;

    postsList.forEach((post, index) => {
      result.push({ type: 'post', data: post, key: `post-${post.id}-${index}` });

      // Insert "People You May Know" every 4 posts
      if ((index + 1) % 4 === 0 && sortedSuggestedUsers.length > userIndex) {
        const usersToShow = sortedSuggestedUsers.slice(userIndex, userIndex + usersPerSuggestion);
        if (usersToShow.length > 0) {
          result.push({
            type: 'suggested-users',
            data: usersToShow,
            key: `suggested-users-${index}`
          });
          userIndex += usersPerSuggestion;
        }
      }

      // Insert "Trending Topics" every 7 posts
      if ((index + 1) % 7 === 0 && trendingHashtags.length > hashtagIndex) {
        const hashtagsToShow = trendingHashtags.slice(hashtagIndex, hashtagIndex + 5);
        if (hashtagsToShow.length > 0) {
          result.push({
            type: 'trending-topics',
            data: hashtagsToShow,
            key: `trending-topics-${index}`
          });
          hashtagIndex += 5;
        }
      }
    });

    return result;
  };

  const postsWithSuggestions = getPostsWithInlineSuggestions(filteredPosts);
  const trendingWithSuggestions = getPostsWithInlineSuggestions(filteredTrendingPosts);

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
  
  // Inline Suggested Users Component
  const InlineSuggestedUsers = ({ users }: { users: any[] }) => (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 mb-6 border border-slate-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          People You May Know
        </h3>
      </div>
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {user.display_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-medium text-sm text-slate-800 dark:text-gray-200">
                  {user.display_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  @{user.username}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFollowUser(user.id)}
              className="text-xs"
            >
              Follow
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  // Inline Trending Topics Component
  const InlineTrendingTopics = ({ hashtags }: { hashtags: any[] }) => (
    <div className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 mb-6 border border-blue-200 dark:border-gray-600 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Trending Right Now
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {hashtags.map((hashtag) => (
          <div key={hashtag.name} className="p-3 bg-white/50 dark:bg-gray-900/50 rounded-md flex justify-between items-center">
            <span className="font-medium">#{hashtag.name}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{hashtag.count} posts</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Conditional render for GroupDetailPage (moved after all hooks)
  if (routeGroupId) {
    return (
      <GroupDetailPage
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 xl:col-span-8">
            {/* Search and Filter Bar */}
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-4 mb-6 border border-slate-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full flex items-center gap-2">
                  <Input
                    placeholder="Search posts, people, hashtags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchQuery('')}
                    className={searchQuery ? '' : 'hidden'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Desktop Filters */}
                <div className="hidden sm:flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="popular">Popular</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="following">Following</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Mobile Filter Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="sm:hidden"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Filters */}
              {showFilters && (
                <div className="mt-4 flex flex-col sm:hidden gap-4">
                  <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="popular">Popular</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="following">Following</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>

            {routePostId && postToDisplay ? (
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-4 border border-slate-200 dark:border-gray-700">
                <PostCard
                  post={postToDisplay}
                  onLike={toggleLike}
                  onBookmark={toggleBookmark}
                  onShare={sharePost}
                  onComment={() => togglePostExpanded(postToDisplay.id)}
                  isExpanded={isPostExpanded(postToDisplay.id)}
                  comments={getPostComments(postToDisplay.id)}
                  isLoadingComments={isLoadingPostComments(postToDisplay.id)}
                  newComment={getNewCommentContent(postToDisplay.id)}
                  onCommentChange={(content) => updateNewComment(postToDisplay.id, content)}
                  onSubmitComment={() => handleCommentSubmit(postToDisplay.id)}
                  currentUser={currentUser}
                  onPostView={trackPostView}
                  onClick={() => { }}
                  onDeletePost={deletePost}  // ADD THIS
                  onEditPost={editPost}      // ADD THIS
                />
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as any); navigate(`/social/${value}`); }} className="space-y-4 sm:space-y-6">
                <TabsList className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-1 border border-slate-200 dark:border-gray-700 grid grid-cols-5 w-full overflow-x-auto">
                  <TabsTrigger value="feed" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-xs sm:text-sm px-1 sm:px-3">
                    <SortDesc className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Feed</span>
                  </TabsTrigger>
                  <TabsTrigger value="trending" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-xs sm:text-sm px-1 sm:px-3">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Trending</span>
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-xs sm:text-sm px-1 sm:px-3">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Groups</span>
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 text-xs sm:text-sm px-1 sm:px-3">
                    <User className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Profile</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 relative text-xs sm:text-sm px-1 sm:px-3">
                    <Bell className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 transform translate-x-1/2 -translate-y-1/2">
                        {unreadCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="mt-0" ref={feedContainerRef}>
                  <div className="space-y-4 sm:space-y-6">
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
                      <div className="space-y-4 sm:space-y-6">
                        <Button
                          onClick={() => setShowPostDialog(true)}
                          className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 py-3"
                        >
                          What's on your mind?
                        </Button>

                        {/* Render posts with inline suggestions */}
                        {postsWithSuggestions.map((item) => {
                          if (item.type === 'post') {
                            return (
                              <PostCard
                                key={item.key}
                                post={item.data}
                                onLike={toggleLike}
                                onBookmark={toggleBookmark}
                                onShare={sharePost}
                                onComment={() => togglePostExpanded(item.data.id)}
                                isExpanded={isPostExpanded(item.data.id)}
                                comments={getPostComments(item.data.id)}
                                isLoadingComments={isLoadingPostComments(item.data.id)}
                                newComment={getNewCommentContent(item.data.id)}
                                onCommentChange={(content) => updateNewComment(item.data.id, content)}
                                onSubmitComment={() => handleCommentSubmit(item.data.id)}
                                currentUser={currentUser}
                                onPostView={trackPostView}
                                onClick={() => handlePostClick(item.data.id)}
                                onDeletePost={deletePost}  // ADD THIS
                                onEditPost={editPost}      // ADD THIS
                              />

                            );
                          } else if (item.type === 'suggested-users') {
                            return <InlineSuggestedUsers key={item.key} users={item.data} />;
                          } else if (item.type === 'trending-topics') {
                            return <InlineTrendingTopics key={item.key} hashtags={item.data} />;
                          }
                          return null;
                        })}

                        {/* Infinite scroll trigger for feed */}
                        <LoadMoreTrigger
                          hasMore={hasMorePosts}
                          isLoading={isLoadingMorePosts}
                          onLoadMore={loadMorePosts}
                          observerRef={feedObserverRef}
                        />

                        {filteredPosts.length === 0 && !isLoading && (
                          <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-gray-700">
                            <div className="max-w-md mx-auto px-4">
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
                  <div className="space-y-4 sm:space-y-6">
                    {isLoading && trendingPosts.length === 0 ? (
                      <LoadingSpinner text="Loading trending posts..." />
                    ) : (
                      <>
                        {/* Render trending posts with inline suggestions */}
                        {trendingWithSuggestions.map((item) => {
                          if (item.type === 'post') {
                            return (
                              <PostCard
                                key={item.key}
                                post={item.data}
                                onLike={toggleLike}
                                onBookmark={toggleBookmark}
                                onShare={sharePost}
                                onComment={() => togglePostExpanded(item.data.id)}
                                isExpanded={isPostExpanded(item.data.id)}
                                comments={getPostComments(item.data.id)}
                                isLoadingComments={isLoadingPostComments(item.data.id)}
                                newComment={getNewCommentContent(item.data.id)}
                                onCommentChange={(content) => updateNewComment(item.data.id, content)}
                                onSubmitComment={() => handleCommentSubmit(item.data.id)}
                                currentUser={currentUser}
                                onPostView={trackPostView}
                                onClick={() => handlePostClick(item.data.id)}
                                onDeletePost={deletePost}  // ADD THIS
                                onEditPost={editPost}      // ADD THIS
                              />
                            );
                          } else if (item.type === 'suggested-users') {
                            return <InlineSuggestedUsers key={item.key} users={item.data} />;
                          } else if (item.type === 'trending-topics') {
                            return <InlineTrendingTopics key={item.key} hashtags={item.data} />;
                          }
                          return null;
                        })}

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
                    onLeaveGroup={leaveGroup}
                    onCreateGroup={handleCreateGroup}
                    currentUser={currentUser}
                    hasMore={hasMoreGroups}
                    onLoadMore={loadMoreGroups}
                    isLoadingMore={isLoadingMoreGroups}
                    onRefresh={refetchGroups}
                  />
                </TabsContent>

                <TabsContent value="profile" className="mt-0">
                  <div className="space-y-4 sm:space-y-6">
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
                      hasMorePosts={hasMoreUserPosts}
                      onLoadMorePosts={loadMoreUserPosts}
                      isLoadingMorePosts={isLoadingUserPosts}
                      userGroups={groups.filter(g => g.is_member)}
                      likedPosts={likedPosts}
                      bookmarkedPosts={bookmarkedPosts}
                      isLoadingLikedPosts={isLoadingLikedPosts}
                      isLoadingBookmarkedPosts={isLoadingBookmarkedPosts}
                      onRefreshLikedPosts={refetchLikedPosts}
                      onRefreshBookmarkedPosts={refetchBookmarkedPosts}
                      onDeletePost={deletePost}
                      onEditPost={editPost}
                    />

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

          {/* Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-6">
              <TrendingSidebar
                hashtags={trendingHashtags}
                suggestedUsers={sortedSuggestedUsers}
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