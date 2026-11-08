/* Service Worker for JobBridge Web Push */
const SW_VERSION = '2026-11-08';
const FALLBACK_ICON = 'images/jobbridge-logo.jpeg';

// Take over immediately so a freshly deployed worker (new notification layout,
// deep-link handling) is used on the very next push instead of after a reload.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

function resolveUrl(value) {
  const scope = self.registration.scope;
  if (typeof value !== 'string' || !value.trim()) return scope;
  try {
    return new URL(value, scope).href;
  } catch (e) {
    return scope;
  }
}

function buildOptions(payload) {
  const icon = resolveUrl(payload.icon || FALLBACK_ICON);
  const options = {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: icon,
    badge: resolveUrl(payload.badge || FALLBACK_ICON),
    data: payload.data && typeof payload.data === 'object' ? payload.data : {},
    renotify: payload.renotify === true,
    tag: typeof payload.tag === 'string' && payload.tag ? payload.tag : undefined,
    requireInteraction: payload.requireInteraction === true,
    timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now(),
  };
  if (Array.isArray(payload.vibrate) && payload.vibrate.length) options.vibrate = payload.vibrate;
  if (typeof payload.image === 'string' && payload.image) options.image = resolveUrl(payload.image);
  if (Array.isArray(payload.actions) && payload.actions.length) {
    options.actions = payload.actions
      .filter((action) => action && typeof action.action === 'string' && typeof action.title === 'string')
      .slice(0, 2)
      .map((action) => ({ action: action.action.slice(0, 40), title: action.title.slice(0, 40) }));
  }
  return options;
}

self.addEventListener('push', function (event) {
  let payload = { title: 'JobBridge', body: 'You have a new notification' };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch (e) {
    payload = { title: 'JobBridge', body: (event.data && event.data.text && event.data.text()) || 'You have a new notification' };
  }
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'JobBridge';
  event.waitUntil(
    self.registration.showNotification(title, buildOptions(payload)).catch(function () {
      return self.registration.showNotification('JobBridge', { body: 'You have a new notification', icon: resolveUrl(FALLBACK_ICON) });
    }),
  );
});

function focusOrOpen(targetUrl) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      let clientUrl = '';
      try {
        clientUrl = new URL(client.url).href;
      } catch (e) {
        clientUrl = client.url;
      }
      if (clientUrl === targetUrl && 'focus' in client) return client.focus();
    }
    // Reuse an already open JobBridge window and navigate it to the deep link.
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if ('focus' in client) {
        if ('navigate' in client) {
          return client.focus().then(function (focused) {
            return (focused || client).navigate(targetUrl).catch(function () {
              return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
            });
          }).catch(function () {
            return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
          });
        }
        return client.focus();
      }
    }
    return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = resolveUrl(data.url || self.registration.scope);
  event.waitUntil(
    focusOrOpen(targetUrl).then(function () {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (windowClients) {
      windowClients.forEach(function (client) {
        if (client.postMessage) {
          client.postMessage({
            type: 'jobbridge-notification-click',
            action: event.action || 'default',
            campaignId: data.campaignId || null,
            url: targetUrl,
          });
        }
      });
    }).catch(function () {}),
  );
});

// Browsers can rotate or expire a push subscription at any time. Re-subscribe
// with the same VAPID key and hand the fresh subscription to an open tab so it
// can be re-saved for the signed-in user.
self.addEventListener('pushsubscriptionchange', function (event) {
  const previous = event.oldSubscription;
  const applicationServerKey = previous && previous.options ? previous.options.applicationServerKey : undefined;
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    }).then(function (subscription) {
      return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
        windowClients.forEach(function (client) {
          if (client.postMessage) {
            client.postMessage({
              type: 'jobbridge-push-resubscribe',
              version: SW_VERSION,
              subscription: subscription.toJSON(),
            });
          }
        });
      });
    }).catch(function () {}),
  );
});

