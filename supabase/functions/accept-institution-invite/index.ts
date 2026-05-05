// supabase/functions/accept-institution-invite/index.ts
// Edge function for accepting an institution invitation via token.

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

    const { inviteToken } = await req.json();

    if (!inviteToken) {
      return new Response(JSON.stringify({ error: 'inviteToken is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('institution_invites')
      .select('*')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError) throw inviteError;

    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('institution_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);

      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user email matches invite email
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'This invitation was sent to a different email address' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('institution_members')
      .select('id, status')
      .eq('institution_id', invite.institution_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return new Response(JSON.stringify({ error: 'Already a member of this institution' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reactivate removed member
      await supabase
        .from('institution_members')
        .update({
          status: 'active',
          role: invite.role,
          invite_code: inviteToken,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMember.id);
    } else {
      // Create new membership
      const { error: memberError } = await supabase.from('institution_members').insert({
        institution_id: invite.institution_id,
        user_id: user.id,
        role: invite.role,
        status: 'active',
        invite_code: inviteToken,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      });

      if (memberError) throw memberError;
    }

    // Mark invite as accepted
    await supabase
      .from('institution_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    // Upgrade user role to tutor_affiliated if they are still a student
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('id', user.id)
      .single();

    if (currentProfile && (!currentProfile.user_role || currentProfile.user_role === 'student')) {
      await supabase
        .from('profiles')
        .update({
          user_role: 'tutor_affiliated',
          role_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    // Fetch the institution details
    const { data: institution } = await supabase
      .from('institutions')
      .select('id, name, slug, type')
      .eq('id', invite.institution_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        institution,
        role: invite.role,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'accept-institution-invite',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[accept-institution-invite] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
