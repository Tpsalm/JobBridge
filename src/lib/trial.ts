import { getSupabaseFunctionsUrl } from "./supabaseHelpers";

const KORA_SCRIPT_SRC =
  "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";

export interface KoraPayConfig {
  key: string;
  reference: string;
  amount: number;
  currency?: string;
  customer: { name: string; email: string };
  notification_url?: string;
  narration?: string;
  channels?: string[];
  default_channel?: string;
  metadata?: Record<string, string>;
  onClose?: () => void;
  onSuccess?: (data: {
    reference: string;
    payment_reference?: string;
    transaction_reference?: string;
    amount: string;
    status: string;
  }) => void;
  onFailed?: (data: {
    reference: string;
    payment_reference?: string;
    transaction_reference?: string;
    status: string;
  }) => void;
  onPending?: () => void;
  onTokenized?: (data: {
    token?: string;
    card?: { token?: string };
    card_token?: string;
  }) => void;
  merchant_bears_cost?: boolean;
}

declare global {
  interface Window {
    Korapay: {
      initialize: (config: KoraPayConfig) => void;
      close: () => void;
    };
  }
}

export function getKoraPublicKey(): string {
  return (import.meta.env.VITE_KORA_PUBLIC_KEY || "").trim();
}

let koraReadyPromise: Promise<boolean> | null = null;

/**
 * Load the KoraPay collections script once and resolve when the global
 * `window.Korapay` becomes available. Retries a few times before failing so
 * slow networks don't leave users stuck.
 */
export function loadKoraScript(timeoutMs = 20000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Korapay) return Promise.resolve(true);
  if (koraReadyPromise) return koraReadyPromise;

  koraReadyPromise = new Promise<boolean>((resolve) => {
    const startTime = Date.now();
    const attempt = () => {
      if (window.Korapay) {
        resolve(true);
        return;
      }
      const existing = document.getElementById("kora-script");
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = "kora-script";
      script.type = "text/javascript";
      script.src = KORA_SCRIPT_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      document.body.appendChild(script);

      const pollInterval = window.setInterval(() => {
        if (window.Korapay) {
          window.clearInterval(pollInterval);
          resolve(true);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          window.clearInterval(pollInterval);
          document.getElementById("kora-script")?.remove();
          resolve(false);
        }
      }, 150);
    };
    attempt();
  });

  return koraReadyPromise;
}

/**
 * Activate the 30-day Service Provider free trial for a user. `cardToken` is
 * the KoraPay saved-card token captured during checkout/signup (₦0 today);
 * the billing worker auto-debits it after the trial ends.
 */
export async function activateServiceTrialForUser(
  userId: string,
  planKey: string,
  cardToken: string,
): Promise<boolean> {
  const functionsBase = getSupabaseFunctionsUrl();
  if (!functionsBase || !userId) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(`${functionsBase}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activate_plan: true,
        trial: true,
        plan_key: planKey,
        user_id: userId,
        duration_days: 30,
        credits: 0,
        amount: 0,
        reference: "",
        card_token: cardToken || "",
      }),
      signal: controller.signal,
    });
    const body = await resp.json().catch(() => ({}));
    return resp.ok && body?.verified === true;
  } catch (e) {
    console.warn("[trial] Service trial activation failed:", e);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const PENDING_TRIAL_STORAGE_KEY = "jb_pending_trial_token";

export function savePendingTrial(token: string, email: string) {
  try {
    sessionStorage.setItem(
      PENDING_TRIAL_STORAGE_KEY,
      JSON.stringify({ token, email }),
    );
  } catch {
    // ignore storage failures
  }
}

/**
 * Retrieve and immediately clear a pending trial token saved during signup for
 * an email-confirmation flow. Returns the token only when it matches the
 * confirmed user's email.
 */
export function takePendingTrial(email: string): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TRIAL_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_TRIAL_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { token?: string; email?: string };
    if (!parsed?.token || !parsed.email) return null;
    if (parsed.email.toLowerCase() !== String(email || "").toLowerCase()) {
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function koraTrialReference(): string {
  return (
    "JB-SVC-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}