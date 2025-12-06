// api/sitemap.js
export default async function handler(req, res) {
  try {
    // Static routes (always included)
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

    let dynamicRoutes = [];

    // Check if we have the required environment variables with VITE_ prefix
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch public social posts
        const { data: publicPosts } = await supabase
          .from('social_posts')
          .select('id, updated_at, created_at')
          .eq('privacy', 'public')
          .limit(50);

        if (publicPosts) {
          publicPosts.forEach(post => {
            dynamicRoutes.push({
              path: `/social/post/${post.id}`,
              lastModified: post.updated_at || post.created_at,
              changeFreq: 'weekly',
              priority: 0.6
            });
          });
        }

        // Fetch public groups
        const { data: publicGroups } = await supabase
          .from('social_groups')
          .select('id, updated_at, created_at')
          .eq('privacy', 'public')
          .limit(50);

        if (publicGroups) {
          publicGroups.forEach(group => {
            dynamicRoutes.push({
              path: `/social/group/${group.id}`,
              lastModified: group.updated_at || group.created_at,
              changeFreq: 'weekly',
              priority: 0.6
            });
          });
        }

      } catch (supabaseError) {
        console.log('Supabase fetch failed:', supabaseError.message);
        // Continue with static routes only
      }
    }

    // Combine all routes
    const allRoutes = [
      ...staticRoutes.map(route => ({
        path: route,
        lastModified: new Date().toISOString().split('T')[0],
        changeFreq: route === '/' ? 'daily' : 'monthly',
        priority: route === '/' ? '1.0' : '0.8',
      })),
      ...dynamicRoutes.map(item => ({
        path: item.path,
        lastModified: item.lastModified,
        changeFreq: item.changeFreq || 'monthly',
        priority: item.priority || 0.6
      }))
    ];

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(url => {
      return `  <url>
    <loc>https://studdyhub.vercel.app${url.path}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
    }).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(xml);

  } catch (error) {
    console.error('Sitemap generation error:', error);

    // Fallback to a minimal sitemap
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://studdyhub.vercel.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(fallbackXml);
  }
}