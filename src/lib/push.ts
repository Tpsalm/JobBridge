// Client helper for subscribing to Web Push and registering service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (e) {
      console.error('[push] service worker registration failed', e);
      return null;
    }
  }
  return null;
}

export async function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(vapidPublicKey: string) {
  try {
    const reg = await registerServiceWorker();
    if (!reg) throw new Error('No service worker registration');
    if (!('PushManager' in window)) throw new Error('PushManager not supported');

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(vapidPublicKey),
    });

    // send subscription to server
    await fetch('/api/register-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub }),
    });

    return sub;
  } catch (e) {
    console.error('[push] subscribeToPush error', e);
    throw e;
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await registerServiceWorker();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/register-push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) });
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('[push] unsubscribe error', e);
  }
}
