import { SocialNotification } from '../../hooks/useSocialNotifications';
import { SocialNotificationItem } from '../NotificationsSection';

export const adaptNotifications = (socialNotifications: SocialNotification[]): SocialNotificationItem[] => {
  return socialNotifications.map(notif => ({
    id: notif.id,
    user_id: notif.user_id,
    type: notif.type,
    title: getNotificationTitle(notif),
    message: getNotificationMessage(notif),
    is_read: notif.is_read,
    created_at: notif.created_at,
    data: {
      actor: notif.actor,
      post: notif.post,
    },
    actor: notif.actor,
  }));
};

export const getNotificationTitle = (notif: SocialNotification): string => {
  switch (notif.type) {
    case 'like': return 'New Like';
    case 'comment': return 'New Comment';
    case 'follow': return 'New Connection';
    case 'mention': return 'You were mentioned';
    case 'share': return 'Post Shared';
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
    default: return 'You have a new notification';
  }
};
