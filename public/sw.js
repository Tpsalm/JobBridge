/* Service Worker for JobBridge Web Push */
self.addEventListener('push', function (event) {
  try {
    const payload = event.data ? event.data.json() : { title: 'JobBridge', body: 'You have a new notification' };
    const title = payload.title || 'JobBridge';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/images/logo-192.png',
      badge: payload.badge || '/images/logo-72.png',
      data: payload.data || {},
      renotify: payload.renotify || false,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // fallback
    event.waitUntil(self.registration.showNotification('JobBridge', { body: 'You have a new notification' }));
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
