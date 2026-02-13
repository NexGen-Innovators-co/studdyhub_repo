import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Tabs, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Loader2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Hooks
import { useSocialActions } from './hooks/useSocialActions';
import { useSocialComments } from './hooks/useSocialComments';
import { useSocialNotifications } from './hooks/useSocialNotifications';
import { useSocialPostViews } from './hooks/useSocialPostViews';
import { useSocialData } from '../../hooks/useSocialData';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '../../services/globalSearchService';
import { useChatData } from './hooks/useChatData';
import { useChatActions } from './hooks/useChatActions';
import { useUserResources } from './hooks/useUserResources';

// Extracted feed components
import {
  SocialFeedLeftSidebar,
  SocialFeedRightSidebar,
  SocialFeedSearchBar,
  FeedTabContent,
  TrendingTabContent,
  FloatingActionButtons,
  ChatPanel,
  SocialFeedDialogs,
  adaptNotifications,
  getNotificationTitle,
  getNotificationMessage,
} from './components/feed';

// Other existing components
import { PostCard } from './components/PostCard';
import { UserProfile } from './components/UserProfile';
import { GroupsSection } from './components/GroupsSection';
import { NotificationsSection } from './components/NotificationsSection';
import { GroupDetailPage } from './components/GroupDetail';
import { OtherUserProfile } from './components/OtherUserProfile';

// Types
import { SortBy, FilterBy, Privacy } from './types/social';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { supabase } from '@/integrations/supabase/client';

