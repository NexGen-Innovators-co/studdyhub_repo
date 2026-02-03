import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, BellOff, Check, CheckCheck, Trash2, Send, Settings, Filter, RefreshCw, Lightbulb } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    preferences,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications();

  // Add refreshing state for button animation
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotifications();
    setTimeout(() => setIsRefreshing(false), 500); 
  };

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'social_like': return '❤️';
      case 'social_comment': return '💬';
      case 'social_mention': return '📢';
      case 'ai_message': return '🤖';
      case 'schedule_reminder': return '📅';
      case 'quiz_due': return '📝';
      case 'assignment_due': return '📚';
      case 'ai_limit_warning': return '⚠️';
      case 'achievement': return '🏆';
      case 'system_update': return '🔔';
      default: return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'social_like': return 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800';
      case 'social_comment': return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
      case 'social_mention': return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800';
      case 'ai_message': return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'schedule_reminder': return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
      case 'quiz_due': return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800';
      case 'ai_limit_warning': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      case 'achievement': return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
      default: return 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-6 overflow-y-auto modern-scrollbar bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Stay updated with your activity
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
                  <p className="text-2xl font-bold">{notifications.length}</p>
                </div>
                <Bell className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Unread</p>
                  <p className="text-2xl font-bold">{unreadCount}</p>
                </div>
                <BellOff className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Read</p>
                  <p className="text-2xl font-bold">{notifications.length - unreadCount}</p>
                </div>
                <Check className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read">
              Read ({notifications.length - unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            <Card>
              <ScrollArea className="h-[600px]">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <BellOff className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      No notifications
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                      {filter === 'unread' 
                        ? "You're all caught up! No unread notifications."
                        : filter === 'read'
                        ? "No read notifications yet."
                        : "You haven't received any notifications yet."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredNotifications.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onMarkRead={() => markAsRead(notification.id)}
                        onDelete={() => deleteNotification(notification.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-16 right-2 lg:bottom-4 lg:right-4 flex flex-col gap-3 z-50">
        {/* Tips Button */}
        {(window as any).__toggleTips && (
          <button
            onClick={() => (window as any).__toggleTips?.()}
            className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
              animation: 'glow 2s ease-in-out infinite'
            }}
            title="Quick Tips"
          >
            <Lightbulb className="w-6 h-6 fill-current" />
          </button>
        )}
        
        {/* Refresh Button */}
        <Button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          size="icon"
          className="h-11 w-11 rounded-full shadow-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
        >
          <RefreshCw className={`h-5 w-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
}

function NotificationCard({ notification, onMarkRead, onDelete }: NotificationCardProps) {
  const [showActions, setShowActions] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'social_like': return '❤️';
      case 'social_comment': return '💬';
      case 'social_mention': return '📢';
      case 'ai_message': return '🤖';
      case 'schedule_reminder': return '📅';
      case 'quiz_due': return '📝';
      case 'assignment_due': return '📚';
      case 'ai_limit_warning': return '⚠️';
      case 'achievement': return '🏆';
      case 'system_update': return '🔔';
      default: return '🔔';
    }
  };

  return (
    <div
      className={`
        group relative p-4 transition-colors
        ${!notification.read 
          ? 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30' 
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xl shadow-sm">
            {getNotificationIcon(notification.type)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {notification.title}
                {!notification.read && (
                  <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {notification.message}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </p>
            </div>

            {/* Actions */}
            <div className={`
              flex gap-1 transition-opacity
              ${showActions ? 'opacity-100' : 'opacity-0 md:opacity-100'}
            `}>
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950"
                  onClick={onMarkRead}
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
