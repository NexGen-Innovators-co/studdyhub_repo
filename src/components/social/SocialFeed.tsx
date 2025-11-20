import React, { useState, useEffect, useRef } from 'react';
import {
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, RefreshCw, Bell, TrendingUp, Users, User, Home, Loader2, X, Plus, Sparkles, Settings, LogOut, ArrowUp, ExternalLink
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent } from '../ui/card';
import { toast } from 'sonner';

// Import hooks
import { useSocialData } from './hooks/useSocialData';
import { useSocialActions } from './hooks/useSocialActions';
import { useSocialComments } from './hooks/useSocialComments';
import { useSocialNotifications } from './hooks/useSocialNotifications';
import { useSocialPostViews } from './hooks/useSocialPostViews';
import { useSocialDataContext } from './context/SocialDataContext';

// Import components
import { PostCard } from './components/PostCard';
import { CreatePostDialog } from './components/CreatePostDialog';
import { UserProfile } from './components/UserProfile';
import { GroupsSection } from './components/GroupsSection';
import { NotificationsSection } from './components/NotificationsSection';
import { GroupDetailPage } from './components/GroupDetail';
import { Dialog, DialogContent } from '../ui/dialog';

// Import types
import { SortBy, FilterBy, Privacy } from './types/social';

interface SocialFeedProps {
  activeTab?: string;
  postId?: string;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({  activeTab: initialActiveTab, postId }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications'>(initialActiveTab as any || 'feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showPostDialog, setShowPostDialog] = useState(false);

  // IMPROVED Pull-to-refresh & scroll-to-top states
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [canPull, setCanPull] = useState(false);

  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Refs
  const feedObserverRef = useRef<HTMLDivElement>(null);
  const trendingObserverRef = useRef<HTMLDivElement>(null);
  const profileObserverRef = useRef<HTMLDivElement>(null);
  const suggestedObserverRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const firstPostRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef(0);
  const rafId = useRef<number | null>(null);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;
  const SCROLL_THRESHOLD = 5;

  const suggestedStripScrollPositions = useRef<Map<string, number>>(new Map());

