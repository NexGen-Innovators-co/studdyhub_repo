import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../components/social/types/social';
import { DEFAULT_LIMITS } from '../components/social/utils/socialConstants';

import {
  CACHE_KEYS,
  CACHE_DURATION,
  saveToCache,
  loadFromCache,
  clearCache
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

// Optimized: Batch queries and cache frequently used data
// Dynamic feed algorithm: mixes engagement, recency, and randomization for varied content
const createPostQuery = (baseQuery: any, sortBy: SortBy) => {
  let query = baseQuery;

  if (sortBy === 'newest') {
    // Mix of newest posts with some randomization
    // Fetch more than needed and will shuffle in-memory
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'popular') {
    // Engagement-based algorithm: score = (likes + comments*2 + shares*3) / age_in_hours
    // This balances viral content with fresh content
    query = query.order('likes_count', { ascending: false });
  }

  return query;
};

const fetchPostRelations = async (postIds: string[], currentUserId: string | null) => {
  if (!postIds.length) return { hashtags: [], tags: [], likes: [], bookmarks: [] };

  const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
    supabase
      .from('social_post_hashtags')
      .select(`post_id, hashtag:social_hashtags(*)`)
      .in('post_id', postIds),
    supabase
      .from('social_post_tags')
      .select(`post_id, tag:social_tags(*)`)
      .in('post_id', postIds),
    currentUserId
      ? supabase
        .from('social_likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds)
      : { data: [] },
    currentUserId
      ? supabase
        .from('social_bookmarks')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds)
      : { data: [] }
  ]);

  return {
    hashtags: hashtagResult.data || [],
    tags: tagResult.data || [],
    likes: likeResult.data || [],
    bookmarks: bookmarkResult.data || []
  };
};

