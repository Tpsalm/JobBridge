import { supabase } from "./supabase";

// Client helper for subscribing to Web Push and registering service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const reg = await navigator.serviceWorker.register(`${baseUrl}sw.js`, {
        scope: baseUrl,
      });
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

export async function subscribeToPush(vapidPublicKey: string, userId?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || (userId && userId !== session.user.id)) {
      throw new Error("Sign in to enable browser notifications.");
    }
    const reg = await registerServiceWorker();
    if (!reg) throw new Error('No service worker registration');
    if (!('PushManager' in window)) throw new Error('PushManager not supported');

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(vapidPublicKey),
    });

    // send subscription to server
    const response = await fetch('/api/register-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not save your browser subscription.");

    return sub;
  } catch (e) {
    console.error('[push] subscribeToPush error', e);
    throw e;
  }
}

export async function unsubscribeFromPush() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to manage browser notifications.");
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Could not open the browser notification service.");
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const response = await fetch('/api/register-push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not remove your browser subscription.");
    await sub.unsubscribe();
  }
}
