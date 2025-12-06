// api/sitemap.js - Enhanced Version
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const staticRoutes = [
    '/',
    '/auth',
    '/privacy-policy',
    '/terms-of-service',
    '/about-us',
    '/blogs',
    '/careers',
    '/contact',
    '/api',
    '/integrations',
    '/documentation-page',
    '/user-guide-page',
  ];

  // Fetch dynamic content from your database
  const dynamicRoutes = await fetchDynamicContent();

  // Combine routes
  const allRoutes = [...staticRoutes, ...dynamicRoutes];

  // Generate XML
  const xml = generateSitemap(allRoutes);

  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
}

async function fetchDynamicContent() {
  const dynamicRoutes = [];

  try {
    // 1. Public Social Posts
    const { data: publicPosts } = await supabase
      .from('social_posts')
      .select('id, created_at, updated_at')
      .eq('privacy', 'public')
      .limit(1000);

    if (publicPosts) {
      publicPosts.forEach(post => {
        dynamicRoutes.push({
          path: `/social/post/${post.id}`,
          lastModified: new Date(post.updated_at || post.created_at).toISOString(),
          changeFreq: 'weekly',
          priority: 0.6
        });
      });
    }

    // 2. Public Groups
    const { data: publicGroups } = await supabase
      .from('social_groups')
      .select('id, created_at, updated_at')
      .eq('privacy', 'public')
      .limit(500);

    if (publicGroups) {
      publicGroups.forEach(group => {
        dynamicRoutes.push({
          path: `/social/group/${group.id}`,
          lastModified: new Date(group.updated_at || group.created_at).toISOString(),
          changeFreq: 'weekly',
          priority: 0.6
        });
      });
    }

    // 3. Public User Profiles
    const { data: publicUsers } = await supabase
      .from('social_users')
      .select('id, username, updated_at, created_at')
      .eq('is_public', true)
      .limit(500);

    if (publicUsers) {
      publicUsers.forEach(user => {
        dynamicRoutes.push({
          path: `/social/profile/${user.username || user.id}`,
          lastModified: new Date(user.updated_at || user.created_at).toISOString(),
          changeFreq: 'monthly',
          priority: 0.5
        });
      });
    }

    // 4. Trending Hashtags
    const { data: hashtags } = await supabase
      .from('social_hashtags')
      .select('name, created_at')
      .order('posts_count', { ascending: false })
      .limit(100);

    if (hashtags) {
      hashtags.forEach(tag => {
        dynamicRoutes.push({
          path: `/social/hashtag/${encodeURIComponent(tag.name)}`,
          lastModified: new Date(tag.created_at).toISOString(),
          changeFreq: 'daily',
          priority: 0.7
        });
      });
    }

    // 5. Blog Posts (if you have a separate blog system)
    const { data: blogPosts } = await supabase
      .from('blog_posts') // Replace with your actual table name
      .select('slug, updated_at, created_at')
      .eq('published', true)
      .limit(100);

    if (blogPosts) {
      blogPosts.forEach(post => {
        dynamicRoutes.push({
          path: `/blogs/${post.slug}`,
          lastModified: new Date(post.updated_at || post.created_at).toISOString(),
          changeFreq: 'monthly',
          priority: 0.7
        });
      });
    }

  } catch (error) {
    console.error('Error fetching dynamic content:', error);
  }

  return dynamicRoutes;
}