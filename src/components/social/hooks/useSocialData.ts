import { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { SortBy, FilterBy } from '../types/social';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

export const useSocialData = (userProfile: any, sortBy: SortBy, filterBy: FilterBy) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [currentUser, setCurrentUser] = useState<SocialUserWithDetails | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SocialUserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSocialUser();
    fetchPosts();
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

      // Apply sorting
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

      // Fetch hashtags
      const { data: hashtagData } = await supabase
        .from('social_post_hashtags')
        .select(`post_id, hashtag:social_hashtags(*)`)
        .in('post_id', postIds);

      // Fetch tags
      const { data: tagData } = await supabase
        .from('social_post_tags')
        .select(`post_id, tag:social_tags(*)`)
        .in('post_id', postIds);

      // Check likes and bookmarks
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
    currentUser,
    trendingHashtags,
    suggestedUsers,
    setSuggestedUsers,
    isLoading,
    refetchPosts: fetchPosts,
  };
};