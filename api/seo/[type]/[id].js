// pages/api/seo/[type]/[id].js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const { type, id } = req.query;

    try {
        let seoData = null;

        switch (type) {
            case 'post':
                seoData = await getPostSEO(id);
                break;
            case 'profile':
                seoData = await getProfileSEO(id);
                break;
            case 'group':
                seoData = await getGroupSEO(id);
                break;
            case 'hashtag':
                seoData = await getHashtagSEO(decodeURIComponent(id));
                break;
            default:
                return res.status(404).json({ error: 'Not found' });
        }

        if (!seoData) {
            return res.status(404).json({ error: 'Not found' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(seoData);
    } catch (error) {
        //console.error('SEO data fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function getPostSEO(postId) {
    const { data: post } = await supabase
        .from('social_posts')
        .select(`
      content,
      created_at,
      updated_at,
      likes_count,
      comments_count,
      author:soci al_users!inner(username, display_name, avatar_url),
      media:soci al_media(url, type)
    `)
        .eq('id', postId)
        .single();

    if (!post) return null;

    const description = post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '');
    const image = post.media?.find(m => m.type === 'image')?.url || post.author?.avatar_url;

    return {
        title: `Post by ${post.author.display_name} | StuddyHub`,
        description,
        type: 'article',
        url: `/social/post/${postId}`,
        image,
        author: post.author.display_name,
        publishedTime: post.created_at,
        updatedTime: post.updated_at,
        tags: extractHashtags(post.content),
        engagement: {
            likes: post.likes_count,
            comments: post.comments_count
        }
    };
}

async function getProfileSEO(userId) {
    const { data: user } = await supabase
        .from('social_users')
        .select(`
      username,
      display_name,
      bio,
      avatar_url,
      followers_count,
      following_count,
      posts_count,
      is_verified,
      is_contributor,
      interests
    `)
        .eq('username', userId)
        .or(`id.eq.${userId}`)
        .single();

    if (!user) return null;

    return {
        title: `${user.display_name}'s Profile | StuddyHub`,
        description: user.bio || `Join ${user.display_name} on StuddyHub for collaborative learning`,
        type: 'profile',
        url: `/social/profile/${user.username || userId}`,
        image: user.avatar_url,
        username: user.username,
        followersCount: user.followers_count,
        followingCount: user.following_count,
        postCount: user.posts_count,
        interests: user.interests,
        isVerified: user.is_verified,
        isContributor: user.is_contributor
    };
}

async function getGroupSEO(groupId) {
    const { data: group } = await supabase
        .from('social_groups')
        .select(`
      name,
      description,
      avatar_url,
      cover_image_url,
      category,
      members_count,
      posts_count,
      created_at
    `)
        .eq('id', groupId)
        .single();

    if (!group) return null;

    return {
        title: `${group.name} Study Group | StuddyHub`,
        description: group.description || `Join ${group.name} study group on StuddyHub`,
        type: 'group',
        url: `/social/group/${groupId}`,
        image: group.cover_image_url || group.avatar_url,
        groupName: group.name,
        category: group.category,
        membersCount: group.members_count,
        postCount: group.posts_count,
        createdAt: group.created_at
    };
}

async function getHashtagSEO(tagName) {
    const { data: hashtag } = await supabase
        .from('social_hashtags')
        .select('name, posts_count, created_at')
        .eq('name', tagName)
        .single();

    if (!hashtag) return null;

    return {
        title: `#${tagName} - Trending Topics | StuddyHub`,
        description: `Explore ${hashtag.posts_count} posts tagged with #${tagName} on StuddyHub`,
        type: 'website',
        url: `/social/hashtag/${encodeURIComponent(tagName)}`,
        tagName,
        postCount: hashtag.posts_count,
        createdAt: hashtag.created_at
    };
}

function extractHashtags(text) {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
}