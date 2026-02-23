// supabase/functions/toggle-bookmark/index.ts
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
    const { post_id, is_bookmarked } = body;

    if (!post_id) {
      return createErrorResponse('post_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (is_bookmarked) {
      // Remove bookmark
      const { error } = await supabase
        .from('social_bookmarks')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', userId);

      if (error) throw error;

      // Decrement bookmarks_count
      await supabase.rpc('decrement_counter', {
        table_name: 'social_posts',
        column_name: 'bookmarks_count',
        row_id: post_id,
      }).then(null, () => {
        // Fallback: manual decrement if RPC doesn't exist
        return supabase
          .from('social_posts')
          .select('bookmarks_count')
          .eq('id', post_id)
          .single()
          .then(({ data }) => {
            if (data) {
              return supabase
                .from('social_posts')
                .update({ bookmarks_count: Math.max(0, (data.bookmarks_count || 0) - 1) })
                .eq('id', post_id);
            }
          });
      });

      return new Response(
        JSON.stringify({ success: true, is_bookmarked: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Add bookmark
      const { error } = await supabase
        .from('social_bookmarks')
        .insert({ post_id, user_id: userId });

      if (error) throw error;

      // Increment bookmarks_count
      await supabase.rpc('increment_counter', {
        table_name: 'social_posts',
        column_name: 'bookmarks_count',
        row_id: post_id,
      }).then(null, () => {
        // Fallback: manual increment if RPC doesn't exist
        return supabase
          .from('social_posts')
          .select('bookmarks_count')
          .eq('id', post_id)
          .single()
          .then(({ data }) => {
            if (data) {
              return supabase
                .from('social_posts')
                .update({ bookmarks_count: (data.bookmarks_count || 0) + 1 })
                .eq('id', post_id);
            }
          });
      });

      return new Response(
        JSON.stringify({ success: true, is_bookmarked: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'toggle-bookmark',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[toggle-bookmark] Error logging failed:', _logErr); }
    console.error('toggle-bookmark error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
