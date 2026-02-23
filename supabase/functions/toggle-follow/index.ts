// supabase/functions/toggle-follow/index.ts
// Consolidates: check existing follow, insert/delete, update counts, create notification
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

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
    const { target_user_id } = body;

    if (!target_user_id) {
      return createErrorResponse('target_user_id is required', 400);
    }

    if (target_user_id === userId) {
      return createErrorResponse('Cannot follow yourself', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('social_follows')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', target_user_id)
      .maybeSingle();

    const isCurrentlyFollowing = !!existingFollow;

    if (isCurrentlyFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('social_follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', target_user_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, is_now_following: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Follow
      const { error: followError } = await supabase
        .from('social_follows')
        .insert({
          follower_id: userId,
          following_id: target_user_id,
        });

      if (followError) throw followError;

      // Get actor name for notification
      const { data: actor } = await supabase
        .from('social_users')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .single();

      // Create in-DB notification
      await supabase
        .from('social_notifications')
        .insert({
          user_id: target_user_id,
          actor_id: userId,
          type: 'follow',
          title: 'New Follower',
          message: `${actor?.display_name || 'Someone'} started following you`,
          is_read: false,
        }).then(null, () => { /* ignore notification errors */ });

      return new Response(
        JSON.stringify({
          success: true,
          is_now_following: true,
          actor_name: actor?.display_name || 'Someone',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'toggle-follow',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[toggle-follow] Error logging failed:', _logErr); }
    console.error('toggle-follow error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
