// supabase/functions/get-social-feed/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { fetchPostsWithRelations, scoreAndSortPosts } from '../utils/post-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const {
      mode = 'feed',         // 'feed' | 'trending' | 'user' | 'liked' | 'bookmarked'
      sortBy = 'newest',     // 'newest' | 'popular'
      offset = 0,
      limit = 15,
      viewedPostIds = [],    // IDs of already-viewed posts for feed algorithm
    } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fetchLimit = limit * 3; // Over-fetch for scoring/shuffling

    let postsData: any[] = [];

    if (mode === 'liked') {
      // Get liked post IDs, then fetch those posts
      const { data: likesData, error: likesError } = await supabase
        .from('social_likes')
        .select('post_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (likesError) throw likesError;
      if (!likesData || likesData.length === 0) {
        return new Response(JSON.stringify({ posts: [], hasMore: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const likedPostIds = likesData.map((l: any) => l.post_id);

      const { data, error } = await supabase
        .from('social_posts')
        .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`)
        .in('id', likedPostIds);

      if (error) throw error;
      postsData = data || [];

      // For liked posts, mark all as liked and fetch only bookmark/hashtag/tag relations
      const postIds = postsData.map((p: any) => p.id);
      const [hashtagResult, tagResult, bookmarksResult] = await Promise.all([
        supabase.from('social_post_hashtags').select('post_id, hashtag:social_hashtags(*)').in('post_id', postIds),
        supabase.from('social_post_tags').select('post_id, tag:social_tags(*)').in('post_id', postIds),
        supabase.from('social_bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
      ]);

      const transformedPosts = postsData.map((post: any) => ({
        ...post,
        hashtags: (hashtagResult.data || []).filter((ph: any) => ph.post_id === post.id).map((ph: any) => ph.hashtag).filter(Boolean),
        tags: (tagResult.data || []).filter((pt: any) => pt.post_id === post.id).map((pt: any) => pt.tag).filter(Boolean),
        is_liked: true,
        is_bookmarked: (bookmarksResult.data || []).some((bm: any) => bm.post_id === post.id),
      }));

      return new Response(JSON.stringify({ posts: transformedPosts, hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (mode === 'bookmarked') {
      // Get bookmarked post IDs, then fetch those posts
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('social_bookmarks')
        .select('post_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (bookmarksError) throw bookmarksError;
      if (!bookmarksData || bookmarksData.length === 0) {
        return new Response(JSON.stringify({ posts: [], hasMore: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookmarkedPostIds = bookmarksData.map((b: any) => b.post_id);

      const { data, error } = await supabase
        .from('social_posts')
        .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`)
        .in('id', bookmarkedPostIds);

      if (error) throw error;
      postsData = data || [];

      const postIds = postsData.map((p: any) => p.id);
      const [hashtagResult, tagResult, likesResult] = await Promise.all([
        supabase.from('social_post_hashtags').select('post_id, hashtag:social_hashtags(*)').in('post_id', postIds),
        supabase.from('social_post_tags').select('post_id, tag:social_tags(*)').in('post_id', postIds),
        supabase.from('social_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
      ]);

      const transformedPosts = postsData.map((post: any) => ({
        ...post,
        hashtags: (hashtagResult.data || []).filter((ph: any) => ph.post_id === post.id).map((ph: any) => ph.hashtag).filter(Boolean),
        tags: (tagResult.data || []).filter((pt: any) => pt.post_id === post.id).map((pt: any) => pt.tag).filter(Boolean),
        is_liked: (likesResult.data || []).some((l: any) => l.post_id === post.id),
        is_bookmarked: true,
      }));

      return new Response(JSON.stringify({ posts: transformedPosts, hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Feed / Trending / User modes
      let query = supabase
        .from('social_posts')
        .select(`*, author:social_users(*), group:social_groups(*), media:social_media(*)`);

      if (mode === 'user') {
        query = query.eq('author_id', userId).order('created_at', { ascending: false });
      } else if (mode === 'trending') {
        query = query
          .eq('privacy', 'public')
          .neq('author_id', userId)
          .order('likes_count', { ascending: false })
          .order('comments_count', { ascending: false });
      } else {
        // Default feed
        query = query.eq('privacy', 'public');
        if (sortBy === 'popular') {
          query = query.order('likes_count', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }
      }

      const { data, error } = await query.range(offset, offset + fetchLimit - 1);
      if (error) throw error;
      postsData = data || [];
    }

    if (postsData.length === 0) {
      return new Response(JSON.stringify({ posts: [], hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For feed mode, filter out own posts older than 5 min
    if (mode === 'feed') {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      postsData = postsData.filter((post: any) => {
        if (post.author_id === userId) {
          return new Date(post.created_at).getTime() >= fiveMinAgo;
        }
        return true;
      });
    }

    // Apply scoring/shuffling for feed and trending
    if (mode === 'feed' || mode === 'trending') {
      postsData = scoreAndSortPosts(postsData, viewedPostIds, mode);
    }

    // Take only what we need
    const selectedPosts = postsData.slice(0, limit);
    const postIds = selectedPosts.map((p: any) => p.id);

    // Batch fetch all relations
    const transformedPosts = await fetchPostsWithRelations(
      supabase,
      postIds,
      selectedPosts,
      userId
    );

    return new Response(
      JSON.stringify({
        posts: transformedPosts,
        hasMore: postsData.length >= limit,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-social-feed error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
