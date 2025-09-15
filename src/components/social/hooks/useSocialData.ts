import { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../types/social';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

export const useSocialData = (userProfile: any, sortBy: SortBy, filterBy: FilterBy) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<SocialPostWithDetails[]>([]);
  const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>([]);
  const [groups, setGroups] = useState<SocialGroupWithDetails[]>([]);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SocialUserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingUserPosts, setIsLoadingUserPosts] = useState(true);
  
  // New states for suggested users pagination
  const [suggestedUsersOffset, setSuggestedUsersOffset] = useState(0);
  const [isLoadingSuggestedUsers, setIsLoadingSuggestedUsers] = useState(false);
  const [hasMoreSuggestedUsers, setHasMoreSuggestedUsers] = useState(true);

  useEffect(() => {
    initializeSocialUser();
    fetchPosts();
    fetchTrendingPosts();
    fetchUserPosts();
    fetchGroups();
    fetchTrendingHashtags();
    fetchSuggestedUsers(true); // Reset pagination when filters change
  }, [sortBy, filterBy]);

  const initializeSocialUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
            display_name: userProfile?.full_name ||  `user_${user.id.slice(0, 8)}`,
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

  const fetchPosts = async () => {
    try {
      setIsLoading(true);

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

      const { data: postsData, error: postsError } = await query.limit(DEFAULT_LIMITS.POSTS_PER_PAGE);

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`post_id, hashtag:social_hashtags(*)`)
        .in('post_id', postIds);

      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`post_id, tag:social_tags(*)`)
        .in('post_id', postIds);

      const { data: { user } } = await supabase.auth.getUser();
      let likeData = [], bookmarkData = [];

      if (user) {
        const { data: likes } = await supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        likeData = likes || [];

        const { data: bookmarks } = await supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        bookmarkData = bookmarks || [];
      }

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagData?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagData?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeData.some(like => like.post_id === post.id);
        const isBookmarked = bookmarkData.some(bookmark => bookmark.post_id === post.id);

        return {
          ...post,
          media: post.media || [],
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendingPosts = async () => {
    try {
      setIsLoading(true);
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
        .order('comments_count', { ascending: false })
        .limit(DEFAULT_LIMITS.POSTS_PER_PAGE);

      const { data: postsData, error: postsError } = await query;

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setTrendingPosts([]);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`post_id, hashtag:social_hashtags(*)`)
        .in('post_id', postIds);

      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`post_id, tag:social_tags(*)`)
        .in('post_id', postIds);

      const { data: { user } } = await supabase.auth.getUser();
      let likeData = [], bookmarkData = [];

      if (user) {
        const { data: likes } = await supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        likeData = likes || [];

        const { data: bookmarks } = await supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);
        bookmarkData = bookmarks || [];
      }

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagData?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagData?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeData.some(like => like.post_id === post.id);
        const isBookmarked = bookmarkData.some(bookmark => bookmark.post_id === post.id);

        return {
          ...post,
          media: post.media || [],
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      setTrendingPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      toast.error('Failed to load trending posts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    try {
      setIsLoadingUserPosts(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserPosts([]);
        return;
      }

      let query = supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(DEFAULT_LIMITS.POSTS_PER_PAGE);

      const { data: postsData, error: postsError } = await query;

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setUserPosts([]);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`post_id, hashtag:social_hashtags(*)`)
        .in('post_id', postIds);

      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`post_id, tag:social_tags(*)`)
        .in('post_id', postIds);

      const likeData = await supabase
        .from('social_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      const bookmarkData = await supabase
        .from('social_bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagData?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagData?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeData.data?.some(like => like.post_id === post.id) || false;
        const isBookmarked = bookmarkData.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          media: post.media || [],
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked
        };
      });

      setUserPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
      toast.error('Failed to load user posts');
    } finally {
      setIsLoadingUserPosts(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from('social_groups')
        .select(`
          *,
          creator:social_users(*),
          members:social_group_members(*)
        `)
        .eq('privacy', 'public');

      const { data: groupsData, error: groupsError } = await query.limit(DEFAULT_LIMITS.GROUPS_PER_PAGE);

      if (groupsError) throw groupsError;

      const transformedGroups = groupsData.map(group => {
        const isMember = user ? group.members.some((m: any) => m.user_id === user.id) : false;
        return {
          ...group,
          is_member: isMember,
          member_role: isMember ? group.members.find((m: any) => m.user_id === user.id)?.role : undefined
        };
      });

      setGroups(transformedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setIsLoadingGroups(false);
    }
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
      console.error('Error fetching trending hashtags:', error);
    }
  };

  // Enhanced suggested users fetching with proper filtering and pagination
  const fetchSuggestedUsers = async (reset: boolean = false) => {
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

      // Step 1: Get users the current user is already following
      const { data: followingData } = await supabase
        .from('social_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      // Add current user ID to exclusion list
      const excludeIds = [...followingIds, user.id];

      // Step 2: Get current user's interests for better recommendations
      const { data: currentUserData } = await supabase
        .from('social_users')
        .select('interests')
        .eq('id', user.id)
        .single();

      const userInterests = currentUserData?.interests || [];

      // Step 3: Build the query with multiple scoring factors
      let query = supabase
        .from('social_users')
        .select('*')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .range(currentOffset, currentOffset + limit - 1);

      // Step 4: Implement smart sorting algorithm
      const { data: candidateUsers, error } = await query;

      if (error) throw error;

      if (!candidateUsers || candidateUsers.length === 0) {
        setHasMoreSuggestedUsers(false);
        setIsLoadingSuggestedUsers(false);
        return;
      }

      // Step 5: Score and rank users based on multiple factors
      const scoredUsers = candidateUsers.map(candidate => {
        let score = 0;

        // Factor 1: Common interests (highest weight)
        const commonInterests = candidate.interests?.filter(interest => 
          userInterests.includes(interest)
        ) || [];
        score += commonInterests.length * 10;

        // Factor 2: Recent activity (users active in last 30 days)
        const lastActive = new Date(candidate.last_active);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (lastActive > thirtyDaysAgo) {
          score += 5;
        }

        // Factor 3: Follower count (moderate weight - popular but not overwhelming)
        const followerBonus = Math.min(candidate.followers_count / 100, 5);
        score += followerBonus;

        // Factor 4: Post activity (users who create content)
        const postBonus = Math.min(candidate.posts_count / 10, 3);
        score += postBonus;

        // Factor 5: Profile completeness
        let completenessScore = 0;
        if (candidate.avatar_url) completenessScore += 1;
        if (candidate.bio && candidate.bio !== 'New to the community!') completenessScore += 1;
        if (candidate.interests && candidate.interests.length > 0) completenessScore += 1;
        score += completenessScore;

        // Factor 6: Verified users get a small boost
        if (candidate.is_verified) score += 2;

        return { ...candidate, recommendation_score: score };
      });

      // Sort by recommendation score
      const sortedUsers = scoredUsers.sort((a, b) => b.recommendation_score - a.recommendation_score);

      // Update state
      if (reset) {
        setSuggestedUsers(sortedUsers);
      } else {
        setSuggestedUsers(prev => [...prev, ...sortedUsers]);
      }

      setSuggestedUsersOffset(currentOffset + candidateUsers.length);
      
      // Check if we have more users to load
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
  };

  // Function to load more suggested users
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
    hasMoreSuggestedUsers,
    refetchPosts: fetchPosts,
    refetchGroups: fetchGroups,
    refetchUserPosts: fetchUserPosts,
    refetchSuggestedUsers: () => fetchSuggestedUsers(true),
    loadMoreSuggestedUsers,
  };
};