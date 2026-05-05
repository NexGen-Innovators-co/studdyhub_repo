import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const { query, userId } = await req.json(); // 'query' will be the image description from the AI
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing search query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let imageUrl: string | null = null;
    let searchError: string | null = null;

    try {
      // --- UNSPLASH API INTEGRATION ---
      const UNSPLASH_ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');
      if (!UNSPLASH_ACCESS_KEY) {
        throw new Error('UNSPLASH_ACCESS_KEY not configured in environment variables.');
      }

      const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`;
      
      const unsplashResponse = await fetch(unsplashUrl, {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      });

      if (!unsplashResponse.ok) {
        const errorData = await unsplashResponse.json();
        // Unsplash API often returns errors in 'errors' array or 'message'
        const errorMessage = errorData.errors ? errorData.errors.join(', ') : errorData.message || unsplashResponse.statusText;
        throw new Error(`Unsplash API error: ${errorMessage}`);
      }

      const unsplashResult = await unsplashResponse.json();
      
      // Check if results exist and get the regular quality image URL
      if (unsplashResult.results && unsplashResult.results.length > 0) {
        imageUrl = unsplashResult.results[0].urls.regular; // Or .small, .thumb, .full
      } else {
        searchError = 'No images found on Unsplash for the query.';
      }

    } catch (e: any) {
      searchError = `Image search failed: ${e.message}`;
      // console.error(searchError);
      // Fallback to a generic placeholder image on error
      imageUrl = `https://placehold.co/400x300/FF0000/FFFFFF?text=Search+Error`; 
    }

    // --- END OF UNSPLASH API INTEGRATION ---

    if (imageUrl) {
      return new Response(JSON.stringify({ imageUrl: imageUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({ error: searchError || 'No image found for the query.' }), {
        status: 404, // Not Found if no image URL is obtained
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'image-search-proxy',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[image-search-proxy] Error logging failed:', _logErr); }
    // console.error('Edge function error in image-search-proxy:', error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

