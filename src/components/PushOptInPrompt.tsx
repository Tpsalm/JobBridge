import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { listenForPushSubscriptionChanges, subscribeToPush } from "../lib/push";

const DISMISS_KEY = "jobbridge:push-prompt-dismissed";

/**
 * Asks a signed-in user to enable browser notifications once.
 *
 * Broadcast campaigns only reach devices that hold a live push subscription, and
 * the only place a user could subscribe used to be the Notifications page, so
 * almost nobody did. This prompt is mounted at the app root so every signed-in
 * user is asked exactly once, and it also re-saves a subscription when the
 * browser rotates it.
 */
export default function PushOptInPrompt() {
  const [signedIn, setSignedIn] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const stopListening = listenForPushSubscriptionChanges();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session?.user?.id));
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user?.id));
    });

    return () => {
      active = false;
      stopListening();
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setVisible(false);
      return;
    }
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage can be blocked; treat as not dismissed */
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = registration ? await registration.pushManager.getSubscription() : null;
        if (!cancelled && !existing) setVisible(true);
      } catch {
        /* ignore: leave the prompt hidden rather than erroring */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/push-config");
      if (!response.ok) throw new Error("Notifications are not configured yet.");
      const { publicKey } = (await response.json()) as { publicKey?: string };
      if (!publicKey) throw new Error("Notifications are not configured yet.");
      await subscribeToPush(publicKey);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
      <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-lg">
        <p className="text-sm font-semibold text-gray-900">Get job alerts on your phone</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          Turn on notifications and messages from JobBridge land on this device, even when the site is closed.
        </p>
        {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Enabling..." : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
