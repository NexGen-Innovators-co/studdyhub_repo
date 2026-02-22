// supabase/functions/get-social-feed/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { fetchPostsWithRelations, scoreAndSortPosts } from '../utils/post-helpers.ts';
import { callGeminiJSON } from '../utils/gemini.ts';
import { getEducationContext, type ServerEducationContext } from '../_shared/educationContext.ts';

// Signal weights for AI preference computation
const SIGNAL_WEIGHTS: Record<string, number> = {
  like: 1.0, comment: 1.5, bookmark: 2.0, share: 3.0, view: 0.3, skip: -0.5, hide: -3.0,
};

// In-memory preference cache (per function instance, ~10 min TTL)
const preferencesCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000;

/**
 * AI-powered post re-ranking using user interaction signals.
 * Computes category affinity from signals, scores posts, and re-orders.
 * Falls back gracefully if data is insufficient.
 */
async function aiRankPosts(
  supabase: any,
  userId: string,
  posts: any[],
  supabaseUrl: string,
  supabaseServiceKey: string,
  educationContext?: ServerEducationContext | null
): Promise<any[]> {
  // Get or compute user preferences
  const preferences = await getUserPreferences(supabase, userId);

  // If user has no interaction history and no interests, skip AI ranking
  if (preferences.interaction_count === 0 && Object.keys(preferences.category_scores).length === 0) {
    return posts;
  }

  // Get following list
  const { data: followingData } = await supabase
    .from('social_follows')
    .select('following_id')
    .eq('follower_id', userId);
  const followingSet = new Set((followingData || []).map((f: any) => f.following_id));

  // Get viewed posts
  const postIds = posts.map((p: any) => p.id);
  const { data: viewedPosts } = await supabase
    .from('social_post_views')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  const viewedSet = new Set((viewedPosts || []).map((v: any) => v.post_id));

  // Score each post
  const scored = posts.map(post => {
    let score = 0;
    const postCategories = post.ai_categories || [];

    // Category match (0-30)
    if (postCategories.length > 0) {
      for (const cat of postCategories) {
        score += Math.min(10, preferences.category_scores[cat] || 0);
      }
      score = Math.min(30, score);
    }

    // Author affinity (0-20)
    if (followingSet.has(post.author_id)) score += 10;
    const authorRank = preferences.preferred_authors.indexOf(post.author_id);
    if (authorRank >= 0) score += Math.max(0, 10 - authorRank);

    // Education context affinity (0-15)
    if (educationContext) {
      const postMeta = post.metadata || {};
      const postCategories = post.ai_categories || [];
      const postContent = ((post.content || '') as string).toLowerCase();
      // Boost posts matching user's curriculum/subjects
      if (educationContext.curriculum && postContent.includes(educationContext.curriculum.toLowerCase())) score += 8;
      if (educationContext.targetExam && postContent.includes(educationContext.targetExam.toLowerCase())) score += 10;
      for (const subj of educationContext.subjects) {
        if (postContent.includes(subj.toLowerCase()) || postCategories.some((c: string) => c.toLowerCase().includes(subj.toLowerCase()))) {
          score += 5;
          break;
        }
      }
      // Boost posts from same education level/country
      if (postMeta.education_level === educationContext.educationLevel) score += 3;
      if (postMeta.country === educationContext.country) score += 2;
    }

    // Quality (0-10)
    score += post.ai_quality_score || 5;

    // Engagement momentum (0-15)
    const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    const engRate = hoursOld > 0
      ? ((post.likes_count || 0) + (post.comments_count || 0) * 2 + (post.shares_count || 0) * 3) / hoursOld
      : 0;
    score += Math.min(15, engRate * 2);

    // Recency (0-15)
    score += Math.max(0, 15 - hoursOld / 3.2);

    // Novelty (0-10)
    if (!viewedSet.has(post.id)) score += 10;

    return { post, score };
  });

  // For cold-start users, use Gemini for interest-based boosting
  if (preferences.interaction_count < 10 && preferences.user_interests.length > 0) {
    try {
      const postSummaries = posts.slice(0, 20).map((p: any, i: number) => ({
        idx: i,
        id: p.id,
        preview: (p.content || '').slice(0, 120),
        categories: p.ai_categories || [],
      }));

      const eduInfo = educationContext
        ? `\nTheir education: ${educationContext.curriculum || ''} ${educationContext.educationLevel || ''}, studying: ${educationContext.subjects.join(', ')}`
        : '';
      const prompt = `A student is interested in: ${preferences.user_interests.join(', ')}${eduInfo}

Rank relevance of these posts (0-10 each):
${postSummaries.map((p: any) => `[${p.idx}] "${p.preview}" (${p.categories.join(', ')})`).join('\n')}

Respond JSON only: {"scores":{"0":5,"1":8}}`;

      const result = await callGeminiJSON<{ scores: Record<string, number> }>(prompt, {
        temperature: 0.2,
        maxOutputTokens: 512,
      });

      if (result.success && result.data?.scores) {
        for (const [idx, boost] of Object.entries(result.data.scores)) {
          const i = parseInt(idx);
          if (scored[i]) {
            scored[i].score += Math.min(15, Math.max(0, boost as number));
          }
        }
      }
    } catch (geminiErr) {
      // Gemini cold-start boost is optional
    }
  }

  // Sort by AI score descending
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.post);
}

