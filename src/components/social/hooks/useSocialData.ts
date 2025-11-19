import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../types/social';
import { DEFAULT_LIMITS } from '../utils/socialConstants';
export type SuggestedUser = SocialUserWithDetails & {
  recommendation_score?: number;   // <-- only present when we query with the RPC
};
export const useSocialData = (userProfile: any, sortBy: SortBy, filterBy: FilterBy, onNotificationReceived?: (notification: any) => void) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<SocialPostWithDetails[]>([]);
  const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>([]);
  const [groups, setGroups] = useState<SocialGroupWithDetails[]>([]);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingUserPosts, setIsLoadingUserPosts] = useState(true);
  const [isLoadingSuggestedUsers, setIsLoadingSuggestedUsers] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [isLoadingMoreGroups, setIsLoadingMoreGroups] = useState(false);

  // Pagination states
  const [postsOffset, setPostsOffset] = useState(0);
  const [trendingPostsOffset, setTrendingPostsOffset] = useState(0);
  const [userPostsOffset, setUserPostsOffset] = useState(0);
  const [suggestedUsersOffset, setSuggestedUsersOffset] = useState(0);
  const [groupsOffset, setGroupsOffset] = useState(0);
  const groupPageRef = useRef(0);

  // Has more states
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreTrendingPosts, setHasMoreTrendingPosts] = useState(true);
  const [hasMoreUserPosts, setHasMoreUserPosts] = useState(true);
  const [hasMoreSuggestedUsers, setHasMoreSuggestedUsers] = useState(true);
  const [hasMoreGroups, setHasMoreGroups] = useState(true);

  // Add to state declarations (near the top of the hook):
  const [likedPosts, setLikedPosts] = useState<SocialPostWithDetails[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<SocialPostWithDetails[]>([]);
  const [isLoadingLikedPosts, setIsLoadingLikedPosts] = useState(false);
  const [isLoadingBookmarkedPosts, setIsLoadingBookmarkedPosts] = useState(false);

  // Buffer for realtime incoming posts (new since last "view")
  const [newPostsBuffer, setNewPostsBuffer] = useState<SocialPostWithDetails[]>([]);
  const [hasNewPosts, setHasNewPosts] = useState(false);

  // Constants
  const POST_LIMIT = DEFAULT_LIMITS.POSTS_PER_PAGE;
  const GROUP_LIMIT = DEFAULT_LIMITS.GROUPS_PER_PAGE;

  // Refs for cleanup
  const subscriptionsRef = useRef<any[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize user and setup realtime listeners
  useEffect(() => {
    initializeSocialUser();
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        subscription?.unsubscribe();
      });
    };
  }, []);

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

  const initializeSocialUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        setIsLoadingGroups(false);
        return;
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
          console.error('Error creating social user:', createError);
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
      console.error('Error initializing social user:', error);
      setIsLoading(false);
      setIsLoadingGroups(false);
    }
  };

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
                toast.info('You have a new notification!');
              }
            } catch (error) {
              console.error('Error fetching notification details:', error);
              if (onNotificationReceived) {
                onNotificationReceived(payload.new);
              }
              toast.info('You have a new notification!');
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
                  if (prev.some(p => p.id === postDetails.id)) return prev;
                  setHasNewPosts(true);
                  return [postDetails, ...prev];
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
            console.error('Realtime posts handler error:', err);
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
            const likesChange = eventType === 'INSERT' ? 1 : eventType === 'DELETE' ? -1 : 0;

            return {
              ...post,
              likes_count: Math.max(0, post.likes_count + likesChange),
              is_liked: isCurrentUser ? eventType === 'INSERT' : post.is_liked
            };
          }
          return post;
        });

      setPosts(updatePostLikes);
      setTrendingPosts(updatePostLikes);
      setUserPosts(updatePostLikes);
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
            .single(),
          supabase
            .from('social_bookmarks')
            .select('id')
            .eq('user_id', currentUserIdRef.current)
            .eq('post_id', postId)
            .single()
        ]);

        isLiked = !likesResult.error;
        isBookmarked = !bookmarksResult.error;
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
      console.error('Error fetching post details:', error);
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

    setPosts([]);
    setTrendingPosts([]);
    setUserPosts([]);
    setSuggestedUsers([]);
    setGroups([]);
    // Clear any buffered new posts when resetting
    setNewPostsBuffer([]);
    setHasNewPosts(false);

    fetchPosts(true);
    fetchTrendingPosts(true);
    fetchUserPosts(true);
    fetchGroups(true);
    fetchTrendingHashtags();
    fetchSuggestedUsers(true);
  };

  const fetchPosts = useCallback(async (reset: boolean = false) => {
    try {
      if (!reset && (!hasMorePosts || isLoadingMorePosts)) return;

      setIsLoading(reset);
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : postsOffset;

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('privacy', 'public');

      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'popular') {
        query = query.order('likes_count', { ascending: false });
      }

      const { data: postsData, error: postsError } = await query
        .range(currentOffset, currentOffset + DEFAULT_LIMITS.POSTS_PER_PAGE - 1);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setHasMorePosts(false);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds),
        currentUserIdRef.current ? supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', currentUserIdRef.current)
          .in('post_id', postIds) : { data: [] },
        currentUserIdRef.current ? supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', currentUserIdRef.current)
          .in('post_id', postIds) : { data: [] }
      ]);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeResult.data?.some(like => like.post_id === post.id) || false;
        const isBookmarked = bookmarkResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({
            ...m,
            type: m.type as "image" | "video" | "document"
          })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      if (reset) {
        setPosts(transformedPosts);
        setPostsOffset(transformedPosts.length);
      } else {
        setPosts(prev => [...prev, ...transformedPosts]);
        setPostsOffset(prev => prev + transformedPosts.length);
      }

      if (transformedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMorePosts(false);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [sortBy, filterBy, hasMorePosts, isLoadingMorePosts, postsOffset]);

  const fetchTrendingPosts = useCallback(async (reset: boolean = false) => {
    try {
      if (!reset && (!hasMoreTrendingPosts || isLoadingMorePosts)) return;

      setIsLoading(reset);
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : trendingPostsOffset;

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('privacy', 'public')
        .order('likes_count', { ascending: false })
        .order('comments_count', { ascending: false });

      const { data: postsData, error: postsError } = await query
        .range(currentOffset, currentOffset + DEFAULT_LIMITS.POSTS_PER_PAGE - 1);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setHasMoreTrendingPosts(false);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds),
        currentUserIdRef.current
          ? supabase
            .from('social_likes')
            .select('post_id')
            .eq('user_id', currentUserIdRef.current)
            .in('post_id', postIds)
          : { data: [] },
        currentUserIdRef.current
          ? supabase
            .from('social_bookmarks')
            .select('post_id')
            .eq('user_id', currentUserIdRef.current)
            .in('post_id', postIds)
          : { data: [] }
      ]);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeResult.data?.some(like => like.post_id === post.id) || false;
        const isBookmarked = bookmarkResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({
            ...m,
            type: m.type as "image" | "video" | "document"
          })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      if (reset) {
        setTrendingPosts(transformedPosts);
        setTrendingPostsOffset(transformedPosts.length);
      } else {
        setTrendingPosts(prev => [...prev, ...transformedPosts]);
        setTrendingPostsOffset(prev => prev + transformedPosts.length);
      }

      if (transformedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMoreTrendingPosts(false);
      }
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      toast.error('Failed to load trending posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [hasMoreTrendingPosts, isLoadingMorePosts, trendingPostsOffset, currentUserIdRef]);

  const fetchUserPosts = useCallback(async (reset: boolean = false) => {
    try {
      if (!reset && (!hasMoreUserPosts || isLoadingUserPosts)) return;

      setIsLoadingUserPosts(reset);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserPosts([]);
        setIsLoadingUserPosts(false);
        return;
      }

      const currentOffset = reset ? 0 : userPostsOffset;

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      const { data: postsData, error: postsError } = await query
        .range(currentOffset, currentOffset + DEFAULT_LIMITS.POSTS_PER_PAGE - 1);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setHasMoreUserPosts(false);
        setIsLoadingUserPosts(false);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds),
        supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)
      ]);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeResult.data?.some(like => like.post_id === post.id) || false;
        const isBookmarked = bookmarkResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      if (reset) {
        setUserPosts(transformedPosts);
        setUserPostsOffset(transformedPosts.length);
      } else {
        setUserPosts(prev => [...prev, ...transformedPosts]);
        setUserPostsOffset(prev => prev + transformedPosts.length);
      }

      if (transformedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMoreUserPosts(false);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
      toast.error('Failed to load user posts');
    } finally {
      setIsLoadingUserPosts(false);
    }
  }, [hasMoreUserPosts, isLoadingUserPosts, userPostsOffset]);

  // FIXED: Fetch Groups - removed dependency on currentUser, use currentUserIdRef instead
  const fetchGroups = useCallback(async (reset = true) => {
    // Don't fetch if user isn't authenticated
    if (!currentUserIdRef.current) {
      setIsLoadingGroups(false);
      return;
    }

    if (reset) {
      groupPageRef.current = 0;
      setGroups([]);
      setHasMoreGroups(true);
    }
    if (!hasMoreGroups && !reset) return;

    const start = groupPageRef.current * GROUP_LIMIT;
    const end = start + GROUP_LIMIT - 1;

    try {
      if (!reset) setIsLoadingMoreGroups(true);
      else setIsLoadingGroups(true);

      const { data: publicGroups, error: publicError } = await supabase
        .from('social_groups')
        .select(`
          *,
          creator:social_users!social_groups_created_by_fkey(*)
        `)
        .eq('privacy', 'public')
        .range(start, end)
        .order('created_at', { ascending: false });

      if (publicError) throw publicError;

      const { data: memberGroups, error: memberError } = await supabase
        .from('social_group_members')
        .select(`
          user_id,
          role,
          status,
          group:social_groups!social_group_members_group_id_fkey(
            *,
            creator:social_users!social_groups_created_by_fkey(*)
          )
        `)
        .eq('user_id', currentUserIdRef.current)
        .eq('status', 'active')
        .range(start, end)
        .order('joined_at', { ascending: false });

      if (memberError) throw memberError;

      const groupsMap = new Map();

      publicGroups?.forEach(group => {
        groupsMap.set(group.id, {
          ...group,
          is_member: false,
          member_role: null,
          member_status: null,
        });
      });

      memberGroups?.forEach(membership => {
        const group = membership.group;
        groupsMap.set(group.id, {
          ...group,
          creator: group.creator,
          is_member: true,
          member_role: membership.role,
          member_status: membership.status,
        });
      });

      const newGroups = Array.from(groupsMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, GROUP_LIMIT) as SocialGroupWithDetails[];

      setGroups(prev => reset ? newGroups : [...prev, ...newGroups]);
      groupPageRef.current += 1;

      if (newGroups.length < GROUP_LIMIT) {
        setHasMoreGroups(false);
      }

    } catch (error) {
      console.error('Error fetching groups:', error);
      setHasMoreGroups(false);
      toast.error('Failed to load groups.');
    } finally {
      setIsLoadingGroups(false);
      setIsLoadingMoreGroups(false);
    }
  }, [hasMoreGroups]); // Removed currentUser dependency

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
      console.error('Error fetching trending hashtags:', error);
    }
  };
  // Add these fetch functions:
  const fetchLikedPosts = useCallback(async () => {
    try {
      setIsLoadingLikedPosts(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLikedPosts([]);
        return;
      }

      // Get all liked post IDs
      const { data: likesData, error: likesError } = await supabase
        .from('social_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (likesError) throw likesError;
      if (!likesData || likesData.length === 0) {
        setLikedPosts([]);
        return;
      }

      const postIds = likesData.map(like => like.post_id);

      // Fetch full post details
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select(`
        *,
        author:social_users(*),
        group:social_groups(*),
        media:social_media(*)
      `)
        .in('id', postIds);

      if (postsError) throw postsError;
      if (!postsData) {
        setLikedPosts([]);
        return;
      }

      // Fetch hashtags and tags
      const [hashtagResult, tagResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds)
      ]);

      // Transform posts
      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: true, // Always true for liked posts
          is_bookmarked: false // Will need to check if also bookmarked
        };
      });

      setLikedPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
      toast.error('Failed to load liked posts');
    } finally {
      setIsLoadingLikedPosts(false);
    }
  }, []);

  const fetchBookmarkedPosts = useCallback(async () => {
    try {
      setIsLoadingBookmarkedPosts(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBookmarkedPosts([]);
        return;
      }

      // Get all bookmarked post IDs
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('social_bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookmarksError) throw bookmarksError;
      if (!bookmarksData || bookmarksData.length === 0) {
        setBookmarkedPosts([]);
        return;
      }

      const postIds = bookmarksData.map(bookmark => bookmark.post_id);

      // Fetch full post details
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select(`
        *,
        author:social_users(*),
        group:social_groups(*),
        media:social_media(*)
      `)
        .in('id', postIds);

      if (postsError) throw postsError;
      if (!postsData) {
        setBookmarkedPosts([]);
        return;
      }

      // Fetch hashtags and tags
      const [hashtagResult, tagResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds)
      ]);

      // Transform posts
      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: false, // Will need to check if also liked
          is_bookmarked: true // Always true for bookmarked posts
        };
      });

      setBookmarkedPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching bookmarked posts:', error);
      toast.error('Failed to load bookmarked posts');
    } finally {
      setIsLoadingBookmarkedPosts(false);
    }
  }, []);

  const fetchSuggestedUsers = useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          setIsLoadingSuggestedUsers(true);
          setSuggestedUsersOffset(0);
          setSuggestedUsers([]);
          setHasMoreSuggestedUsers(true);
        } else if (isLoadingSuggestedUsers || !hasMoreSuggestedUsers) {
          return;
        } else {
          setIsLoadingSuggestedUsers(true);
        }
  
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoadingSuggestedUsers(false);
          return;
        }
  
        const currentOffset = reset ? 0 : suggestedUsersOffset;
        const limit = DEFAULT_LIMITS.SUGGESTED_USERS;
  
        // --------------------------------------------------------------
        // 1. Get the IDs we already follow (and ourselves)
        // --------------------------------------------------------------
        const { data: followingData } = await supabase
          .from('social_follows')
          .select('following_id')
          .eq('follower_id', user.id);
  
        const followingIds = followingData?.map(f => f.following_id) ?? [];
        const excludeIds = [...followingIds, user.id];
  
        // --------------------------------------------------------------
        // 2. Call the RPC that does **all** the scoring + ordering
        // --------------------------------------------------------------
         const { data, error } = await supabase
          .rpc('get_suggested_users', {
            p_user_id: user.id,
            p_exclude_ids: excludeIds,
            p_limit: limit,
            p_offset: currentOffset,
          });
  
        const scoredUsers = data as SuggestedUser[] | null;
  
        if (error) throw error;
  
        if (!scoredUsers || scoredUsers.length === 0) {
          setHasMoreSuggestedUsers(false);
          setIsLoadingSuggestedUsers(false);
          return;
        }
  
        // --------------------------------------------------------------
        // 3. Update state – **no sorting needed**
        // --------------------------------------------------------------
        if (reset) {
          setSuggestedUsers(scoredUsers);
        } else {
          setSuggestedUsers(prev => [...prev, ...scoredUsers]);
        }
  
        setSuggestedUsersOffset(currentOffset + scoredUsers.length);
  
        if (scoredUsers.length < limit) {
          setHasMoreSuggestedUsers(false);
        }
      } catch (err) {
        console.error('Error fetching suggested users:', err);
        if (reset || suggestedUsers.length === 0) {
          toast.error('Failed to load suggested users');
        }
      } finally {
        setIsLoadingSuggestedUsers(false);
      }
    },
    [
      isLoadingSuggestedUsers,
      hasMoreSuggestedUsers,
      suggestedUsersOffset,
      suggestedUsers.length,
    ]
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
    refetchPosts: () => fetchPosts(true),
    refetchTrendingPosts: () => fetchTrendingPosts(true),
    refetchGroups: () => fetchGroups(true),
    refetchUserPosts: () => fetchUserPosts(true),
    refetchSuggestedUsers: () => fetchSuggestedUsers(true),
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
    // Realtime new-post helpers
    newPostsCount: newPostsBuffer.length,
    hasNewPosts,
    showNewPosts,
    clearNewPosts,
  };
};