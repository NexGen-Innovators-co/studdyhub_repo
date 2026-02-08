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
 * Engagement-weighted scoring for feed posts.
 * Mixes engagement, recency, and randomness for variety.
 */
export function scoreAndSortPosts(
  posts: any[],
  viewedPostIds: string[] = [],
  mode: 'feed' | 'trending' = 'feed'
) {
  const viewedSet = new Set(viewedPostIds);
  const unviewed = posts.filter((p: any) => !viewedSet.has(p.id));
  const viewed = posts.filter((p: any) => viewedSet.has(p.id));

  const scorePosts = (items: any[]) => {
    return items
      .map((post: any) => {
        let score: number;
        if (mode === 'trending') {
          score =
            (post.likes_count || 0) * 3 +
            (post.comments_count || 0) * 2 +
            (post.shares_count || 0) * 5 +
            Math.random() * 2;
        } else {
          const hoursAgo =
            (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
          score =
            (post.likes_count || 0) +
            (post.comments_count || 0) * 2 +
            (post.shares_count || 0) * 3 +
            Math.max(0, 10 - hoursAgo / 2.4) + // 24h recency bonus
            Math.random() * 5;
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
