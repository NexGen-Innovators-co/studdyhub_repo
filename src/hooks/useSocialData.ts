import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../components/social/types/social';
import { DEFAULT_LIMITS } from '../components/social/utils/socialConstants';

import {
  CACHE_KEYS,
  saveToCache,
  loadFromCache,
} from '../utils/socialCache';
import { offlineStorage, STORES } from '../utils/offlineStorage';

export type SuggestedUser = SocialUserWithDetails & {
  recommendation_score?: number;
};

const uniqueById = <T extends { id: string }>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

// Normalize post types coming from edge functions
const normalizePosts = (posts: any[]): SocialPostWithDetails[] => {
  return posts.map(post => ({
    ...post,
    privacy: post.privacy as "public" | "followers" | "private",
    media: (post.media || []).map((m: any) => ({
      ...m,
      type: m.type as "image" | "video" | "document"
    })),
    group: post.group ? {
      ...post.group,
      privacy: post.group.privacy as "public" | "private"
    } : undefined,
    hashtags: post.hashtags || [],
    tags: post.tags || [],
    is_liked: post.is_liked ?? false,
    is_bookmarked: post.is_bookmarked ?? false,
  }));
};

export const useSocialData = (
  userProfile: any,
  sortBy: SortBy,
  filterBy: FilterBy,
  onNotificationReceived?: (notification: any) => void
) => {
  // State initialization remains the same
  const [posts, setPosts] = useState<SocialPostWithDetails[]>(() => loadFromCache(CACHE_KEYS.POSTS) || []);
  const [trendingPosts, setTrendingPosts] = useState<SocialPostWithDetails[]>(() => loadFromCache(CACHE_KEYS.TRENDING) || []);
  const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>(() => loadFromCache(CACHE_KEYS.USER_POSTS) || []);
  const [groups, setGroups] = useState<SocialGroupWithDetails[]>(() => loadFromCache(CACHE_KEYS.GROUPS) || []);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>(() => loadFromCache(CACHE_KEYS.HASHTAGS) || []);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>(() => loadFromCache(CACHE_KEYS.SUGGESTED) || []);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(() => !loadFromCache(CACHE_KEYS.POSTS));
  const [isLoadingGroups, setIsLoadingGroups] = useState(() => !loadFromCache(CACHE_KEYS.GROUPS));
  const [isLoadingUserPosts, setIsLoadingUserPosts] = useState(() => !loadFromCache(CACHE_KEYS.USER_POSTS));
  const [isLoadingSuggestedUsers, setIsLoadingSuggestedUsers] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [isLoadingMoreGroups, setIsLoadingMoreGroups] = useState(false);
  const isFetchedRef = useRef(false); // Ref to track if data has already been fetched to prevent refetch on mount if data exists

  const [postsOffset, setPostsOffset] = useState(0);
  const [trendingPostsOffset, setTrendingPostsOffset] = useState(0);
  const [userPostsOffset, setUserPostsOffset] = useState(0);
  const [suggestedUsersOffset, setSuggestedUsersOffset] = useState(0);
  const [groupsOffset, setGroupsOffset] = useState(0);

  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreTrendingPosts, setHasMoreTrendingPosts] = useState(true);
  const [hasMoreUserPosts, setHasMoreUserPosts] = useState(true);
  const [hasMoreSuggestedUsers, setHasMoreSuggestedUsers] = useState(true);
  const [hasMoreGroups, setHasMoreGroups] = useState(true);

  const [likedPosts, setLikedPosts] = useState<SocialPostWithDetails[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<SocialPostWithDetails[]>([]);
  const [isLoadingLikedPosts, setIsLoadingLikedPosts] = useState(false);
  const [isLoadingBookmarkedPosts, setIsLoadingBookmarkedPosts] = useState(false);

  const [newPostsBuffer, setNewPostsBuffer] = useState<SocialPostWithDetails[]>([]);
  const [hasNewPosts, setHasNewPosts] = useState(false);



  const subscriptionsRef = useRef<any[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasCachedDataRef = useRef(false);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const groupPageRef = useRef<number>(0);



  // OPTIMIZED: Fetch posts via edge function (single API call replaces 5+ DB queries)
  const fetchPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMorePosts || isLoadingMorePosts)) return;

    if (!navigator.onLine) {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
      return;
    }

    try {
      if (reset) {
        setIsLoading(posts.length === 0);
      }
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : postsOffset;

      const { data: response, error } = await supabase.functions.invoke('get-social-feed', {
        body: {
          mode: 'feed',
          sortBy,
          offset: currentOffset,
          limit: DEFAULT_LIMITS.POSTS_PER_PAGE,
          viewedPostIds: Array.from(viewedPostIds),
        },
      });

      if (error) {
        if (!navigator.onLine) {
          const offlinePosts = await offlineStorage.getAll<SocialPostWithDetails>(STORES.SOCIAL_POSTS);
          if (offlinePosts.length > 0) {
            setPosts(reset ? offlinePosts : uniqueById([...posts, ...offlinePosts]));
            setHasMorePosts(false);
            return;
          }
        }
        throw error;
      }

      const transformedPosts = normalizePosts(response?.posts || []);

      if (transformedPosts.length === 0) {
        setHasMorePosts(false);
        return;
      }

      // Save to offline storage
      if (transformedPosts.length > 0) {
        await offlineStorage.saveAll(STORES.SOCIAL_POSTS, transformedPosts);
      }

      if (reset) {
        setPosts(uniqueById(transformedPosts));
        setPostsOffset(transformedPosts.length);
      } else {
        setPosts(prev => uniqueById([...prev, ...transformedPosts]));
        setPostsOffset(prev => prev + transformedPosts.length);
      }

      setHasMorePosts(response?.hasMore ?? false);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [sortBy, filterBy, hasMorePosts, isLoadingMorePosts, postsOffset, viewedPostIds]);

  // OPTIMIZED: Trending posts via edge function
  const fetchTrendingPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMoreTrendingPosts || isLoadingMorePosts)) return;

    if (!navigator.onLine) {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
      return;
    }

    try {
      if (reset) {
        setIsLoading(trendingPosts.length === 0);
      }
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : trendingPostsOffset;

      const { data: response, error } = await supabase.functions.invoke('get-social-feed', {
        body: {
          mode: 'trending',
          offset: currentOffset,
          limit: DEFAULT_LIMITS.POSTS_PER_PAGE,
          viewedPostIds: Array.from(viewedPostIds),
        },
      });

      if (error) throw error;

      const transformedPosts = normalizePosts(response?.posts || []);

      if (transformedPosts.length === 0) {
        setHasMoreTrendingPosts(false);
        return;
      }

      if (reset) {
        setTrendingPosts(uniqueById(transformedPosts));
        setTrendingPostsOffset(transformedPosts.length);
      } else {
        setTrendingPosts(prev => uniqueById([...prev, ...transformedPosts]));
        setTrendingPostsOffset(prev => prev + transformedPosts.length);
      }

      setHasMoreTrendingPosts(response?.hasMore ?? false);
    } catch (error) {
      toast.error('Failed to load trending posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [hasMoreTrendingPosts, isLoadingMorePosts, trendingPostsOffset, viewedPostIds]);

  // OPTIMIZED: User posts via edge function
  const fetchUserPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMoreUserPosts || isLoadingUserPosts)) return;

    if (!navigator.onLine) {
      setIsLoadingUserPosts(false);
      return;
    }

    try {
      if (reset) {
        setIsLoadingUserPosts(userPosts.length === 0);
      }

      const currentOffset = reset ? 0 : userPostsOffset;

      const { data: response, error } = await supabase.functions.invoke('get-social-feed', {
        body: {
          mode: 'user',
          offset: currentOffset,
          limit: DEFAULT_LIMITS.POSTS_PER_PAGE,
        },
      });

      if (error) throw error;

      const transformedPosts = normalizePosts(response?.posts || []);

      if (transformedPosts.length === 0) {
        setHasMoreUserPosts(false);
        setIsLoadingUserPosts(false);
        return;
      }

      if (reset) {
        setUserPosts(uniqueById(transformedPosts));
        setUserPostsOffset(transformedPosts.length);
      } else {
        setUserPosts(prev => uniqueById([...prev, ...transformedPosts]));
        setUserPostsOffset(prev => prev + transformedPosts.length);
      }

      setHasMoreUserPosts(response?.hasMore ?? false);
    } catch (error) {
      toast.error('Failed to load user posts');
    } finally {
      setIsLoadingUserPosts(false);
    }
  }, [hasMoreUserPosts, isLoadingUserPosts, userPostsOffset]);

  // OPTIMIZED: Liked posts via edge function
  const fetchLikedPosts = useCallback(async () => {
    try {
      setIsLoadingLikedPosts(true);

      const { data: response, error } = await supabase.functions.invoke('get-social-feed', {
        body: { mode: 'liked' },
      });

      if (error) throw error;

      const transformedPosts = normalizePosts(response?.posts || []);
      setLikedPosts(transformedPosts);
    } catch (error) {
      toast.error('Failed to load liked posts');
    } finally {
      setIsLoadingLikedPosts(false);
    }
  }, []);

  // OPTIMIZED: Bookmarked posts via edge function
  const fetchBookmarkedPosts = useCallback(async () => {
    try {
      setIsLoadingBookmarkedPosts(true);

      const { data: response, error } = await supabase.functions.invoke('get-social-feed', {
        body: { mode: 'bookmarked' },
      });

      if (error) throw error;

      const transformedPosts = normalizePosts(response?.posts || []);
      setBookmarkedPosts(transformedPosts);
    } catch (error) {
      toast.error('Failed to load bookmarked posts');
    } finally {
      setIsLoadingBookmarkedPosts(false);
    }
  }, []);

  // OPTIMIZED: Groups via edge function (2 queries → 1 API call)
  const fetchGroups = useCallback(async (reset = true) => {
    if (!currentUserIdRef.current) return;
    if (!reset && (!hasMoreGroups || isLoadingMoreGroups)) return;

    const limit = DEFAULT_LIMITS.GROUPS_PER_PAGE;
    const offset = reset ? 0 : groupsOffset;

    try {
      setIsLoadingMoreGroups(!reset);
      if (reset) {
        setIsLoadingGroups(groups.length === 0);
      }

      const { data: response, error } = await supabase.functions.invoke('get-social-groups', {
        body: { offset, limit },
      });

      if (error) {
        if (!navigator.onLine) {
          const offlineGroups = await offlineStorage.getAll<SocialGroupWithDetails>(STORES.SOCIAL_GROUPS);
          if (offlineGroups.length > 0) {
            setGroups(reset ? offlineGroups : [...groups, ...offlineGroups]);
            setHasMoreGroups(false);
            return;
          }
        }
        throw error;
      }

      const groupsWithDetails: SocialGroupWithDetails[] = response?.groups || [];

      if (reset) {
        setGroups(groupsWithDetails);
      } else {
        setGroups(prev => [...prev, ...groupsWithDetails]);
      }

      setHasMoreGroups(response?.hasMore ?? false);
      setGroupsOffset(offset + groupsWithDetails.length);

      // Save to offline storage
      if (groupsWithDetails.length > 0) {
        await offlineStorage.saveAll(STORES.SOCIAL_GROUPS, groupsWithDetails);
      }

      saveToCache(CACHE_KEYS.GROUPS, reset ? groupsWithDetails : [...groups, ...groupsWithDetails]);
    } catch (err) {
      toast.error('Failed to load groups');
    } finally {
      setIsLoadingGroups(false);
      setIsLoadingMoreGroups(false);
    }
  }, [groupsOffset, groups, hasMoreGroups, isLoadingMoreGroups, isLoadingGroups]);
  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: socialUser, error } = await supabase
        .from('social_users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && socialUser) {
        setCurrentUser(socialUser);
      }
    } catch (error) {
      ////console.error('Error refetching current user:', error);
    }
  }, []);

  useEffect(() => {
    const initializeSocialUser = async () => {
      try {
        if (!navigator.onLine) {
          setIsLoading(false);
          setIsLoadingGroups(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          setIsLoadingGroups(false);
          return;
        }

        // 🔥 NEW: If user changed, clear everything first
        if (currentUserIdRef.current && currentUserIdRef.current !== user.id) {
          setPosts([]);
          setTrendingPosts([]);
          setUserPosts([]);
          setGroups([]);
          setTrendingHashtags([]);
          setSuggestedUsers([]);
          setCurrentUser(null);
          isInitializedRef.current = false;
        }

        currentUserIdRef.current = user.id;

        const { data: socialUser, error: fetchError } = await supabase
          .from('social_users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          const { data: newSocialUser, error: createError } = await supabase
            .from('social_users')
            .insert({
              id: user.id,
              username: userProfile?.full_name?.toLowerCase().replace(/\s+/g, '_') || `user_${user.id.slice(0, 8)}`,
              display_name: userProfile?.full_name || `user_${user.id.slice(0, 8)}`,
              avatar_url: userProfile?.avatar_url || '',
              bio: 'New to the community!',
              interests: ['learning', 'technology']
            })
            .select()
            .single();

          if (createError) {
            ////console.error('Error creating social user:', createError);
            toast.error('Failed to initialize social profile');
            setIsLoading(false);
            setIsLoadingGroups(false);
            return;
          }
          setCurrentUser(newSocialUser);
        } else if (!fetchError && socialUser) {
          setCurrentUser(socialUser);
        } else {
          setIsLoading(false);
          setIsLoadingGroups(false);
        }
      } catch (error) {
        ////console.error('Error initializing social user:', error);
        setIsLoading(false);
        setIsLoadingGroups(false);
      }
    };
    initializeSocialUser();
  }, []); // Run once on mount

  // Fetch user's viewed post IDs when currentUser is set
  useEffect(() => {
    const fetchViewedPosts = async () => {
      if (!currentUser?.id) return;

      if (!navigator.onLine) return;

      try {
        const { data, error } = await supabase
          .from('social_post_views')
          .select('post_id')
          .eq('user_id', currentUser.id);

        if (error) throw error;

        setViewedPostIds(new Set(data.map((view: { post_id: string }) => view.post_id)));
      } catch (err) {
        ////console.error('Error fetching viewed posts:', err);
      }
    };

    fetchViewedPosts();
  }, [currentUser?.id]);

  // Add this to update viewedPostIds when a post is viewed (call this from useSocialPostViews or wherever trackPostView is)
  // For now, assuming it's called externally, but if needed, export a function
  const markPostAsViewed = useCallback((postId: string) => {
    setViewedPostIds(prev => new Set([...prev, postId]));
  }, []);
  // Check if we have valid cached data
  useEffect(() => {
    const cachedPosts = loadFromCache(CACHE_KEYS.POSTS);
    hasCachedDataRef.current = cachedPosts && cachedPosts.length > 0;
  }, []);

  // Save to cache whenever data changes
  useEffect(() => {
    if (posts.length > 0) {
      saveToCache(CACHE_KEYS.POSTS, posts);
    }
  }, [posts]);

  useEffect(() => {
    if (trendingPosts.length > 0) {
      saveToCache(CACHE_KEYS.TRENDING, trendingPosts);
    }
  }, [trendingPosts]);

  useEffect(() => {
    if (userPosts.length > 0) {
      saveToCache(CACHE_KEYS.USER_POSTS, userPosts);
    }
  }, [userPosts]);

  useEffect(() => {
    if (groups.length > 0) {
      saveToCache(CACHE_KEYS.GROUPS, groups);
    }
  }, [groups]);

  useEffect(() => {
    if (suggestedUsers.length > 0) {
      saveToCache(CACHE_KEYS.SUGGESTED, suggestedUsers);
    }
  }, [suggestedUsers]);

  useEffect(() => {
    if (trendingHashtags.length > 0) {
      saveToCache(CACHE_KEYS.HASHTAGS, trendingHashtags);
    }
  }, [trendingHashtags]);

  useEffect(() => {
    if (currentUser) {
      currentUserIdRef.current = currentUser.id;
    } else {
      currentUserIdRef.current = null;
    }
  }, [currentUser]);

  // Fetch initial data when user is loaded OR filters change
  useEffect(() => {
    if (currentUser && isInitializedRef.current) {
      resetAndFetchData();
    }
  }, [sortBy, filterBy]);

  // Fetch data when currentUser becomes available for the first time
  useEffect(() => {
    if (currentUser && !isInitializedRef.current) {
      isInitializedRef.current = true;
      // **CRITICAL: Call resetAndFetchData after isInitializedRef is true**
      resetAndFetchData();
      setupRealtimeListeners();
    }
  }, [currentUser]);

  const setupRealtimeListeners = () => {
    subscriptionsRef.current.forEach(subscription => {
      subscription?.unsubscribe();
    });
    subscriptionsRef.current = [];

    if (currentUserIdRef.current) {
      const notificationsSubscription = supabase
        .channel('user_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'social_notifications',
            filter: `user_id=eq.${currentUserIdRef.current}`
          },
          async (payload) => {
            try {
              const { data: notificationData, error } = await supabase
                .from('social_notifications')
                .select(`
                  *,
                  actor:social_users!social_notifications_actor_id_fkey(*),
                  post:social_posts(*)
                `)
                .eq('id', payload.new.id)
                .single();

              if (!error && notificationData) {
                if (onNotificationReceived) {
                  onNotificationReceived(notificationData);
                }
                // Note: Toast is handled by useSocialNotifications hook to avoid duplicates
              }
            } catch (error) {
              ////console.error('Error fetching notification details:', error);
              if (onNotificationReceived) {
                onNotificationReceived(payload.new);
              }
              // Note: Toast is handled by useSocialNotifications hook to avoid duplicates
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.push(notificationsSubscription);
    }

    // POSTS realtime subscription (INSERT / UPDATE / DELETE)
    const postsSubscription = supabase
      .channel('social_posts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_posts' },
        // mark payload as any to avoid TS errors from strict Realtime payload typing
        async (payload: any) => {
          try {
            // normalize event type (supabase sometimes provides eventType)
            const eventType: string = (payload?.eventType as string) || (payload?.type as string) || '';
            const newRec = payload?.new as any;
            const oldRec = payload?.old as any;
            const postId = newRec?.id || oldRec?.id;
            if (!postId) return;

            const isInsert = /insert/i.test(eventType);
            const isUpdate = /update/i.test(eventType);
            const isDelete = /delete/i.test(eventType);

            if (isInsert) {
              const postDetails = await fetchPostDetails(postId);
              if (postDetails) {
                setNewPostsBuffer(prev => {
                  if (prev.some(p => p.id === postDetails.id)) return uniqueById(prev);
                  setHasNewPosts(true);
                  return uniqueById([postDetails, ...prev]);
                });
              }
            } else if (isUpdate) {
              const updated = await fetchPostDetails(postId);
              if (updated) {
                const updateInList = (prev: SocialPostWithDetails[]) => prev.map(p => p.id === updated.id ? updated : p);
                setPosts(prev => updateInList(prev));
                setTrendingPosts(prev => updateInList(prev));
                setUserPosts(prev => updateInList(prev));
                setLikedPosts(prev => updateInList(prev));
                setBookmarkedPosts(prev => updateInList(prev));
                setNewPostsBuffer(prev => prev.map(p => p.id === updated.id ? updated : p));
              }
            } else if (isDelete) {
              const removeFrom = (prev: SocialPostWithDetails[]) => prev.filter(p => p.id !== postId);
              setPosts(prev => removeFrom(prev));
              setTrendingPosts(prev => removeFrom(prev));
              setUserPosts(prev => removeFrom(prev));
              setLikedPosts(prev => removeFrom(prev));
              setBookmarkedPosts(prev => removeFrom(prev));
              setNewPostsBuffer(prev => {
                const next = prev.filter(p => p.id !== postId);
                if (next.length === 0) setHasNewPosts(false);
                return next;
              });
            }
          } catch (err) {
            ////console.error('Realtime posts handler error:', err);
          }
        }
      )
      .subscribe();

    subscriptionsRef.current.push(postsSubscription);

    const likesSubscription = supabase
      .channel('social_likes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_likes'
        },
        (payload) => {
          handleLikesRealtimeUpdate(payload);
        }
      )
      .subscribe();

    const commentsSubscription = supabase
      .channel('social_comments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_comments'
        },
        (payload) => {
          handleCommentsRealtimeUpdate(payload);
        }
      )
      .subscribe();

    if (currentUserIdRef.current) {
      const followsSubscription = supabase
        .channel('social_follows_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'social_follows',
            filter: `follower_id=eq.${currentUserIdRef.current}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
              fetchSuggestedUsers(true);
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.push(followsSubscription);
    }

    subscriptionsRef.current.push(likesSubscription, commentsSubscription);
  };

  const handleLikesRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const postId = newRecord?.post_id || oldRecord?.post_id;
    const userId = newRecord?.user_id || oldRecord?.user_id;

    if (postId) {
      const updatePostLikes = (prev: SocialPostWithDetails[]) =>
        prev.map(post => {
          if (post.id === postId) {
            const isCurrentUser = userId === currentUserIdRef.current;

            // If it's the current user, we only update if it's NOT already in the desired state
            // to avoid overwriting the manual optimistic update which is more immediate
            const likesChange = eventType === 'INSERT' ? 1 : eventType === 'DELETE' ? -1 : 0;

            return {
              ...post,
              likes_count: Math.max(0, post.likes_count + (isCurrentUser ? 0 : likesChange)),
              is_liked: isCurrentUser ? eventType === 'INSERT' : post.is_liked
            };
          }
          return post;
        });

      setPosts(updatePostLikes);
      setTrendingPosts(updatePostLikes);
      setUserPosts(updatePostLikes);
      setLikedPosts(updatePostLikes);
      setBookmarkedPosts(updatePostLikes);
    }
  };

  const handleCommentsRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const postId = newRecord?.post_id || oldRecord?.post_id;

    if (postId) {
      const updatePostComments = (prev: SocialPostWithDetails[]) =>
        prev.map(post => {
          if (post.id === postId) {
            const commentsChange = eventType === 'INSERT' ? 1 : eventType === 'DELETE' ? -1 : 0;
            return {
              ...post,
              comments_count: Math.max(0, post.comments_count + commentsChange)
            };
          }
          return post;
        });

      setPosts(updatePostComments);
      setTrendingPosts(updatePostComments);
      setUserPosts(updatePostComments);
      setLikedPosts(updatePostComments);
      setBookmarkedPosts(updatePostComments);
    }
  };

  const fetchPostDetails = async (postId: string): Promise<SocialPostWithDetails | null> => {
    try {
      const { data: postData, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('id', postId)
        .single();

      if (error || !postData) return null;

      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`hashtag:social_hashtags(*)`)
        .eq('post_id', postId);

      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`tag:social_tags(*)`)
        .eq('post_id', postId);

      let isLiked = false, isBookmarked = false;
      if (currentUserIdRef.current) {
        const [likesResult, bookmarksResult] = await Promise.all([
          supabase
            .from('social_likes')
            .select('id')
            .eq('user_id', currentUserIdRef.current)
            .eq('post_id', postId)
            .maybeSingle(),
          supabase
            .from('social_bookmarks')
            .select('id')
            .eq('user_id', currentUserIdRef.current)
            .eq('post_id', postId)
            .maybeSingle()
        ]);

        isLiked = !!likesResult.data;
        isBookmarked = !!bookmarksResult.data;
      }

      return {
        ...postData,
        privacy: postData.privacy as "public" | "followers" | "private",
        media: (postData.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
        group: postData.group ? { ...postData.group, privacy: postData.group.privacy as "public" | "private" } : undefined,
        hashtags: hashtagData?.map(h => h.hashtag).filter(Boolean) || [],
        tags: tagData?.map(t => t.tag).filter(Boolean) || [],
        is_liked: isLiked,
        is_bookmarked: isBookmarked
      };
    } catch (error) {
      ////console.error('Error fetching post details:', error);
      return null;
    }
  };

  const resetAndFetchData = () => {

    setPostsOffset(0);
    setTrendingPostsOffset(0);
    setUserPostsOffset(0);
    setSuggestedUsersOffset(0);
    setGroupsOffset(0);
    groupPageRef.current = 0;

    setHasMorePosts(true);
    setHasMoreTrendingPosts(true);
    setHasMoreUserPosts(true);
    setHasMoreSuggestedUsers(true);
    setHasMoreGroups(true);

    // Don't clear posts immediately to avoid UI flash/loading state if we have cached data
    // setPosts([]);
    // setTrendingPosts([]);
    // setUserPosts([]);
    // setGroups([]);

    setSuggestedUsers([]);
    // Clear any buffered new posts when resetting
    setNewPostsBuffer([]);
    setHasNewPosts(false);

    // Pass false for loading if we have data? No, fetchPosts decides.
    fetchPosts(true);
    fetchTrendingPosts(true);
    fetchUserPosts(true);
    fetchGroups(true);
    fetchTrendingHashtags();
    fetchSuggestedUsers(true);

  };

  const fetchTrendingHashtags = async () => {
    try {
      const { data, error } = await supabase
        .from('social_hashtags')
        .select('*')
        .order('posts_count', { ascending: false })
        .limit(DEFAULT_LIMITS.TRENDING_HASHTAGS);

      if (!error && data) {
        setTrendingHashtags(data);
      }
    } catch (error) {
      ////console.error('Error fetching trending hashtags:', error);
    }
  };

  // OPTIMIZED: Suggested users via edge function (5+ queries → 1 API call)
  const fetchSuggestedUsers = useCallback(
    async (reset: boolean = false) => {
      if (!reset && (isLoadingSuggestedUsers || !hasMoreSuggestedUsers)) {
        return;
      }

      try {
        if (reset) {
          if (suggestedUsers.length === 0) setIsLoadingSuggestedUsers(true);
        } else {
          setIsLoadingSuggestedUsers(true);
        }

        if (reset) {
          setSuggestedUsersOffset(0);
          setSuggestedUsers([]);
          setHasMoreSuggestedUsers(true);
        }

        const currentOffset = reset ? 0 : suggestedUsersOffset;
        const limit = DEFAULT_LIMITS.SUGGESTED_USERS;

        const { data: response, error } = await supabase.functions.invoke('get-suggested-users', {
          body: { offset: currentOffset, limit },
        });

        if (error) throw error;

        const paginatedUsers: SuggestedUser[] = response?.users || [];

        if (paginatedUsers.length === 0) {
          setHasMoreSuggestedUsers(false);
          setIsLoadingSuggestedUsers(false);
          return;
        }

        if (reset) {
          setSuggestedUsers(paginatedUsers);
        } else {
          setSuggestedUsers(prev => [...prev, ...paginatedUsers]);
        }

        setSuggestedUsersOffset(currentOffset + paginatedUsers.length);
        setHasMoreSuggestedUsers(response?.hasMore ?? false);

      } catch (err) {
        ////console.error('Error fetching suggested users:', err);
      } finally {
        setIsLoadingSuggestedUsers(false);
      }
    },
    [currentUser, suggestedUsersOffset, isLoadingSuggestedUsers, hasMoreSuggestedUsers]
  );

  const loadMorePosts = () => {
    if (!isLoadingMorePosts && hasMorePosts) {
      fetchPosts(false);
    }
  };

  const loadMoreTrendingPosts = () => {
    if (!isLoadingMorePosts && hasMoreTrendingPosts) {
      fetchTrendingPosts(false);
    }
  };

  const loadMoreUserPosts = () => {
    if (!isLoadingUserPosts && hasMoreUserPosts) {
      fetchUserPosts(false);
    }
  };

  const loadMoreGroups = () => {
    if (!isLoadingGroups && hasMoreGroups) {
      fetchGroups(false);
    }
  };

  const loadMoreSuggestedUsers = () => {
    if (!isLoadingSuggestedUsers && hasMoreSuggestedUsers) {
      fetchSuggestedUsers(false);
    }
  };

  // Promote buffered new posts into the visible feed(s)
  const showNewPosts = () => {
    if (!newPostsBuffer || newPostsBuffer.length === 0) return;
    // Prepend to main posts list
    setPosts(prev => [...newPostsBuffer, ...prev]);
    // Also add to other lists where appropriate (best-effort)
    setTrendingPosts(prev => [...newPostsBuffer.filter(p => !prev.some(x => x.id === p.id)), ...prev]);
    // if any of the buffered posts belong to the current user, also update userPosts
    const myPosts = newPostsBuffer.filter(p => p.author?.id === currentUserIdRef.current);
    if (myPosts.length) setUserPosts(prev => [...myPosts, ...prev]);
    // Clear buffer
    setNewPostsBuffer([]);
    setHasNewPosts(false);
  };

  const clearNewPosts = () => {
    setNewPostsBuffer([]);
    setHasNewPosts(false);
  };
  const forceRefresh = useCallback(() => {
    resetAndFetchData();
  }, []);

  return {
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
    isLoadingMoreGroups,
    hasMorePosts,
    hasMoreTrendingPosts,
    hasMoreUserPosts,
    hasMoreSuggestedUsers,
    hasMoreGroups,
    refetchPosts: forceRefresh, // Use force refresh for manual refresh
    refetchTrendingPosts: () => fetchTrendingPosts(true),
    refetchGroups: () => fetchGroups(true),
    refetchUserPosts: () => fetchUserPosts(true),
    refetchSuggestedUsers: () => fetchSuggestedUsers(true),
    refetchCurrentUser: fetchCurrentUser,
    loadMorePosts,
    loadMoreTrendingPosts,
    loadMoreUserPosts,
    loadMoreGroups,
    loadMoreSuggestedUsers,
    likedPosts,
    bookmarkedPosts,
    isLoadingLikedPosts,
    isLoadingBookmarkedPosts,
    refetchLikedPosts: fetchLikedPosts,
    refetchBookmarkedPosts: fetchBookmarkedPosts,
    newPostsCount: newPostsBuffer.length,
    hasNewPosts,
    showNewPosts,
    clearNewPosts,
    forceRefresh, // Export this for manual cache clearing if needed
  };
};
