// supabase/functions/get-suggested-users/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { callGeminiJSON } from '../utils/gemini.ts';

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
    const { offset = 0, limit = 10, previouslyShownIds = [] } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Time-based seed for deterministic-per-session but varying-across-sessions randomness
    // Changes every 30 minutes so users see fresh suggestions on return visits
    const timeSeed = Math.floor(Date.now() / (30 * 60 * 1000));
    const seededRandom = (id: string) => {
      // Simple hash of id + timeSeed for deterministic pseudo-random
      let hash = 0;
      const str = id + timeSeed.toString();
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
      }
      return Math.abs(hash % 1000) / 1000; // 0-1 range
    };

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

    // 5. Scoring algorithm with time-seeded variety
    const previouslyShownSet = new Set(previouslyShownIds);
    const scoredUsers = userPool
      .filter((u: any) => !previouslyShownSet.has(u.id)) // Exclude already shown
      .map((poolUser: any) => {
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

      // Time-seeded variety factor (up to 20% of score + 8 points)
      // This ensures different users surface on different sessions
      const varietyBonus = seededRandom(poolUser.id) * (score * 0.2 + 8);
      score += varietyBonus;

      return {
        ...poolUser,
        recommendation_score: Math.round(score * 100) / 100,
        mutual_friends_count: mutualCount,
        is_following: false,
        is_followed_by: false,
      };
    });

    // Sort by score
    scoredUsers.sort((a: any, b: any) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

    // AI Enhancement: For the top candidates, use Gemini to compute semantic
    // bio/interest similarity (only for users with bios, max 15 per call)
    const topCandidates = scoredUsers.slice(0, Math.min(20, scoredUsers.length));
    if (userInterests.length > 0 || currentUser?.bio) {
      try {
        const candidatesWithBio = topCandidates
          .filter((u: any) => u.bio || (u.interests && u.interests.length > 0))
          .slice(0, 15);

        if (candidatesWithBio.length > 0) {
          const userProfile = [
            userInterests.length > 0 ? `Interests: ${userInterests.join(', ')}` : '',
            currentUser?.bio ? `Bio: ${currentUser.bio.slice(0, 200)}` : '',
          ].filter(Boolean).join('. ');

          const candidateSummaries = candidatesWithBio.map((u: any, i: number) => {
            const parts = [];
            if (u.interests?.length) parts.push(`interests: ${u.interests.join(', ')}`);
            if (u.bio) parts.push(`bio: ${u.bio.slice(0, 100)}`);
            return `[${i}] ${parts.join(', ')}`;
          });

          const prompt = `Rate how well each user matches this student's profile (0-10):

Student: ${userProfile}

Candidates:
${candidateSummaries.join('\n')}

Respond JSON only: {"scores":{"0":7,"1":3}}`;

          const result = await callGeminiJSON<{ scores: Record<string, number> }>(prompt, {
            temperature: 0.2,
            maxOutputTokens: 256,
          });

          if (result.success && result.data?.scores) {
            for (const [idx, aiScore] of Object.entries(result.data.scores)) {
              const candidate = candidatesWithBio[parseInt(idx)];
              if (candidate) {
                const user = scoredUsers.find((u: any) => u.id === candidate.id);
                if (user) {
                  // AI similarity adds up to 20 points
                  user.recommendation_score += Math.min(20, Math.max(0, (aiScore as number) * 2));
                  user.ai_match_score = aiScore;
                }
              }
            }
            // Re-sort after AI boost
            scoredUsers.sort((a: any, b: any) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
          }
        }
      } catch (aiErr) {
        // AI enhancement is best-effort
        console.error('AI suggested users fallback:', aiErr);
      }
    }

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
