// supabase/functions/create-institution/index.ts
// Edge function for creating a new institution with the creator as owner.

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

    // Authenticate user
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
    const { name, slug, type, countryId, educationLevelId, description, website, address, city, region } = body;

    if (!name || !slug) {
      return new Response(JSON.stringify({ error: 'Name and slug are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('institutions')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Slug already taken' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create institution
    const { data: institution, error: createError } = await supabase
      .from('institutions')
      .insert({
        name,
        slug,
        type: type || 'school',
        country_id: countryId || null,
        education_level_id: educationLevelId || null,
        description: description || null,
        website: website || null,
        address: address || null,
        city: city || null,
        region: region || null,
        verification_status: 'unverified',
        is_active: true,
      })
      .select('*')
      .single();

    if (createError) throw createError;

    // Add creator as owner member
    const { error: memberError } = await supabase.from('institution_members').insert({
      institution_id: institution.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      // Rollback institution creation
      await supabase.from('institutions').delete().eq('id', institution.id);
      throw memberError;
    }

    return new Response(JSON.stringify({ institution }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'create-institution',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[create-institution] Error logging failed:', _logErr); }
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
