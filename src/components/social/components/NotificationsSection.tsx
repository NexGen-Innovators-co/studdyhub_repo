import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Bell, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: any;
}

interface NotificationsSectionProps {
  notifications: Notification[];
  unreadCount: number;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  notifications,
  unreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
}) => {
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md border border-slate-200 dark:border-gray-700">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllNotificationsAsRead}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            Mark all as read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-center text-slate-600 dark:text-gray-300">No notifications</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${notification.is_read
                  ? 'bg-slate-50 dark:bg-gray-900'
                  : 'bg-blue-50 dark:bg-blue-900/50'
                  }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">{notification.title}</p>
                  <p className="text-sm text-slate-600 dark:text-gray-300">{notification.message}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(notification.created_at))} ago
                  </p>
                </div>
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markNotificationAsRead(notification.id)}
                    className="text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
                  >
                    Mark as read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteNotification(notification.id)}
                  className="text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};