// supabase/functions/get-suggested-users/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

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
    const { offset = 0, limit = 10 } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get current user's interests
    const { data: currentUser } = await supabase
      .from('social_users')
      .select('interests')
      .eq('id', userId)
      .single();

    const userInterests: string[] = currentUser?.interests || [];

    // 2. Get IDs we already follow (and ourselves)
    const { data: followingData } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = (followingData || []).map((f: any) => f.following_id);
    const excludeIds = [userId, ...followingIds];

    // 3. Calculate mutual follows
    let mutualFollowsMap: Record<string, number> = {};
    if (followingIds.length > 0) {
      const { data: mutuals } = await supabase
        .from('social_follows')
        .select('following_id')
        .in('follower_id', followingIds.slice(0, 50));

      (mutuals || []).forEach((m: any) => {
        if (!excludeIds.includes(m.following_id)) {
          mutualFollowsMap[m.following_id] = (mutualFollowsMap[m.following_id] || 0) + 1;
        }
      });
    }

    // 4. Fetch user pools (mutual + popular) in parallel
    const poolIds = Object.keys(mutualFollowsMap);
    const [mutualPoolResult, popularPoolResult] = await Promise.all([
      poolIds.length > 0
        ? supabase.from('social_users').select('*').in('id', poolIds.slice(0, 100))
        : { data: [] },
      supabase
        .from('social_users')
        .select('*')
        .not('id', 'in', `(${excludeIds.slice(0, 100).join(',')})`)
        .order('followers_count', { ascending: false })
        .limit(50),
    ]);

    // Merge pools, deduplicating
    const seenIds = new Set<string>();
    const userPool: any[] = [];

    for (const u of mutualPoolResult.data || []) {
      if (!excludeIds.includes(u.id) && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        userPool.push(u);
      }
    }
    for (const u of popularPoolResult.data || []) {
      if (!excludeIds.includes(u.id) && !seenIds.has(u.id)) {
        seenIds.add(u.id);
        userPool.push(u);
      }
    }

    // 5. Scoring algorithm (same as client but now server-side)
    const scoredUsers = userPool.map((poolUser: any) => {
      let score = 0;

      // Mutual follows (high weight)
      const mutualCount = mutualFollowsMap[poolUser.id] || 0;
      score += mutualCount * 15;

      // Interest match (medium weight)
      if (userInterests.length > 0 && poolUser.interests) {
        const commonInterests = poolUser.interests.filter((i: string) =>
          userInterests.includes(i)
        );
        score += commonInterests.length * 10;
      }

      // Popularity (low weight)
      score += Math.min((poolUser.followers_count || 0) / 10, 20);

      // Activity (medium weight)
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
        is_followed_by: false,
      };
    });

    // Sort by score
    scoredUsers.sort((a: any, b: any) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

    // Paginate
    const paginatedUsers = scoredUsers.slice(offset, offset + limit);
    const hasMore = offset + limit < scoredUsers.length;

    return new Response(
      JSON.stringify({ users: paginatedUsers, hasMore }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-suggested-users error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
