import { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../types/social';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

export const useSocialData = (userProfile: any, sortBy: SortBy, filterBy: FilterBy) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<SocialPostWithDetails[]>([]);
  const [userPosts, setUserPosts] = useState<SocialPostWithDetails[]>([]); // New state for user posts
  const [groups, setGroups] = useState<SocialGroupWithDetails[]>([]);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SocialUserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingUserPosts, setIsLoadingUserPosts] = useState(true); // New loading state for user posts

  useEffect(() => {
    initializeSocialUser();
    fetchPosts();
    fetchTrendingPosts();
    fetchUserPosts(); // New function call
    fetchGroups();
    fetchTrendingHashtags();
    fetchSuggestedUsers();
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
            display_name: userProfile?.full_name || 'Anonymous User',
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

  const fetchSuggestedUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_users')
        .select('*')
        .neq('id', user.id)
        .order('followers_count', { ascending: false })
        .limit(DEFAULT_LIMITS.SUGGESTED_USERS);

      if (!error && data) {
        setSuggestedUsers(data);
      }
    } catch (error) {
      console.error('Error fetching suggested users:', error);
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
    setCurrentUser, // Added to allow updating currentUser after profile changes
    trendingHashtags,
    suggestedUsers,
    setSuggestedUsers,
    isLoading,
    isLoadingGroups,
    isLoadingUserPosts,
    refetchPosts: fetchPosts,
    refetchGroups: fetchGroups,
    refetchUserPosts: fetchUserPosts,
  };
};