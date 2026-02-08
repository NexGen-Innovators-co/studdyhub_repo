// supabase/functions/delete-social-post/index.ts
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

    // Verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('social_posts')
      .select('author_id')
      .eq('id', post_id)
      .single();

    if (fetchError || !post) {
      return createErrorResponse('Post not found', 404);
    }

    if (post.author_id !== userId) {
      return createErrorResponse('You can only delete your own posts', 403);
    }

    // Cascade delete all related data in parallel (using service role key)
    await Promise.all([
      supabase.from('social_likes').delete().eq('post_id', post_id),
      supabase.from('social_comments').delete().eq('post_id', post_id),
      supabase.from('social_bookmarks').delete().eq('post_id', post_id),
      supabase.from('social_media').delete().eq('post_id', post_id),
      supabase.from('social_post_hashtags').delete().eq('post_id', post_id),
      supabase.from('social_post_tags').delete().eq('post_id', post_id),
      supabase.from('social_notifications').delete().eq('post_id', post_id),
    ]);

    // Delete the post itself
    const { error: deleteError } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', post_id);

    if (deleteError) throw deleteError;

    // Decrement user's posts_count
    const { data: userData } = await supabase
      .from('social_users')
      .select('posts_count')
      .eq('id', userId)
      .single();

    if (userData) {
      await supabase
        .from('social_users')
        .update({ posts_count: Math.max(0, (userData.posts_count || 0) - 1) })
        .eq('id', userId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('delete-social-post error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
