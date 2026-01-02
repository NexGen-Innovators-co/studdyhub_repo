// Types for notification system
export interface NotificationSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  device_type: 'web' | 'mobile' | 'desktop';
  browser?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  action_url?: string;
  icon?: string;
  created_at: string;
  scheduled_for?: string;
}

export type NotificationType =
  | 'schedule_reminder'
  | 'quiz_due'
  | 'assignment_due'
  | 'study_session'
  | 'social_like'
  | 'social_comment'
  | 'social_follow'
  | 'social_mention'
  | 'podcast_share'
  | 'ai_limit_warning'
  | 'subscription_renewal'
  | 'general';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  schedule_reminders: boolean;
  social_notifications: boolean;
  quiz_reminders: boolean;
  assignment_reminders: boolean;
  reminder_time: number; // minutes before event
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string; // HH:mm format
  quiet_hours_end?: string; // HH:mm format
  created_at: string;
  updated_at: string;
}

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: 'google' | 'outlook';
  access_token: string;
  refresh_token: string;
  calendar_id?: string;
  sync_enabled: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderSettings {
  enabled: boolean;
  time: number; // minutes before
  methods: ('push' | 'email')[];
}

export interface ScheduleItemWithReminders extends ScheduleItem {
  reminders?: ReminderSettings[];
  calendar_event_id?: string; // ID in external calendar
  sync_to_calendar?: boolean;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

// Import ScheduleItem from Class.ts
import type { ScheduleItem } from './Class';
