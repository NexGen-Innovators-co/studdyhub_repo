// Supabase Edge Function: check-schedule-reminders
// Scans for upcoming schedule items and triggers push notifications
// Run via pg_cron every minute

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { logSystemError } from '../_shared/errorLogger.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Get all scheduled items starting in the next 15 minutes
    // That have NOT had a reminder sent yet
    const now = new Date()
    const futureWindow = new Date(now.getTime() + 16 * 60000) // 16 minutes from now (buffer)

    // We strictly look for items that:
    // - Start between NOW and NOW + 15 mins
    // - Don't have a corresponding 'sent' record in schedule_reminders (or where notification_sent is false)

    // Simplification: We check the schedule_reminders table.
    // If your app populates schedule_reminders, valid query is:

    const { data: pendingReminders, error: remindersError } = await supabaseClient
      .from('schedule_reminders')
      .select(`
        id,
        reminder_minutes,
        schedule_items!inner (
          id,
          title,
          start_time,
          user_id
        )
      `)
      .eq('notification_sent', false)
      .is('notification_sent_at', null)

    if (remindersError) throw remindersError

    console.log(`Found ${pendingReminders?.length || 0} pending reminders`)

    const validReminders = []

    // Filter reminders that are actually DUE
    // Due if: schedule_start_time - reminder_minutes <= now
    if (pendingReminders) {
      for (const reminder of pendingReminders) {
        // @ts-ignore
        const item = reminder.schedule_items
        const startTime = new Date(item.start_time).getTime()
        const triggerTime = startTime - (reminder.reminder_minutes * 60000)

        // If trigger time is in the past (or now), it's due
        if (triggerTime <= now.getTime()) {
          validReminders.push({
            reminderId: reminder.id,
            userId: item.user_id,
            title: item.title,
            minutesUntil: Math.round((startTime - now.getTime()) / 60000)
          })
        }
      }
    }

    console.log(`Processing ${validReminders.length} due reminders`)

    // Send notifications
    for (const reminder of validReminders) {
      try {
        // Trigger send-notification function
        // We call it directly via fetch or invoke, OR allow this function to send directly if we copy logic.
        // Calling the function is cleaner separation.

        await supabaseClient.functions.invoke('send-notification', {
          body: {
            user_id: reminder.userId,
            type: 'schedule_reminder',
            title: 'Upcoming Class',
            message: `${reminder.title} starts in ${Math.max(0, reminder.minutesUntil)} minutes!`,
            data: { schedule_id: reminder.reminderId } // passing ID for context
          }
        })

        // Mark as sent
        await supabaseClient
          .from('schedule_reminders')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString()
          })
          .eq('id', reminder.reminderId)

      } catch (err) {
        console.error(`Failed to process reminder ${reminder.reminderId}`, err)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: validReminders.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'check-schedule-reminders',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[check-schedule-reminders] Error logging failed:', _logErr); }
    console.error('Error in check-schedule-reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