  const findScrollParent = (el?: Element | null) => {
    let node = el as Element | null;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  // Custom hooks
  const {
    posts,
    setPosts,
    trendingPosts,
    setTrendingPosts,
    userPosts,
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
    isLoadingMorePosts,
    hasMorePosts,
    hasMoreTrendingPosts,
    hasMoreUserPosts,
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
    isLoadingMoreGroups,
    likedPosts,
    bookmarkedPosts,
    isLoadingLikedPosts,
    isLoadingBookmarkedPosts,
    refetchLikedPosts,
    refetchBookmarkedPosts,
    setUserPosts,
    newPostsCount,
    hasNewPosts,
    showNewPosts,
    clearNewPosts,
    isLoadingSuggestedUsers,
    hasMoreSuggestedUsers,
    loadMoreSuggestedUsers,
  } =  useSocialDataContext();

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
    deletePost,
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
  const location = useLocation();
  const { tab: routeTab, postId: routePostId, groupId: routeGroupId } = useParams<{ tab?: string; postId?: string; groupId?: string }>();

  // Sync search & "open create" dialog from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || '';
    if (q !== searchQuery) setSearchQuery(q);

    if (params.get('openCreate') === 'true') {
      setShowPostDialog(true);
      params.delete('openCreate');
      const newSearch = params.toString();
      navigate({ pathname: location.pathname, search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Effects
  useEffect(() => {
    const createObserver = (ref: React.RefObject<HTMLDivElement>, hasMore: boolean, isLoading: boolean, loadMore: () => void) => {
      if (ref.current) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
              loadMore();
            }
          },
          { threshold: 0.1, rootMargin: '200px' }
        );
        observer.observe(ref.current);
        return observer;
      }
      return null;
    };

    const feedObserver = createObserver(feedObserverRef, hasMorePosts, isLoadingMorePosts, loadMorePosts);
    const trendingObserver = createObserver(trendingObserverRef, hasMoreTrendingPosts, isLoadingMorePosts, loadMoreTrendingPosts);
    const profileObserver = createObserver(profileObserverRef, hasMoreUserPosts, isLoadingUserPosts, loadMoreUserPosts);

    let suggestedObserver: IntersectionObserver | null = null;
    if (suggestedObserverRef.current) {
      suggestedObserver = new IntersectionObserver(
        (entries) => {
          if (isPulling || isRefreshing) return;
          if (entries[0].isIntersecting && hasMoreSuggestedUsers && !isLoadingSuggestedUsers) {
            loadMoreSuggestedUsers();
          }
        },
        { threshold: 0.1, rootMargin: '200px' }
      );
      suggestedObserver.observe(suggestedObserverRef.current);
    }

    return () => {
      feedObserver?.disconnect();
      trendingObserver?.disconnect();
      profileObserver?.disconnect();
      suggestedObserver?.disconnect();
    };
  }, [activeTab, hasMorePosts, hasMoreTrendingPosts, hasMoreUserPosts, isLoadingMorePosts, isLoadingUserPosts, hasMoreSuggestedUsers, isLoadingSuggestedUsers, loadMoreSuggestedUsers, isPulling, isRefreshing, loadMorePosts, loadMoreTrendingPosts, loadMoreUserPosts]);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (routeTab) setActiveTab(routeTab as any);
    else if (initialActiveTab) setActiveTab(initialActiveTab as any);
  }, [routeTab, initialActiveTab]);



  // Handlers
  const handleCreatePost = async () => {
    const success = await createPost(newPostContent, selectedPrivacy, selectedFiles);
    if (success) {
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
      refetchUserPosts();
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      toast.success('Post published!');
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    clearNewPosts();
    const actions: Record<string, () => Promise<any> | void> = {
      groups: async () => refetchGroups(),
      profile: async () => refetchUserPosts(),
      trending: async () => refetchTrendingPosts(),
      feed: async () => refetchPosts(),
      notifications: async () => { /* nothing */ },
    };
    try {
      const act = actions[activeTab] || (() => { });
      await act();
      toast.success('Feed updated');
    } catch (err) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const scrollToTop = () => {
    // Try scrolling the topRef element into view first (works for both document and nested containers)
    if (topRef.current && typeof topRef.current.scrollIntoView === 'function') {
      try {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      } catch {
        // ignore and fall back
      }
    }

    // Determine the scroll container at the time of click (use existing ref or compute)
    const container = scrollContainerRef.current ?? findScrollParent(topRef.current);
    if (!container) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If the container is the document (html/body), use window.scrollTo
    if (
      container === document.scrollingElement ||
      container === document.documentElement ||
      container === document.body
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If it's an element, try element.scrollTo, otherwise set scrollTop
    const el = container as HTMLElement;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      el.scrollTop = 0;
    }
  };

  // track scroll position to show/hide floating action buttons
  useEffect(() => {
    const container = findScrollParent(topRef.current);
    scrollContainerRef.current = container as unknown as HTMLElement;

    const onScroll = () => {
      const scTop =
        container === document.scrollingElement || container === document.documentElement
          ? window.scrollY || window.pageYOffset
          : (container as HTMLElement).scrollTop;
      setShowScrollTop((prev) => {
        const next = scTop > 300;
        if (next !== prev) return next;
        return prev;
      });
    };

    // initial
    onScroll();

    if (container === document.scrollingElement || container === document.documentElement) {
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    } else {
      (container as HTMLElement).addEventListener('scroll', onScroll, { passive: true });
      return () => (container as HTMLElement).removeEventListener('scroll', onScroll);
    }
  }, []);

  const filterPosts = (postList: any[]) => {
    if (!searchQuery.trim()) return postList;
    const searchLower = searchQuery.toLowerCase();
    return postList.filter(post =>
      post.content.toLowerCase().includes(searchLower) ||
      post.author?.display_name?.toLowerCase().includes(searchLower) ||
      post.author?.username?.toLowerCase().includes(searchLower)
    );
  };

  const uniqueSuggestedUsers = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const u of suggestedUsers || []) {
      if (!map.has(u.id)) map.set(u.id, u);
    }
    return Array.from(map.values());
  }, [suggestedUsers]);

  const [modalUser, setModalUser] = useState<any | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const openUserModal = (user: any) => {
    setModalUser(user);
    setIsUserModalOpen(true);
  };

  const InFeedSuggestedStrip: React.FC<{
    users: any[];
    offset: number;
    stripId: string;
    saveScroll: (id: string, pos: number) => void;
    getSavedScroll: (id: string) => number;
  }> = ({ users, offset, stripId, saveScroll, getSavedScroll }) => {
    const [loadingIds, setLoadingIds] = React.useState<Record<string, boolean>>({});
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const handleFollow = async (id: string) => {
      if (loadingIds[id]) return;
      setLoadingIds(prev => ({ ...prev, [id]: true }));
      try {
        await followUser(id);
        toast.success('Followed');
      } catch {
        toast.error('Failed to follow');
      } finally {
        setLoadingIds(prev => ({ ...prev, [id]: false }));
      }
    };

    const list = React.useMemo(() => {
      if (!users || users.length === 0) return [];
      const n = users.length;
      const o = Math.floor(offset % n);
      return users.slice(o).concat(users.slice(0, o)).slice(0, 12);
    }, [users, offset]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const saved = getSavedScroll(stripId) || 0;
      if (saved && Math.abs(el.scrollLeft - saved) > 2) el.scrollLeft = saved;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onScroll = () => {
      const pos = containerRef.current?.scrollLeft || 0;
      saveScroll(stripId, pos);
    };

    if (!list || list.length === 0) return null;

    return (
      <div className="py-3 px-2 -mx-2 mx-auto max-w-[680px]">
        <div className="flex items-center justify-between mb-2 px-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Suggested for you</h4>
          <button className="text-xs text-slate-500 hover:underline" onClick={() => setActiveTab('trending')}>See all</button>
        </div>

        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex space-x-3 overflow-x-auto scrollbar-hide px-2 "
        >
          {list.map((u) => (
            <div key={u.id} className="min-w-[140px] max-w-[180px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="cursor-pointer" onClick={() => openUserModal(u)}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>{u.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{u.display_name}</div>
                  <div className="text-xs text-slate-500 truncate">@{u.username}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-full text-xs"
                  onClick={() => handleFollow(u.id)}
                  disabled={!!loadingIds[u.id]}
                >
                  {loadingIds[u.id] ? '...' : 'Follow'}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => openUserModal(u)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPostsWithStrips = (postList: any[]) => {
    const items: JSX.Element[] = [];
    const POSTS_BETWEEN_STRIPS = 6;
    const filtered = filterPosts(postList);
    let stripCounter = 0;

    filtered.forEach((post, idx) => {
      const isFirst = idx === 0;
      const postElement = isFirst ? (
        <div key={post.id} ref={firstPostRef} data-first-post>
          <PostCard
            post={post}
            currentUser={currentUser}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
            onShare={sharePost}
            onComment={() => togglePostExpanded(post.id)}
            isExpanded={isPostExpanded(post.id)}
            comments={getPostComments(post.id)}
            isLoadingComments={isLoadingPostComments(post.id)}
            newComment={getNewCommentContent(post.id)}
            onCommentChange={(c) => updateNewComment(post.id, c)}
            onSubmitComment={() => addComment(post.id)}
            onPostView={trackPostView}
            onClick={() => navigate(`/social/post/${post.id}`)}
            onDeletePost={deletePost}
            onEditPost={editPost}
          />
        </div>
      ) : (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onLike={toggleLike}
          onBookmark={toggleBookmark}
          onShare={sharePost}
          onComment={() => togglePostExpanded(post.id)}
          isExpanded={isPostExpanded(post.id)}
          comments={getPostComments(post.id)}
          isLoadingComments={isLoadingPostComments(post.id)}
          newComment={getNewCommentContent(post.id)}
          onCommentChange={(c) => updateNewComment(post.id, c)}
          onSubmitComment={() => addComment(post.id)}
          onPostView={trackPostView}
          onClick={() => navigate(`/social/post/${post.id}`)}
          onDeletePost={deletePost}
          onEditPost={editPost}
        />
      );

      items.push(postElement);

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
          />
        );
        stripCounter++;
      }
    });

    return items;
  };

  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  if (routeGroupId) return <GroupDetailPage currentUser={currentUser} />;

  const postToDisplay = routePostId
    ? [...posts, ...trendingPosts, ...userPosts].find((post) => post.id === routePostId)
    : null;

  return (
    <div className="min-h-screen bg-transparent font-sans">

      <div className="max-w-[1440px] mx-auto px-0 sm:px-4 md:px-6">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 relative">

          {/* Left Sidebar like LinkedIn */}
          <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen pt-6 overflow-y-auto scrollbar-hide pr-8">
            <div className="space-y-6 w-full max-w-[350px]">
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={currentUser?.avatar_url} />
                      <AvatarFallback>{currentUser?.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg">{currentUser?.display_name}</h3>
                      <p className="text-sm text-slate-500">@{currentUser?.username}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-500">Followers</span>
                      <span className="font-medium">{currentUser?.followers_count || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-slate-500">Following</span>
                      <span className="font-medium">{currentUser?.following_count || 0}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setActiveTab('profile')}
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
              </div>

              {/* Additional sections if needed */}
              {/* For example, My Network or Saved Items */}
            </div>
          </div>

          <main className="col-span-1 lg:col-span-6 max-h-[95vh] overflow-y-auto scrollbar-hide lg:border-x border-slate-200 dark:border-slate-800 pb-20 lg:pb-0">
            <div ref={topRef} />

            {hasNewPosts && newPostsCount > 0 && (
              <div className="px-4 mb-4">
                <div className="max-w-[720px] mx-auto flex items-center justify-center">
                  <button
                    onClick={() => {
                      showNewPosts();
                      topRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-full shadow hover:shadow-md"
                  >
                    View {newPostsCount} new post{newPostsCount > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

            <div className="px-0 ">
              {routePostId && postToDisplay ? (
                <div className="mb-6">
                  <Button variant="ghost" onClick={() => navigate('/social/feed')} className="mb-2 pl-0 hover:pl-2">← Back</Button>
                  <PostCard
                    post={postToDisplay}
                    currentUser={currentUser}
                    onLike={toggleLike}
                    onBookmark={toggleBookmark}
                    onShare={sharePost}
                    onComment={() => togglePostExpanded(postToDisplay.id)}
                    isExpanded={true}
                    comments={getPostComments(postToDisplay.id)}
                    isLoadingComments={isLoadingPostComments(postToDisplay.id)}
                    newComment={getNewCommentContent(postToDisplay.id)}
                    onCommentChange={(c) => updateNewComment(postToDisplay.id, c)}
                    onSubmitComment={() => addComment(postToDisplay.id)}
                    onPostView={trackPostView}
                    onDeletePost={deletePost}
                    onEditPost={editPost}
                  />
                </div>
              ) : (
                <Tabs value={activeTab} className="space-y-6">
                  <TabsContent value="feed" className="outline-none space-y-5">
                    <CreatePostDialog
                      isOpen={showPostDialog}
                      onOpenChange={setShowPostDialog}
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

                    {isLoading && posts.length === 0 ? <LoadingSpinner /> : (
                      <>
                        {renderPostsWithStrips(posts)}
                        {hasMorePosts && <div ref={feedObserverRef} className="h-10" />}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="trending" className="outline-none space-y-5">
                    {isLoading && trendingPosts.length === 0 ? <LoadingSpinner /> : (
                      <>
                        {renderPostsWithStrips(trendingPosts)}
                        {hasMoreTrendingPosts && <div ref={trendingObserverRef} className="h-10" />}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="groups" className="outline-none">
                    <GroupsSection
                      groups={groups}
                      isLoading={isLoadingGroups}
                      onJoinGroup={joinGroup}
                      onLeaveGroup={leaveGroup}
                      onCreateGroup={createGroup}
                      currentUser={currentUser}
                      hasMore={hasMoreGroups}
                      onLoadMore={loadMoreGroups}
                      isLoadingMore={isLoadingMoreGroups}
                    />
                  </TabsContent>

                  <TabsContent value="profile" className="outline-none">
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
                      onSubmitComment={addComment}
                      currentUser={currentUser}
                      refetchPosts={refetchUserPosts}
                      onPostView={trackPostView}
                      onClick={(id) => navigate(`/social/post/${id}`)}
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
                    <div ref={profileObserverRef} className="h-10" />
                  </TabsContent>

                  <TabsContent value="notifications" className="outline-none">
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
          </main>
          <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen pt-6 overflow-y-auto scrollbar-hide pl-8">
            <div className="space-y-6 w-full max-w-[350px]">

              {/* Trending Widget */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" /> Trends for you
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trendingHashtags.slice(0, 5).map((tag, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                      <div className="text-xs text-slate-500 mb-1">Trending</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">#{tag.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{tag.count} posts</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center">
                  <Button variant="ghost" className="text-blue-600 text-sm w-full" onClick={() => setActiveTab('trending')}>Show more</Button>
                </div>
              </div>

              {/* Suggested Users Widget */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden sticky top-6 z-10">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg">Who to follow</h3>
                </div>
                <div className="p-4 space-y-4">
                  {uniqueSuggestedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-semibold text-sm truncate">{user.display_name}</p>
                          <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => followUser(user.id)} className="h-8 rounded-full px-3 text-xs">Follow</Button>
                    </div>
                  ))}
                  <div ref={suggestedObserverRef} className="h-6" />
                  {isLoadingSuggestedUsers && <div className="text-center text-sm text-slate-500 py-2">Loading more...</div>}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MOBILE BOTTOM NAV */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
          <div className="flex justify-around items-center h-16">
            <button onClick={() => setActiveTab('feed')} className={`p-2 rounded-full ${activeTab === 'feed' ? 'text-blue-600' : 'text-slate-500'}`}><Home className="h-6 w-6" /></button>
            <button onClick={() => setActiveTab('trending')} className={`p-2 rounded-full ${activeTab === 'trending' ? 'text-blue-600' : 'text-slate-500'}`}><Search className="h-6 w-6" /></button>
            <button onClick={() => setShowPostDialog(true)} className="p-3 bg-blue-600 rounded-full text-white shadow-lg -mt-6"><Plus className="h-6 w-6" /></button>
            <button onClick={() => setActiveTab('notifications')} className={`p-2 rounded-full relative ${activeTab === 'notifications' ? 'text-blue-600' : 'text-slate-500'}`}>
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />}
            </button>
            <button onClick={() => setActiveTab('profile')} className={`p-2 rounded-full ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-500'}`}><User className="h-6 w-6" /></button>
          </div>
        </div>

        {/* Floating Action Buttons: Refresh + Scroll-to-top */}

        <div className="fixed right-6 bottom-24 lg:bottom-8 z-50 flex flex-col items-center gap-3">
          <button
            onClick={handleRefresh}
            className="h-11 w-11 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-transform hover:scale-105 flex items-center justify-center border border-slate-100 dark:border-slate-800"
            aria-label="Refresh feed"
            title="Refresh"
          >
            <RefreshCw className={`${isRefreshing ? 'animate-spin' : ''} h-5 w-5 text-blue-600`} />
          </button>

          <button
            onClick={scrollToTop}
            className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:shadow-xl transition-transform hover:scale-110 flex items-center justify-center"
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>

      </div>

      {/* User profile modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="max-w-[780px] w-[95vw] p-0 bg-transparent border-none">
          {modalUser && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden">
              <UserProfile
                user={modalUser}
                isOwnProfile={currentUser?.id === modalUser.id}
                onEditProfile={updateProfile}
                posts={[]}
                isLoadingPosts={false}
                onLike={toggleLike}
                onBookmark={toggleBookmark}
                onShare={sharePost}
                onComment={togglePostExpanded}
                isPostExpanded={isPostExpanded}
                getPostComments={getPostComments}
                isLoadingPostComments={isLoadingPostComments}
                getNewCommentContent={getNewCommentContent}
                onCommentChange={updateNewComment}
                onSubmitComment={addComment}
                currentUser={currentUser}
                onPostView={trackPostView}
                onClick={(id: string) => { setIsUserModalOpen(false); navigate(`/social/post/${id}`); }}
                likedPosts={likedPosts}
                bookmarkedPosts={bookmarkedPosts}
                onRefreshLikedPosts={refetchLikedPosts}
                onRefreshBookmarkedPosts={refetchBookmarkedPosts}
                userGroups={groups.filter(g => g.is_member)}
                onFollow={(id: string) => followUser(id)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};