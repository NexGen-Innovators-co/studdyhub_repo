// Notification Initialization Service
// Handles automatic push notification subscription after user grants permission

import { PushNotificationService } from './pushNotificationService';
import { supabase } from '@/integrations/supabase/client';

const pushService = new PushNotificationService();
let initializationAttempted = false; // Prevent multiple initialization attempts

/**
 * Initialize push notifications for authenticated users
 * Should be called after successful login
 */
export async function initializePushNotifications(): Promise<boolean> {
  // Prevent multiple initialization attempts in the same session
  if (initializationAttempted) {
    return false;
  }
  
  initializationAttempted = true;

  try {
    // Check if Service Worker is supported
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    // Check if Push API is supported
    if (!('PushManager' in window)) {
      return false;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Check user's notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('push_notifications')
      .eq('user_id', user.id)
      .single();

    // Only auto-subscribe if user has enabled push notifications
    if (preferences && !preferences.push_notifications) {
      return false;
    }

    // Check current permission status
    const permission = await Notification.permission;
    
    if (permission === 'granted') {
      // Auto-subscribe if permission already granted
      await pushService.subscribe(user.id);
      return true;
    } else if (permission === 'denied') {
      return false;
    } else {
      // Permission is "default" - don't auto-request, let user initiate
      return false;
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
}

/**
 * Request notification permission and subscribe
 * Should be called when user explicitly enables notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await pushService.subscribe(user.id);
        return true;
      } else {
        return false;
      }
    } else {
      console.log('❌ [Init] Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('❌ [Init] Error requesting notification permission:', error);
    return false;
  }
  return false;
}

/**
 * Check if push notifications are supported and enabled
 */
export function isPushNotificationsSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission {
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
}

/**
 * Get push notification service instance for advanced usage
 */
export function getPushService(): PushNotificationService {
  return pushService;
}
