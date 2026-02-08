// supabase/functions/join-leave-group/index.ts
// Consolidates: check membership, insert/delete, update members_count
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
    const { group_id, action } = body; // action: 'join' | 'leave'

    if (!group_id || !action) {
      return createErrorResponse('group_id and action (join/leave) are required', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'join') {
      // Check if already a member
      const { data: existing } = await supabase
        .from('social_group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, action: 'already_member' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert membership
      const { error: joinError } = await supabase
        .from('social_group_members')
        .insert({
          group_id,
          user_id: userId,
          role: 'member',
        });

      if (joinError) throw joinError;

      // Update member count
      const { data: group } = await supabase
        .from('social_groups')
        .select('members_count')
        .eq('id', group_id)
        .single();

      await supabase
        .from('social_groups')
        .update({ members_count: (group?.members_count || 0) + 1 })
        .eq('id', group_id);

      return new Response(
        JSON.stringify({ success: true, action: 'joined', members_count: (group?.members_count || 0) + 1 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'leave') {
      // Delete membership
      const { error: leaveError } = await supabase
        .from('social_group_members')
        .delete()
        .eq('group_id', group_id)
        .eq('user_id', userId);

      if (leaveError) throw leaveError;

      // Update member count
      const { data: group } = await supabase
        .from('social_groups')
        .select('members_count')
        .eq('id', group_id)
        .single();

      const newCount = Math.max(0, (group?.members_count || 1) - 1);
      await supabase
        .from('social_groups')
        .update({ members_count: newCount })
        .eq('id', group_id);

      return new Response(
        JSON.stringify({ success: true, action: 'left', members_count: newCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return createErrorResponse('Invalid action. Must be "join" or "leave".', 400);
    }
  } catch (error) {
    console.error('join-leave-group error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
