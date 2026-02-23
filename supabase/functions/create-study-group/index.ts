// supabase/functions/create-study-group/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SubscriptionValidator, 
  createErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user ID from auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // Check subscription for group creation
    const canCreate = await validator.canCreateGroup(userId);
    if (!canCreate.allowed) {
      return createErrorResponse(canCreate.message || 'Not allowed to create groups', 403);
    }

    // Parse request body
    const body = await req.json();
    const { 
      name, 
      description, 
      subject, 
      privacy = 'public', 
      max_members = 50,
      cover_image_url = null 
    } = body;

    // Validate inputs
    if (!name || name.trim().length === 0) {
      return createErrorResponse('Group name is required', 400);
    }

    if (name.length > 100) {
      return createErrorResponse('Group name is too long (max 100 characters)', 400);
    }

    if (description && description.length > 1000) {
      return createErrorResponse('Group description is too long (max 1000 characters)', 400);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin (admins have unlimited groups)
    const isAdmin = await validator.isAdmin(userId);

    // Check group limit based on tier (skip for admins)
    if (!isAdmin) {
      const subscription = await validator.getUserSubscription(userId);
      let maxGroups = subscription.subscription_tier === 'free' ? 0 : 
                      subscription.subscription_tier === 'scholar' ? 10 : 100;

      if (subscription.subscription_tier === 'scholar' || subscription.subscription_tier === 'genius') {
        const { count: groupCount } = await supabase
          .from('social_groups')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', userId);

        if (groupCount && groupCount >= maxGroups) {
          return createErrorResponse(`Group limit reached (${maxGroups} groups). Upgrade your plan to create more.`, 403);
        }
      }
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('social_groups')
      .insert({
        created_by: userId,
        name,
        description: description || null,
        category: subject || 'General',
        privacy,
        cover_image_url: cover_image_url || null,
        members_count: 1,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (groupError) {
      // console.error('Error creating group:', groupError);
      return createErrorResponse('Failed to create group', 500);
    }

    // Add creator as a group member
    const { error: memberError } = await supabase
      .from('social_group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString()
      });

    if (memberError) {
      // console.error('Error adding creator as member:', memberError);
      // Continue anyway - group is created
    }

    return new Response(JSON.stringify({
      success: true,
      group
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'create-study-group',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[create-study-group] Error logging failed:', _logErr); }
    // console.error('Error in create-study-group:', error);
    return createErrorResponse('Internal server error', 500);
  }
});

