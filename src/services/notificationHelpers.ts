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