/**
 * Get or compute user preferences from interaction signals
 */
async function getUserPreferences(supabase: any, userId: string) {
  // Check cache
  const cached = preferencesCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.data;

  // Check DB for recent profile
  const { data: user } = await supabase
    .from('social_users')
    .select('ai_preferred_categories, ai_preferred_authors, ai_profile_updated_at, interests')
    .eq('id', userId)
    .single();

  const userInterests: string[] = user?.interests || [];

  if (user?.ai_profile_updated_at) {
    const age = Date.now() - new Date(user.ai_profile_updated_at).getTime();
    if (age < 60 * 60 * 1000) { // Less than 1 hour old
      const prefs = {
        category_scores: user.ai_preferred_categories || {},
        preferred_authors: user.ai_preferred_authors || [],
        interaction_count: Object.keys(user.ai_preferred_categories || {}).length > 0 ? 10 : 0,
        user_interests: userInterests,
      };
      preferencesCache.set(userId, { data: prefs, expires: Date.now() + CACHE_TTL });
      return prefs;
    }
  }

  // Compute from signals
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signals } = await supabase
    .from('social_user_signals')
    .select('signal_type, signal_value, categories, post_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500);

  const interactionCount = (signals || []).length;
  const categoryScores: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};

  if (interactionCount === 0) {
    // Fall back to declared interests
    for (const interest of userInterests) {
      categoryScores[interest.toLowerCase()] = 5;
    }
  } else {
    for (const signal of signals) {
      const weight = SIGNAL_WEIGHTS[signal.signal_type] || 0.5;
      const value = weight * (signal.signal_value || 1);
      const ageHours = (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
      const timeDecay = Math.max(0.2, 1 - ageHours / (30 * 24));
      const wv = value * timeDecay;

      for (const cat of (signal.categories || [])) {
        categoryScores[cat] = (categoryScores[cat] || 0) + wv;
      }
    }

    // Get author affinity
    const interactedIds = [...new Set(signals.map((s: any) => s.post_id))].slice(0, 100);
    if (interactedIds.length > 0) {
      const { data: interactedPosts } = await supabase
        .from('social_posts')
        .select('author_id')
        .in('id', interactedIds);
      for (const p of (interactedPosts || [])) {
        authorCounts[p.author_id] = (authorCounts[p.author_id] || 0) + 1;
      }
    }
  }

  const sortedAuthors = Object.entries(authorCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 20)
    .map(([id]) => id);

  const prefs = {
    category_scores: categoryScores,
    preferred_authors: sortedAuthors,
    interaction_count: interactionCount,
    user_interests: userInterests,
  };

  // Persist to DB asynchronously
  supabase
    .from('social_users')
    .update({
      ai_preferred_categories: categoryScores,
      ai_preferred_authors: sortedAuthors,
      ai_profile_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .then(() => {})
    .catch(() => {});

  preferencesCache.set(userId, { data: prefs, expires: Date.now() + CACHE_TTL });
  return prefs;
}

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
      cursor = null,         // cursor-based pagination: ISO timestamp of last post seen
      limit = 15,
      viewedPostIds = [],    // IDs of already-viewed posts for feed algorithm
      excludeIds = [],       // IDs already loaded on client to avoid duplicates
    } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Fetch exactly limit + 1 to determine hasMore without over-fetching
    const fetchLimit = limit + 1;

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
        // Cursor-based pagination for user posts
        if (cursor) {
          query = query.lt('created_at', cursor);
        }
      } else if (mode === 'trending') {
        // IMPROVED: "Hot" score algorithm
        // Fetch posts from the last 7 days with at least 1 like to compute velocity
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        
        query = query
          .eq('privacy', 'public')
          .neq('author_id', userId)
          .gte('created_at', sevenDaysAgo) // Focus on recent content
          .order('likes_count', { ascending: false }) // Initial loose sort
          .limit(100); // Fetch a larger candidate pool for in-memory re-ranking

        if (excludeIds.length > 0) {
          query = query.not('id', 'in', `(${excludeIds.slice(0, 500).join(',')})`);
        }
      } else {
        // Default feed — cursor-based by created_at
        query = query.eq('privacy', 'public');
        if (sortBy === 'popular') {
          query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
          if (excludeIds.length > 0) {
            query = query.not('id', 'in', `(${excludeIds.slice(0, 500).join(',')})`);
          }
        } else {
          query = query.order('created_at', { ascending: false });
          if (cursor) {
            query = query.lt('created_at', cursor);
          }
        }
      }

      // Use the appropriate limit: trending needs a larger candidate pool for scoring
      const actualFetchLimit = mode === 'trending' ? Math.max(100, fetchLimit) : fetchLimit;
      const { data, error } = await query.limit(actualFetchLimit);
      if (error) throw error;
      postsData = data || [];
    }

    if (postsData.length === 0) {
      return new Response(JSON.stringify({ posts: [], hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine hasMore BEFORE any client-side filtering to avoid falsely
    // reporting "no more posts" when the filter removes some rows.
    const rawCount = postsData.length;
    const hasMore = mode === 'trending'
      ? rawCount > limit          // trending fetches a larger pool
      : rawCount > limit;         // others fetch limit+1 as probe

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

    // Take only what we need (drop the extra +1 probe row)
    let selectedPosts = postsData.slice(0, limit);

    // AI-powered re-ranking for feed mode
    if (mode === 'feed' && selectedPosts.length > 0) {
      try {
        // Fetch user's education context for affinity scoring
        let eduCtx: ServerEducationContext | null = null;
        try {
          eduCtx = await getEducationContext(supabase, userId);
        } catch { /* non-critical */ }
        selectedPosts = await aiRankPosts(supabase, userId, selectedPosts, supabaseUrl, supabaseServiceKey, eduCtx);
      } catch (aiErr) {
        // AI ranking is best-effort — fall back to standard scoring
        console.error('AI ranking fallback:', aiErr);
      }
    }

    const postIds = selectedPosts.map((p: any) => p.id);

    // Compute the cursor for the next page
    // Use the original chronological cursor (not AI-reordered) to maintain stable pagination
    const allPostsByDate = postsData.slice(0, limit).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const nextCursor = allPostsByDate.length > 0
      ? allPostsByDate[0].created_at  // oldest post in this batch = cursor for next page
      : null;

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
        hasMore,
        nextCursor,
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
