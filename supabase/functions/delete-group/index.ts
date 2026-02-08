// supabase/functions/delete-group/index.ts
// Consolidates: cascade delete group members, posts, events, chat messages, then group (5 queries → 1 call)
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

    const { group_id } = await req.json();
    if (!group_id) {
      return createErrorResponse('group_id is required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is the group creator
    const { data: group, error: groupError } = await supabase
      .from('social_groups')
      .select('id, created_by')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return createErrorResponse('Group not found', 404);
    }

    if (group.created_by !== userId) {
      return createErrorResponse('Only the group creator can delete the group', 403);
    }

    // Cascade delete all related data in parallel
    const [membersResult, postsResult, eventsResult, messagesResult] = await Promise.all([
      supabase.from('social_group_members').delete().eq('group_id', group_id),
      supabase.from('social_posts').delete().eq('group_id', group_id),
      supabase.from('social_events').delete().eq('group_id', group_id),
      supabase.from('social_chat_messages').delete().eq('group_id', group_id),
    ]);

    // Check for errors in cascade deletes
    const cascadeErrors = [membersResult.error, postsResult.error, eventsResult.error, messagesResult.error].filter(Boolean);
    if (cascadeErrors.length > 0) {
      console.error('Cascade delete errors:', cascadeErrors);
    }

    // Delete the group itself
    const { error: deleteError } = await supabase
      .from('social_groups')
      .delete()
      .eq('id', group_id);

    if (deleteError) {
      throw new Error(`Failed to delete group: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-group:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
