// src/services/notificationPreferencesService.ts
// Service for creating and managing notification preferences
// Auto-creates default preferences for new users at signup

import { supabase } from '@/integrations/supabase/client';

/**
 * Detects user's timezone from their IP address
 * Uses ip-api.com free tier (45 requests/min per IP)
 * Falls back to UTC if detection fails
 */
export const detectTimezoneFromIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://ip-api.com/json/?fields=timezone', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[Timezone] Failed to fetch timezone from IP');
      return 'UTC';
    }

    const data = await response.json();
    if (data.timezone) {
      //console.log(`[Timezone] Auto-detected from IP: ${data.timezone}`);
      return data.timezone;
    }
    return 'UTC';
  } catch (error) {
    console.warn('[Timezone] Error detecting timezone from IP:', error);
    return 'UTC';
  }
};

/**
 * Creates default notification preferences for a new user
 * Called automatically after user signup
 * Includes timezone auto-detection
 */
export const createDefaultNotificationPreferences = async (userId: string): Promise<boolean> => {
  try {
    // Check if preferences already exist (prevent duplicates)
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
     // console.log('[NotifPrefs] Preferences already exist for user:', userId);
      return true;
    }

    // Auto-detect timezone from IP
    const userTimezone = await detectTimezoneFromIP();

    // Create default notification preferences
    const { error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: userId,
        email_notifications: true,
        push_notifications: true,
        schedule_reminders: true,
        social_notifications: true,
        quiz_reminders: true,
        assignment_reminders: true,
        reminder_time: 30, // minutes before event
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        user_timezone: userTimezone,
        max_notifications_per_day: 3,
        daily_categories: {
          study_planning: {
            enabled: true,
            time: '07:00'
          },
          quiz_challenge: {
            enabled: true,
            time: '14:00'
          },
          group_nudge: {
            enabled: true,
            time: '17:00'
          },
          podcast_discovery: {
            enabled: true,
            time: '19:00'
          },
          progress_tracking: {
            enabled: true,
            time: '20:00'
          }
        }
      });

    if (error) {
      console.error('[NotifPrefs] Error creating default preferences:', error);
      // Don't block signup if preferences creation fails
      return false;
    }

    //console.log('[NotifPrefs] Default notification preferences created for user:', userId, 'with timezone:', userTimezone);
    return true;
  } catch (error) {
    console.error('[NotifPrefs] Unexpected error creating notification preferences:', error);
    // Don't throw - this should not block user signup
    return false;
  }
};
