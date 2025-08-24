import { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_LIMITS } from '../utils/socialConstants';

export const useSocialNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('social_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(DEFAULT_LIMITS.NOTIFICATIONS);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('social_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (!error) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_read: true }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('social_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('social_notifications')
        .delete()
        .eq('id', notificationId);

      if (!error) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        toast.success('Notification deleted');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  };
};