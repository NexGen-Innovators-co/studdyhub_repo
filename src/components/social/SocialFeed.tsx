import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, RefreshCw, Bell, TrendingUp, Users, User, Home, Loader2, X, Plus, Sparkles, Settings, LogOut, ArrowUp, ExternalLink,
  MessageCircle, Lock
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent } from '../ui/card';
import { toast } from 'sonner';

// Import hooks
import { useSocialActions } from './hooks/useSocialActions';
import { useSocialComments } from './hooks/useSocialComments';
import { SocialNotification, useSocialNotifications } from './hooks/useSocialNotifications';
import { useSocialPostViews } from './hooks/useSocialPostViews';
import { useSocialData } from '../../hooks/useSocialData';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';

// Import components
import { PostCard } from './components/PostCard';
import { CreatePostDialog } from './components/CreatePostDialog';
import { UserProfile } from './components/UserProfile';
import { GroupsSection } from './components/GroupsSection';
import { NotificationsSection, SocialNotificationItem } from './components/NotificationsSection';
import { GroupDetailPage } from './components/GroupDetail';
import { ContentModerationFeedback, ContentGuidelines } from './components/ContentModerationFeedback';


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
import { supabase } from '@/integrations/supabase/client';

interface SocialFeedProps {
  activeTab?: string;
  postId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

import { useImperativeHandle, forwardRef } from 'react';

export interface SocialFeedHandle {
  openCreatePostDialog: (options: { content: string; coverUrl?: string; metadata?: any }) => void;
}

export const SocialFeed = forwardRef<SocialFeedHandle, SocialFeedProps>(
  ({ activeTab: initialActiveTab, postId, searchQuery: externalSearchQuery, onSearchChange }, ref) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile' | 'notifications' | 'userProfile'>(initialActiveTab as any || 'feed');
  const [internalSearch, setInternalSearch] = useState('');
  const [showPostDialog, setShowPostDialog] = useState(false);

  const effectiveSearch = externalSearchQuery ?? internalSearch;

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    onSearchChange?.(value);
  };

