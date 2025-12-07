import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// ✅ CHANGED: Renamed from 'Notification' to 'SocialNotificationItem'
export interface SocialNotificationItem {
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
    avatar_url?: string;
  };
}

interface NotificationsSectionProps {
  // ✅ CHANGED: Use the renamed interface
  notifications: SocialNotificationItem[];
  unreadCount: number;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  fetchNotifications: () => Promise<void>;
  isLoading: boolean;
  hasMore?: boolean;
}
// Add this helper function at the top of your component file
const removeDuplicateNotifications = (notifications: SocialNotificationItem[]) => {
  const seen = new Set();
  return notifications.filter(notification => {
    if (seen.has(notification.id)) {
      return false;
    }
    seen.add(notification.id);
    return true;
  });
};

// In your NotificationsSection component, update the filteredNotifications calculation:
export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  notifications,
  unreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  fetchNotifications,
  isLoading,
  hasMore = true,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  // Remove duplicates from notifications prop
  const uniqueNotifications = useMemo(() => {
    return removeDuplicateNotifications(notifications);
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const result = filter === 'unread'
      ? uniqueNotifications.filter(n => !n.is_read)
      : uniqueNotifications;

    // Additional safety check
    return removeDuplicateNotifications(result);
  }, [uniqueNotifications, filter]);

  // Update unread count based on unique notifications
  const actualUnreadCount = useMemo(() => {
    return uniqueNotifications.filter(n => !n.is_read).length;
  }, [uniqueNotifications]);


  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = document.querySelector('[data-notifications-container]');
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Load more when 100px from bottom and not already loading
    if (distanceFromBottom <= 100 && !isLoadingMore && hasMore && !isLoading) {
      loadMoreNotifications();
    }
  }, [isLoadingMore, hasMore, isLoading]);

  // Load more notifications
  const loadMoreNotifications = async () => {
    if (isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      await fetchNotifications();
      setPage(prev => prev + 1);
    } catch (error) {
      //console.error('Error loading more notifications:', error);
      toast.error('Failed to load more notifications');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Add scroll event listener
  useEffect(() => {
    const container = document.querySelector('[data-notifications-container]');
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case 'group_invite':
        return <Users className="h-5 w-5 text-blue-500" />;
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


  return (
    <Card className="flex flex-col max-h-[calc(90vh-4rem)] overflow-y-auto pb-6 w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
      <CardHeader className="text-white p-4 flex  shadow-lg">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-slate-700 dark:text-gray-300" />
              {actualUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{actualUnreadCount}</span>
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">
              Notifications
            </CardTitle>
          </div>

          <div className="flex items-center text-slate-500 dark:text-gray-400 gap-2 sm:gap-2">
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
              <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
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
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent
        className="flex-1 overflow-y-auto px-0 py-4 space-y-1"
        data-notifications-container
      >
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
                  className={`group flex items-start gap-3 sm:gap-4 p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors ${!notification.is_read
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

            {/* Loading indicator for infinite scroll */}
            {(isLoadingMore || isLoading) && (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-slate-600 dark:text-gray-400">
                  Loading more notifications...
                </span>
              </div>
            )}

            {/* No more notifications message */}
            {!hasMore && filteredNotifications.length > 0 && (
              <div className="flex justify-center items-center py-4">
                <span className="text-sm text-slate-500 dark:text-gray-400">
                  No more notifications to load
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="p-4 text-center border-t border-slate-200 dark:border-gray-700">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
              {hasMore && !isLoadingMore && ' • Scroll to load more'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};