// sw.js - Service Worker for Push Notifications
// Save this in the same folder as your index.html

const CACHE_NAME = 'jeans-club-v1';

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed');
  self.skipWaiting();
});

// FIXED: Added missing curly brace here
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(clients.claim());
});

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('📨 Push received');
  
  let notification = {
    title: 'Jeans Club',
    body: 'You have a new update!',
    icon: 'https://i.ibb.co.com/Rp9F4xBC/jeans-club.jpg',
    badge: 'https://i.ibb.co.com/Rp9F4xBC/jeans-club.jpg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: 'https://elijah787.github.io/jeans-club'
    }
  };

  if (event.data) {
    try {
      const parsed = JSON.parse(event.data.text());
      notification = { ...notification, ...parsed };
    } catch (e) {
      notification.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      vibrate: notification.vibrate,
      requireInteraction: notification.requireInteraction,
      data: notification.data,
      tag: 'jeans-club-' + Date.now()
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const url = event.notification.data?.url || 'https://elijah787.github.io/jeans-club';
        
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle messages from main page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notif = event.data.notification;
    self.registration.showNotification(notif.title, {
      body: notif.body,
      icon: notif.icon || 'https://i.ibb.co.com/Rp9F4xBC/jeans-club.jpg',
      requireInteraction: true,
      data: notif.data || {}
    });
  }
});