// Service Worker for Push Notifications and Offline Access
// @ts-nocheck

const CACHE_NAME = 'studdyhub-v2'; // Increment version
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase API calls
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  const url = new URL(event.request.url);

  // Strategy 1: Network-First for index.html and navigation requests
  // This ensures the user always gets the latest version of the app shell (if online)
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match(event.request))
    );
    return;
  }

  // Strategy 2: Stale-While-Revalidate for other assets
  // Serve from cache immediately for speed, but refresh the cache in the background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });

      return cachedResponse || fetchPromise;
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