  // IMPROVED Pull-to-refresh & scroll-to-top states
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);


  // Add these state variables near your other state declarations:
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [userProfile, setUserProfile] = useState<any>(null); // You might need to get this from auth

  // Add user profile effect


  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [postMetadata, setPostMetadata] = useState<any>(null);

  // Expose openCreatePostDialog to parent via ref
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
        } catch (e) {
          setSelectedFiles([]);
        }
      } else {
        setSelectedFiles([]);
      }
      setShowPostDialog(true);
    }
  }), []);

  // Refs
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
  const [showChatList, setShowChatList] = useState(false);
  const [selectedChatSession, setSelectedChatSession] = useState<string | null>(null);
  const [showResourceSharingModal, setShowResourceSharingModal] = useState(false);
  const [showSharePostModal, setShowSharePostModal] = useState(false);
  const [postToShare, setPostToShare] = useState<SocialPostWithDetails | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);        // > 800px
  const [isScrolledDeep, setIsScrolledDeep] = useState(false); // > 1200px
  
  // State for user resources
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [userClassRecordings, setUserClassRecordings] = useState<any[]>([]);

  // Add this helper once (outside component or inside but memoized)
  const getScrollContainer = useCallback(() => {
    if (scrollContainerRef.current) return scrollContainerRef.current;
    const main = document.querySelector('main.overflow-y-auto');
    if (main instanceof HTMLElement) return main;
    return document.scrollingElement || document.documentElement;
  }, []);
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserProfile({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url || ''
        });
        
        // Fetch user resources for sharing
        const [notesResult, documentsResult, recordingsResult] = await Promise.all([
          supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('class_recordings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        ]);
        
        if (notesResult.data) setUserNotes(notesResult.data);
        if (documentsResult.data) setUserDocuments(documentsResult.data);
        if (recordingsResult.data) setUserClassRecordings(recordingsResult.data);
      }
    };
    fetchUserProfile();
  }, []);
  // Save scroll position BEFORE changing tab
  const saveCurrentScroll = useCallback(() => {
    if (!activeTab) return;
    const container = getScrollContainer();
    if (container) {
      tabScrollPositions.current[activeTab] = container.scrollTop;
    }
  }, [activeTab, getScrollContainer]);

  // Restore scroll AFTER tab changes
  useLayoutEffect(() => {
    const container = getScrollContainer();
    const saved = tabScrollPositions.current[activeTab] || 0;
    if (container && saved > 0) {
      container.scrollTop = saved;
    }
  }, [activeTab, getScrollContainer]);

  // Track scroll for floating buttons (isScrolled, etc.)
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      setIsScrolled(scrollTop > 800);
      setIsScrolledDeep(scrollTop > 1200);
    };

    handleScroll(); // Initial check
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [getScrollContainer]);

  // Correct handleTabChange — NO RECURSION!
  const handleTabChange = useCallback((newTab: typeof activeTab) => {
    saveCurrentScroll(); // Save current tab scroll
    setActiveTab(newTab);
  }, [saveCurrentScroll]);

  const handleSharePostToChat = (post: SocialPostWithDetails) => {
    setPostToShare(post);
    setShowSharePostModal(true);
  };

  const handleSharePostMessage = async (sessionId: string, message: string): Promise<boolean> => {
    if (!postToShare) return false;
    const result = await sendMessageWithResource(sessionId, message, postToShare.id, 'post');
    sharePost(postToShare); // Increment share count
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    if (result) setPostToShare(null);
    return !!result;
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { tab: routeTab, postId: routePostId, groupId: routeGroupId, userId: routeUserId } = useParams<{
    tab?: string;
    postId?: string;
    groupId?: string;
    userId?: string;
  }>();
  const handleShareResource = async (resourceId: string, resourceType: 'note' | 'document' | 'class_recording', message?: string): Promise<boolean> => {
    if (!activeChatSessionId) {
      toast.error("No active chat session to share resource to.");
      return Promise.resolve(false);
    }
    sharePost(postToShare); // Increment share count
    const result = await sendMessageWithResource(activeChatSessionId, message || "", resourceId, resourceType);
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    return !!result;
  };
  const handleChatSendMessageWithResource = async (
    content: string,
    resourceId: string,
    resourceType: 'note' | 'document' | 'post' | 'class_recording'
  ): Promise<boolean> => {
    if (!activeChatSessionId) return false;
    const result = await sendMessageWithResource(activeChatSessionId, content, resourceId, resourceType);
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    return !!result;
  };
  const handleChatSendMessage = async (content: string, files?: File[]): Promise<boolean> => {
    if (!activeChatSessionId) return false;
    const result = await sendChatMessage(activeChatSessionId, content, files);
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    return !!result;
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
  const {
    posts,
    trendingPosts,
    userPosts,
    groups,
    currentUser,
    trendingHashtags,
    suggestedUsers,
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
    refetchCurrentUser,
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
    newPostsCount,
    hasNewPosts,
    showNewPosts,
    clearNewPosts,
    isLoadingSuggestedUsers,
    hasMoreSuggestedUsers,
    loadMoreSuggestedUsers,
    forceRefresh,
    setPosts,
    setTrendingPosts,
    setUserPosts,
    setGroups,
    setSuggestedUsers,
    setCurrentUser,
  } = useSocialData(userProfile, sortBy, filterBy);

  // CHAT: Add chat hooks after existing hooks
  const {
    chatSessions,
    activeSessionMessages,
    isLoadingSessions: isLoadingChatSessions,
    isLoadingMessages: isLoadingChatMessages,
    activeSessionId: activeChatSessionId,
    setActiveSession,
    refetchSessions: refetchChatSessions,
    editMessage,
    deleteMessage,
    addOptimisticMessage,
  } = useChatData(currentUser?.id || null);

  const {
    createP2PChatSession,
    sendChatMessage,
    sendMessageWithResource,
    isSending: isSendingMessage,
    isCreatingSession,
  } = useChatActions(currentUser?.id || null);

  const handleStartChat = async (userId: string) => {
    const sessionId = await createP2PChatSession(userId);


    if (sessionId) {
      try {
        await refetchChatSessions();
        setSelectedChatSession(sessionId);
        setShowChatList(true);
        await setActiveSession(sessionId);
      } catch (error) {

      }
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
    refetchCurrentUser,
  );

  const {
    addComment,
    updateNewComment,
    togglePostExpanded,
    isPostExpanded,
    getPostComments,
    isLoadingPostComments,
    isAddingComment,
    getNewCommentContent,
  } = useSocialComments(currentUser, posts);

  // In your SocialFeed component, update the usage:
  const {
    notifications,
    unreadCount,
    isLoading: isLoadingNotifications,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    groupedNotifications,
    hasMore,
    isLoadingMore,
  } = useSocialNotifications();

  // Use grouped notifications in your UI
  const notificationGroups = groupedNotifications();

  const { trackPostView, cleanup } = useSocialPostViews(setPosts, setTrendingPosts, setUserPosts);

  // Feature access hook for subscription checks
  const { canPostSocials, canChat, canCreateGroups } = useFeatureAccess();
  const canCreatePosts = useMemo(() => canPostSocials(), [canPostSocials]);
  const canStartChats = useMemo(() => canChat(), [canChat]);
  const canCreateNewGroups = useMemo(() => canCreateGroups(), [canCreateGroups]);

  // Move uniqueSuggestedUsers definition up so it's available for useEffect dependencies
  const uniqueSuggestedUsers = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const u of suggestedUsers || []) {
      if (!map.has(u.id)) map.set(u.id, u);
    }
    return Array.from(map.values());
  }, [suggestedUsers]);

  // Sync search & "open create" dialog from URL query params
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
  // Add error state
  const [error, setError] = useState<string | null>(null);

  // Add error handling to your refresh function
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);

    try {
      await forceRefresh();
      await fetchNotifications();
    } catch (err) {
      setError('Failed to refresh data');

    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoading || isRefreshing) return;

    const observers: IntersectionObserver[] = [];

    const createObserver = (
      ref: React.RefObject<HTMLDivElement>,
      hasMore: boolean,
      isLoadingMore: boolean,
      loadMore: () => void,
      root: HTMLElement | null = null
    ) => {
      if (!ref.current || !hasMore || isLoadingMore) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0 && hasMore && !isLoadingMore && !isRefreshing) {
              loadMore();
            }
          });
        },
        {
          threshold: [0, 0.1, 0.5],
          rootMargin: '200px',
          root: root
        }
      );
      observer.observe(ref.current);
      return observer;
    };

    // Create observers based on active tab
    switch (activeTab) {
      case 'feed': {
        const feedObserver = createObserver(feedObserverRef, hasMorePosts, isLoadingMorePosts, loadMorePosts);
        if (feedObserver) observers.push(feedObserver);
        break;
      }
      case 'trending': {
        const trendingObserver = createObserver(trendingObserverRef, hasMoreTrendingPosts, isLoadingMorePosts, loadMoreTrendingPosts);
        if (trendingObserver) observers.push(trendingObserver);
        break;
      }
      case 'profile': {
        const profileObserver = createObserver(profileObserverRef, hasMoreUserPosts, isLoadingUserPosts, loadMoreUserPosts);
        if (profileObserver) observers.push(profileObserver);
        // Right sidebar suggestions infinite scroll in profile
        if (uniqueSuggestedUsers.length > 0 && suggestedObserverRef.current) {
          const sidebarSuggestionsObserver = createObserver(
            suggestedObserverRef,
            hasMoreSuggestedUsers,
            isLoadingSuggestedUsers,
            loadMoreSuggestedUsers,
            suggestedContainerRef.current
          );
          if (sidebarSuggestionsObserver) observers.push(sidebarSuggestionsObserver);
        }
        break;
      }
    }

    // Cleanup function
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [activeTab, isLoading, isRefreshing, isLoadingMorePosts, isLoadingUserPosts, isLoadingSuggestedUsers, hasMoreSuggestedUsers, uniqueSuggestedUsers.length]);

  // Backup: Scroll-based load more trigger (in case IntersectionObserver fails)
  useEffect(() => {
    const container = getScrollContainer();
    if (!container || isLoading || isRefreshing) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Trigger load more when scrolled 85% down
      if (scrollPercentage > 0.85) {
        switch (activeTab) {
          case 'feed':
            if (hasMorePosts && !isLoadingMorePosts) loadMorePosts();
            break;
          case 'trending':
            if (hasMoreTrendingPosts && !isLoadingMorePosts) loadMoreTrendingPosts();
            break;
          case 'profile':
            if (hasMoreUserPosts && !isLoadingUserPosts) loadMoreUserPosts();
            break;
        }
      }
    };

    // Debounce scroll handler
    let scrollTimeout: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };

    container.addEventListener('scroll', debouncedScroll);
    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener('scroll', debouncedScroll);
    };
  }, [
    activeTab, 
    isLoading, 
    isRefreshing, 
    hasMorePosts, 
    isLoadingMorePosts, 
    hasMoreTrendingPosts, 
    hasMoreUserPosts, 
    isLoadingUserPosts,
    loadMorePosts,
    loadMoreTrendingPosts,
    loadMoreUserPosts,
    getScrollContainer
  ]);

  // Replace the existing useEffect that sets activeTab from route
  useEffect(() => {
    if (routeUserId) {
      if (routeUserId === currentUser?.id) {
        // Viewing own profile → go to normal profile tab
        handleTabChange('profile');
        setViewedUserId(null);
        if (location.pathname !== '/social/profile') {
          navigate('/social/profile', { replace: true });
        }
      } else {
        // Viewing someone else's profile → special tab
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
  // Initialize activeTab from route on mount only
  useEffect(() => {
    if (routeUserId) {
      // Viewing a user profile - don't set activeTab to prevent conflicts
      return;
    }
    if (routeTab) {
      handleTabChange(routeTab as any);
    } else if (initialActiveTab) {
      handleTabChange(initialActiveTab as any);
    }
  }, [routeTab, initialActiveTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Moderation state
  const [moderationResult, setModerationResult] = useState<any>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Handlers
  const handleCreatePost = async () => {
    const result = await createPost(newPostContent, selectedPrivacy, selectedFiles, undefined, postMetadata);
    
    // Handle moderation rejection
    if (typeof result === 'object' && result.moderation && !result.moderation.approved) {
      setModerationResult(result.moderation);
      // Keep the dialog open so user can see feedback and revise
      setShowPostDialog(false); // Close the create dialog
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

  // Total unread count
  const totalUnread = useMemo(() =>
    chatSessions.reduce((sum, s) => sum + (s.unread_count || 0), 0),
    [chatSessions]
  );

  const filterPosts = (postList: any[]) => {
    if (!effectiveSearch.trim()) return postList;
    const searchLower = effectiveSearch.toLowerCase();
    return postList.filter(post =>
      post.content?.toLowerCase().includes(searchLower) ||
      post.author?.display_name?.toLowerCase().includes(searchLower) ||
      post.author?.username?.toLowerCase().includes(searchLower)
    );
  };

  const filteredGroups = useMemo(() => {
    if (!effectiveSearch.trim()) return groups;
    const searchLower = effectiveSearch.toLowerCase();
    return groups.filter((group) =>
      group.name?.toLowerCase().includes(searchLower) ||
      group.description?.toLowerCase().includes(searchLower) 
      // ||
      // group.tags?.some((t: string) => t?.toLowerCase().includes(searchLower))
    );
  }, [groups, effectiveSearch]);

  const filteredUsers = useMemo(() => {
    if (!effectiveSearch.trim()) return [];
    const searchLower = effectiveSearch.toLowerCase();
    return uniqueSuggestedUsers.filter(user => 
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.bio?.toLowerCase().includes(searchLower) ||
      user.interests?.some((i: string) => i.toLowerCase().includes(searchLower))
    );
  }, [uniqueSuggestedUsers, effectiveSearch]);

  const filteredUserPosts = useMemo(() => filterPosts(userPosts), [userPosts, effectiveSearch]);

  const searchPlaceholder = useMemo(() => {
    switch (activeTab) {
      case 'trending':
        return 'Search trending posts or authors';
      case 'groups':
        return 'Search groups by name or tag';
      case 'profile':
        return 'Search your posts';
      case 'notifications':
        return 'Search notifications';
      default:
        return 'Search posts, people, or tags';
    }
  }, [activeTab]);



  const InFeedSuggestedStrip: React.FC<{
    users: any[];
    offset: number;
    stripId: string;
    saveScroll: (id: string, pos: number) => void;
    getSavedScroll: (id: string) => number;
  }> = ({ users, offset, stripId, saveScroll, getSavedScroll }) => {
    const [loadingIds, setLoadingIds] = React.useState<Record<string, boolean>>({});
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const localObserverRef = React.useRef<HTMLDivElement | null>(null);

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

    // Local observer for horizontal infinite scroll
    useEffect(() => {
      if (!localObserverRef.current || !hasMoreSuggestedUsers || isLoadingSuggestedUsers) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMoreSuggestedUsers && !isLoadingSuggestedUsers) {
            loadMoreSuggestedUsers();
          }
        },
        { 
          threshold: 0.1, 
          root: containerRef.current,
          rootMargin: '0px 100px 0px 0px' // Trigger when 100px from right edge
        }
      );

      observer.observe(localObserverRef.current);
      return () => observer.disconnect();
    }, [hasMoreSuggestedUsers, isLoadingSuggestedUsers]);

    const onScroll = () => {
      const pos = containerRef.current?.scrollLeft || 0;
      saveScroll(stripId, pos);
    };

    if (!list || list.length === 0) return null;

    return (
      <div className="py-3 px-2 -mx-2 max-w-[680px]">
        <div className="flex items-center justify-between mb-2 px-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Suggested for you</h4>
          <button className="text-xs text-slate-500 hover:underline" onClick={() => {
            setActiveTab('profile');
            setTimeout(() => {
              const suggestionsTab = document.querySelector('[data-value="suggestions"]');
              if (suggestionsTab) (suggestionsTab as HTMLElement).click();
            }, 0);
          }}>See all</button>
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
                  className="flex-1 rounded-full text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleFollow(u.id)}
                  disabled={!!loadingIds[u.id]}
                >
                  {loadingIds[u.id] ? '...' : 'Follow'}
                </Button>
                {/* CHANGED: Navigate instead of opening modal */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-2 hover:bg-slate-200 "
                  onClick={() => handleViewProfile(u.id)}
                  title="View Profile"
                >
                  <ExternalLink className="h-4 w-4 color-blue-500" />
                </Button>
              </div>
            </div>
          ))}
          {hasMoreSuggestedUsers && (
              <div
                ref={localObserverRef}
                className="h-full min-w-[100px] flex items-center justify-center"
              >
                {isLoadingSuggestedUsers ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                ) : (
                  <div className="text-xs text-slate-400">Scroll for more</div>
                )}
              </div>
            )}
        </div>
      </div>
    );
  };

  const renderPostsWithStrips = (postList: any[], isLoading: boolean) => {
    if (isLoading && postList.length === 0) {
      return <LoadingSpinner />;
    }

    if (postList.length === 0 && !isLoading) {
      return (
        <div className="text-center py-12">
          <div className="text-slate-400 text-lg">No posts found</div>
          <Button
            onClick={forceRefresh}
            variant="outline"
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      );
    }
    const items: JSX.Element[] = [];
    const POSTS_BETWEEN_STRIPS = 6;
    const filtered = filterPosts(postList);
    let stripCounter = 0;

    filtered.forEach((post, idx) => {
      const isFirst = idx === 0;
      const postElement = isFirst ? (
        <div key={post.id} ref={firstPostRef} data-first-post className='space-y-1 lg:space-y-4'>
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
            isAddingComment={isAddingComment(post.id)}
            onSubmitComment={async () => {
              const success = await addComment(post.id);
              if (success) {
                const updatePost = (p: SocialPostWithDetails) => 
                  p.id === post.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p;
                setPosts(prev => prev.map(updatePost));
                setTrendingPosts(prev => prev.map(updatePost));
                setUserPosts(prev => prev.map(updatePost));
              }
            }}
            onPostView={trackPostView}
            onClick={() => navigate(`/social/post/${post.id}`)}
            onDeletePost={deletePost}
            onEditPost={editPost}
            onShareToChat={handleSharePostToChat}
          />
        </div>
      ) : (
        <div key={post.id} className='space-y-1 lg:space-y-4'>
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
            isAddingComment={isAddingComment(post.id)}
            onSubmitComment={async () => {
              const success = await addComment(post.id);
              if (success) {
                const updatePost = (p: SocialPostWithDetails) => 
                  p.id === post.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p;
                setPosts(prev => prev.map(updatePost));
                setTrendingPosts(prev => prev.map(updatePost));
                setUserPosts(prev => prev.map(updatePost));
              }
            }}
            onPostView={trackPostView}
            onClick={() => navigate(`/social/post/${post.id}`)}
            onDeletePost={deletePost}
            onEditPost={editPost}
            onShareToChat={handleSharePostToChat}
          />
        </div>
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

  const LoadingSpinner = ({ size = "default" }: { size?: "default" | "sm" }) => (
    <div className={`flex flex-col items-center justify-center ${size === "default" ? "py-12" : "py-4"}`}>
      <Loader2 className={`${size === "default" ? "h-8 w-8" : "h-6 w-6"} animate-spin text-blue-600`} />
      <p className="text-sm text-slate-500 mt-2">Loading posts...</p>
    </div>
  );// In SocialFeed.tsx, update the adapter function:
  const adaptNotifications = (socialNotifications: SocialNotification[]): SocialNotificationItem[] => {
    return socialNotifications.map(notif => ({
      id: notif.id,
      user_id: notif.user_id,
      type: notif.type,
      title: getNotificationTitle(notif),
      message: getNotificationMessage(notif),
      is_read: notif.is_read,
      created_at: notif.created_at,
      data: {
        actor: notif.actor,
        post: notif.post
      },
      actor: notif.actor
    }));
  };

  const getNotificationTitle = (notif: SocialNotification): string => {
    switch (notif.type) {
      case 'like': return 'New Like';
      case 'comment': return 'New Comment';
      case 'follow': return 'New Follower';
      case 'mention': return 'You were mentioned';
      case 'share': return 'Post Shared';
      default: return 'Notification';
    }
  };

  const getNotificationMessage = (notif: SocialNotification): string => {
    const actorName = notif.actor?.display_name || 'Someone';
    switch (notif.type) {
      case 'like': return `${actorName} liked your post`;
      case 'comment': return `${actorName} commented on your post`;
      case 'follow': return `${actorName} started following you`;
      case 'mention': return `${actorName} mentioned you in a post`;
      case 'share': return `${actorName} shared your post`;
      default: return 'You have a new notification';
    }
  };

  const filteredNotifications = useMemo(() => {
    if (!effectiveSearch.trim()) return notifications;
    const searchLower = effectiveSearch.toLowerCase();
    return notifications.filter((notif) => {
      const title = getNotificationTitle(notif).toLowerCase();
      const message = getNotificationMessage(notif).toLowerCase();
      const actor = notif.actor?.display_name?.toLowerCase() || '';
      const postContent = notif.post?.content?.toLowerCase() || '';
      return (
        title.includes(searchLower) ||
        message.includes(searchLower) ||
        actor.includes(searchLower) ||
        postContent.includes(searchLower)
      );
    });
  }, [notifications, effectiveSearch]);
  // BEFORE the return statement, handle profile routing:
  if (routeGroupId) return <GroupDetailPage currentUser={currentUser} />;

  const postToDisplay = routePostId
    ? [...posts, ...trendingPosts, ...userPosts].find((post) => post.id === routePostId)
    : null;

  return (
    <div className=" bg-transparent font-sans">

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-red-800 text-sm">{error}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="text-red-800 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className=" max-w-[1240px] mx-auto px-0 ">

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
                      onClick={() => handleTabChange('profile')}
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
              </div>
              {/* {activeTab !== 'notifications' && (
                <NotificationsSection
                  notifications={adaptNotifications(filteredNotifications)}
                  unreadCount={unreadCount}
                  markNotificationAsRead={markNotificationAsRead}
                  markAllNotificationsAsRead={markAllNotificationsAsRead}
                  deleteNotification={deleteNotification}
                  hasMore={hasMore}
                  isLoading={isLoadingMore}
                  fetchNotifications={fetchNotifications
                  }
                />
              )} */}
            </div>
          </div>
          <main
            ref={scrollContainerRef}
            className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar pb-20 lg:pb-20"
          >
            <div />

            {/* Unified search bar for all social tabs */}
            <div className="px-4 pt-4">
              <div className="max-w-[720px] mx-auto">
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={effectiveSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-9 pr-10"
                  />
                  {effectiveSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500"
                      onClick={() => handleSearchChange('')}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>


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
                <Tabs value={activeTab} className="space-y-1 ">
                  <TabsContent value="feed" className="outline-none space-y-1 lg:space-y-4">
                    {/* Moderation Feedback */}
                    {moderationResult && !moderationResult.approved && (
                      <div className="mb-4">
                        <ContentModerationFeedback
                          result={moderationResult}
                          onRevise={() => {
                            setModerationResult(null);
                            setShowPostDialog(true);
                          }}
                          onAppeal={() => {
                            toast.info('Appeal feature coming soon!');
                          }}
                        />
                      </div>
                    )}

                    {/* Educational Guidelines Button */}
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowGuidelines(!showGuidelines)}
                            >
                              View Guidelines
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Guidelines Modal */}
                    {showGuidelines && (
                      <div className="mb-4">
                        <ContentGuidelines onClose={() => setShowGuidelines(false)} />
                      </div>
                    )}

                    {/* CreatePostDialog moved to be accessible from all tabs */}

                    {/* People Search Results */}
                    {effectiveSearch.trim() && filteredUsers.length > 0 && (
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
                                  onClick={() => toggleFollow(user.id)}
                                >
                                  Follow
                                </Button>
                              </div>
                            ))}
                          </div>
                          {filteredUsers.length > 3 && (
                            <button 
                              className="w-full py-2 text-xs text-blue-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800"
                              onClick={() => {
                                setActiveTab('profile');
                                setTimeout(() => {
                                  const suggestionsTab = document.querySelector('[data-value="suggestions"]');
                                  if (suggestionsTab) (suggestionsTab as HTMLElement).click();
                                }, 0);
                              }}
                            >
                              View all {filteredUsers.length} people
                            </button>
                          )}
                        </div>
                      </div>
                    )}

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
                        <Button onClick={() => setShowPostDialog(true)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create First Post
                        </Button>
                      </div>
                    ) : (
                      <>
                        {renderPostsWithStrips(posts, isLoading)}
                        <div ref={feedObserverRef} className="h-10" />
                        {isLoadingMorePosts && <LoadingSpinner size="sm" />}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="trending" className="outline-none space-y-1 lg:space-y-4">
                    {isLoading && trendingPosts.length === 0 ? (
                      <LoadingSpinner />
                    ) : trendingPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                          <TrendingUp className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No trending posts yet</h3>
                        <p className="text-slate-600 mb-6 max-w-sm">
                          Trending posts appear here based on engagement. Start creating and interacting with posts to see them trend!
                        </p>
                        <Button onClick={() => setShowPostDialog(true)} variant="outline" className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create Post
                        </Button>
                      </div>
                    ) : (
                      <>
                        {renderPostsWithStrips(trendingPosts, isLoading)}
                        <div ref={trendingObserverRef} className="h-10" />
                        {isLoadingMorePosts && <LoadingSpinner size="sm" />}
                      </>
                    )}
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
                      onSubmitComment={async (postId: string) => {
                        const success = await addComment(postId);
                        if (success) {
                          const updatePost = (p: SocialPostWithDetails) => 
                            p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p;
                          setPosts(prev => prev.map(updatePost));
                          setTrendingPosts(prev => prev.map(updatePost));
                          setUserPosts(prev => prev.map(updatePost));
                        }
                      }}
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
                    {isLoadingMorePosts == true && <LoadingSpinner />}

                  </TabsContent>

                  <TabsContent value="notifications" className="animate-in fade-in duration-500 lg:bottom-24  bg-white dark:bg-slate-900 overflow-hidden flex">
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
                        onSubmitComment={async (postId: string) => {
                          const success = await addComment(postId);
                          if (success) {
                            const updatePost = (p: SocialPostWithDetails) => 
                              p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p;
                            setPosts(prev => prev.map(updatePost));
                            setTrendingPosts(prev => prev.map(updatePost));
                            setUserPosts(prev => prev.map(updatePost));
                          }
                        }}
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
                      />)
                    }

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
                          className="w-full justify-start bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => {
                            if (!canCreatePosts) {
                              toast.error('Posts are available for Scholar and Genius plans');
                              return;
                            }
                            setShowPostDialog(true);
                          }}
                          disabled={!canCreatePosts}
                          title={!canCreatePosts ? 'Upgrade to Scholar or Genius to create posts' : 'Create a new post'}
                        >
                          {!canCreatePosts && <Lock className="h-4 w-4 mr-2" />}
                          <Plus className={!canCreatePosts ? '' : 'h-4 w-4 mr-2'} /> Create Post
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
                          className="w-full justify-start bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => {
                            if (!canCreateNewGroups) {
                              toast.error('Groups are available for Scholar and Genius plans');
                              return;
                            }
                            navigate('/social/groups');
                            setTimeout(() => {
                              const event = new CustomEvent('triggerCreateGroup');
                              window.dispatchEvent(event);
                            }, 100);
                          }}
                          disabled={!canCreateNewGroups}
                          title={!canCreateNewGroups ? 'Upgrade to Scholar or Genius to create groups' : 'Create a new group'}
                        >
                          {!canCreateNewGroups && <Lock className="h-4 w-4 mr-2" />}
                          <Plus className={!canCreateNewGroups ? '' : 'h-4 w-4 mr-2'} /> Create Group
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Trending Widget */}
                  {/* <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
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
                      <Button variant="ghost" className="text-blue-600 text-sm w-full" onClick={() => handleTabChange('trending')}>Show more</Button>
                    </div>
                  </div> */}
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
                  {/* <div className="bg-gradient-to-br from-blue-50 to-pink-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <TrendingUp className="h-5 w-5" /> Trending Now
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-blue-600">{trendingPosts.length}</div>
                          <div className="text-xs text-slate-500">Trending Posts</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
                          <div className="text-2xl font-bold text-pink-600">{trendingHashtags.length}</div>
                          <div className="text-xs text-slate-500">Active Hashtags</div>
                        </div>
                      </div>
                    </div>
                  </div> */}

                  {/* Top Hashtags Widget */}
                  {/* <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
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
                  </div> */}
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
                        className="w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        size="sm"
                        onClick={() => {
                          if (!canCreateNewGroups) {
                            toast.error('Groups are available for Scholar and Genius plans');
                            return;
                          }
                          setTimeout(() => {
                            const event = new CustomEvent('triggerCreateGroup');
                            window.dispatchEvent(event);
                          }, 100);
                        }}
                        disabled={!canCreateNewGroups}
                        title={!canCreateNewGroups ? 'Upgrade to Scholar or Genius to create groups' : 'Create a new group'}
                      >
                        {!canCreateNewGroups && <Lock className="h-4 w-4 mr-2" />}
                        <Plus className={!canCreateNewGroups ? '' : 'h-4 w-4 mr-2'} /> Create Group
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

              {activeTab === 'profile' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 sticky top-6 ">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg">Who to follow</h3>
                  </div>
                  <div ref={suggestedContainerRef} className="p-4 space-y-4 overflow-y-scroll max-h-[500px] modern-scrollbar">
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

        {/* Floating Action Buttons: Refresh + Scroll-to-top */}

        <div className="fixed bottom-16 right-2 flex flex-col gap-3 z-40 pointer-events-none">
          <div className="flex flex-col items-center gap-3 pointer-events-auto">
            {/* New Posts Banner (Instagram-style) */}
            {hasNewPosts && (
              <button
                onClick={showNewPosts}
                className="animate-bounce bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-xl font-medium text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
              </button>
            )}

            {/* Refresh Button - shows when scrolled or has new posts */}
            <button
              onClick={() => handleRefresh?.()}
              className={`
              h-11 w-11 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 
              shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center
              border border-slate-100 dark:border-slate-800 backdrop-blur-sm
              ${isScrolled || hasNewPosts ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-0 opacity-0 pointer-events-none'}
            `}
              aria-label="Refresh feed"
              title="Refresh"
            >
              <RefreshCw className={`${isRefreshing || isLoading ? 'animate-spin' : ''} h-5 w-5 text-blue-600`} />
            </button>

            {/* Scroll to Top Button */}
            <button
              onClick={scrollToTop}
              className={`
              h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:shadow-xl 
              transition-all duration-300 flex items-center justify-center backdrop-blur-sm
              ${isScrolledDeep ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-0 opacity-0 scale-50 pointer-events-none'}
            `}
              aria-label="Scroll to top"
              title="Back to top"
            >
              <ArrowUp className="h-6 w-6" />
            </button>

            {/* Open Chats Button */}
            <button
              onClick={() => setShowChatList(prev => !prev)}
              className={`
              relative h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 
              text-white shadow-lg hover:shadow-2xl transition-all duration-300 
              flex items-center justify-center backdrop-blur-sm ring-4 ring-blue-500/20
              ${isScrolled || showChatList || totalUnread > 0
                  ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
                  : 'translate-y-0 opacity-0 scale-75 pointer-events-none'}
            `}
              aria-label="Open messages"
              title="Messages"
            >
              <MessageCircle className="h-7 w-7" />
              {totalUnread > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse ring-2 ring-white">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* User profile modal */}

      {showChatList && (
        <div className="fixed inset-1 mt-11 lg:mt-0 lg:inset-auto lg:right-6 animate-in fade-in duration-500 lg:bottom-24 lg:h-[600px] bg-white dark:bg-slate-900 z-50 lg:rounded-2xl lg:shadow-2xl overflow-hidden flex">
          {/* Mobile close button */}


          {/* Chat interface */}
          <div className="flex-1 flex max-w-[100vw]">
            {!activeChatSessionId ? (
              <ChatList
                sessions={chatSessions}
                activeSessionId={activeChatSessionId}
                onSessionSelect={setActiveSession}
                currentUserId={currentUser?.id || ''}
                isLoading={isLoadingChatSessions}
                onbackClick={() => setShowChatList(false)}
              />
            ) : (
              // In the ChatWindow component usage:
              <ChatWindow
                session={chatSessions.find((s) => s.id === activeChatSessionId) || null}
                messages={activeSessionMessages}
                currentUserId={currentUser?.id || ''}
                onBack={() => { setActiveSession(null); setShowChatList(true) }}
                onSendMessage={handleChatSendMessage}
                onSendMessageWithResource={handleChatSendMessageWithResource}
                isSending={isSendingMessage}
                isLoading={isLoadingChatMessages}
                editMessage={editMessage}
                deleteMessage={deleteMessage}
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
          notes={userNotes}
          documents={userDocuments}
          classRecordings={userClassRecordings}
          isSharing={isSendingMessage}
          isLoading={false}
          hasMoreNotes={false}
          hasMoreDocuments={false}
          hasMoreRecordings={false}
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

      {/* Create Post Dialog - Restored */}
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
        metadata={postMetadata}
        disabled={!canCreatePosts}
        upgradeMessage="You've reached your daily post limit. Upgrade to Premium for unlimited posts!"
      />
    </div>
  );
});