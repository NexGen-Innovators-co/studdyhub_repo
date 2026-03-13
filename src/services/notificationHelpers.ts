// Notification Helper Service
// Helper functions to create notifications from anywhere in the app

import { supabase } from '@/integrations/supabase/client';
import type { Notification } from '@/types';

export type NotificationType =
  | 'general'
  | 'schedule_reminder'
  | 'quiz_due'
  | 'assignment_due'
  | 'study_session'
  | 'social_like'
  | 'social_comment'
  | 'social_follow'
  | 'social_mention'
  | 'ai_limit_warning'
  | 'subscription_renewal'
  | 'podcast_created'
  | 'podcast_live'
  | 'podcast_deleted'
  | 'institution_invite';
/**
 * Create a podcast notification (created, live, deleted)
 */
export async function createPodcastNotification(
  userId: string,
  type: 'podcast_created' | 'podcast_live' | 'podcast_deleted',
  podcastTitle: string,
  podcastId: string,
  extra?: { [key: string]: any }
): Promise<Notification | null> {
  let title = '';
  let message = '';
  let icon = undefined;
  let image = undefined;
  // Try to get cover image and avatar from extra
  if (extra) {
    if (extra.coverUrl) image = extra.coverUrl;
    if (extra.avatarUrl) icon = extra.avatarUrl;
  }
  if (type === 'podcast_created') {
    title = 'New Podcast Created';
    message = `A new podcast "${podcastTitle}" was created.`;
  } else if (type === 'podcast_live') {
    title = 'Live Podcast Started';
    message = `The podcast "${podcastTitle}" is now live!`;
  } else if (type === 'podcast_deleted') {
    title = 'Podcast Deleted';
    message = `The podcast "${podcastTitle}" was deleted.`;
  }
  return createNotification({
    userId,
    type,
    title,
    message,
    icon,
    image,
    data: { podcastId, podcastTitle, ...extra }
  });
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  image?: string;
  data?: Record<string, any>;
  expiresAt?: Date;
  saveToDb?: boolean;
}

/**
 * Create a notification for a user
 * This will automatically trigger real-time updates and push notifications
 * Uses the edge function to bypass RLS policies
 */
/**
 * Core notification creation function used by all helpers
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        icon: params.icon,
        image: params.image,
        data: params.data,
        save_to_db: params.saveToDb !== undefined ? params.saveToDb : true
      }
    });

    if (error) throw error;

    return data?.notification || null;
  } catch (error) {
    //console.error('❌ Failed to create notification:', error);
    return null;
  }
}

/**
 * Create a chat message notification
 */
export async function createChatNotification(
  userId: string,
  chatTitle: string,
  message: string,
  chatSessionId: string
): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'general',
    title: `New message in ${chatTitle}`,
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    data: { chatSessionId }
  });
}

/**
 * Create a quiz notification
 */
export async function createQuizNotification(
  userId: string,
  quizTitle: string,
  dueDate?: Date
): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'quiz_due',
    title: 'Quiz Available',
    message: `"${quizTitle}" is ready to take${dueDate ? ` (due ${dueDate.toLocaleDateString()})` : ''}`,
    data: { quizTitle, dueDate: dueDate?.toISOString() }
  });
}

/**
 * Create a schedule reminder notification
 */
export async function createScheduleReminder(
  userId: string,
  eventTitle: string,
  eventTime: Date
): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'schedule_reminder',
    title: 'Upcoming Event',
    message: `${eventTitle} starts at ${eventTime.toLocaleTimeString()}`,
    data: { eventTitle, eventTime: eventTime.toISOString() }
  });
}

/**
 * Create a social notification (like, comment, follow)
 */
export async function createSocialNotification(
  userId: string,
  type: 'social_like' | 'social_comment' | 'social_follow' | 'social_mention',
  fromUserName: string,
  postId?: string
): Promise<Notification | null> {
  const messages = {
    social_like: `${fromUserName} liked your post`,
    social_comment: `${fromUserName} commented on your post`,
    social_follow: `${fromUserName} started following you`,
    social_mention: `${fromUserName} mentioned you in a post`
  };

  return createNotification({
    userId,
    type,
    title: 'Social Activity',
    message: messages[type],
    data: { fromUserName, postId }
  });
}

