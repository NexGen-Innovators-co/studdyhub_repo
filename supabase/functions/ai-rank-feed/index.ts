// supabase/functions/ai-rank-feed/index.ts
// AI-powered personalized feed ranking using user interaction signals + Gemini
// Builds a preference profile per user and scores posts against it

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { callGeminiJSON } from '../utils/gemini.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Signal weights for preference computation
const SIGNAL_WEIGHTS: Record<string, number> = {
  like: 1.0,
  comment: 1.5,
  bookmark: 2.0,
  share: 3.0,
  view: 0.3,
  dwell: 0.5,
  skip: -0.5,
  hide: -3.0,
};

// Cache user preferences for 10 minutes to avoid recomputing on every scroll
const preferencesCache = new Map<string, { data: UserPreferences; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface UserPreferences {
  category_scores: Record<string, number>; // category → affinity score
  preferred_authors: string[];             // top author IDs
  avg_quality_preference: number;          // preferred quality score range
  sentiment_preference: string;            // preferred sentiment
  interaction_count: number;               // total signals (used for cold-start detection)
}

interface RankedPost {
  post_id: string;
  ai_score: number;
  signals: {
    category_match: number;
    author_affinity: number;
    quality_bonus: number;
    engagement_momentum: number;
    recency: number;
    novelty: number;
  };
}

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
      postIds = [],         // Post IDs to rank
      mode = 'rank',        // 'rank' | 'profile' | 'update-profile'
    } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mode: Get user's AI preference profile
    if (mode === 'profile') {
      const preferences = await getUserPreferences(supabase, userId);
      return new Response(JSON.stringify({ success: true, preferences }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode: Force-update user's preference profile
    if (mode === 'update-profile') {
      const preferences = await computeUserPreferences(supabase, userId);
      // Persist to DB
      await supabase
        .from('social_users')
        .update({
          ai_preferred_categories: preferences.category_scores,
          ai_preferred_authors: preferences.preferred_authors,
          ai_profile_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      // Invalidate cache
      preferencesCache.delete(userId);

      return new Response(JSON.stringify({ success: true, preferences }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode: Rank posts for this user
    if (!postIds.length) {
      return new Response(JSON.stringify({ scores: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preferences = await getUserPreferences(supabase, userId);

    // Fetch post data for ranking
    const { data: posts } = await supabase
      .from('social_posts')
      .select('id, content, author_id, ai_categories, ai_sentiment, ai_quality_score, likes_count, comments_count, shares_count, views_count, created_at')
      .in('id', postIds);

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ scores: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's viewed posts
    const { data: viewedPosts } = await supabase
      .from('social_post_views')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const viewedSet = new Set((viewedPosts || []).map(v => v.post_id));

    // Get following list for author affinity
    const { data: followingData } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', userId);
    const followingSet = new Set((followingData || []).map(f => f.following_id));

    // Score each post
    const scores: Record<string, RankedPost> = {};

    for (const post of posts) {
      scores[post.id] = scorePost(post, preferences, viewedSet, followingSet);
    }

    // For cold-start users (< 10 interactions), use Gemini to boost relevance
    if (preferences.interaction_count < 10) {
      const coldStartBoosts = await coldStartRanking(supabase, userId, posts);
      for (const [postId, boost] of Object.entries(coldStartBoosts)) {
        if (scores[postId]) {
          scores[postId].ai_score += boost;
          scores[postId].signals.category_match += boost;
        }
      }
    }

    return new Response(JSON.stringify({ scores }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'ai-rank-feed',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[ai-rank-feed] Error logging failed:', _logErr); }
    console.error('ai-rank-feed error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get user preferences (from cache, DB, or compute fresh)
 */
async function getUserPreferences(supabase: any, userId: string): Promise<UserPreferences> {
  // Check in-memory cache
  const cached = preferencesCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Check if DB has recent preferences
  const { data: user } = await supabase
    .from('social_users')
    .select('ai_preferred_categories, ai_preferred_authors, ai_profile_updated_at, interests')
    .eq('id', userId)
    .single();

  if (user?.ai_profile_updated_at) {
    const profileAge = Date.now() - new Date(user.ai_profile_updated_at).getTime();
    // Use DB preferences if less than 1 hour old
    if (profileAge < 60 * 60 * 1000) {
      const prefs: UserPreferences = {
        category_scores: user.ai_preferred_categories || {},
        preferred_authors: user.ai_preferred_authors || [],
        avg_quality_preference: 6,
        sentiment_preference: 'positive',
        interaction_count: Object.keys(user.ai_preferred_categories || {}).length > 0 ? 10 : 0,
      };
      preferencesCache.set(userId, { data: prefs, expires: Date.now() + CACHE_TTL });
      return prefs;
    }
  }

  // Compute fresh preferences
  const preferences = await computeUserPreferences(supabase, userId);

  // Persist to DB asynchronously
  supabase
    .from('social_users')
    .update({
      ai_preferred_categories: preferences.category_scores,
      ai_preferred_authors: preferences.preferred_authors,
      ai_profile_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .then(() => {})
    .catch(() => {});

  // Cache
  preferencesCache.set(userId, { data: preferences, expires: Date.now() + CACHE_TTL });

  return preferences;
}

/**
 * Compute user preferences from interaction signals
 */
async function computeUserPreferences(supabase: any, userId: string): Promise<UserPreferences> {
  // Get last 30 days of signals
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: signals } = await supabase
    .from('social_user_signals')
    .select('signal_type, signal_value, categories, post_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500);

  const interactionCount = (signals || []).length;

  // If no signals, fall back to declared interests
  if (!signals || signals.length === 0) {
    const { data: user } = await supabase
      .from('social_users')
      .select('interests')
      .eq('id', userId)
      .single();

    const interests = user?.interests || [];
    const categoryScores: Record<string, number> = {};
    interests.forEach((interest: string) => {
      categoryScores[interest.toLowerCase()] = 5;
    });

    return {
      category_scores: categoryScores,
      preferred_authors: [],
      avg_quality_preference: 6,
      sentiment_preference: 'positive',
      interaction_count: 0,
    };
  }

  // Compute weighted category affinity
  const categoryScores: Record<string, number> = {};
  const authorScores: Record<string, number> = {};
  let totalQuality = 0;
  let qualityCount = 0;
  const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signal_type] || 0.5;
    const value = weight * (signal.signal_value || 1);

    // Time decay: recent signals matter more (decay over 30 days)
    const ageHours = (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
    const timeDecay = Math.max(0.2, 1 - ageHours / (30 * 24));
    const weightedValue = value * timeDecay;

    // Category affinity
    if (signal.categories && signal.categories.length > 0) {
      for (const cat of signal.categories) {
        categoryScores[cat] = (categoryScores[cat] || 0) + weightedValue;
      }
    }
  }

  // Get author data from the posts the user interacted with
  const interactedPostIds = [...new Set((signals || []).map((s: any) => s.post_id))].slice(0, 100);
  if (interactedPostIds.length > 0) {
    const { data: interactedPosts } = await supabase
      .from('social_posts')
      .select('id, author_id, ai_quality_score, ai_sentiment')
      .in('id', interactedPostIds);

    if (interactedPosts) {
      for (const post of interactedPosts) {
        authorScores[post.author_id] = (authorScores[post.author_id] || 0) + 1;
        if (post.ai_quality_score) {
          totalQuality += post.ai_quality_score;
          qualityCount++;
        }
        if (post.ai_sentiment) {
          sentimentCounts[post.ai_sentiment] = (sentimentCounts[post.ai_sentiment] || 0) + 1;
        }
      }
    }
  }

  // Rank categories and authors
  const sortedAuthors = Object.entries(authorScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([id]) => id);

  const topSentiment = Object.entries(sentimentCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'positive';

  return {
    category_scores: categoryScores,
    preferred_authors: sortedAuthors,
    avg_quality_preference: qualityCount > 0 ? totalQuality / qualityCount : 6,
    sentiment_preference: topSentiment,
    interaction_count: interactionCount,
  };
}

/**
 * Score a single post against user preferences
 */
function scorePost(
  post: any,
  preferences: UserPreferences,
  viewedSet: Set<string>,
  followingSet: Set<string>
): RankedPost {
  const signals = {
    category_match: 0,
    author_affinity: 0,
    quality_bonus: 0,
    engagement_momentum: 0,
    recency: 0,
    novelty: 0,
  };

  // 1. Category match (0-30 points)
  const postCategories = post.ai_categories || [];
  if (postCategories.length > 0 && Object.keys(preferences.category_scores).length > 0) {
    let catScore = 0;
    for (const cat of postCategories) {
      catScore += preferences.category_scores[cat] || 0;
    }
    // Normalize: cap at 30
    signals.category_match = Math.min(30, catScore);
  }

  // 2. Author affinity (0-20 points)
  if (followingSet.has(post.author_id)) {
    signals.author_affinity += 10;
  }
  const authorRank = preferences.preferred_authors.indexOf(post.author_id);
  if (authorRank >= 0) {
    signals.author_affinity += Math.max(0, 10 - authorRank); // Top authors get more
  }

  // 3. Quality bonus (0-10 points)
  const qualityScore = post.ai_quality_score || 5;
  signals.quality_bonus = qualityScore; // Direct 1-10 score

  // 4. Engagement momentum (0-15 points)
  const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const engagementRate = hoursOld > 0
    ? ((post.likes_count || 0) + (post.comments_count || 0) * 2 + (post.shares_count || 0) * 3) / hoursOld
    : 0;
  signals.engagement_momentum = Math.min(15, engagementRate * 2);

  // 5. Recency (0-15 points, decays over 48h)
  signals.recency = Math.max(0, 15 - hoursOld / 3.2);

  // 6. Novelty bonus — unseen posts get a boost (0-10 points)
  if (!viewedSet.has(post.id)) {
    signals.novelty = 10;
  }

  const totalScore = Object.values(signals).reduce((sum, s) => sum + s, 0);

  return {
    post_id: post.id,
    ai_score: Math.round(totalScore * 100) / 100,
    signals,
  };
}

/**
 * For cold-start users with < 10 interactions, use Gemini to match posts to interests
 */
async function coldStartRanking(
  supabase: any,
  userId: string,
  posts: any[]
): Promise<Record<string, number>> {
  const { data: user } = await supabase
    .from('social_users')
    .select('interests, bio')
    .eq('id', userId)
    .single();

  if (!user?.interests || user.interests.length === 0) {
    return {};
  }

  // Create a compact summary of posts for Gemini
  const postSummaries = posts.slice(0, 20).map((p, i) => ({
    idx: i,
    id: p.id,
    preview: (p.content || '').slice(0, 150),
    categories: p.ai_categories || [],
  }));

  const prompt = `A student is interested in: ${user.interests.join(', ')}
${user.bio ? `Bio: ${user.bio.slice(0, 200)}` : ''}

Rank how relevant these posts are to their interests. Score each 0-10.
Posts:
${postSummaries.map(p => `[${p.idx}] "${p.preview}" (${p.categories.join(', ')})`).join('\n')}

Respond in JSON: {"scores": {"<post_index>": <score>}}`;

  const result = await callGeminiJSON<{ scores: Record<string, number> }>(prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
  });

  if (!result.success || !result.data?.scores) {
    return {};
  }

  const boosts: Record<string, number> = {};
  for (const [idx, score] of Object.entries(result.data.scores)) {
    const post = postSummaries[parseInt(idx)];
    if (post) {
      boosts[post.id] = Math.min(15, Math.max(0, score)); // Cap at 15
    }
  }

  return boosts;
}
