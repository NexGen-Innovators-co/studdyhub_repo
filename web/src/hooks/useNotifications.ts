// Hook for managing notifications
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { pushNotificationService } from '@/services/pushNotificationService';
import type { Notification, NotificationPreferences } from '@/types';
import { toast } from 'sonner';

export function useNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const initSessionRef = useRef<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    if (!navigator.onLine) {
      //console.log("Offline: Skipping notification fetch");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      //console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    }
  }, [user]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    if (!navigator.onLine) {
      //console.log("Offline: Skipping preferences fetch");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences
        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            email_notifications: true,
            push_notifications: true,
            schedule_reminders: true,
            social_notifications: true,
            quiz_reminders: true,
            assignment_reminders: true,
            reminder_time: 30,
            quiet_hours_enabled: false
          })
          .select()
          .maybeSingle();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (error) {
      //console.error('Error fetching preferences:', error);
    }
  }, [user]);

  // Check push notification subscription status
  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;

    const subscribed = await pushNotificationService.isSubscribed();
    setIsSubscribed(subscribed);
  }, [user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user) return false;

    try {
      const subscription = await pushNotificationService.subscribe(user.id);
      if (subscription) {
        setIsSubscribed(true);
        toast.success('Push notifications enabled!');
        return true;
      }
      return false;
    } catch (error) {
      //console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      const success = await pushNotificationService.unsubscribe(user.id);
      if (success) {
        setIsSubscribed(false);
        toast.success('Push notifications disabled');
        return true;
      }
      return false;
    } catch (error) {
      //console.error('Error unsubscribing from push notifications:', error);
      toast.error('Failed to disable push notifications');
      return false;
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      //console.error('Error marking notification as read:', error);
      toast.error('Failed to update notification');
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      //console.error('Error marking all as read:', error);
      toast.error('Failed to update notifications');
    }
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.read ? prev - 1 : prev;
      });
    } catch (error) {
      //console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  }, [user, notifications]);

  // Update preferences
  const updatePreferences = useCallback(async (
    updates: Partial<NotificationPreferences>
  ) => {
    if (!user || !preferences) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setPreferences(data);
      toast.success('Notification preferences updated');
    } catch (error) {
      //console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    }
  }, [user, preferences]);

  // // Send test notification
  // const sendTestNotification = useCallback(async () => {
  //   if (!user) return;

  //   try {
  //     await pushNotificationService.sendTestNotification(user.id);
  //     toast.success('Test notification sent!');
  //   } catch (error) {
  //     // console.error('Error sending test notification:', error);
  //     toast.error('Failed to send test notification');
  //   }
  // }, [user]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Ensure we have a confirmed session from Supabase before doing any DB calls.
      // This prevents calling protected endpoints while auth is still resolving
      // which can produce 401/429 loops.
      try {
        const sessionResp = await supabase.auth.getSession();
        const sessionId = sessionResp?.data?.session?.access_token || null;
        if (!sessionId) {
          setLoading(false);
          return;
        }

        // If we've already initialized for this session token, skip re-init
        if (initSessionRef.current === sessionId) {
          setLoading(false);
          return;
        }
        initSessionRef.current = sessionId;
      } catch (e) {
        setLoading(false);
        return;
      }

      if (!navigator.onLine) {
        //console.log("Offline: Skipping notification initialization");
        setLoading(false);
        return;
      }

      setLoading(true);
      await Promise.all([
        pushNotificationService.initialize(),
        fetchNotifications(),
        fetchPreferences(),
        checkSubscriptionStatus()
      ]);
      setLoading(false);
    };

    initialize();
  }, [user, fetchNotifications, fetchPreferences, checkSubscriptionStatus]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user || !navigator.onLine) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast for foreground notification
          toast.info(newNotification.title, {
            description: newNotification.message,
            action: {
              label: 'View',
              onClick: () => {
                if (newNotification.action_url) {
                  navigate(newNotification.action_url);
                } else {
                  // Default navigation based on type
                  switch (newNotification.type) {
                    case 'schedule_reminder':
                    case 'assignment_due':
                      navigate('/schedule');
                      break;
                    case 'quiz_due':
                      navigate('/quizzes');
                      break;
                    case 'social_like':
                    case 'social_comment':
                    case 'social_mention':
                      if (newNotification.data?.post_id) {
                        navigate(`/social/post/${newNotification.data.post_id}`);
                      } else {
                        navigate('/social');
                      }
                      break;
                    case 'social_follow':
                      if (newNotification.data?.actor_id) {
                        navigate(`/social/profile/${newNotification.data.actor_id}`);
                      } else {
                        navigate('/social');
                      }
                      break;
                    default:
                      navigate('/social/notifications');
                  }
                }
              }
            }
          });

          // Show browser notification if enabled
          if (preferences?.push_notifications && isSubscribed) {
            pushNotificationService.showLocalNotification({
              title: newNotification.title,
              body: newNotification.message,
              data: { id: newNotification.id, type: newNotification.type }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, preferences, isSubscribed]);

  return {
    notifications,
    unreadCount,
    preferences,
    isSubscribed,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    subscribe,
    unsubscribe,
    updatePreferences,
    // sendTestNotification
  };
}

