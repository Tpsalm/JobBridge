import { supabase } from "./supabase";

const KORA_SCRIPT_SRC =
  "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";

export interface ServiceProviderPlanConfig {
  id: string;
  name: string;
  price: number;
  monthlyPriceFormatted: string;
  duration: string;
  popular?: boolean;
  badge?: string;
  features: string[];
}

export const SERVICE_PROVIDER_PLANS: Record<string, ServiceProviderPlanConfig> = {
  service_monthly: {
    id: "service_monthly",
    name: "Monthly Listing",
    price: 1500,
    monthlyPriceFormatted: "₦1,500",
    duration: "30 days",
    badge: "Get Started",
    features: [
      "Profile on JobBridge marketplace",
      "Name and contact info visible",
      "Description of services & portfolio",
      "Location & direct client inquiries",
      "₦0 charged today for 30 full days",
    ],
  },
  service_verified: {
    id: "service_verified",
    name: "Verified Professional",
    price: 3000,
    monthlyPriceFormatted: "₦3,000",
    duration: "30 days",
    popular: true,
    badge: "Best Value",
    features: [
      "Everything in Monthly Listing",
      "Verified badge ✓ on your profile",
      "Priority in search results",
      "ID & Phone verification badge",
      "Increased trust & 3x more client inquiries",
    ],
  },
  service_featured: {
    id: "service_featured",
    name: "Featured Professional",
    price: 5000,
    monthlyPriceFormatted: "₦5,000",
    duration: "30 days",
    badge: "Most Popular",
    features: [
      "Everything in Verified Professional",
      "Featured badge ⭐",
      "Top of search results & homepage spotlight",
      "Priority placement across categories",
      "Promotion on WhatsApp & social channels",
    ],
  },
};

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
 * `window.Korapay` becomes available.
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

/**
 * Format a future date (default 30 days from now) for Spotify-style trial display
 * Example: "October 11, 2026"
 */
export function getTrialBillingStartDate(days = 30): { date: Date; formatted: string } {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const formatted = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return { date, formatted };
}

/**
 * Activate the 30-day service-provider trial after KoraPay returns its
 * provider-issued card token. The token is sent directly to the Edge Function
 * and never written to browser storage or profile metadata.
 */
export async function activateServiceTrialForUser(
  userId: string,
  planKey = "service_verified",
  cardToken = "",
): Promise<boolean> {
  if (!userId) return false;

  if (!cardToken) {
    console.error("[trial] KoraPay did not return a reusable card token.");
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke<{ verified?: boolean }>(
      "verify-payment",
      {
        body: {
          activate_plan: true,
          trial: true,
          plan_key: planKey || "service_verified",
          user_id: userId,
          duration_days: 30,
          credits: 0,
          amount: 0,
          reference: "",
          card_token: cardToken,
        },
      },
    );
    if (error) throw error;
    return data?.verified === true;
  } catch (error) {
    console.error("[trial] Service trial activation failed:", error);
    return false;
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
