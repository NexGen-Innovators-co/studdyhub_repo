// supabase/functions/track-post-view/index.ts
// Consolidates: check existing view, insert view, update views_count
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

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
    const { post_id } = body;

    if (!post_id) {
      return createErrorResponse('post_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing view (deduplicate)
    const { data: existingView } = await supabase
      .from('social_post_views')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingView) {
      // Already viewed, no-op
      return new Response(
        JSON.stringify({ success: true, already_viewed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new view
    const { error: viewError } = await supabase
      .from('social_post_views')
      .insert({
        post_id,
        user_id: userId,
      });

    if (viewError) throw viewError;

    // Update the post's views_count atomically
    const { data: post } = await supabase
      .from('social_posts')
      .select('views_count')
      .eq('id', post_id)
      .single();

    if (post) {
      await supabase
        .from('social_posts')
        .update({ views_count: (post.views_count || 0) + 1 })
        .eq('id', post_id);
    }

    return new Response(
      JSON.stringify({ success: true, already_viewed: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('track-post-view error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