interface SocialFeedProps {
  activeTab?: string;
  postId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export interface SocialFeedHandle {
  openCreatePostDialog: (options: { content: string; coverUrl?: string; metadata?: any }) => void;
}

export const SocialFeed = forwardRef<SocialFeedHandle, SocialFeedProps>(
  ({ activeTab: initialActiveTab, postId, searchQuery: externalSearchQuery, onSearchChange }, ref) => {
    // ─── Core state ───────────────────────────────────────
    const isOnline = useOnlineStatus();
    const navigate = useNavigate();
    const location = useLocation();
    const { tab: routeTab, postId: routePostId, groupId: routeGroupId, userId: routeUserId } = useParams<{
      tab?: string; postId?: string; groupId?: string; userId?: string;
    }>();

    const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications' | 'userProfile'>(initialActiveTab as any || 'feed');
    const [internalSearch, setInternalSearch] = useState('');
    const [showPostDialog, setShowPostDialog] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewedUserId, setViewedUserId] = useState<string | null>(null);

    const effectiveSearch = externalSearchQuery ?? internalSearch;

    // ─── User ID ──────────────────────────────────────────
    useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
    }, []);

    // ─── Global search ────────────────────────────────────
    const { search, results: searchResults, isSearching } = useGlobalSearch(SEARCH_CONFIGS.posts, userId, { debounceMs: 500 });

    const handleSearchChange = useCallback((value: string) => {
      setInternalSearch(value);
      if (!value.trim()) {
        setHasSearched(false);
      } else {
        setHasSearched(true);
        search(value);
      }
      onSearchChange?.(value);
    }, [search, onSearchChange]);

    // ─── Scroll & refresh state ───────────────────────────
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isScrolledDeep, setIsScrolledDeep] = useState(false);

    // ─── Sort / filter / profile state ────────────────────
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [filterBy, setFilterBy] = useState<FilterBy>('all');
    const [userProfile, setUserProfile] = useState<any>(null);

    // ─── Post creation state ──────────────────────────────
    const [newPostContent, setNewPostContent] = useState('');
    const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [postMetadata, setPostMetadata] = useState<any>(null);
    const [moderationResult, setModerationResult] = useState<any>(null);
    const [showGuidelines, setShowGuidelines] = useState(false);

    // ─── Chat & sharing state ─────────────────────────────
    const [showChatList, setShowChatList] = useState(false);
    const [selectedChatSession, setSelectedChatSession] = useState<string | null>(null);
    const [showResourceSharingModal, setShowResourceSharingModal] = useState(false);
    const [showSharePostModal, setShowSharePostModal] = useState(false);
    const [postToShare, setPostToShare] = useState<SocialPostWithDetails | null>(null);

    // ─── Refs ─────────────────────────────────────────────
    const feedObserverRef = useRef<HTMLDivElement>(null);
    const trendingObserverRef = useRef<HTMLDivElement>(null);
    const profileObserverRef = useRef<HTMLDivElement>(null);
    const suggestedObserverRef = useRef<HTMLDivElement>(null);
    const suggestedContainerRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const firstPostRef = useRef<HTMLDivElement | null>(null);
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const suggestedStripScrollPositions = useRef<Map<string, number>>(new Map());
    const tabScrollPositions = useRef<Record<string, number>>({});

    // ─── Expose imperative handle ─────────────────────────
    useImperativeHandle(ref, () => ({
      openCreatePostDialog: async ({ content, coverUrl, metadata }) => {
        setNewPostContent(content);
        setSelectedPrivacy('public');
        setPostMetadata(metadata || null);
        if (coverUrl) {
          try {
            const response = await fetch(coverUrl);
            const blob = await response.blob();
            const fileName = coverUrl.split('/').pop() || 'cover.jpg';
            const file = new File([blob], fileName, { type: blob.type });
            setSelectedFiles([file]);
          } catch {
            setSelectedFiles([]);
          }
        } else {
          setSelectedFiles([]);
        }
        setShowPostDialog(true);
      },
    }), []);

    // ─── Scroll utilities ─────────────────────────────────
    const getScrollContainer = useCallback(() => {
      if (scrollContainerRef.current) return scrollContainerRef.current;
      const main = document.querySelector('main.overflow-y-auto');
      if (main instanceof HTMLElement) return main;
      return document.scrollingElement || document.documentElement;
    }, []);

    const findScrollParent = (el?: Element | null) => {
      let node = el as Element | null;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node;
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };

    // ─── User profile + resources ─────────────────────────
    useEffect(() => {
      const fetchUserProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserProfile({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || '',
          });
        }
      };
      fetchUserProfile();
    }, []);

    // User resources hook (replaces direct DB calls)
    const { userNotes, userDocuments, userClassRecordings } = useUserResources(userId);

    // ─── Data hooks ───────────────────────────────────────
    const {
      posts, trendingPosts, userPosts, groups, currentUser,
      trendingHashtags, suggestedUsers,
      isLoading, isLoadingGroups, isLoadingUserPosts, isLoadingMorePosts,
      hasMorePosts, hasMoreTrendingPosts, hasMoreUserPosts, hasMoreGroups,
      refetchPosts, refetchTrendingPosts, refetchGroups, refetchUserPosts, refetchCurrentUser,
      loadMorePosts, loadMoreTrendingPosts, loadMoreUserPosts, loadMoreGroups, isLoadingMoreGroups,
      likedPosts, bookmarkedPosts, isLoadingLikedPosts, isLoadingBookmarkedPosts,
      refetchLikedPosts, refetchBookmarkedPosts,
      newPostsCount, hasNewPosts, showNewPosts, clearNewPosts,
      isLoadingSuggestedUsers, hasMoreSuggestedUsers, loadMoreSuggestedUsers,
      forceRefresh,
      setPosts, setTrendingPosts, setUserPosts, setGroups, setSuggestedUsers, setCurrentUser,
    } = useSocialData(userProfile, sortBy, filterBy);

    const {
      chatSessions, activeSessionMessages,
      isLoadingSessions: isLoadingChatSessions,
      isLoadingMessages: isLoadingChatMessages,
      activeSessionId: activeChatSessionId,
      setActiveSession, refetchSessions: refetchChatSessions,
      editMessage, deleteMessage, addOptimisticMessage,
    } = useChatData(currentUser?.id || null);

    const {
      createP2PChatSession, sendChatMessage, sendMessageWithResource,
      isSending: isSendingMessage, isCreatingSession,
    } = useChatActions(currentUser?.id || null);

    const {
      createPost, updateProfile, toggleLike, toggleBookmark, sharePost, toggleFollow,
      isUploading, createGroup, joinGroup, leaveGroup, deletePost, editPost,
    } = useSocialActions(currentUser, posts, setPosts, setSuggestedUsers, groups, setGroups, setTrendingPosts, setUserPosts, setCurrentUser, refetchCurrentUser);

    const {
      addComment, updateNewComment, togglePostExpanded, isPostExpanded,
      getPostComments, isLoadingPostComments, isAddingComment, getNewCommentContent,
    } = useSocialComments(currentUser, posts);

    const {
      notifications, unreadCount, isLoading: isLoadingNotifications,
      fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead,
      deleteNotification, groupedNotifications, hasMore, isLoadingMore,
    } = useSocialNotifications();

    const { trackPostView, cleanup } = useSocialPostViews(setPosts, setTrendingPosts, setUserPosts);
    const { canPostSocials, canChat, canCreateGroups } = useFeatureAccess();
    const canCreatePosts = useMemo(() => canPostSocials(), [canPostSocials]);
    const canStartChats = useMemo(() => canChat(), [canChat]);
    const canCreateNewGroups = useMemo(() => canCreateGroups(), [canCreateGroups]);

    // ─── Derived data ─────────────────────────────────────
    const uniqueSuggestedUsers = useMemo(() => {
      const map = new Map<string, any>();
      for (const u of suggestedUsers || []) {
        if (!map.has(u.id)) map.set(u.id, u);
      }
      return Array.from(map.values());
    }, [suggestedUsers]);

    const totalUnread = useMemo(
      () => chatSessions.reduce((sum, s) => sum + (s.unread_count || 0), 0),
      [chatSessions],
    );

    // ─── Filtering ────────────────────────────────────────
    const filterPosts = useCallback((postList: any[]) => {
      if (!effectiveSearch.trim()) return postList;
      const s = effectiveSearch.toLowerCase();
      return postList.filter(p =>
        p.content?.toLowerCase().includes(s) ||
        p.author?.display_name?.toLowerCase().includes(s) ||
        p.author?.username?.toLowerCase().includes(s),
      );
    }, [effectiveSearch]);

    const filteredGroups = useMemo(() => {
      if (!effectiveSearch.trim()) return groups;
      const s = effectiveSearch.toLowerCase();
      return groups.filter(g => g.name?.toLowerCase().includes(s) || g.description?.toLowerCase().includes(s));
    }, [groups, effectiveSearch]);

    const filteredUsers = useMemo(() => {
      if (!effectiveSearch.trim()) return [];
      const s = effectiveSearch.toLowerCase();
      return uniqueSuggestedUsers.filter(u =>
        u.display_name?.toLowerCase().includes(s) || u.username?.toLowerCase().includes(s) ||
        u.bio?.toLowerCase().includes(s) || u.interests?.some((i: string) => i.toLowerCase().includes(s)),
      );
    }, [uniqueSuggestedUsers, effectiveSearch]);

    const filteredUserPosts = useMemo(() => filterPosts(userPosts), [userPosts, filterPosts]);

    const filteredNotifications = useMemo(() => {
      if (!effectiveSearch.trim()) return notifications;
      const s = effectiveSearch.toLowerCase();
      return notifications.filter(n => {
        const title = getNotificationTitle(n).toLowerCase();
        const message = getNotificationMessage(n).toLowerCase();
        const actor = n.actor?.display_name?.toLowerCase() || '';
        const postContent = n.post?.content?.toLowerCase() || '';
        return title.includes(s) || message.includes(s) || actor.includes(s) || postContent.includes(s);
      });
    }, [notifications, effectiveSearch]);

    const searchPlaceholder = useMemo(() => {
      switch (activeTab) {
        case 'trending': return 'Search trending posts or authors';
        case 'groups': return 'Search groups by name or tag';
        case 'profile': return 'Search your posts';
        case 'notifications': return 'Search notifications';
        default: return 'Search posts, people, or tags';
      }
    }, [activeTab]);

    // ─── Scroll management ────────────────────────────────
    const saveCurrentScroll = useCallback(() => {
      if (!activeTab) return;
      const container = getScrollContainer();
      if (container) tabScrollPositions.current[activeTab] = container.scrollTop;
    }, [activeTab, getScrollContainer]);

    useLayoutEffect(() => {
      const container = getScrollContainer();
      const saved = tabScrollPositions.current[activeTab] || 0;
      if (container && saved > 0) container.scrollTop = saved;
    }, [activeTab, getScrollContainer]);

    useEffect(() => {
      const container = getScrollContainer();
      if (!container) return;
      const handleScroll = () => {
        const scrollTop = container.scrollTop;
        setIsScrolled(scrollTop > 800);
        setIsScrolledDeep(scrollTop > 1200);
      };
      handleScroll();
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [getScrollContainer]);

    const handleTabChange = useCallback((newTab: typeof activeTab) => {
      saveCurrentScroll();
      setActiveTab(newTab);
    }, [saveCurrentScroll]);

    const scrollToTop = useCallback(() => {
      const container = scrollContainerRef.current ?? findScrollParent(topRef.current);
      if (!container || container === document.scrollingElement || container === document.documentElement || container === document.body) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = container as HTMLElement;
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
      else el.scrollTop = 0;
    }, []);

    // ─── Event handlers ───────────────────────────────────
    const handleRefresh = useCallback(async () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      setError(null);
      try {
        await forceRefresh();
        await fetchNotifications();
      } catch {
        setError('Failed to refresh data');
      } finally {
        setIsRefreshing(false);
      }
    }, [isRefreshing, forceRefresh, fetchNotifications]);

    const handleCreatePost = useCallback(async () => {
      const result = await createPost(newPostContent, selectedPrivacy, selectedFiles, undefined, postMetadata);
      if (typeof result === 'object' && result.moderation && !result.moderation.approved) {
        setModerationResult(result.moderation);
        setShowPostDialog(false);
        toast.error('Content needs improvement', {
          description: 'Your post doesn\'t meet our educational guidelines. Please review the feedback below.',
          duration: 6000,
        });
        return;
      }
      if (result === true) {
        setNewPostContent('');
        setSelectedFiles([]);
        setPostMetadata(null);
        setShowPostDialog(false);
        setModerationResult(null);
        toast.success('Post published successfully! 🎉');
      }
    }, [createPost, newPostContent, selectedPrivacy, selectedFiles, postMetadata]);

    const handleStartChat = useCallback(async (userId: string) => {
      const sessionId = await createP2PChatSession(userId);
      if (sessionId) {
        try {
          await refetchChatSessions();
          setSelectedChatSession(sessionId);
          setShowChatList(true);
          await setActiveSession(sessionId);
        } catch { }
      }
    }, [createP2PChatSession, refetchChatSessions, setActiveSession]);

    const handleSharePostToChat = useCallback((post: SocialPostWithDetails) => {
      setPostToShare(post);
      setShowSharePostModal(true);
    }, []);

    const handleSharePostMessage = useCallback(async (sessionId: string, message: string): Promise<boolean> => {
      if (!postToShare) return false;
      const result = await sendMessageWithResource(sessionId, message, postToShare.id, 'post');
      sharePost(postToShare);
      if (result && addOptimisticMessage) addOptimisticMessage(result);
      if (result) setPostToShare(null);
      return !!result;
    }, [postToShare, sendMessageWithResource, sharePost, addOptimisticMessage]);

    const handleShareResource = useCallback(async (resourceId: string, resourceType: 'note' | 'document' | 'class_recording', message?: string): Promise<boolean> => {
      if (!activeChatSessionId) { toast.error('No active chat session to share resource to.'); return false; }
      const result = await sendMessageWithResource(activeChatSessionId, message || '', resourceId, resourceType);
      if (result && addOptimisticMessage) addOptimisticMessage(result);
      return !!result;
    }, [activeChatSessionId, sendMessageWithResource, addOptimisticMessage]);

    const handleChatSendMessage = useCallback(async (content: string, files?: File[]): Promise<boolean> => {
      if (!activeChatSessionId) return false;
      const result = await sendChatMessage(activeChatSessionId, content, files);
      if (result && addOptimisticMessage) addOptimisticMessage(result);
      return !!result;
    }, [activeChatSessionId, sendChatMessage, addOptimisticMessage]);

    const handleChatSendMessageWithResource = useCallback(async (content: string, resourceId: string, resourceType: 'note' | 'document' | 'post' | 'class_recording'): Promise<boolean> => {
      if (!activeChatSessionId) return false;
      const result = await sendMessageWithResource(activeChatSessionId, content, resourceId, resourceType);
      if (result && addOptimisticMessage) addOptimisticMessage(result);
      return !!result;
    }, [activeChatSessionId, sendMessageWithResource, addOptimisticMessage]);

    const handleSubmitComment = useCallback(async (postId: string) => {
      const success = await addComment(postId);
      if (success) {
        const updatePost = (p: SocialPostWithDetails) =>
          p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p;
        setPosts(prev => prev.map(updatePost));
        setTrendingPosts(prev => prev.map(updatePost));
        setUserPosts(prev => prev.map(updatePost));
      }
    }, [addComment, setPosts, setTrendingPosts, setUserPosts]);

    const onSeeAllSuggested = useCallback(() => {
      setActiveTab('profile');
      setTimeout(() => {
        const suggestionsTab = document.querySelector('[data-value="suggestions"]');
        if (suggestionsTab) (suggestionsTab as HTMLElement).click();
      }, 0);
    }, []);

    // ─── URL sync effects ──────────────────────────────────
    useEffect(() => {
      const params = new URLSearchParams(location.search);
      const q = params.get('search') || '';
      if (q !== effectiveSearch) handleSearchChange(q);
      if (params.get('openCreate') === 'true') {
        setShowPostDialog(true);
        params.delete('openCreate');
        const newSearch = params.toString();
        navigate({ pathname: location.pathname, search: newSearch ? `?${newSearch}` : '' }, { replace: true });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    useEffect(() => {
      if (routeUserId) {
        if (routeUserId === currentUser?.id) {
          handleTabChange('profile');
          setViewedUserId(null);
          if (location.pathname !== '/social/profile') navigate('/social/profile', { replace: true });
        } else {
          handleTabChange('userProfile');
          setViewedUserId(routeUserId);
        }
      } else if (routeTab) {
        handleTabChange(routeTab as any);
        setViewedUserId(null);
      } else if (initialActiveTab) {
        handleTabChange(initialActiveTab as any);
        setViewedUserId(null);
      } else {
        handleTabChange('feed');
        setViewedUserId(null);
      }
    }, [routeTab, routeUserId, initialActiveTab, currentUser?.id, location.pathname, navigate]);

    useEffect(() => {
      if (routeUserId) return;
      if (routeTab) handleTabChange(routeTab as any);
      else if (initialActiveTab) handleTabChange(initialActiveTab as any);
    }, [routeTab, initialActiveTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Infinite scroll observers ────────────────────────
    // Use refs to avoid stale closures in IntersectionObserver callbacks
    const hasMorePostsRef = useRef(hasMorePosts);
    const hasMoreTrendingRef = useRef(hasMoreTrendingPosts);
    const hasMoreUserPostsRef = useRef(hasMoreUserPosts);
    const hasMoreSuggestedRef = useRef(hasMoreSuggestedUsers);
    const isLoadingMorePostsRef = useRef(isLoadingMorePosts);
    const isLoadingUserPostsRef = useRef(isLoadingUserPosts);
    const isLoadingSuggestedRef = useRef(isLoadingSuggestedUsers);
    const isRefreshingRef = useRef(isRefreshing);
    const loadMorePostsRef = useRef(loadMorePosts);
    const loadMoreTrendingRef = useRef(loadMoreTrendingPosts);
    const loadMoreUserPostsRef = useRef(loadMoreUserPosts);
    const loadMoreSuggestedRef = useRef(loadMoreSuggestedUsers);

    // Keep refs in sync
    hasMorePostsRef.current = hasMorePosts;
    hasMoreTrendingRef.current = hasMoreTrendingPosts;
    hasMoreUserPostsRef.current = hasMoreUserPosts;
    hasMoreSuggestedRef.current = hasMoreSuggestedUsers;
    isLoadingMorePostsRef.current = isLoadingMorePosts;
    isLoadingUserPostsRef.current = isLoadingUserPosts;
    isLoadingSuggestedRef.current = isLoadingSuggestedUsers;
    isRefreshingRef.current = isRefreshing;
    loadMorePostsRef.current = loadMorePosts;
    loadMoreTrendingRef.current = loadMoreTrendingPosts;
    loadMoreUserPostsRef.current = loadMoreUserPosts;
    loadMoreSuggestedRef.current = loadMoreSuggestedUsers;

    useEffect(() => {
      if (isLoading || isRefreshing) return;
      const observers: IntersectionObserver[] = [];

      const createObserver = (
        ref: React.RefObject<HTMLDivElement>,
        hasMoreRef: React.MutableRefObject<boolean>,
        isLoadingMoreRef: React.MutableRefObject<boolean>,
        loadMoreRef: React.MutableRefObject<() => void>,
        root: HTMLElement | null = null,
      ) => {
        if (!ref.current) return null;

        const tryLoad = () => {
          if (hasMoreRef.current && !isLoadingMoreRef.current && !isRefreshingRef.current) {
            loadMoreRef.current();
          }
        };

        const observer = new IntersectionObserver(
          (entries) => entries.forEach(entry => {
            if (entry.isIntersecting) tryLoad();
          }),
          { threshold: [0, 0.1], rootMargin: '400px', root },
        );
        observer.observe(ref.current);

        // Immediately check if sentinel is already visible (handles the case
        // where the observer is recreated while the sentinel is already in view)
        requestAnimationFrame(() => {
          if (!ref.current) return;
          const rect = ref.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
          if (rect.top < viewportHeight + 400) {
            tryLoad();
          }
        });

        return observer;
      };

      switch (activeTab) {
        case 'feed': {
          const o = createObserver(feedObserverRef, hasMorePostsRef, isLoadingMorePostsRef, loadMorePostsRef);
          if (o) observers.push(o); break;
        }
        case 'trending': {
          const o = createObserver(trendingObserverRef, hasMoreTrendingRef, isLoadingMorePostsRef, loadMoreTrendingRef);
          if (o) observers.push(o); break;
        }
        case 'profile': {
          const o = createObserver(profileObserverRef, hasMoreUserPostsRef, isLoadingUserPostsRef, loadMoreUserPostsRef);
          if (o) observers.push(o);
          if (uniqueSuggestedUsers.length > 0 && suggestedObserverRef.current) {
            const s = createObserver(suggestedObserverRef, hasMoreSuggestedRef, isLoadingSuggestedRef, loadMoreSuggestedRef, suggestedContainerRef.current);
            if (s) observers.push(s);
          }
          break;
        }
      }

      return () => observers.forEach(o => o.disconnect());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isLoading, isRefreshing]);

    // Backup scroll-based load more
    useEffect(() => {
      const container = getScrollContainer();
      if (!container || isLoading || isRefreshing) return;
      let scrollTimeout: NodeJS.Timeout;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container as any;
        if ((scrollTop + clientHeight) / scrollHeight > 0.85) {
          switch (activeTab) {
            case 'feed': if (hasMorePostsRef.current && !isLoadingMorePostsRef.current) loadMorePostsRef.current(); break;
            case 'trending': if (hasMoreTrendingRef.current && !isLoadingMorePostsRef.current) loadMoreTrendingRef.current(); break;
            case 'profile': if (hasMoreUserPostsRef.current && !isLoadingUserPostsRef.current) loadMoreUserPostsRef.current(); break;
          }
        }
      };

      const debouncedScroll = () => { clearTimeout(scrollTimeout); scrollTimeout = setTimeout(handleScroll, 100); };
      container.addEventListener('scroll', debouncedScroll);
      return () => { clearTimeout(scrollTimeout); container.removeEventListener('scroll', debouncedScroll); };
    }, [activeTab, isLoading, isRefreshing, getScrollContainer]);

    // ─── Route-level early returns ────────────────────────
    if (routeGroupId) return <GroupDetailPage currentUser={currentUser} />;

    const postToDisplay = routePostId
      ? [...posts, ...trendingPosts, ...userPosts].find((p) => p.id === routePostId)
      : null;

    // ─── Render ───────────────────────────────────────────
    return (
      <div className="bg-transparent font-sans">
        {/* Network error */}
        {!isOnline && (
          <div className="mx-4 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-yellow-800 text-sm">You're offline. Please check your internet connection.</span>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="text-yellow-800 border-yellow-300 hover:bg-yellow-100" disabled={!isOnline}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && isOnline && (
          <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-red-800 text-sm">{error}</div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-800 hover:bg-red-100">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="max-w-[1240px] mx-auto px-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 relative max-h-screen overflow-y-auto modern-scrollbar">

            {/* Left Sidebar */}
            <SocialFeedLeftSidebar
              currentUser={currentUser}
              onViewProfile={() => handleTabChange('profile')}
            />

            {/* Main Content */}
            <main ref={scrollContainerRef} className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar pb-20 lg:pb-20">
              <div />
              <SocialFeedSearchBar value={effectiveSearch} onChange={handleSearchChange} placeholder={searchPlaceholder} />

              {/* New posts banner */}
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

              <div className="pb-10 p-0 space-y-6" ref={topRef}>
                {/* Single post view */}
                {routePostId && !postToDisplay ? (
                  <div className="mb-6 flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p className="text-sm text-slate-500">Loading post...</p>
                    </div>
                  </div>
                ) : routePostId && postToDisplay ? (
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
                  <Tabs value={activeTab} className="space-y-1">
                    <TabsContent value="feed" className="outline-none space-y-1 lg:space-y-4">
                      <FeedTabContent
                        posts={posts}
                        isLoading={isLoading}
                        isLoadingMorePosts={isLoadingMorePosts}
                        feedObserverRef={feedObserverRef}
                        firstPostRef={firstPostRef}
                        currentUser={currentUser}
                        onLike={toggleLike}
                        onBookmark={toggleBookmark}
                        onShare={sharePost}
                        onShareToChat={handleSharePostToChat}
                        onDeletePost={deletePost}
                        onEditPost={editPost}
                        onPostView={trackPostView}
                        onComment={togglePostExpanded}
                        isPostExpanded={isPostExpanded}
                        getPostComments={getPostComments}
                        isLoadingPostComments={isLoadingPostComments}
                        getNewCommentContent={getNewCommentContent}
                        onCommentChange={updateNewComment}
                        isAddingComment={isAddingComment}
                        onSubmitComment={handleSubmitComment}
                        effectiveSearch={effectiveSearch}
                        filterPosts={filterPosts}
                        uniqueSuggestedUsers={uniqueSuggestedUsers}
                        hasMoreSuggestedUsers={hasMoreSuggestedUsers}
                        isLoadingSuggestedUsers={isLoadingSuggestedUsers}
                        loadMoreSuggestedUsers={loadMoreSuggestedUsers}
                        suggestedStripScrollPositions={suggestedStripScrollPositions}
                        onToggleFollow={toggleFollow}
                        onSeeAllSuggested={onSeeAllSuggested}
                        filteredUsers={filteredUsers}
                        moderationResult={moderationResult}
                        onReviseModeration={() => { setModerationResult(null); setShowPostDialog(true); }}
                        showGuidelines={showGuidelines}
                        onToggleGuidelines={() => setShowGuidelines(!showGuidelines)}
                        onShowPostDialog={() => setShowPostDialog(true)}
                        onForceRefresh={forceRefresh}
                        setPosts={setPosts}
                        setTrendingPosts={setTrendingPosts}
                        setUserPosts={setUserPosts}
                      />
                    </TabsContent>

                    <TabsContent value="trending" className="outline-none space-y-1 lg:space-y-4">
                      <TrendingTabContent
                        posts={trendingPosts}
                        isLoading={isLoading}
                        isLoadingMorePosts={isLoadingMorePosts}
                        trendingObserverRef={trendingObserverRef}
                        currentUser={currentUser}
                        onLike={toggleLike}
                        onBookmark={toggleBookmark}
                        onShare={sharePost}
                        onShareToChat={handleSharePostToChat}
                        onDeletePost={deletePost}
                        onEditPost={editPost}
                        onPostView={trackPostView}
                        onComment={togglePostExpanded}
                        isPostExpanded={isPostExpanded}
                        getPostComments={getPostComments}
                        isLoadingPostComments={isLoadingPostComments}
                        getNewCommentContent={getNewCommentContent}
                        onCommentChange={updateNewComment}
                        isAddingComment={isAddingComment}
                        onSubmitComment={handleSubmitComment}
                        uniqueSuggestedUsers={uniqueSuggestedUsers}
                        hasMoreSuggestedUsers={hasMoreSuggestedUsers}
                        isLoadingSuggestedUsers={isLoadingSuggestedUsers}
                        loadMoreSuggestedUsers={loadMoreSuggestedUsers}
                        suggestedStripScrollPositions={suggestedStripScrollPositions}
                        onToggleFollow={toggleFollow}
                        onSeeAllSuggested={onSeeAllSuggested}
                        filterPosts={filterPosts}
                        onShowPostDialog={() => setShowPostDialog(true)}
                        onForceRefresh={forceRefresh}
                      />
                    </TabsContent>

                    <TabsContent value="groups" className="outline-none">
                      <GroupsSection
                        groups={filteredGroups}
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
                        posts={filteredUserPosts}
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
                        isAddingComment={isAddingComment}
                        onSubmitComment={handleSubmitComment}
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
                        searchQuery={effectiveSearch}
                      />
                      <div ref={profileObserverRef} className="h-10" />
                      {isLoadingMorePosts && (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          <p className="text-sm text-slate-500 mt-2">Loading posts...</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="notifications" className="animate-in fade-in duration-500 lg:bottom-24 bg-white dark:bg-slate-900 overflow-hidden flex">
                      <NotificationsSection
                        notifications={adaptNotifications(filteredNotifications)}
                        unreadCount={unreadCount}
                        markNotificationAsRead={markNotificationAsRead}
                        markAllNotificationsAsRead={markAllNotificationsAsRead}
                        deleteNotification={deleteNotification}
                        hasMore={hasMore}
                        isLoading={isLoadingMore}
                        fetchNotifications={fetchNotifications}
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
                          isAddingComment={isAddingComment}
                          onSubmitComment={handleSubmitComment}
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
                          searchQuery={effectiveSearch}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </main>

            {/* Right Sidebar */}
            <SocialFeedRightSidebar
              activeTab={activeTab}
              currentUser={currentUser}
              groups={groups}
              notifications={notifications}
              uniqueSuggestedUsers={uniqueSuggestedUsers}
              hasMoreSuggestedUsers={hasMoreSuggestedUsers}
              isLoadingSuggestedUsers={isLoadingSuggestedUsers}
              suggestedContainerRef={suggestedContainerRef}
              suggestedObserverRef={suggestedObserverRef}
              canCreatePosts={canCreatePosts}
              canCreateNewGroups={canCreateNewGroups}
              onToggleFollow={toggleFollow}
              onShowPostDialog={() => setShowPostDialog(true)}
            />
          </div>

          {/* Floating Action Buttons */}
          <FloatingActionButtons
            isScrolled={isScrolled}
            isScrolledDeep={isScrolledDeep}
            isRefreshing={isRefreshing}
            isLoading={isLoading}
            hasNewPosts={hasNewPosts}
            newPostsCount={newPostsCount}
            totalUnread={totalUnread}
            showChatList={showChatList}
            onRefresh={handleRefresh}
            onScrollToTop={scrollToTop}
            onShowNewPosts={showNewPosts}
            onToggleChatList={() => setShowChatList(prev => !prev)}
          />
        </div>

        {/* Chat Panel */}
        <ChatPanel
          isOpen={showChatList}
          chatSessions={chatSessions}
          activeSessionId={activeChatSessionId}
          activeSessionMessages={activeSessionMessages}
          currentUserId={currentUser?.id || ''}
          isLoadingSessions={isLoadingChatSessions}
          isLoadingMessages={isLoadingChatMessages}
          isSending={isSendingMessage}
          onClose={() => setShowChatList(false)}
          onSessionSelect={(id) => {
            if (id) setActiveSession(id);
            else { setActiveSession(null); setShowChatList(true); }
          }}
          onSendMessage={handleChatSendMessage}
          onSendMessageWithResource={handleChatSendMessageWithResource}
          editMessage={editMessage}
          deleteMessage={deleteMessage}
        />

        {/* Dialogs */}
        <SocialFeedDialogs
          showPostDialog={showPostDialog}
          onShowPostDialogChange={setShowPostDialog}
          newPostContent={newPostContent}
          onContentChange={setNewPostContent}
          selectedPrivacy={selectedPrivacy}
          onPrivacyChange={setSelectedPrivacy}
          selectedFiles={selectedFiles}
          onFilesChange={setSelectedFiles}
          onSubmitPost={handleCreatePost}
          isUploading={isUploading}
          currentUser={currentUser}
          postMetadata={postMetadata}
          canCreatePosts={canCreatePosts}
          showResourceSharingModal={showResourceSharingModal}
          onCloseResourceSharing={() => setShowResourceSharingModal(false)}
          onShareResource={handleShareResource}
          userNotes={userNotes}
          userDocuments={userDocuments}
          userClassRecordings={userClassRecordings}
          isSendingMessage={isSendingMessage}
          activeChatSessionId={activeChatSessionId}
          showSharePostModal={showSharePostModal}
          onCloseSharePost={() => { setShowSharePostModal(false); setPostToShare(null); }}
          postToShare={postToShare}
          chatSessions={chatSessions}
          currentUserId={currentUser?.id || ''}
          onSharePostMessage={handleSharePostMessage}
        />
      </div>
    );
  },
);
