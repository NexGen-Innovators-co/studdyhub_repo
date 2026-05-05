// Supplemental types for notification and calendar integration tables
// These should be added to your main types.ts file after running the migration
// OR merge these into the Database['public']['Tables'] section

export interface NotificationTables {
  notifications: {
    Row: {
      id: string
      user_id: string
      type: 'schedule_reminder' | 'quiz_due' | 'assignment_due' | 'study_session' | 'social_like' | 'social_comment' | 'social_follow' | 'social_mention' | 'ai_limit_warning' | 'subscription_renewal' | 'general'
      title: string
      message: string
      data: JSON | null
      read: boolean
      read_at: string | null
      created_at: string
      expires_at: string | null
    }
    Insert: {
      id?: string
      user_id: string
      type: 'schedule_reminder' | 'quiz_due' | 'assignment_due' | 'study_session' | 'social_like' | 'social_comment' | 'social_follow' | 'social_mention' | 'ai_limit_warning' | 'subscription_renewal' | 'general'
      title: string
      message: string
      data?: JSON | null
      read?: boolean
      read_at?: string | null
      created_at?: string
      expires_at?: string | null
    }
    Update: {
      id?: string
      user_id?: string
      type?: 'schedule_reminder' | 'quiz_due' | 'assignment_due' | 'study_session' | 'social_like' | 'social_comment' | 'social_follow' | 'social_mention' | 'ai_limit_warning' | 'subscription_renewal' | 'general'
      title?: string
      message?: string
      data?: JSON | null
      read?: boolean
      read_at?: string | null
      created_at?: string
      expires_at?: string | null
    }
    Relationships: []
  }
  notification_subscriptions: {
    Row: {
      id: string
      user_id: string
      endpoint: string
      p256dh: string
      auth: string
      device_type: 'web' | 'mobile' | 'desktop' | null
      browser: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      endpoint: string
      p256dh: string
      auth: string
      device_type?: 'web' | 'mobile' | 'desktop' | null
      browser?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      endpoint?: string
      p256dh?: string
      auth?: string
      device_type?: 'web' | 'mobile' | 'desktop' | null
      browser?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  notification_preferences: {
    Row: {
      user_id: string
      push_notifications: boolean
      email_notifications: boolean
      schedule_reminders: boolean
      social_notifications: boolean
      quiz_reminders: boolean
      assignment_reminders: boolean
      quiet_hours_enabled: boolean
      quiet_hours_start: string | null
      quiet_hours_end: string | null
      reminder_time: number
      created_at: string
      updated_at: string
    }
    Insert: {
      user_id: string
      push_notifications?: boolean
      email_notifications?: boolean
      schedule_reminders?: boolean
      social_notifications?: boolean
      quiz_reminders?: boolean
      assignment_reminders?: boolean
      quiet_hours_enabled?: boolean
      quiet_hours_start?: string | null
      quiet_hours_end?: string | null
      reminder_time?: number
      created_at?: string
      updated_at?: string
    }
    Update: {
      user_id?: string
      push_notifications?: boolean
      email_notifications?: boolean
      schedule_reminders?: boolean
      social_notifications?: boolean
      quiz_reminders?: boolean
      assignment_reminders?: boolean
      quiet_hours_enabled?: boolean
      quiet_hours_start?: string | null
      quiet_hours_end?: string | null
      reminder_time?: number
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  calendar_integrations: {
    Row: {
      id: string
      user_id: string
      provider: 'google' | 'outlook'
      access_token: string
      refresh_token: string | null
      expires_at: string | null
      calendar_id: string | null
      sync_enabled: boolean
      last_synced_at: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      provider: 'google' | 'outlook'
      access_token: string
      refresh_token?: string | null
      expires_at?: string | null
      calendar_id?: string | null
      sync_enabled?: boolean
      last_synced_at?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      provider?: 'google' | 'outlook'
      access_token?: string
      refresh_token?: string | null
      expires_at?: string | null
      calendar_id?: string | null
      sync_enabled?: boolean
      last_synced_at?: string | null
      created_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  schedule_reminders: {
    Row: {
      id: string
      schedule_id: string
      reminder_minutes: number
      notification_sent: boolean
      notification_sent_at: string | null
      created_at: string
    }
    Insert: {
      id?: string
      schedule_id: string
      reminder_minutes: number
      notification_sent?: boolean
      notification_sent_at?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      schedule_id?: string
      reminder_minutes?: number
      notification_sent?: boolean
      notification_sent_at?: string | null
      created_at?: string
    }
    Relationships: []
  }
}

// Instructions to integrate:
// 1. Run the migration: supabase db push
// 2. Regenerate types: supabase gen types typescript --project-id your-project-ref > src/integrations/supabase/types.ts
// OR
// 3. Manually merge the NotificationTables interfaces into your types.ts Database['public']['Tables'] section
