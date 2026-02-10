import { SocialNotification } from '../../hooks/useSocialNotifications';
import { SocialNotificationItem } from '../NotificationsSection';

export const adaptNotifications = (socialNotifications: SocialNotification[]): SocialNotificationItem[] => {
  return socialNotifications.map(notif => ({
    id: notif.id,
    user_id: notif.user_id,
    type: notif.type,
    title: notif.title || getNotificationTitle(notif),
    message: notif.message || getNotificationMessage(notif),
    is_read: notif.is_read,
    created_at: notif.created_at,
    data: {
      actor: notif.actor,
      post: notif.post,
      post_id: notif.post_id || notif.post?.id,
      actor_id: notif.actor_id || notif.actor?.id,
      group_id: notif.data?.group_id,
      ...(notif.data || {}),
    },
    actor: notif.actor ? {
      id: notif.actor.id,
      display_name: notif.actor.display_name,
      username: notif.actor.username,
      avatar_url: notif.actor.avatar_url,
    } : undefined,
  }));
};

export const getNotificationTitle = (notif: SocialNotification): string => {
  switch (notif.type) {
    case 'like': return 'New Like';
    case 'comment': return 'New Comment';
    case 'follow': return 'New Connection';
    case 'mention': return 'You were mentioned';
    case 'share': return 'Post Shared';
    case 'group_invite': return 'Group Update';
    default: return 'Notification';
  }
};

export const getNotificationMessage = (notif: SocialNotification): string => {
  const actorName = notif.actor?.display_name || 'Someone';
  switch (notif.type) {
    case 'like': return `${actorName} liked your post`;
    case 'comment': return `${actorName} commented on your post`;
    case 'follow': return `${actorName} connected with you`;
    case 'mention': return `${actorName} mentioned you in a post`;
    case 'share': return `${actorName} shared your post`;
    case 'group_invite': return notif.message || 'Group membership update';
    default: return 'You have a new notification';
  }
};
