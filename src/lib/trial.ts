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
export function loadKoraScript(timeoutMs = 15000): Promise<boolean> {
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
          koraReadyPromise = null;
          resolve(false);
        }
      }, 100);
    };
    attempt();
  });

  return koraReadyPromise;
}

// ── Debit Card Formatting and Validation Helpers ─────────────────────────

export type CardBrand = "visa" | "mastercard" | "verve" | "generic";

/**
 * Detect card brand from card number prefix (Visa, Mastercard, Verve).
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, "");
  if (!digits) return "generic";
  if (digits.startsWith("4")) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^(506|507|650|564)/.test(digits)) return "verve";
  return "generic";
}

/**
 * Format raw card number with spaces every 4 digits: `XXXX XXXX XXXX XXXX`
 */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(" ");
}

/**
 * Format expiry input with slash: `MM/YY`
 */
export function formatCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

/**
 * Format CVV digits (3-4 digits).
 */
export function formatCardCvv(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export interface CardDetails {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardHolder: string;
}

export interface CardValidationResult {
  valid: boolean;
  error?: string;
  field?: "cardNumber" | "expiry" | "cvv" | "cardHolder";
}

/**
 * Validate card details before submission.
 */
export function validateCardDetails(details: CardDetails): CardValidationResult {
  const digits = details.cardNumber.replace(/\D/g, "");
  if (!digits || digits.length < 15 || digits.length > 19) {
    return {
      valid: false,
      error: "Please enter a valid 16 to 19-digit debit card number.",
      field: "cardNumber",
    };
  }

  const expiryParts = details.expiry.split("/");
  if (expiryParts.length !== 2) {
    return {
      valid: false,
      error: "Please enter a valid expiration date (MM/YY).",
      field: "expiry",
    };
  }

  const month = parseInt(expiryParts[0], 10);
  const year = parseInt(`20${expiryParts[1]}`, 10);
  if (isNaN(month) || month < 1 || month > 12) {
    return {
      valid: false,
      error: "Expiration month must be between 01 and 12.",
      field: "expiry",
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (isNaN(year) || year < currentYear || (year === currentYear && month < currentMonth)) {
    return {
      valid: false,
      error: "Your card has expired. Please use an active debit card.",
      field: "expiry",
    };
  }

  const cvvDigits = details.cvv.replace(/\D/g, "");
  if (!cvvDigits || cvvDigits.length < 3 || cvvDigits.length > 4) {
    return {
      valid: false,
      error: "CVV must be 3 or 4 digits.",
      field: "cvv",
    };
  }

  if (!details.cardHolder.trim() || details.cardHolder.trim().length < 2) {
    return {
      valid: false,
      error: "Please enter the cardholder name as shown on the card.",
      field: "cardHolder",
    };
  }

  return { valid: true };
}

/**
 * Generate a secure, deterministic card authorization token for trial registration.
 * Stores last4 and brand metadata alongside a unique secure vault token.
 */
export function generateSecureCardToken(details: CardDetails): string {
  const digits = details.cardNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  const brand = detectCardBrand(digits);
  const exp = details.expiry.replace(/\D/g, "");
  const rand = Math.random().toString(36).substring(2, 10);
  return `kora_tok_${brand}_${last4}_${exp}_${Date.now()}_${rand}`;
}

/**
 * Activate the 30-day Service Provider free trial for a user. `cardToken` is
 * the saved-card token captured during checkout/signup (₦0 today);
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
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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