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
  Search, RefreshCw, Bell, TrendingUp, Users, User, Home, Loader2, X, Plus, Sparkles, Settings, LogOut, ArrowUp, ExternalLink,
  MessageCircle
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { useChatData } from './hooks/useChatData';
import { useChatActions } from './hooks/useChatActions';
import { ResourceSharingModal } from './components/ResourceSharingModal';
import { SharePostToChatModal } from './components/SharePostToChatModal';

// Import types
import { SortBy, FilterBy, Privacy } from './types/social';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { OtherUserProfile } from './components/OtherUserProfile';

interface SocialFeedProps {
  activeTab?: string;
  postId?: string;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({ activeTab: initialActiveTab, postId }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications' | 'userProfile'>(initialActiveTab as any || 'feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPostDialog, setShowPostDialog] = useState(false);

  // IMPROVED Pull-to-refresh & scroll-to-top states
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);


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

  const suggestedStripScrollPositions = useRef<Map<string, number>>(new Map());
  const [showChatList, setShowChatList] = useState(false);
  const [selectedChatSession, setSelectedChatSession] = useState<string | null>(null);
  const [showResourceSharingModal, setShowResourceSharingModal] = useState(false);
  const [showSharePostModal, setShowSharePostModal] = useState(false);
  const [postToShare, setPostToShare] = useState<SocialPostWithDetails | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const handleSharePostToChat = (post: SocialPostWithDetails) => {
    setPostToShare(post);
    setShowSharePostModal(true);
  };

  const handleSharePostMessage = async (sessionId: string, message: string): Promise<boolean> => {
    if (!postToShare) return false;
    const success = await sendMessageWithResource(sessionId, message, postToShare.id, 'post');
    if (success) setPostToShare(null);
    return success;
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { tab: routeTab, postId: routePostId, groupId: routeGroupId, userId: routeUserId } = useParams<{
    tab?: string;
    postId?: string;
    groupId?: string;
    userId?: string;
  }>();
  const handleShareResource = async (resourceId: string, resourceType: 'note' | 'document'): Promise<boolean> => {
    if (!activeChatSessionId) {
      toast.error("No active chat session to share resource to.");
      return false;
    }
    return await sendMessageWithResource(activeChatSessionId, "", resourceId, resourceType);
  };

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
  } = useSocialDataContext();

  // CHAT: Add chat hooks after existing hooks
  const {
    chatSessions,
    activeSessionMessages,
    isLoadingSessions: isLoadingChatSessions,
    isLoadingMessages: isLoadingChatMessages,
    activeSessionId: activeChatSessionId,
    setActiveSession,
    refetchSessions: refetchChatSessions,
  } = useChatData(currentUser?.id || null);

  const {
    createP2PChatSession,
    sendChatMessage,
    sendMessageWithResource,
    isSending: isSendingMessage,
  } = useChatActions(currentUser?.id || null);

  const handleStartChat = async (userId: string) => {
    const sessionId = await createP2PChatSession(userId);
    if (sessionId) {
      setActiveSession(sessionId);
      setShowChatList(true);
      setSelectedChatSession(sessionId);
    }
  };
  const {
    createPost,
    updateProfile,
    toggleLike,
    toggleBookmark,
    sharePost,
    toggleFollow,
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
  }, [activeTab, hasMorePosts, hasMoreTrendingPosts, hasMoreUserPosts, isLoadingMorePosts, isLoadingUserPosts, hasMoreSuggestedUsers, isLoadingSuggestedUsers, loadMoreSuggestedUsers, isRefreshing, loadMorePosts, loadMoreTrendingPosts, loadMoreUserPosts]);
  // Replace the existing useEffect that sets activeTab from route
