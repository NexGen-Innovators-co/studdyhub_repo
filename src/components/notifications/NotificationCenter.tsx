// Notification Center Component
import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Settings, X, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/types';
import { useNavigate } from 'react-router-dom';
import { createTestNotification } from '@/services/notificationHelpers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const notificationIcons: Record<string, string> = {
  schedule_reminder: '📅',
  quiz_due: '📝',
  assignment_due: '📚',
  study_session: '📖',
  social_like: '❤️',
  social_comment: '💬',
  social_follow: '👤',
  social_mention: '📢',
  ai_limit_warning: '⚠️',
  subscription_renewal: '💳',
  general: '🔔'
};

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loading
  } = useNotifications();
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  // const handleTestNotification = async () => {
  //   if (!user) return;
  //   const result = await createTestNotification(user.id);
  //   if (result) {
  //     toast.success('Test notification created! It should appear in real-time.');
  //   } else {
  //     toast.error('Failed to create test notification');
  //   }
  // };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" align="end">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                title="Mark all as read"
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <CheckCheck className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard?view=settings&tab=notifications')}
              title="Notification settings"
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onDelete={() => deleteNotification(notification.id)}
                  onMarkRead={() => markAsRead(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator className="bg-slate-200 dark:bg-slate-700" />
            <div className="p-2 bg-white dark:bg-slate-900 space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-center text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  navigate('/dashboard?view=notifications');
                  setIsOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
}

function NotificationItem({ notification, onClick, onDelete, onMarkRead }: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`
        p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative
        ${!notification.read ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-400' : ''}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 mt-1">
          {notification.icon || notificationIcons[notification.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm line-clamp-1 text-slate-900 dark:text-white">
              {notification.title}
            </p>
            {!notification.read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0 mt-1" />
            )}
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 absolute right-2 top-2 bg-white dark:bg-slate-900 rounded-md shadow-md border border-slate-200 dark:border-slate-700 p-0.5">
            {!notification.read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                title="Mark as read"
              >
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
