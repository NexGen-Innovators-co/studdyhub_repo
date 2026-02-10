// supabase/functions/get-social-groups/index.ts
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
    const { offset = 0, limit = 10 } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single query: groups with creator + member count
    const { data: rawGroups, error } = await supabase
      .from('social_groups')
      .select(`*, creator:social_users!social_groups_created_by_fkey(*), members:social_group_members(count)`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    if (!rawGroups || rawGroups.length === 0) {
      return new Response(JSON.stringify({ groups: [], hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch fetch memberships for current user
    const groupIds = rawGroups.map((g: any) => g.id);
    const { data: memberships } = await supabase
      .from('social_group_members')
      .select('group_id, role, status')
      .eq('user_id', userId)
      .in('group_id', groupIds);

    const membershipMap = new Map(
      (memberships || []).map((m: any) => [m.group_id, m])
    );

    const groups = rawGroups.map((g: any) => {
      const membership = membershipMap.get(g.id);
      // Use the DB-maintained members_count (only counts active members via trigger)
      // rather than the unfiltered aggregate which includes pending/banned rows
      const activeCount = g.members_count || 0;
      return {
        ...g,
        members_count: activeCount,
        // Only mark as member if status is 'active' — pending users are NOT members
        is_member: membership?.status === 'active',
        member_role: membership?.role || null,
        member_status: membership?.status || null,
      };
    });

    return new Response(
      JSON.stringify({ groups, hasMore: groups.length === limit }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-social-groups error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