/**
 * Create an AI limit warning notification
 */
export async function createAILimitWarning(
  userId: string,
  remainingCredits: number
): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'ai_limit_warning',
    title: 'AI Credits Low',
    message: `You have ${remainingCredits} AI credits remaining. Upgrade to continue using AI features.`,
    data: { remainingCredits }
  });
}

/**
 * Test function - Create a test notification
 */
export async function createTestNotification(userId: string): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'general',
    title: 'Test Notification',
    message: 'This is a test notification from the frontend! 🔔'
  });
}

/**
 * Create an institution invite notification for an existing platform user.
 */
export async function createInstitutionInviteNotification(
  userId: string,
  institutionName: string,
  role: string,
  inviteToken: string,
  invitedByName?: string
): Promise<Notification | null> {
  const from = invitedByName ? ` by ${invitedByName}` : '';
  return createNotification({
    userId,
    type: 'institution_invite' as NotificationType,
    title: 'Institution Invitation',
    message: `You've been invited${from} to join "${institutionName}" as ${role}.`,
    data: { inviteToken, institutionName, role },
  });
}

// ====================================
// DAILY ENGAGEMENT NOTIFICATION HELPERS
// ====================================

/**
 * Calculate the open rate (CTR) of notifications
 * @param opened Number of notifications opened
 * @param sent Total number of notifications sent
 * @returns Open rate as a percentage (0-100)
 */
export const calculateCTR = (opened: number, sent: number): number => {
  if (sent === 0) return 0;
  return Math.round((opened / sent) * 100);
};

/**
 * Calculate the action conversion rate
 * @param actions Number of actions taken
 * @param clicks Number of times notification was clicked
 * @returns Conversion rate as a percentage (0-100)
 */
export const calculateConversionRate = (actions: number, clicks: number): number => {
  if (clicks === 0) return 0;
  return Math.round((actions / clicks) * 100);
};

/**
 * Get human-readable label for notification category
 * @param category Category identifier
 * @returns Human-readable category name
 */
export const getCategoryLabel = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'study_planning': 'Study Planning',
    'quiz_challenge': 'Quiz Challenge',
    'group_nudge': 'Group Nudge',
    'podcast_discovery': 'Podcast Discovery',
    'progress_tracking': 'Progress Celebration',
    'schedule_reminder': 'Schedule Reminder',
    'quiz_due': 'Quiz Due',
    'assignment_due': 'Assignment Due',
    'study_session': 'Study Session',
    'social_like': 'Social Like',
    'social_comment': 'Social Comment',
    'social_follow': 'Social Follow',
    'social_mention': 'Social Mention',
    'podcast_share': 'Podcast Share',
    'ai_limit_warning': 'AI Limit Warning',
    'subscription_renewal': 'Subscription Renewal',
    'general': 'General'
  };
  return categoryMap[category] || category;
};

/**
 * Get emoji for notification category
 * @param category Category identifier
 * @returns Emoji string
 */
export const getCategoryEmoji = (category: string): string => {
  const emojiMap: Record<string, string> = {
    'study_planning': '📚',
    'quiz_challenge': '🎯',
    'group_nudge': '👥',
    'podcast_discovery': '🎧',
    'progress_tracking': '🏆',
    'schedule_reminder': '📅',
    'quiz_due': '✏️',
    'assignment_due': '📝',
    'study_session': '🎓',
    'social_like': '❤️',
    'social_comment': '💬',
    'social_follow': '⭐',
    'social_mention': '@️⃣',
    'podcast_share': '📢',
    'ai_limit_warning': '⚠️',
    'subscription_renewal': '🔄',
    'general': 'ℹ️'
  };
  return emojiMap[category] || '📬';
};

/**
 * Get human-readable label for engagement tier
 * @param tier Engagement tier enum value
 * @returns Human-readable tier name
 */
export const getEngagementTierLabel = (tier: string): string => {
  const tierMap: Record<string, string> = {
    'very_active': 'Very Active',
    'active': 'Active',
    'warm': 'Warm',
    'cold': 'Cold'
  };
  return tierMap[tier] || tier;
};

