// supabase/functions/utils/post-helpers.ts
// Shared helpers for social post edge functions

/**
 * Fetch posts with all relations (hashtags, tags, likes, bookmarks) in batched queries.
 * Returns fully transformed post objects ready for the client.
 */
export async function fetchPostsWithRelations(
  supabase: any,
  postIds: string[],
  postsData: any[],
  currentUserId: string | null
) {
  if (!postIds.length) return [];

  const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
    supabase
      .from('social_post_hashtags')
      .select('post_id, hashtag:social_hashtags(*)')
      .in('post_id', postIds),
    supabase
      .from('social_post_tags')
      .select('post_id, tag:social_tags(*)')
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
      : { data: [] },
  ]);

  const hashtags = hashtagResult.data || [];
  const tags = tagResult.data || [];
  const likes = likeResult.data || [];
  const bookmarks = bookmarkResult.data || [];

  return postsData.map((post: any) => {
    const postHashtags = hashtags
      .filter((ph: any) => ph.post_id === post.id)
      .map((ph: any) => ph.hashtag)
      .filter(Boolean);

    const postTags = tags
      .filter((pt: any) => pt.post_id === post.id)
      .map((pt: any) => pt.tag)
      .filter(Boolean);

    const isLiked = likes.some((like: any) => like.post_id === post.id);
    const isBookmarked = bookmarks.some((bm: any) => bm.post_id === post.id);

    return {
      ...post,
      hashtags: postHashtags,
      tags: postTags,
      is_liked: isLiked,
      is_bookmarked: isBookmarked,
    };
  });
}

/**
 * Seeded PRNG (mulberry32) — gives deterministic-per-session randomness.
 * Each edge-function invocation uses a different seed so users see
 * a fresh order every time they open the feed.
 */
function seededRandom(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Engagement-weighted scoring for feed posts.
 * Adds a small random jitter per invocation so the order varies each
 * time the user opens the feed, while still keeping high-quality posts
 * near the top.
 */
export function scoreAndSortPosts(
  posts: any[],
  viewedPostIds: string[] = [],
  mode: 'feed' | 'trending' = 'feed'
) {
  const viewedSet = new Set(viewedPostIds);
  const unviewed = posts.filter((p: any) => !viewedSet.has(p.id));
  const viewed = posts.filter((p: any) => viewedSet.has(p.id));

  // Use a time-based seed so each invocation produces a different order
  const rand = seededRandom(Date.now() ^ (Math.random() * 0xFFFFFFFF));

  const scorePosts = (items: any[]) => {
    return items
      .map((post) => {
        let score: number;
        if (mode === 'trending') {
          // "Hot" algorithm: (Score) / (Time + 2)^Gravity
          const hoursAgo = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60));
          const engagement = (post.likes_count || 0) * 1 + (post.comments_count || 0) * 2 + (post.shares_count || 0) * 3;
          const numerator = engagement + 1;
          const denominator = Math.pow(hoursAgo + 2, 1.8);
          score = numerator / denominator;
          // Small jitter (±15% of score) so trending varies slightly
          score += score * (rand() * 0.3 - 0.15);
        } else {
          const hoursAgo =
            (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
          score =
            (post.likes_count || 0) +
            (post.comments_count || 0) * 2 +
            (post.shares_count || 0) * 3 +
            Math.max(0, 10 - hoursAgo / 2.4); // 24h recency bonus
          // Add jitter (±20% of score, min ±1) so feed order varies each visit
          const jitter = Math.max(1, score * 0.2);
          score += jitter * (rand() * 2 - 1);
        }
        return { post, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .map((item: any) => item.post);
  };

  const sortedUnviewed = scorePosts(unviewed);
  const sortedViewed = scorePosts(viewed);

  return [...sortedUnviewed, ...sortedViewed];
}
