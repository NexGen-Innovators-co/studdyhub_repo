// supabase/functions/manage-notifications/index.ts
// Consolidates: markAsRead, markAllAsRead, deleteNotification
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
    const { action, notification_id } = body;
    // actions: 'mark_read', 'mark_all_read', 'delete'

    if (!action) {
      return createErrorResponse('action is required (mark_read, mark_all_read, delete)', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'mark_read': {
        if (!notification_id) {
          return createErrorResponse('notification_id is required for mark_read', 400);
        }
        const { error } = await supabase
          .from('social_notifications')
          .update({ is_read: true })
          .eq('id', notification_id)
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, action: 'mark_read' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_all_read': {
        const { error } = await supabase
          .from('social_notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, action: 'mark_all_read' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!notification_id) {
          return createErrorResponse('notification_id is required for delete', 400);
        }
        const { error } = await supabase
          .from('social_notifications')
          .delete()
          .eq('id', notification_id)
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, action: 'delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return createErrorResponse('Invalid action. Must be "mark_read", "mark_all_read", or "delete".', 400);
    }
  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'manage-notifications',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[manage-notifications] Error logging failed:', _logErr); }
    console.error('manage-notifications error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