const transformPosts = (
  postsData: any[],
  relations: any
): SocialPostWithDetails[] => {
  return postsData.map(post => {
    const postHashtags = relations.hashtags
      .filter((ph: any) => ph.post_id === post.id)
      .map((ph: any) => ph.hashtag)
      .filter(Boolean);

    const postTags = relations.tags
      .filter((pt: any) => pt.post_id === post.id)
      .map((pt: any) => pt.tag)
      .filter(Boolean);

    const isLiked = relations.likes.some((like: any) => like.post_id === post.id);
    const isBookmarked = relations.bookmarks.some((bookmark: any) => bookmark.post_id === post.id);

    return {
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
      hashtags: postHashtags,
      tags: postTags,
      is_liked: isLiked,
      is_bookmarked: isBookmarked
    };
  });
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

  const POST_LIMIT = DEFAULT_LIMITS.POSTS_PER_PAGE;
  const GROUP_LIMIT = DEFAULT_LIMITS.GROUPS_PER_PAGE;

  const subscriptionsRef = useRef<any[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasCachedDataRef = useRef(false);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const groupPageRef = useRef<number>(0);

  // Cache for frequently accessed data
  const postRelationsCache = useRef<Map<string, any>>(new Map());

  // OPTIMIZED: Fetch posts with batched relations
  const fetchPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMorePosts || isLoadingMorePosts)) return;

    if (!navigator.onLine) {
        setIsLoading(false);
        setIsLoadingMorePosts(false);
        return;
    }

    try {
      setIsLoading(reset);
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : postsOffset;
      const fetchLimit = DEFAULT_LIMITS.POSTS_PER_PAGE * 3;

      let query = createPostQuery(
        supabase
          .from('social_posts')
          .select(`
            *,
            author:social_users(*),
            group:social_groups(*),
            media:social_media(*)
          `)
          .eq('privacy', 'public'),
        sortBy
      );

      const { data: postsData, error: postsError } = await query
        .range(currentOffset, currentOffset + fetchLimit - 1);

      if (postsError) {
        if (!navigator.onLine) {
          const offlinePosts = await offlineStorage.getAll<SocialPostWithDetails>(STORES.SOCIAL_POSTS);
          if (offlinePosts.length > 0) {
            setPosts(reset ? offlinePosts : uniqueById([...posts, ...offlinePosts]));
            setHasMorePosts(false);
            return;
          }
        }
        throw postsError;
      }
      
      if (!postsData || postsData.length === 0) {
        setHasMorePosts(false);
        return;
      }

      // Filter posts (same logic as before)
      const filteredPosts = postsData.filter(post => {
        if (post.author_id === currentUserIdRef.current) {
          const postCreatedAt = new Date(post.created_at).getTime();
          const now = Date.now();
          const fiveMinutesAgo = now - (5 * 60 * 1000);
          return postCreatedAt >= fiveMinutesAgo;
        }
        return true;
      });

      // DYNAMIC FEED ALGORITHM:
      // 1. Separate viewed and unviewed posts
      const unviewedPosts = filteredPosts.filter(p => !viewedPostIds.has(p.id));
      const viewedPosts = filteredPosts.filter(p => viewedPostIds.has(p.id));

      // 2. Apply smart shuffling to unviewed posts for variety
      // Shuffle using Fisher-Yates with engagement weight
      const shuffleWithEngagement = (posts: any[]) => {
        const weighted = [...posts];
        
        // Calculate engagement score for each post
        const withScores = weighted.map(post => ({
          post,
          // Engagement score: recent posts get boost, popular posts get boost
          score: (post.likes_count || 0) + 
                 (post.comments_count || 0) * 2 + 
                 (post.shares_count || 0) * 3 +
                 // Recency bonus: newer posts (within 24h) get up to 10 point boost
                 Math.max(0, 10 - ((Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24))),
          // Add randomness (0-5 points) to prevent always showing same top posts
          random: Math.random() * 5
        }));

        // Sort by combined score (engagement + recency + randomness)
        withScores.sort((a, b) => (b.score + b.random) - (a.score + a.random));
        
        return withScores.map(item => item.post);
      };

      // 3. Shuffle unviewed posts for variety, keep viewed posts at end
      const shuffledUnviewed = shuffleWithEngagement(unviewedPosts);
      const sortedViewed = viewedPosts.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // 4. Combine: unviewed posts first (shuffled), then viewed posts
      const reorderedPosts = [...shuffledUnviewed, ...sortedViewed];

      const selectedPosts = reorderedPosts.slice(0, POST_LIMIT);
      const postIds = selectedPosts.map(post => post.id);

      // OPTIMIZED: Batch fetch all relations at once
      const relations = await fetchPostRelations(postIds, currentUserIdRef.current);

      const transformedPosts = transformPosts(selectedPosts, relations);

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

      if (selectedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMorePosts(false);
      }
    } catch (error) {
      ////console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [sortBy, filterBy, hasMorePosts, isLoadingMorePosts, postsOffset, viewedPostIds]);

  // OPTIMIZED: Trending posts with same batching
  const fetchTrendingPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMoreTrendingPosts || isLoadingMorePosts)) return;

    if (!navigator.onLine) {
        setIsLoading(false);
        setIsLoadingMorePosts(false);
        return;
    }

    try {
      setIsLoading(reset);
      if (!reset) setIsLoadingMorePosts(true);

      const currentOffset = reset ? 0 : trendingPostsOffset;
      const fetchLimit = DEFAULT_LIMITS.POSTS_PER_PAGE * 3;

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

      if (currentUserIdRef.current) {
        query = query.neq('author_id', currentUserIdRef.current);
      }

      const { data: postsData, error: postsError } = await query
        .range(currentOffset, currentOffset + fetchLimit - 1);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setHasMoreTrendingPosts(false);
        return;
      }

      // DYNAMIC TRENDING ALGORITHM:
      // Add variety to trending posts instead of always showing same top posts
      const unviewedTrending = postsData.filter(p => !viewedPostIds.has(p.id));
      const viewedTrending = postsData.filter(p => viewedPostIds.has(p.id));

      // Mix trending posts with slight randomization to show variety
      const mixTrending = (posts: any[]) => {
        return posts.map(post => ({
          post,
          // Trending score: heavily weighted toward likes/comments but with small random factor
          score: (post.likes_count || 0) * 3 + 
                 (post.comments_count || 0) * 2 + 
                 (post.shares_count || 0) * 5 +
                 // Small random factor (0-2 points) for variety
                 Math.random() * 2
        }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.post);
      };

      const sortedUnviewed = mixTrending(unviewedTrending);
      const sortedViewed = mixTrending(viewedTrending);

      const reorderedPosts = [...sortedUnviewed, ...sortedViewed];
      const selectedPosts = reorderedPosts.slice(0, POST_LIMIT);
      const postIds = selectedPosts.map(post => post.id);

      // OPTIMIZED: Batch fetch relations
      const relations = await fetchPostRelations(postIds, currentUserIdRef.current);
      const transformedPosts = transformPosts(selectedPosts, relations);

      if (reset) {
        setTrendingPosts(uniqueById(transformedPosts));
        setTrendingPostsOffset(transformedPosts.length);
      } else {
        setTrendingPosts(prev => uniqueById([...prev, ...transformedPosts]));
        setTrendingPostsOffset(prev => prev + transformedPosts.length);
      }

      if (selectedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMoreTrendingPosts(false);
      }
    } catch (error) {
      ////console.error('Error fetching trending posts:', error);
      toast.error('Failed to load trending posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMorePosts(false);
    }
  }, [hasMoreTrendingPosts, isLoadingMorePosts, trendingPostsOffset, viewedPostIds]);

  // OPTIMIZED: User posts with batching
  const fetchUserPosts = useCallback(async (reset: boolean = false) => {
    if (!reset && (!hasMoreUserPosts || isLoadingUserPosts)) return;

    if (!navigator.onLine) {
        setIsLoadingUserPosts(false);
        return;
    }

    try {
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

      // OPTIMIZED: Batch fetch relations
      const relations = await fetchPostRelations(postIds, user.id);
      const transformedPosts = transformPosts(postsData, relations);

      if (reset) {
        setUserPosts(uniqueById(transformedPosts));
        setUserPostsOffset(transformedPosts.length);
      } else {
        setUserPosts(prev => uniqueById([...prev, ...transformedPosts]));
        setUserPostsOffset(prev => prev + transformedPosts.length);
      }

      if (transformedPosts.length < DEFAULT_LIMITS.POSTS_PER_PAGE) {
        setHasMoreUserPosts(false);
      }
    } catch (error) {
      ////console.error('Error fetching user posts:', error);
      toast.error('Failed to load user posts');
    } finally {
      setIsLoadingUserPosts(false);
    }
  }, [hasMoreUserPosts, isLoadingUserPosts, userPostsOffset]);

  // OPTIMIZED: Liked posts with batching
  const fetchLikedPosts = useCallback(async () => {
    try {
      setIsLoadingLikedPosts(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLikedPosts([]);
        return;
      }

      // Get liked post IDs
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

      // Fetch post details
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

      // OPTIMIZED: Batch fetch relations (excluding likes since we know they're liked)
      const [hashtagResult, tagResult, bookmarksResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
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
        const isBookmarked = bookmarksResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: true,
          is_bookmarked: isBookmarked
        };
      });

      setLikedPosts(transformedPosts);
    } catch (error) {
      ////console.error('Error fetching liked posts:', error);
      toast.error('Failed to load liked posts');
    } finally {
      setIsLoadingLikedPosts(false);
    }
  }, []);

  // OPTIMIZED: Bookmarked posts with batching
  const fetchBookmarkedPosts = useCallback(async () => {
    try {
      setIsLoadingBookmarkedPosts(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBookmarkedPosts([]);
        return;
      }

      // Get bookmarked post IDs
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('social_bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (bookmarksError) throw bookmarksError;
      if (!bookmarksData || bookmarksData.length === 0) {
        setBookmarkedPosts([]);
        return;
      }

      const postIds = bookmarksData.map(bookmark => bookmark.post_id);

      // Fetch post details
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

      // OPTIMIZED: Batch fetch relations (excluding bookmarks since we know they're bookmarked)
      const [hashtagResult, tagResult, likesResult] = await Promise.all([
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
          .in('post_id', postIds)
      ]);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likesResult.data?.some(like => like.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({ ...m, type: m.type as "image" | "video" | "document" })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: true
        };
      });

      setBookmarkedPosts(transformedPosts);
    } catch (error) {
      ////console.error('Error fetching bookmarked posts:', error);
      toast.error('Failed to load bookmarked posts');
    } finally {
      setIsLoadingBookmarkedPosts(false);
    }
  }, []);

  // OPTIMIZED: Groups query - simplified and more efficient
  const fetchGroups = useCallback(async (reset = true) => {
    if (!currentUserIdRef.current) return;
    if (!reset && (!hasMoreGroups || isLoadingMoreGroups)) return;
    
    // Removed the guard that was blocking initial load when isLoadingGroups was true
    // if (reset && isLoadingGroups) return;

    const limit = DEFAULT_LIMITS.GROUPS_PER_PAGE;
    const offset = reset ? 0 : groupsOffset;

    try {
      setIsLoadingMoreGroups(!reset);
      if (reset) setIsLoadingGroups(true);

      // OPTIMIZED: Single query with proper filtering
      // We fetch all groups to allow discovery, and then check membership
      const { data: rawGroups, error } = await supabase
        .from('social_groups')
        .select(`
          *,
          creator:social_users!social_groups_created_by_fkey(*),
          members:social_group_members(count)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

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

      // Fetch memberships for these groups for the current user separately
      // to avoid filtering out groups the user hasn't joined yet
      const groupIds = (rawGroups || []).map(g => g.id);
      let memberships: any[] = [];
      
      if (groupIds.length > 0 && currentUserIdRef.current) {
        const { data: membershipData } = await supabase
          .from('social_group_members')
          .select('group_id, role, status')
          .eq('user_id', currentUserIdRef.current)
          .in('group_id', groupIds);
        memberships = membershipData || [];
      }

      const groupsWithDetails: SocialGroupWithDetails[] = (rawGroups || []).map(g => {
        const membership = memberships.find(m => m.group_id === g.id);
        return {
          ...g,
          creator: g.creator,
          members_count: g.members[0]?.count || g.members_count || 0,
          is_member: !!membership,
          member_role: membership?.role || null,
          member_status: membership?.status || null,
        };
      });

      if (reset) {
        setGroups(groupsWithDetails);
      } else {
        setGroups(prev => [...prev, ...groupsWithDetails]);
      }

      setHasMoreGroups(groupsWithDetails.length === limit);
      setGroupsOffset(offset + groupsWithDetails.length);

      // Save to offline storage
      if (groupsWithDetails.length > 0) {
        await offlineStorage.saveAll(STORES.SOCIAL_GROUPS, groupsWithDetails);
      }

      saveToCache(CACHE_KEYS.GROUPS, reset ? groupsWithDetails : [...groups, ...groupsWithDetails]);
    } catch (err) {
      ////console.error('Error fetching groups:', err);
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
                toast.info('You have a new notification!');
              }
            } catch (error) {
              ////console.error('Error fetching notification details:', error);
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
            
            // If it's the current user, we skip the count increment because 
            // it's already handled by the manual update in useSocialActions.toggleLike
            const likesChange = isCurrentUser ? 0 : (eventType === 'INSERT' ? 1 : eventType === 'DELETE' ? -1 : 0);

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

  const fetchSuggestedUsers = useCallback(
    async (reset: boolean = false) => {
      if (!reset && (isLoadingSuggestedUsers || !hasMoreSuggestedUsers)) {
        return;
      }

      try {
        setIsLoadingSuggestedUsers(true);
        if (reset) {
          setSuggestedUsersOffset(0);
          setSuggestedUsers([]);
          setHasMoreSuggestedUsers(true);
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
        const excludeIds = [user.id, ...followingIds];

        // --------------------------------------------------------------
        // 2. Fetch potential candidates and calculate mutual follows
        // --------------------------------------------------------------
        let mutualFollowsMap: Record<string, number> = {};
        if (followingIds.length > 0) {
          const { data: mutuals } = await supabase
            .from('social_follows')
            .select('following_id')
            .in('follower_id', followingIds.slice(0, 50));
          
          mutuals?.forEach(m => {
            if (!excludeIds.includes(m.following_id)) {
              mutualFollowsMap[m.following_id] = (mutualFollowsMap[m.following_id] || 0) + 1;
            }
          });
        }

        // Fetch a pool of users to score
        const poolIds = Object.keys(mutualFollowsMap);
        let userPool: SocialUserWithDetails[] = [];

        if (poolIds.length > 0) {
          const { data: mutualPool } = await supabase
            .from('social_users')
            .select('*')
            .in('id', poolIds.slice(0, 100));
          if (mutualPool) userPool = mutualPool as SocialUserWithDetails[];
        }

        // Also fetch some popular users to fill the pool
        let popularQuery = supabase
          .from('social_users')
          .select('*');
        
        if (excludeIds.length > 0) {
          popularQuery = popularQuery.not('id', 'in', `(${excludeIds.slice(0, 100).join(',')})`);
        }

        const { data: popularPool } = await popularQuery
          .order('followers_count', { ascending: false })
          .limit(50);
        
        if (popularPool) {
          const existingIds = new Set(userPool.map(u => u.id));
          popularPool.forEach(u => {
            if (!existingIds.has(u.id) && !excludeIds.includes(u.id)) {
              userPool.push(u as SocialUserWithDetails);
            }
          });
        }

        // --------------------------------------------------------------
        // 3. Scoring Algorithm
        // --------------------------------------------------------------
        const userInterests = currentUser?.interests || [];
        
        const scoredUsers: SuggestedUser[] = userPool.map(poolUser => {
          let score = 0;

          // Mutual follows score (High weight)
          const mutualCount = mutualFollowsMap[poolUser.id] || 0;
          score += mutualCount * 15;

          // Interest match score (Medium weight)
          if (userInterests.length > 0 && poolUser.interests) {
            const commonInterests = poolUser.interests.filter(interest => 
              userInterests.includes(interest)
            );
            score += commonInterests.length * 10;
          }

          // Popularity score (Low weight)
          score += Math.min((poolUser.followers_count || 0) / 10, 20);

          // Activity score (Medium weight)
          score += Math.min((poolUser.posts_count || 0) / 5, 15);

          // Recency bonus
          const lastActive = poolUser.last_active ? new Date(poolUser.last_active) : new Date(0);
          const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 3600 * 24);
          if (daysSinceActive < 3) score += 15;
          else if (daysSinceActive < 7) score += 5;

          return {
            ...poolUser,
            recommendation_score: score,
            mutual_friends_count: mutualCount,
            is_following: false,
            is_followed_by: false
          };
        });

        // Sort by score
        scoredUsers.sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

        // Paginate
        const paginatedUsers = scoredUsers.slice(currentOffset, currentOffset + limit);

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
        setHasMoreSuggestedUsers(currentOffset + paginatedUsers.length < scoredUsers.length);

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