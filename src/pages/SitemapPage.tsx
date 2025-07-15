import React, { useEffect } from 'react';

// The sitemap content as a string
const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://notemind.lovable.app/</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/notes</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/recordings</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/schedule</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/chat</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/documents</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://notemind.lovable.app/settings</loc>
    <lastmod>2025-07-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

const SitemapPage: React.FC = () => {
  useEffect(() => {
    // Attempt to set the content type for browser display, though server-side is ideal for SEO
    document.documentElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    document.body.style.whiteSpace = 'pre'; // Preserve whitespace for XML display

    return () => {
      document.documentElement.removeAttribute('xmlns');
      document.body.style.whiteSpace = '';
    };
  }, []);

  return (
    <pre style={{ margin: 0, padding: '1rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {sitemapContent}
    </pre>
  );
};

export default SitemapPage;
