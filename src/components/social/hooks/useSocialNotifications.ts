import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

// Add proper typing for notifications
export interface SocialNotification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'share';
  post_id?: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  post?: {
    id: string;
    content: string;
    author_id: string;
  };
}

// Updated useSocialNotifications hook with duplicate prevention
export const useSocialNotifications = () => {
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const NOTIFICATIONS_PER_PAGE = 20;

  // Helper function to prevent duplicates
  const addNotificationWithoutDuplicates = useCallback((currentNotifications: SocialNotification[], newNotifications: SocialNotification[]) => {
    const existingIds = new Set(currentNotifications.map(n => n.id));
    const uniqueNewNotifications = newNotifications.filter(n => !existingIds.has(n.id));
    return [...currentNotifications, ...uniqueNewNotifications];
  }, []);

  // Optimized: Memoized fetch function with pagination
  const fetchNotifications = useCallback(async (page: number = 0, loadMore: boolean = false) => {
    if (!userId) return;

    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const from = page * NOTIFICATIONS_PER_PAGE;
      const to = from + NOTIFICATIONS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('social_notifications')
        .select(`
          *,
          actor:social_users!social_notifications_actor_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          ),
          post:social_posts(
            id,
            content,
            author_id
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        const newNotifications = data as SocialNotification[];

        if (loadMore) {
          // Prevent duplicates when loading more
          setNotifications(prev => addNotificationWithoutDuplicates(prev, newNotifications));
        } else {
          setNotifications(newNotifications);
          setCurrentPage(0);
        }

        // Update unread count (only on initial load for performance)
        if (!loadMore) {
          const unread = newNotifications.filter(n => !n.is_read).length;
          setUnreadCount(unread);
        }

        // Check if there are more notifications to load
        setHasMore(count ? count > (page + 1) * NOTIFICATIONS_PER_PAGE : false);

        if (loadMore) {
          setCurrentPage(prev => prev + 1);
        }
      }
    } catch (error) {

      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [userId, addNotificationWithoutDuplicates]);

  // Updated real-time subscription to prevent duplicates
  useEffect(() => {
    if (!userId) return;

    let retryCount = 0;
    const maxRetries = 3;

    const setupSubscription = () => {
      const subscription = supabase
        .channel(`user_notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'social_notifications',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            try {
              // Reset retry count on successful message
              retryCount = 0;

              const { data: notificationData, error } = await supabase
                .from('social_notifications')
                .select(`
                  *,
                  actor:social_users!social_notifications_actor_id_fkey(
                    id,
                    username,
                    display_name,
                    avatar_url
                  ),
                  post:social_posts(
                    id,
                    content,
                    author_id
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (error) throw error;

              if (notificationData) {
                // Prevent duplicate real-time notifications
                setNotifications(prev => {
                  const exists = prev.find(n => n.id === notificationData.id);
                  if (exists) return prev; // Skip if already exists

                  const newNotification = notificationData as SocialNotification;
                  return [newNotification, ...prev];
                });

                setUnreadCount(prev => prev + 1);

                // Show toast only for important notifications
                if (!notificationData.is_read) {
                  const message = getNotificationMessage(notificationData as SocialNotification);
                  toast.info(message, {
                    duration: 4000,
                    action: {
                      label: 'View',
                      onClick: () => {

                      }
                    }
                  });
                }
              }
            } catch (error) {

            }
          }
        )
        .on('system', { event: 'disconnect' }, () => {

          // Attempt to reconnect with exponential backoff
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            setTimeout(() => {
              retryCount++;
              setupSubscription();
            }, delay);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {

            retryCount = 0;
          }
        });

      return subscription;
    };

    const subscription = setupSubscription();

    return () => {
      subscription?.unsubscribe();
    };
  }, [userId]);


  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);
      } catch (error) {

      }
    };
    getUser();
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    let retryCount = 0;
    const maxRetries = 3;

    const setupSubscription = () => {
      const subscription = supabase
        .channel(`user_notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'social_notifications',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            try {
              // Reset retry count on successful message
              retryCount = 0;

              const { data: notificationData, error } = await supabase
                .from('social_notifications')
                .select(`
                  *,
                  actor:social_users!social_notifications_actor_id_fkey(
                    id,
                    username,
                    display_name,
                    avatar_url
                  ),
                  post:social_posts(
                    id,
                    content,
                    author_id
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (error) throw error;

              if (notificationData) {
                setNotifications(prev => [notificationData as SocialNotification, ...prev]);
                setUnreadCount(prev => prev + 1);

                // Show toast only for important notifications
                if (!notificationData.is_read) {
                  const message = getNotificationMessage(notificationData as SocialNotification);
                  toast.info(message, {
                    duration: 4000,
                    action: {
                      label: 'View',
                      onClick: () => {
                        // You can add navigation logic here

                      }
                    }
                  });
                }
              }
            } catch (error) {

            }
          }
        )
        .on('system', { event: 'disconnect' }, () => {

          // Attempt to reconnect with exponential backoff
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            setTimeout(() => {
              retryCount++;
              setupSubscription();
            }, delay);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {

            retryCount = 0;
          }
        });

      return subscription;
    };

    const subscription = setupSubscription();

    return () => {
      subscription?.unsubscribe();
    };
  }, [userId]);


  // Initial fetch when userId changes
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  // Optimized: Memoized action functions
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('social_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, is_read: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {

      toast.error('Failed to mark notification as read');
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      if (!userId) return;

      const { error } = await supabase
        .from('social_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {

      toast.error('Failed to mark notifications as read');
    }
  }, [userId]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('social_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));

      // Update unread count if the deleted notification was unread
      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      toast.success('Notification deleted');
    } catch (error) {

      toast.error('Failed to delete notification');
    }
  }, [notifications]);

  // Helper function for notification messages
  const getNotificationMessage = (notification: SocialNotification): string => {
    const actorName = notification.actor?.display_name || 'Someone';

    switch (notification.type) {
      case 'like':
        return `${actorName} liked your post`;
      case 'comment':
        return `${actorName} commented on your post`;
      case 'follow':
        return `${actorName} started following you`;
      case 'mention':
        return `${actorName} mentioned you in a post`;
      case 'share':
        return `${actorName} shared your post`;
      default:
        return 'You have a new notification';
    }
  };

  // Group notifications by date
  const groupedNotifications = useCallback(() => {
    const groups: { [key: string]: SocialNotification[] } = {};

    notifications.forEach(notification => {
      const date = new Date(notification.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(notification);
    });

    return groups;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading: isLoading || isLoadingMore,
    isLoadingMore,
    hasMore,
    fetchNotifications: () => fetchNotifications(currentPage + 1, true),
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    groupedNotifications,
    getNotificationMessage,
  };
};