/**
 * Get color class for engagement tier
 * @param tier Engagement tier enum value
 * @returns Tailwind color class
 */
export const getEngagementTierColor = (tier: string): string => {
  const colorMap: Record<string, string> = {
    'very_active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'active': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'warm': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'cold': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };
  return colorMap[tier] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
};

/**
 * Format a timestamp to a readable date string
 * @param timestamp ISO timestamp string
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 */
export const formatNotificationDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a timestamp to include time
 * @param timestamp ISO timestamp string
 * @returns Formatted date time string (e.g., "Jan 15, 2025 2:30 PM")
 */
export const formatNotificationDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Check if a notification should be sent based on quiet hours
 * @param currentTime Current time in HH:mm format
 * @param quietStart Quiet hours start in HH:mm format
 * @param quietEnd Quiet hours end in HH:mm format
 * @returns true if notification should be sent (outside quiet hours)
 */
export const isOutsideQuietHours = (
  currentTime: string,
  quietStart: string,
  quietEnd: string
): boolean => {
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const current = parseTime(currentTime);
  const start = parseTime(quietStart);
  const end = parseTime(quietEnd);

  // If quiet hours span midnight (e.g., 22:00 to 08:00)
  if (start > end) {
    return current < end || current >= start;
  }

  // Normal case (e.g., 22:00 to 08:00 next day)
  return current < start || current >= end;
};

/**
 * Get the next scheduled time for a notification category
 * @param preferredTime Time in HH:mm format
 * @param timezone IANA timezone string (e.g., 'US/Eastern')
 * @returns JavaScript Date object for next scheduled time
 */
export const getNextScheduledTime = (preferredTime: string, timezone: string): Date => {
  const [hours, minutes] = preferredTime.split(':').map(Number);

  // Get current time in user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const dateStr = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
  const timeStr = `${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}`;

  const [currentHour, currentMinute] = timeStr.split(':').map(Number);

  let nextDate = new Date(dateStr);
  nextDate.setHours(hours, minutes, 0, 0);

  // If the preferred time has already passed today, schedule for tomorrow
  if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
};

/**
 * Calculate engagement stats for a notification category
 * @param sent Number sent
 * @param opened Number opened
 * @param clicked Number clicked
 * @param actions Number actions taken
 * @returns Object with calculated metrics
 */
export const calculateEngagementStats = (
  sent: number,
  opened: number,
  clicked: number,
  actions: number
) => {
  const openRate = calculateCTR(opened, sent);
  const clickRate = calculateCTR(clicked, sent);
  const conversionRate = calculateConversionRate(actions, clicked);

  return {
    sent,
    opened,
    clicked,
    actions,
    openRate,
    clickRate,
    conversionRate
  };
};

/**
 * Determine if a user should receive daily notifications based on their tier
 * @param engagementTier User's engagement tier
 * @returns true if user should receive daily notifications
 */
export const shouldReceiveDailyNotifications = (engagementTier: string): boolean => {
  // Send to all tiers, but frequency may vary
  return ['very_active', 'active', 'warm', 'cold'].includes(engagementTier);
};

/**
 * Get the frequency modifier for daily notifications based on engagement tier
 * @param engagementTier User's engagement tier
 * @returns Multiplier for number of notifications (0 = none, 1 = normal, >1 = more frequent)
 */
export const getNotificationFrequencyModifier = (engagementTier: string): number => {
  const modifierMap: Record<string, number> = {
    'very_active': 0.8,    // Send fewer to very active users (they're already engaged)
    'active': 1.0,          // Normal frequency
    'warm': 1.2,            // Slightly more frequent for re-engagement
    'cold': 1.5             // More frequent for win-back
  };
  return modifierMap[engagementTier] ?? 1.0;
};

/**
 * Generate a summary title for notification analytics
 * @param period Time period (e.g., '7d', '30d', 'all')
 * @returns Summary title string
 */
export const getAnalyticsPeriodLabel = (period: string): string => {
  const periodMap: Record<string, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    'all': 'All Time'
  };
  return periodMap[period] || period;
};
