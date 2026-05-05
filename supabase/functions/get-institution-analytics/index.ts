// supabase/functions/get-institution-analytics/index.ts
// Edge function for fetching institution-level analytics.
// Returns member counts, course stats, activity trends.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { institutionId } = await req.json();

    if (!institutionId) {
      return new Response(JSON.stringify({ error: 'institutionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller has access
    const { data: callerMembership } = await supabase
      .from('institution_members')
      .select('role')
      .eq('institution_id', institutionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!callerMembership || !['owner', 'admin', 'educator'].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gather analytics in parallel
    const [membersResult, coursesResult, invitesResult, membersByRole] = await Promise.all([
      // Total active members
      supabase
        .from('institution_members')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('status', 'active'),

      // Total courses by this institution's members
      supabase
        .from('courses')
        .select('id, is_published, created_at', { count: 'exact' })
        .eq('institution_id', institutionId),

      // Pending invites
      supabase
        .from('institution_invites')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('status', 'pending'),

      // Members grouped by role
      supabase
        .from('institution_members')
        .select('role')
        .eq('institution_id', institutionId)
        .eq('status', 'active'),
    ]);

    // Calculate role breakdown
    const roleBreakdown: Record<string, number> = {};
    (membersByRole.data || []).forEach((m: any) => {
      roleBreakdown[m.role] = (roleBreakdown[m.role] || 0) + 1;
    });

    // Course stats
    const courseList = coursesResult.data || [];
    const publishedCourses = courseList.filter((c: any) => c.is_published).length;
    const draftCourses = courseList.length - publishedCourses;

    // Recent activity — courses created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCourses = courseList.filter(
      (c: any) => new Date(c.created_at) > thirtyDaysAgo
    ).length;

    const analytics = {
      members: {
        total: membersResult.count ?? 0,
        byRole: roleBreakdown,
      },
      courses: {
        total: coursesResult.count ?? 0,
        published: publishedCourses,
        draft: draftCourses,
        createdLast30Days: recentCourses,
      },
      invites: {
        pending: invitesResult.count ?? 0,
      },
    };

    return new Response(JSON.stringify({ analytics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'get-institution-analytics',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[get-institution-analytics] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
