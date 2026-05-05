// supabase/functions/manage-institution-members/index.ts
// Edge function for managing institution members — invite, remove, update role, list.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action = 'list' | 'invite' | 'remove' | 'update-role' | 'list-invites';

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

    const body = await req.json();
    const { action, institutionId, memberId, email, role } = body as {
      action: Action;
      institutionId: string;
      memberId?: string;
      email?: string;
      role?: string;
    };

    if (!action || !institutionId) {
      return new Response(JSON.stringify({ error: 'action and institutionId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the requesting user is an admin/owner of the institution
    const { data: callerMembership } = await supabase
      .from('institution_members')
      .select('role, status')
      .eq('institution_id', institutionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const callerRole = callerMembership?.role;
    const canManage = callerRole === 'owner' || callerRole === 'admin';

    // ─── LIST MEMBERS ────────────────────────────────
    if (action === 'list') {
      const { data: members, error: listError } = await supabase
        .from('institution_members')
        .select('*, profile:profiles ( full_name, avatar_url, email )')
        .eq('institution_id', institutionId)
        .in('status', ['active', 'pending', 'invited'])
        .order('role')
        .order('joined_at', { ascending: false });

      if (listError) throw listError;

      return new Response(JSON.stringify({ members }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── LIST INVITES ────────────────────────────────
    if (action === 'list-invites') {
      const { data: invites, error: invError } = await supabase
        .from('institution_invites')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invError) throw invError;

      return new Response(JSON.stringify({ invites }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All remaining actions require admin/owner role
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── INVITE ──────────────────────────────────────
    if (action === 'invite') {
      if (!email || !role) {
        return new Response(JSON.stringify({ error: 'email and role are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invite, error: inviteError } = await supabase
        .from('institution_invites')
        .insert({
          institution_id: institutionId,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select('*')
        .single();

      if (inviteError) throw inviteError;

      // TODO: Send invitation email via send-notification or similar

      return new Response(JSON.stringify({ invite }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── REMOVE MEMBER ───────────────────────────────
    if (action === 'remove') {
      if (!memberId) {
        return new Response(JSON.stringify({ error: 'memberId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent removing the owner
      const { data: targetMember } = await supabase
        .from('institution_members')
        .select('role')
        .eq('id', memberId)
        .single();

      if (targetMember?.role === 'owner') {
        return new Response(JSON.stringify({ error: 'Cannot remove the institution owner' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: removeError } = await supabase
        .from('institution_members')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (removeError) throw removeError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── UPDATE ROLE ─────────────────────────────────
    if (action === 'update-role') {
      if (!memberId || !role) {
        return new Response(JSON.stringify({ error: 'memberId and role are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only owner can promote to admin
      if (role === 'admin' && callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the owner can assign admin role' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('institution_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'manage-institution-members',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[manage-institution-members] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
