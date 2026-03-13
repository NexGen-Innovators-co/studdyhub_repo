// Supabase Edge Function: scheduled-notifications-dispatcher
// Schedule: Every 5 minutes via pg_cron
// Purpose: Check daily_notification_log for notifications due to be sent and dispatch them

import { serve } from 'https://deno.land/std@0.195.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { logSystemError } from '../_shared/errorLogger.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[scheduled-notifications-dispatcher] Starting dispatch run...');
    
    const now = new Date().toISOString();

    // 1. Find all notifications that should be sent now
    // Criteria: scheduled_send_at <= now AND actually_sent_at IS NULL
    const { data: notificationsDue, error: fetchError } = await supabase
      .from('daily_notification_log')
      .select('id, user_id, notification_type, message_template, deep_link_url, personalization_data, category')
      .lte('scheduled_send_at', now)
      .is('actually_sent_at', null)
      .order('scheduled_send_at', { ascending: true })
      .limit(100); // Process up to 100 per run to avoid timeout

    if (fetchError) {
      throw new Error(`Failed to fetch due notifications: ${fetchError.message}`);
    }

    if (!notificationsDue || notificationsDue.length === 0) {
      console.log('[scheduled-notifications-dispatcher] No notifications due for sending');
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: 'No notifications due' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scheduled-notifications-dispatcher] Found ${notificationsDue.length} notifications due to send`);

    let sentCount = 0;
    let failedCount = 0;
    const logsToUpdate: { id: string; success: boolean; error?: string }[] = [];

    // 2. Send each notification via send-notification function
    for (const notif of notificationsDue) {
      try {
        // Reconstruct the notification payload
        const sendPayload = {
          user_id: notif.user_id,
          type: notif.notification_type,
          title: notif.notification_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          message: notif.message_template,
          data: notif.personalization_data || { category: notif.category },
          action_url: notif.deep_link_url,
          save_to_db: false, // Already logged in daily_notification_log
        };

        console.log(`[scheduled-notifications-dispatcher] Sending notification ${notif.id} to user ${notif.user_id}`);

        const response = await supabase.functions.invoke('send-notification', {
          body: sendPayload,
        });

        if (response.error) {
          console.error(`Error sending notification ${notif.id}:`, response.error);
          logsToUpdate.push({ id: notif.id, success: false, error: response.error?.message });
          failedCount++;
        } else {
          console.log(`Successfully sent notification ${notif.id}`);
          logsToUpdate.push({ id: notif.id, success: true });
          sentCount++;
        }
      } catch (err: any) {
        console.error(`Exception sending notification ${notif.id}:`, err);
        logsToUpdate.push({ id: notif.id, success: false, error: err.message });
        failedCount++;
      }
    }

    // 3. Update the logs with actually_sent_at timestamp for successful sends
    const successfulIds = logsToUpdate
      .filter(log => log.success)
      .map(log => log.id);

    if (successfulIds.length > 0) {
      const { error: updateError } = await supabase
        .from('daily_notification_log')
        .update({ actually_sent_at: new Date().toISOString() })
        .in('id', successfulIds);

      if (updateError) {
        console.error('[scheduled-notifications-dispatcher] Error updating sent timestamps:', updateError);
      } else {
        console.log(`[scheduled-notifications-dispatcher] Updated ${successfulIds.length} notification logs with send timestamps`);
      }
    }

    // 4. Log failed sends for debugging
    const failedLogs = logsToUpdate.filter(log => !log.success);
    if (failedLogs.length > 0) {
      console.warn(`[scheduled-notifications-dispatcher] Failed to send ${failedLogs.length} notifications:`, failedLogs);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: sentCount,
        failed: failedCount,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[scheduled-notifications-dispatcher] Fatal error:', error);
    
    try {
      await logSystemError(supabase, {
        source: 'scheduled-notifications-dispatcher',
        message: error.message,
        details: { stack: error.stack },
        severity: 'error',
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
