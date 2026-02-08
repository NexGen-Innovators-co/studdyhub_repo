// supabase/functions/manage-group-member/index.ts
// Consolidates: approve member (RPC + count update), reject member (delete + notification) → 1 call
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

    const { action, membership_id, target_user_id, group_id } = await req.json();

    if (!action || !membership_id || !target_user_id || !group_id) {
      return createErrorResponse('action, membership_id, target_user_id, and group_id are required', 400);
    }

    if (!['approve', 'reject'].includes(action)) {
      return createErrorResponse('action must be "approve" or "reject"', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'approve') {
      // Call the PostgreSQL function that bypasses RLS
      const { data, error } = await supabase.rpc('approve_group_member', {
        p_membership_id: membership_id,
        p_group_id: group_id,
        p_user_id: target_user_id,
        p_approver_id: userId
      });

      if (error) {
        return createErrorResponse(`Failed to approve: ${error.message}`, 500);
      }

      if (!data?.success) {
        return createErrorResponse(data?.error || 'Failed to approve member', 500);
      }

      // Update group members count
      const { count } = await supabase
        .from('social_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group_id)
        .eq('status', 'active');

      if (count !== null) {
        await supabase
          .from('social_groups')
          .update({
            members_count: count,
            updated_at: new Date().toISOString()
          })
          .eq('id', group_id);
      }

      return new Response(
        JSON.stringify({ success: true, action: 'approved', members_count: count }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reject') {
      // Get group name for notification
      const { data: group } = await supabase
        .from('social_groups')
        .select('name')
        .eq('id', group_id)
        .single();

      // Delete membership record
      const { error: deleteError } = await supabase
        .from('social_group_members')
        .delete()
        .eq('id', membership_id);

      if (deleteError) {
        throw new Error(`Failed to reject member: ${deleteError.message}`);
      }

      // Send rejection notification
      await supabase.from('social_notifications').insert({
        user_id: target_user_id,
        type: 'group_invite',
        title: 'Request Declined',
        message: `Your request to join "${group?.name || 'the group'}" was declined.`,
        data: { group_id }
      });

      return new Response(
        JSON.stringify({ success: true, action: 'rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in manage-group-member:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
