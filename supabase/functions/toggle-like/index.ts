// supabase/functions/toggle-like/index.ts
// Consolidates: check social_users exists, insert/delete like, create notification
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
    const { post_id, is_liked } = body;

    if (!post_id) {
      return createErrorResponse('post_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (is_liked) {
      // Unlike — delete from social_likes
      const { error } = await supabase
        .from('social_likes')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, is_liked: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Like — verify social_users record exists, then insert
      const { data: socialUser, error: socialUserError } = await supabase
        .from('social_users')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single();

      if (socialUserError || !socialUser) {
        return createErrorResponse('Social profile not found. Please refresh the page.', 400);
      }

      const { error: insertError } = await supabase
        .from('social_likes')
        .insert({ post_id, user_id: userId });

      if (insertError) throw insertError;

      // Get post author for notification (only if not self-like)
      const { data: post } = await supabase
        .from('social_posts')
        .select('author_id')
        .eq('id', post_id)
        .single();

      let notificationCreated = false;
      if (post && post.author_id !== userId) {
        // Create in-DB notification
        await supabase
          .from('social_notifications')
          .insert({
            user_id: post.author_id,
            actor_id: userId,
            type: 'like',
            title: 'New Like',
            message: `${socialUser.display_name || 'Someone'} liked your post`,
            post_id: post_id,
            is_read: false,
          }).then(null, () => { /* ignore notification errors */ });
        notificationCreated = true;
      }

      return new Response(
        JSON.stringify({
          success: true,
          is_liked: true,
          notification_created: notificationCreated,
          actor_name: socialUser.display_name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('toggle-like error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
