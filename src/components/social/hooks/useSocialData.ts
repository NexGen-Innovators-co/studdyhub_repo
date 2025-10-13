import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../types/social';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

export const useSocialData = (userProfile: any, sortBy: SortBy, filterBy: FilterBy, onNotificationReceived?: (notification: any) => void) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<SocialPostWithDetails[]>([]);
  const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>([]);
  const [groups, setGroups] = useState<SocialGroupWithDetails[]>([]);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SocialUserWithDetails[]>([]);

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
// Constants
const POST_LIMIT = DEFAULT_LIMITS.POSTS_PER_PAGE;
const GROUP_LIMIT = DEFAULT_LIMITS.GROUPS_PER_PAGE;
  // Refs for cleanup
  const subscriptionsRef = useRef<any[]>([]);
  const currentUserIdRef = useRef<string | null>(null);


  // Initialize user and setup realtime listeners
  useEffect(() => {
    initializeSocialUser();
    return () => {
      // Cleanup all subscriptions
      subscriptionsRef.current.forEach(subscription => {
        subscription?.unsubscribe();
      });
    };
  }, []);

  // Fetch initial data when filters change
  useEffect(() => {
    resetAndFetchData();
  }, [sortBy, filterBy]);

  // Setup realtime listeners when user is available
  useEffect(() => {
    if (currentUser) {
      setupRealtimeListeners();
    }
  }, [currentUser]);

  const initializeSocialUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          return;
        }
        setCurrentUser(newSocialUser);
      } else if (!fetchError && socialUser) {
        setCurrentUser(socialUser);
      }
    } catch (error) {
      console.error('Error initializing social user:', error);
    }
  };

  const setupRealtimeListeners = () => {
    // Cleanup existing subscriptions
    subscriptionsRef.current.forEach(subscription => {
      subscription?.unsubscribe();
    });
    subscriptionsRef.current = [];

    // Listen to posts changes
    // const postsSubscription = supabase
    //   .channel('social_posts_changes')
    //   .on(
    //     'postgres_changes',
    //     {
    //       event: '*',
    //       schema: 'public',
    //       table: 'social_posts',
    //       filter: 'privacy=eq.public'
    //     },
    //     (payload) => {
    //       handlePostsRealtimeUpdate(payload);
    //     }
    //   )
    //   .subscribe();

    // Listen to notifications
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
            // Fetch the complete notification data with related information
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
                // Call the callback to update notifications state
                if (onNotificationReceived) {
                  onNotificationReceived(notificationData);
                }

                // Show toast notification
                let message = 'You have a new notification!';
                toast.info(message);
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

    

    // Listen to likes changes
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

    // Listen to comments changes
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

    // Listen to follows changes
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
            // Refresh suggested users when follow status changes
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
              fetchSuggestedUsers(true);
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.push(followsSubscription);
    }

    subscriptionsRef.current.push( likesSubscription, commentsSubscription);
  };

  const handlePostsRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Add new post to the beginning of the list if it matches current filters
      fetchPostDetails(newRecord.id).then(postDetails => {
        if (postDetails) {
          setPosts(prev => [postDetails, ...prev]);
          // Also update trending posts if it has high engagement
          if (postDetails.likes_count > 0 || postDetails.comments_count > 0) {
            setTrendingPosts(prev => [postDetails, ...prev.slice(0, DEFAULT_LIMITS.POSTS_PER_PAGE - 1)]);
          }
        }
      });
    } else if (eventType === 'UPDATE') {
      // Update existing post
      fetchPostDetails(newRecord.id).then(postDetails => {
        if (postDetails) {
          const updatePost = (prev: SocialPostWithDetails[]) =>
            prev.map(post => post.id === postDetails.id ? postDetails : post);

          setPosts(updatePost);
          setTrendingPosts(updatePost);
          setUserPosts(updatePost);
        }
      });
    } else if (eventType === 'DELETE') {
      // Remove deleted post
      const removePost = (prev: SocialPostWithDetails[]) =>
        prev.filter(post => post.id !== oldRecord.id);

      setPosts(removePost);
      setTrendingPosts(removePost);
      setUserPosts(removePost);
    }
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

      // Fetch hashtags and tags
      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`hashtag:social_hashtags(*)`)
        .eq('post_id', postId);

      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`tag:social_tags(*)`)
        .eq('post_id', postId);

      // Check user interactions
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
        media: postData.media || [],
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
    // Reset pagination states
    setPostsOffset(0);
    setTrendingPostsOffset(0);
    setUserPostsOffset(0);
    setSuggestedUsersOffset(0);
    setGroupsOffset(0);

    // Reset has more states
    setHasMorePosts(true);
    setHasMoreTrendingPosts(true);
    setHasMoreUserPosts(true);
    setHasMoreSuggestedUsers(true);
    setHasMoreGroups(true);

    // Clear existing data
    setPosts([]);
    setTrendingPosts([]);
    setUserPosts([]);
    setSuggestedUsers([]);
    setGroups([]);

    // Fetch initial data
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
          media: post.media || [],
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
          media: post.media || [],
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
  }, [hasMoreTrendingPosts, isLoadingMorePosts, trendingPostsOffset]);

  const fetchUserPosts = useCallback(async (reset: boolean = false) => {
    try {
      if (!reset && (!hasMoreUserPosts || isLoadingUserPosts)) return;

      setIsLoadingUserPosts(reset);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserPosts([]);
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
          media: post.media || [],
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

  
  // --- Fetch Groups ---
  const fetchGroups = useCallback(async (reset = true) => {
    const user = currentUser;
    if (!user) return;

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

      // Fetch groups and check membership status in one query
      let { data, error, count } = await supabase
        .from('social_groups')
        .select(`
          *,
          creator:social_users!social_groups_creator_id_fkey(*),
          member_status:social_group_members!inner(user_id, role, status)
        `, { count: 'exact' })
        // Only fetch public groups or groups where the current user is a member
        .or(`privacy.eq.public,member_status.user_id.eq.${user.id}`)
        .range(start, end)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const newGroups = (data as any[]).map(group => {
        const memberInfo = group.member_status.find((m: any) => m.user_id === user.id);

        return {
          ...group,
          creator: group.creator,
          is_member: !!memberInfo && memberInfo.status === 'active',
          member_role: memberInfo?.role || null,
          member_status: memberInfo?.status || null,
        } as SocialGroupWithDetails;
      });

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
  }, [currentUser, hasMoreGroups]); // Depend on currentUser to ensure group status is correct


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

  const fetchSuggestedUsers = useCallback(async (reset: boolean = false) => {
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

      // Get users the current user is already following
      const { data: followingData } = await supabase
        .from('social_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      const excludeIds = [...followingIds, user.id];

      // Get current user's interests
      const { data: currentUserData } = await supabase
        .from('social_users')
        .select('interests')
        .eq('id', user.id)
        .single();

      const userInterests = currentUserData?.interests || [];

      let query = supabase
        .from('social_users')
        .select('*')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .range(currentOffset, currentOffset + limit - 1);

      const { data: candidateUsers, error } = await query;

      if (error) throw error;

      if (!candidateUsers || candidateUsers.length === 0) {
        setHasMoreSuggestedUsers(false);
        setIsLoadingSuggestedUsers(false);
        return;
      }

      // Score and rank users
      const scoredUsers = candidateUsers.map(candidate => {
        let score = 0;

        // Common interests
        const commonInterests = candidate.interests?.filter(interest =>
          userInterests.includes(interest)
        ) || [];
        score += commonInterests.length * 10;

        // Recent activity
        const lastActive = new Date(candidate.last_active);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (lastActive > thirtyDaysAgo) {
          score += 5;
        }

        // Follower count
        const followerBonus = Math.min(candidate.followers_count / 100, 5);
        score += followerBonus;

        // Post activity
        const postBonus = Math.min(candidate.posts_count / 10, 3);
        score += postBonus;

        // Profile completeness
        let completenessScore = 0;
        if (candidate.avatar_url) completenessScore += 1;
        if (candidate.bio && candidate.bio !== 'New to the community!') completenessScore += 1;
        if (candidate.interests && candidate.interests.length > 0) completenessScore += 1;
        score += completenessScore;

        // Verified users
        if (candidate.is_verified) score += 2;

        return { ...candidate, recommendation_score: score };
      });

      const sortedUsers = scoredUsers.sort((a, b) => b.recommendation_score - a.recommendation_score);

      if (reset) {
        setSuggestedUsers(sortedUsers);
      } else {
        setSuggestedUsers(prev => [...prev, ...sortedUsers]);
      }

      setSuggestedUsersOffset(currentOffset + candidateUsers.length);

      if (candidateUsers.length < limit) {
        setHasMoreSuggestedUsers(false);
      }

    } catch (error) {
      console.error('Error fetching suggested users:', error);
      if (reset || suggestedUsers.length === 0) {
        toast.error('Failed to load suggested users');
      }
    } finally {
      setIsLoadingSuggestedUsers(false);
    }
  }, [isLoadingSuggestedUsers, hasMoreSuggestedUsers, suggestedUsersOffset, suggestedUsers.length]);

  // Load more functions
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
  };
};