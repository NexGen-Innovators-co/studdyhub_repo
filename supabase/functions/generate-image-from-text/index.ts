import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { description, userId } = await req.json();
        // console.log('[generate-image-from-text] Incoming data:', { description, userId });
        if (!description || typeof description !== 'string' || !description.trim()) {
            return new Response(JSON.stringify({ error: 'Missing or empty description for image generation.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Pollinations.ai — free image generation, no API key required.
        // The URL itself returns the generated image as PNG/JPEG.
        const encodedPrompt = encodeURIComponent(description.trim());
        const seed = Math.floor(Math.random() * 999999);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;

        // Verify the URL is reachable (HEAD request — fast, no body download)
        const probe = await fetch(imageUrl, { method: "HEAD" });
        if (!probe.ok) {
            throw new Error(`Pollinations image generation failed: HTTP ${probe.status}`);
        }

        return new Response(JSON.stringify({ imageUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
      // ── Log to system_error_logs ──
      try {
        const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await logSystemError(_logClient, {
          severity: 'error',
          source: 'generate-image-from-text',
          message: error?.message || String(error),
          details: { stack: error?.stack },
        });
      } catch (_logErr) { console.error('[generate-image-from-text] Error logging failed:', _logErr); }
        // console.error('Edge function error in generate-image-from-text:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