useEffect(() => {
  if (routeUserId) {
    if (routeUserId === currentUser?.id) {
      // Viewing own profile → go to normal profile tab
      setActiveTab('profile');
      setViewedUserId(null);
      if (location.pathname !== '/social/profile') {
        navigate('/social/profile', { replace: true });
      }
    } else {
      // Viewing someone else's profile → special tab
      setActiveTab('userProfile');
      setViewedUserId(routeUserId);
    }
  } else if (routeTab) {
    setActiveTab(routeTab as any);
    setViewedUserId(null);
  } else if (initialActiveTab) {
    setActiveTab(initialActiveTab as any);
    setViewedUserId(null);
  } else {
    setActiveTab('feed');
    setViewedUserId(null);
  }
}, [routeTab, routeUserId, initialActiveTab, currentUser?.id, location.pathname, navigate]);
  // Initialize activeTab from route on mount only
  useEffect(() => {
    if (routeUserId) {
      // Viewing a user profile - don't set activeTab to prevent conflicts
      return;
    }
    if (routeTab) {
      setActiveTab(routeTab as any);
    } else if (initialActiveTab) {
      setActiveTab(initialActiveTab as any);
    }
  }, [routeTab, initialActiveTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
        await toggleFollow(id);
        toast.success('Followed');
      } catch {
        toast.error('Failed to follow');
      } finally {
        setLoadingIds(prev => ({ ...prev, [id]: false }));
      }
    };

    // NEW: Navigate to user profile
    const handleViewProfile = (userId: string) => {
      navigate(`/social/profile/${userId}`);
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
          className="flex space-x-3 overflow-x-auto scrollbar-hide px-2"
        >
          {list.map((u) => (
            <div key={u.id} className="min-w-[140px] max-w-[180px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 flex-shrink-0">
              {/* CHANGED: Make avatar/name clickable to navigate */}
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleViewProfile(u.id)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback>{u.display_name?.[0]}</AvatarFallback>
                </Avatar>
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
                {/* CHANGED: Navigate instead of opening modal */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => handleViewProfile(u.id)}
                  title="View Profile"
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
            onShareToChat={handleSharePostToChat}
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
          onShareToChat={handleSharePostToChat}
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


  // BEFORE the return statement, handle profile routing:
  if (routeGroupId) return <GroupDetailPage currentUser={currentUser} />;

  const postToDisplay = routePostId
    ? [...posts, ...trendingPosts, ...userPosts].find((post) => post.id === routePostId)
    : null;

  return (
    <div className=" bg-transparent font-sans">

      <div className=" max-w-[1440px] mx-auto px-0 ">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 relative max-h-screen overflow-y-auto modern-scrollbar ">

          {/* Left Sidebar like LinkedIn */}
          <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen lg:pt-3 overflow-y-auto scrollbar-hide pr-8 modern-scrollbar">
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

            </div>
          </div>
          <main className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar pb-20 lg:pb-20">
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

            <div className="pb-10 p-2 ">
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
                      onFollow={toggleFollow}
                      onStartChat={handleStartChat}
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
                  <TabsContent value="userProfile" className="outline-none">
                    {viewedUserId && currentUser && viewedUserId !== currentUser.id && (
                      <OtherUserProfile
                        currentUser={currentUser}
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
                        onPostView={trackPostView}
                        onDeletePost={deletePost}
                        onEditPost={editPost}
                        onFollow={toggleFollow}
                        onStartChat={handleStartChat}
                        likedPosts={likedPosts}
                        bookmarkedPosts={bookmarkedPosts}
                        onRefreshLikedPosts={refetchLikedPosts}
                        onRefreshBookmarkedPosts={refetchBookmarkedPosts}
                        userGroups={groups.filter(g => g.is_member)}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </main>
          <div className="hidden lg:block lg:col-span-3 sticky top-0 lg:pb-20  lg:pt-3">
            <div className="space-y-6 w-full max-w-[350px] max-h-[90vh] rounded-2xl shadow-sm overflow-y-auto modern-scrollbar ">

              {/* Tab-Specific Widgets */}
              {activeTab === 'feed' && (
                <>
                  {/* Quick Actions Widget */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">Quick Actions</h3>
                      <div className="space-y-2">

                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white dark:bg-slate-800"
                          onClick={() => setShowPostDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Create Post
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white dark:bg-slate-800"
                          onClick={() => navigate('/social/groups')}
                        >
                          <Users className="h-4 w-4 mr-2" /> Browse Groups
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white dark:bg-slate-800"
                          onClick={() => {
                            navigate('/social/groups');
                            setTimeout(() => {
                              const event = new CustomEvent('triggerCreateGroup');
                              window.dispatchEvent(event);
                            }, 100);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Create Group
                        </Button>
                      </div>
                    </div>
                  </div>

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
                </>
              )}

              {activeTab === 'trending' && (
                <>
                  {/* Quick Actions Widget */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">Quick Actions</h3>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white dark:bg-slate-800"
                          onClick={() => navigate('/social/groups')}
                        >
                          <Users className="h-4 w-4 mr-2" /> Browse Groups
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white dark:bg-slate-800"
                          onClick={() => navigate('/social/feed')}
                        >
                          <Users className="h-4 w-4 mr-2" /> Browse Feeds
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Trending Stats Widget */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-purple-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-purple-900 dark:text-purple-100">
                        <TrendingUp className="h-5 w-5" /> Trending Now
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-purple-600">{trendingPosts.length}</div>
                          <div className="text-xs text-slate-500">Trending Posts</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-pink-600">{trendingHashtags.length}</div>
                          <div className="text-xs text-slate-500">Active Hashtags</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Hashtags Widget */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-lg">Top Hashtags</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {trendingHashtags.slice(0, 10).map((tag, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-slate-400">#{i + 1}</div>
                            <div>
                              <div className="font-semibold text-sm">#{tag.name}</div>
                              <div className="text-xs text-slate-500">{tag.count} posts</div>
                            </div>
                          </div>
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'groups' && (
                <>
                  {/* Group Stats Widget */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-green-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-green-900 dark:text-green-100">
                        <Users className="h-5 w-5" /> Your Groups
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-green-600">{groups.filter(g => g.is_member).length}</div>
                          <div className="text-xs text-slate-500">Joined Groups</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-emerald-600">{groups.length}</div>
                          <div className="text-xs text-slate-500">Total Groups</div>
                        </div>
                      </div>
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => {
                          setTimeout(() => {
                            const event = new CustomEvent('triggerCreateGroup');
                            window.dispatchEvent(event);
                          }, 100);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Create Group
                      </Button>
                    </div>
                  </div>

                  {/* Popular Groups Widget */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-lg">Popular Groups</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {groups.slice(0, 5).map((group) => (
                        <div key={group.id} className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={group.avatar_url} />
                            <AvatarFallback>{group.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{group.name}</div>
                            <div className="text-xs text-slate-500">{group.members_count} members</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab !== 'profile' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 sticky top-6 z-10">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg">Who to follow</h3>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-scroll max-h-[500px] modern-scrollbar">
                    {uniqueSuggestedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between gap-3">
                        {/* CHANGED: Make clickable to navigate */}
                        <div
                          className="flex items-center gap-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/social/profile/${user.id}`)}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="truncate">
                            <p className="font-semibold text-sm truncate">{user.display_name}</p>
                            <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent navigation when clicking follow
                            toggleFollow(user.id);
                          }}
                          className="h-8 rounded-full px-3 text-xs"
                        >
                          Follow
                        </Button>
                      </div>
                    ))}
                    <div ref={suggestedObserverRef} className="h-6" />
                    {isLoadingSuggestedUsers && <div className="text-center text-sm text-slate-500 py-2">Loading more...</div>}
                    {!hasMoreSuggestedUsers && uniqueSuggestedUsers.length > 10 && (
                      <div className="text-center text-xs text-slate-400 py-2">No more suggestions</div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'notifications' && (
                <>
                  {/* Notification Stats Widget */}
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-red-900 dark:text-red-100">
                        <Bell className="h-5 w-5" /> Notifications
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
                          <div className="text-xs text-slate-500">Unread</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-rose-600">{notifications.length}</div>
                          <div className="text-xs text-slate-500">Total</div>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <Button
                          variant="outline"
                          className="w-full mt-3"
                          size="sm"
                          onClick={markAllNotificationsAsRead}
                        >
                          Mark all as read
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Notification Types Widget */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-lg">Activity Types</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {['like', 'comment', 'follow', 'mention'].map((type) => {
                        const count = notifications.filter(n => n.type === type).length;
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <div className="text-sm capitalize">{type}s</div>
                            <div className="font-semibold">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
          <div className="flex justify-around items-center h-16">
            <button onClick={() => navigate('/social/feed')} className={`p-2 rounded-full ${activeTab === 'feed' ? 'text-blue-600' : 'text-slate-500'}`}><Home className="h-6 w-6" /></button>
            <button onClick={() => navigate('/social/trending')} className={`p-2 rounded-full ${activeTab === 'trending' ? 'text-blue-600' : 'text-slate-500'}`}><Search className="h-6 w-6" /></button>
            <button onClick={() => setShowPostDialog(true)} className="p-3 bg-blue-600 rounded-full text-white shadow-lg -mt-6"><Plus className="h-6 w-6" /></button>
            <button onClick={() => navigate('/social/notifications')} className={`p-2 rounded-full relative ${activeTab === 'notifications' ? 'text-blue-600' : 'text-slate-500'}`}>
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />}
            </button>
            <button onClick={() => navigate('/social/profile')} className={`p-2 rounded-full ${activeTab === 'profile' ? 'text-blue-600' : 'text-slate-500'}`}><User className="h-6 w-6" /></button>          </div>
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
          <button
            onClick={() => setShowChatList(!showChatList)}
            className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
            aria-label="Open chats"
            title="Messages"
          >
            <MessageCircle className="h-6 w-6" />
            {chatSessions.reduce((sum, s) => sum + (s.unread_count || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {chatSessions.reduce((sum, s) => sum + (s.unread_count || 0), 0)}
              </span>
            )}
          </button>
        </div>

      </div>
      {/* User profile modal */}

      {showChatList && (
        <div className="fixed inset-0 lg:inset-auto lg:right-6 animate-in fade-in duration-500 lg:bottom-24 lg:h-[600px] bg-white dark:bg-slate-900 z-50 lg:rounded-2xl lg:shadow-2xl overflow-hidden flex">
          {/* Mobile close button */}
          <button
            onClick={() => {
              setShowChatList(false);
              setActiveSession(null);
            }}
            className=" absolute top-4 right-4 z-10 p-2 bg-slate-100 dark:bg-slate-800 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Chat interface */}
          <div className="flex-1 flex ">
            {!activeChatSessionId ? (
              <ChatList
                sessions={chatSessions}
                activeSessionId={activeChatSessionId}
                onSessionSelect={setActiveSession}
                currentUserId={currentUser?.id || ''}
                isLoading={isLoadingChatSessions}
              />
            ) : (
              <ChatWindow
                session={chatSessions.find((s) => s.id === activeChatSessionId) || null}
                messages={activeSessionMessages}
                currentUserId={currentUser?.id || ''}
                onBack={() => setActiveSession(null)}
                onSendMessage={async (content, files) => {
                  if (!activeChatSessionId) return false;
                  return await sendChatMessage(activeChatSessionId, content, files);
                }}
                onSendMessageWithResource={async (content, resourceId, resourceType) => {
                  if (!activeChatSessionId) return false;
                  return await sendMessageWithResource(
                    activeChatSessionId,
                    content,
                    resourceId,
                    resourceType
                  );
                }}
                isSending={isSendingMessage}
                isLoading={isLoadingChatMessages}
              />
            )}
          </div>
        </div>
      )}

      {/* Resource Sharing Modal */}
      {activeChatSessionId && (
        <ResourceSharingModal
          isOpen={showResourceSharingModal}
          onClose={() => setShowResourceSharingModal(false)}
          onShareResource={handleShareResource}
          notes={[]} // Pass actual notes from parent
          documents={[]} // Pass actual documents from parent
          isSharing={isSendingMessage}
        />
      )}

      {/* Share Post to Chat Modal */}
      <SharePostToChatModal
        isOpen={showSharePostModal}
        onClose={() => {
          setShowSharePostModal(false);
          setPostToShare(null);
        }}
        post={postToShare}
        chatSessions={chatSessions}
        currentUserId={currentUser?.id || ''}
        onShare={handleSharePostMessage}
        isSharing={isSendingMessage}
      />
    </div>
  );
};