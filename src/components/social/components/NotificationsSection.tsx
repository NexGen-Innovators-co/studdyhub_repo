import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { 
  Bell, 
  Trash2, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Users, 
  CheckCheck,
  X,
  Filter,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: any;
  actor?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string;
  };
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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case 'group_invite':
        return <Users className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleDelete = async (notificationId: string) => {
    setDeletingIds(prev => new Set(prev).add(notificationId));
    try {
      await deleteNotification(notificationId);
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-lg border border-slate-200 dark:border-gray-700">
      <CardHeader className="border-b border-slate-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-slate-700 dark:text-gray-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{unreadCount}</span>
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">
              Notifications
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 hidden sm:inline-flex">
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {filter === 'all' ? 'All' : 'Unread'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilter('all')}>
                  All Notifications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('unread')}>
                  Unread Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mark All as Read */}
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllNotificationsAsRead}
                className="gap-1 sm:gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-slate-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {filter === 'unread' 
                ? 'All caught up!' 
                : 'When you get notifications, they will show up here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => {
              const isDeleting = deletingIds.has(notification.id);
              
              return (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-3 sm:gap-4 p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors ${
                    !notification.is_read
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : ''
                  }`}
                >
                  {/* Actor Avatar */}
                  {notification.actor ? (
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                      <AvatarImage src={notification.actor.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm">
                        {notification.actor.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 line-clamp-1">
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-600 dark:text-gray-300 mb-1 line-clamp-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                      <span>
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                      {notification.actor && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>@{notification.actor.username}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons - Icons only on mobile */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => markNotificationAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(notification.id)}
                      disabled={isDeleting}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="p-4 text-center border-t border-slate-200 dark:border-gray-700">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};