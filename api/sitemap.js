// api/sitemap.js

// This function will be executed by Vercel as a serverless function.
// It generates a dynamic sitemap.xml.

export default async function handler(req, res) {
  // Define your static routes for NoteMind AI
  const staticRoutes = [
    '/',
    '/auth',
    '/privacy-policy',
    '/terms-of-service',
    '/about-us',
    '/blogs', // This will be the base for blog posts
    '/careers',
    '/contact',
    '/api',
    '/integrations',
    '/documentation-page',
    '/user-guide-page',
  ];

  // --- Placeholder for dynamic routes (e.g., blog posts) ---
  // In a real application, you would fetch your dynamic content here.
  // For example, if you have blog posts stored in a database or CMS:
  /*
  import { createClient } from '@supabase/supabase-js'; // You'll need to install this if not already
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let dynamicBlogRoutes = [];
  try {
    const { data: posts, error } = await supabase
      .from('blog_posts') // Assuming your blog posts table is named 'blog_posts'
      .select('slug, updated_at'); // Assuming a 'slug' column for URL and 'updated_at' for lastmod

    if (error) {
      console.error('Error fetching blog posts for sitemap:', error);
    } else {
      dynamicBlogRoutes = posts.map(post => ({
        path: `/blogs/${post.slug}`,
        lastModified: new Date(post.updated_at).toISOString(),
        changeFreq: 'weekly',
        priority: 0.7
      }));
    }
  } catch (error) {
    console.error('Unexpected error fetching dynamic routes for sitemap:', error);
  }
  */

  // For demonstration, using hardcoded dynamic routes based on your blog page content
  const dynamicBlogRoutes = [
    {
      path: '/blogs/the-future-of-learning',
      lastModified: '2025-07-25T00:00:00+00:00', // Example date, replace with actual
      changeFreq: 'weekly',
      priority: 0.7
    },
    {
      path: '/blogs/mastering-your-notes',
      lastModified: '2025-07-18T00:00:00+00:00', // Example date, replace with actual
      changeFreq: 'weekly',
      priority: 0.7
    },
    {
      path: '/blogs/voice-to-text-unlocking-insights',
      lastModified: '2025-07-10T00:00:00+00:00', // Example date, replace with actual
      changeFreq: 'weekly',
      priority: 0.7
    },
    {
      path: '/blogs/personalized-learning-paths',
      lastModified: '2025-07-01T00:00:00+00:00', // Example date, replace with actual
      changeFreq: 'weekly',
      priority: 0.7
    },
    // Add more dynamic blog post paths here based on your actual data
  ];
  // -----------------------------------------------------------


  // Combine all URLs and format them for the sitemap
  const allUrls = staticRoutes.map(route => ({
    path: route,
    lastModified: new Date().toISOString(), // Use current date for static pages
    changeFreq: route === '/' ? 'daily' : 'monthly',
    priority: route === '/' ? 1.0 : 0.8,
  })).concat(dynamicBlogRoutes.map(item => ({
    path: item.path,
    lastModified: item.lastModified,
    changeFreq: item.changeFreq || 'monthly', // Default to monthly if not specified
    priority: item.priority || 0.7 // Default priority if not specified
  })));

  // Construct the XML string
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const baseUrl = 'https://studdyhub.vercel.app'; // Your app's domain

  allUrls.forEach(url => {
    xml += `
  <url>
    <loc>${baseUrl}${url.path}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  // Set the content type header and send the XML
  res.setHeader('Content-Type', 'application/xml');
  res.status(200).send(xml);
}
