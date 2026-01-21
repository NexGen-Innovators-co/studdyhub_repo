// Service Worker for Push Notifications and Offline Access
// @ts-nocheck

const CACHE_NAME = 'studdyhub-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/badge-72x72.png'
];

// Install event - Cache static assets
self.addEventListener('install', (event) => {
  ////console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      //console.log('Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  //console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            //console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase API calls (handled by IndexedDB/Supabase client)
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Don't cache if not a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache the new resource
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Push event - Handle incoming push notifications
self.addEventListener('push', (event) => {
  //console.log('Push event received');

  if (!event.data) {
    //console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || 'StuddyHub';
    const options = {
      body: data.body || data.message || 'You have a new notification',
      icon: data.icon || (data.data && data.data.avatarUrl) || '/icon-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      image: data.image || (data.data && (data.data.coverUrl || data.data.imageUrl)),
      data: data.data || {},
      tag: data.tag || 'studdyhub-notification',
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    //console.error('Error showing notification:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  //console.log('Notification clicked:', event);
  event.notification.close();

  const notificationData = event.notification.data;
  let url = '/';

  // Determine URL based on notification type
  if (notificationData) {
    switch (notificationData.type) {
      case 'schedule_reminder':
        url = '/schedule';
        break;
      case 'quiz_due':
        url = '/quizzes';
        break;
      case 'assignment_due':
        url = '/schedule';
        break;
      case 'social_share':
      case 'social_mention':
      case 'like':
        url = notificationData.post_id ? `/social/post/${notificationData.post_id}` : '/social';
        break;
      case 'comment':
        url = notificationData.post_id ? `/social/post/${notificationData.post_id}` : '/social';
        break;
      case 'share':
      case 'mention':
        url = notificationData.post_id ? `/social/post/${notificationData.post_id}` : '/social';
        break;
      case 'social_follow':
        url = notificationData.actor_id ? `/social/profile/${notificationData.actor_id}` : '/social';
      case 'follow':
        url = notificationData.actor_id ? `/social/profile/${notificationData.actor_id}` : '/social';
        break;
      case 'ai_limit_warning':
        url = '/subscription';
        break;
      default:
        url = notificationData.action_url || '/dashboard';
    }
  }

  // Handle notification action clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        url = notificationData.action_url || '/dashboard';
        break;
      case 'dismiss':
        return;
      case 'snooze':
        // Re-schedule notification (this would need backend support)
        return;
      default:
        break;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((client) => {
            if ('navigate' in client) {
              return client.navigate(url);
            }
          });
        }
      }

      // No window open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  //console.log('Notification closed:', event);

  // Track notification dismissal (optional)
  const notificationData = event.notification.data;
  if (notificationData && notificationData.id) {
    // Could send analytics or update read status
    fetch('/api/notifications/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notificationData.id })
    }).catch(console.error);
  }
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    // Fetch pending notifications from server
    const response = await fetch('/api/notifications/pending');
    const notifications = await response.json();

    // Show each notification
    for (const notification of notifications) {
      await self.registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        data: notification.data
      });
    }
  } catch (error) {
    //console.error('Error syncing notifications:', error);
  }
}

// Message event - Handle messages from the client
self.addEventListener('message', (event) => {
  //console.log('Service Worker received message:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, event.data.options);
  }
});

// Service Worker is ready
////console.log('✅ Service Worker loaded successfully');
