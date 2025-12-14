// Push Notification Service
import { supabase } from '@/integrations/supabase/client';
import type { PushNotificationPayload, NotificationSubscription } from '@/types';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ;

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Request permission for push notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }
    
    if (Notification.permission === 'denied') {
      return 'denied';
    }

    return await Notification.requestPermission();
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(userId: string): Promise<NotificationSubscription | null> {
    try {
      const permission = await this.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      if (!this.registration) {
        await this.initialize();
      }

      if (!this.registration) {
        throw new Error('Service Worker not registered');
      }

      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed to push notifications');
        
        // Check if this subscription exists in database
        const subscriptionData = existingSubscription.toJSON();
        const { data: existingRecord } = await supabase
          .from('notification_subscriptions')
          .select('*')
          .eq('endpoint', subscriptionData.endpoint!)
          .eq('user_id', userId)
          .single();
        
        if (existingRecord) {
          console.log('Subscription already in database');
          return existingRecord;
        }
        
        // Subscription exists in browser but not in database - save it
        const { data, error } = await supabase
          .from('notification_subscriptions')
          .insert({
            user_id: userId,
            endpoint: subscriptionData.endpoint!,
            p256dh: subscriptionData.keys!.p256dh,
            auth: subscriptionData.keys!.auth,
            device_type: this.getDeviceType(),
            browser: this.getBrowserInfo()
          })
          .select()
          .single();

        if (error && error.code !== '23505') throw error; // Ignore duplicate key errors
        return data || existingRecord;
      }

      // Subscribe to push
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });

      // Save subscription to database
      const subscriptionData = this.subscription.toJSON();
      
      const { data, error } = await supabase
        .from('notification_subscriptions')
        .insert({
          user_id: userId,
          endpoint: subscriptionData.endpoint!,
          p256dh: subscriptionData.keys!.p256dh,
          auth: subscriptionData.keys!.auth,
          device_type: this.getDeviceType(),
          browser: this.getBrowserInfo()
        })
        .select()
        .single();

      if (error && error.code !== '23505') throw error; // Ignore duplicate key errors
      
      console.log('Push notification subscription successful');
      return data;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: string): Promise<boolean> {
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe();
      }

      // Remove from database
      await supabase
        .from('notification_subscriptions')
        .delete()
        .eq('user_id', userId);

      this.subscription = null;
      console.log('Push notification unsubscribed');
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription !== null;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Send a test notification
   */
  // async sendTestNotification(userId: string): Promise<boolean> {
  //   try {
  //     const { error } = await supabase.functions.invoke('send-notification', {
  //       body: {
  //         userId,
  //         notification: {
  //           title: 'Test Notification',
  //           body: 'This is a test notification from StuddyHub!',
  //           icon: '/icon-192x192.png',
  //           data: {
  //             type: 'test',
  //             timestamp: new Date().toISOString()
  //           }
  //         }
  //       }
  //     });

  //     if (error) throw error;
  //     return true;
  //   } catch (error) {
  //     console.error('Failed to send test notification:', error);
  //     return false;
  //   }
  // }

  /**
   * Schedule a notification
   */
  async scheduleNotification(
    userId: string,
    payload: PushNotificationPayload,
    scheduledFor: Date
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'schedule_reminder',
          title: payload.title,
          message: payload.body,
          data: payload.data,
          scheduled_for: scheduledFor.toISOString(),
          read: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return false;
    }
  }

  /**
   * Show local notification (doesn't require server)
   */
  async showLocalNotification(payload: PushNotificationPayload): Promise<void> {
    if (Notification.permission !== 'granted') {
      return;
    }
    
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    const options: NotificationOptions & { actions?: any; vibrate?: number[] } = {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
      data: payload.data,
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
      vibrate: payload.vibrate || [200, 100, 200]
    };

    if (payload.actions) {
      options.actions = payload.actions;
    }

    await this.registration.showNotification(payload.title, options);
  }

  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    return await this.registration.pushManager.getSubscription();
  }

  /**
   * Utility: Convert VAPID key
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get device type
   */
  private getDeviceType(): 'web' | 'mobile' | 'desktop' {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'mobile';
    if (/electron/i.test(ua)) return 'desktop';
    return 'web';
  }

  /**
   * Get browser info
   */
  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }
}

export { PushNotificationService };
export const pushNotificationService = new PushNotificationService();
