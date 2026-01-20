// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification',
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/logo192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/',
        timestamp: data.timestamp
      },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Quick Wing', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const action = event.action;
  const url = event.notification.data?.url || '/';

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Optionally track dismissed notifications
  console.log('Notification dismissed', event.notification.tag);
});

// Handle service worker installation
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
