// Supabase Edge Function: send-notification
// Sends push notifications to subscribed users

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@studdyhub.com'

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

interface NotificationRequest {
  user_id?: string
  user_ids?: string[]
  type: string
  title: string
  message: string
  data?: Record<string, any>
  save_to_db?: boolean
}

interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  device_type: string
}

// Helper function to send web push notification
async function sendWebPush(
  subscription: PushSubscription,
  payload: any
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    // Prepare the web push payload
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: payload.icon || '/icon-192.png',
      image: payload.image,
      badge: '/badge-72.png',
      tag: payload.type,
      data: payload.data || {},
      requireInteraction: ['schedule_reminder', 'quiz_due'].includes(payload.type),
      timestamp: Date.now(),
    })

    await webpush.sendNotification(
      pushSubscription,
      pushPayload
    )

    return true
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`Subscription gone for ${subscription.id}`)
      return false
    }
    console.error(`Error sending push to ${subscription.id}:`, error)
    return true // Keep subscription on other errors
  }
}

// Check if user is in quiet hours
function isInQuietHours(preferences: any): boolean {
  if (!preferences?.quiet_hours_enabled) return false

  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = (preferences.quiet_hours_start || '22:00').split(':').map(Number)
  const [endHour, endMin] = (preferences.quiet_hours_end || '08:00').split(':').map(Number)

  const quietStart = startHour * 60 + startMin
  const quietEnd = endHour * 60 + endMin

  // Handle overnight quiet hours
  if (quietStart > quietEnd) {
    return currentTime >= quietStart || currentTime < quietEnd
  }

  return currentTime >= quietStart && currentTime < quietEnd
}

// Check if notification type is enabled in preferences
function isNotificationTypeEnabled(preferences: any, type: string): boolean {
  const typeMap: Record<string, string> = {
    schedule_reminder: 'schedule_reminders',
    quiz_due: 'quiz_reminders',
    assignment_due: 'assignment_reminders',
    social_like: 'social_notifications',
    social_comment: 'social_notifications',
    social_mention: 'social_notifications',
    social_follow: 'social_notifications',
  }

  const preferenceKey = typeMap[type]
  if (!preferenceKey) return true // Default to enabled for unknown types

  return preferences[preferenceKey] !== false
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    const body = await req.json()
    
    // Handle Supabase Database Webhook payload
    let notificationRequest: NotificationRequest
    
    if (body.type === 'INSERT' && body.table === 'notifications' && body.record) {
      const record = body.record
      notificationRequest = {
        user_id: record.user_id,
        type: record.type,
        title: record.title,
        message: record.message,
        data: record.data,
        save_to_db: false // Already in DB
      }
    } else {
      notificationRequest = body
    }

    const { user_id, user_ids, type, title, message, data, save_to_db = true } = notificationRequest

    // Validate required fields
    if (!type || !title || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, title, message' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!user_id && !user_ids) {
      return new Response(
        JSON.stringify({ error: 'Either user_id or user_ids must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Determine target users
    const targetUsers = user_ids || [user_id!]
    const results: Record<string, any> = {
      total: targetUsers.length,
      sent: 0,
      saved: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    // Process each user
    for (const userId of targetUsers) {
      try {
        // Get user preferences
        const { data: preferences } = await supabaseClient
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .single()

        // Check if push notifications are enabled
        // If preferences exist and explicitly disabled, skip. 
        // If preferences are missing, we proceed (assuming they might still have subscriptions).
        if (preferences && preferences.push_notifications === false) {
           console.log(`User ${userId} has disabled push notifications in preferences`);
           results.skipped++;
           continue;
        }

        // Check if notification type is enabled (only if preferences exist)
        if (preferences && !isNotificationTypeEnabled(preferences, type)) {
          console.log(`User ${userId} has disabled notifications of type ${type}`);
          results.skipped++;
          continue;
        }

        // Check quiet hours
        if (isInQuietHours(preferences)) {
          results.skipped++
          continue
        }

        // Save notification to database if requested
        let notificationId: string | undefined
        if (save_to_db) {
          const { data: savedNotification, error: saveError } = await supabaseClient
            .from('notifications')
            .insert({
              user_id: userId,
              type,
              title,
              message,
              data,
              read: false,
            })
            .select('id')
            .single()

          if (saveError) {
            console.error(`Error saving notification for user ${userId}:`, saveError)
            results.errors.push({ user_id: userId, error: 'Failed to save notification' })
          } else {
            notificationId = savedNotification.id
            results.saved++
          }
        }

        // Get user's push subscriptions
        const { data: subscriptions, error: subsError } = await supabaseClient
          .from('notification_subscriptions')
          .select('*')
          .eq('user_id', userId)

        if (subsError) {
          console.error(`Error fetching subscriptions for user ${userId}:`, subsError)
          results.errors.push({ user_id: userId, error: 'Failed to fetch subscriptions' })
          continue
        }

        if (!subscriptions || subscriptions.length === 0) {
          results.skipped++
          continue
        }

        // Determine action URL based on type
        let action_url = '/dashboard'
        if (['like', 'comment', 'mention', 'social_share', 'social_comment', 'social_mention'].includes(type)) {
          if (data?.post_id) action_url = `/social/post/${data.post_id}`
          else action_url = '/social'
        } else if (['follow', 'social_follow'].includes(type)) {
          if (data?.actor_id) action_url = `/social/profile/${data.actor_id}`
          else action_url = '/social'
        } else if (['schedule_reminder', 'assignment_due'].includes(type)) {
          action_url = '/schedule'
        } else if (type === 'quiz_due') {
          action_url = '/quizzes'
        } else if (data?.url) {
          action_url = data.url
        }

        // Send push notification to each subscription
        const pushPayload = {
          type,
          title,
          message,
          icon: notificationRequest.icon,
          image: notificationRequest.image,
          data: {
            type, // critical for service worker routing
            action_url,
            ...data,
            notification_id: notificationId,
          },
        }

        let sentToDevice = false
        for (const subscription of subscriptions) {
          const success = await sendWebPush(subscription, pushPayload)
          
          if (!success) {
            // Delete invalid subscription
            await supabaseClient
              .from('notification_subscriptions')
              .delete()
              .eq('id', subscription.id)
          } else {
            sentToDevice = true
          }
        }

        if (sentToDevice) {
          results.sent++
        } else {
          results.failed++
        }
      } catch (error) {
        console.error(`Error processing notification for user ${userId}:`, error)
        results.errors.push({ user_id: userId, error: error.message })
        results.failed++
      }
    }

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error in send-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
