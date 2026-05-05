// supabase/functions/get-user-posts-metadata/index.ts
// Consolidates: fetch user posts + hashtags + tags + like status + bookmark status (5 queries → 1 call)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

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

    // Auth is optional — viewer may be anonymous
    let viewerId: string | null = null;
    try {
      viewerId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    } catch (_) {
      // Anonymous viewer
    }

    const body = await req.json();
    const { author_id, offset = 0, limit = 10 } = body;

    if (!author_id) {
      return createErrorResponse('author_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch posts with author, group, media
    const { data: postsData, error: postsError } = await supabase
      .from('social_posts')
      .select(`
        *,
        author:social_users(*),
        group:social_groups(*),
        media:social_media(*)
      `)
      .eq('author_id', author_id)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!postsData || postsData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, posts: [], has_more: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const postIds = postsData.map(p => p.id);

    // 2. Fetch metadata in parallel
    const metadataQueries: Promise<any>[] = [
      supabase.from('social_post_hashtags').select('post_id, hashtag:social_hashtags(*)').in('post_id', postIds),
      supabase.from('social_post_tags').select('post_id, tag:social_tags(*)').in('post_id', postIds),
    ];

    if (viewerId) {
      metadataQueries.push(
        supabase.from('social_likes').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
        supabase.from('social_bookmarks').select('post_id').eq('user_id', viewerId).in('post_id', postIds)
      );
    }

    const results = await Promise.all(metadataQueries);
    const [hashtagResult, tagResult, likeResult, bookmarkResult] = results;

    // 3. Transform posts with metadata
    const posts = postsData.map(post => {
      const postHashtags = hashtagResult.data?.filter((ph: any) => ph.post_id === post.id)?.map((ph: any) => ph.hashtag)?.filter(Boolean) || [];
      const postTags = tagResult.data?.filter((pt: any) => pt.post_id === post.id)?.map((pt: any) => pt.tag)?.filter(Boolean) || [];
      const isLiked = viewerId ? (likeResult?.data?.some((like: any) => like.post_id === post.id) || false) : false;
      const isBookmarked = viewerId ? (bookmarkResult?.data?.some((bm: any) => bm.post_id === post.id) || false) : false;

      return {
        ...post,
        hashtags: postHashtags,
        tags: postTags,
        is_liked: isLiked,
        is_bookmarked: isBookmarked
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        posts,
        has_more: postsData.length === limit
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'get-user-posts-metadata',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[get-user-posts-metadata] Error logging failed:', _logErr); }
    console.error('Error in get-user-posts-metadata:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
