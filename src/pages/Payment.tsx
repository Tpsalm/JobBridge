import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  ShieldCheck,
  CheckCircle,
  Loader2,
  Lock,
  Receipt,
  Sparkles,
  Circle,
  Zap,
} from "lucide-react";
import {
  createAdvertisement,
  fetchAdvertisementsByOwner,
} from "../lib/supabaseQueries";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { fetchPaymentByReference, recordPayment } from "../lib/supabaseQueries";
import { sendEmail } from "../lib/email";
import { getSupabaseFunctionsUrl } from "../lib/supabaseHelpers";
import { recordPaymentClick } from "../lib/paymentMetrics";

declare global {
  interface Window {
    Korapay: {
      initialize: (config: KoraPayConfig) => void;
      close: () => void;
    };
  }
}

// Safari/iOS error handling: Suppress KoraPay cleanup errors after payment success
const isKoraScriptSource = (source?: string | null) => {
  if (!source) return false;
  return source.includes("korapay") || source.includes("korablobstorage") || source.includes("korapay-collections");
};

const suppressKoraPay = (message: string, source?: string | null) => {
  if (typeof message !== "string") return false;

  const sanitized = message.trim();
  const isScriptError = sanitized === "Script error." || sanitized === "Script error";

  if (
    sanitized.includes("hasAttribute") ||
    sanitized.includes("Cannot read properties of null") ||
    isScriptError
  ) {
    if (isScriptError) {
      return isKoraScriptSource(source);
    }

    const stack = new Error().stack || "";
    if (
      stack.includes("korapay") ||
      stack.includes("korapay-collections") ||
      isKoraScriptSource(source)
    ) {
      console.warn(
        "[KoraPay] Suppressed cleanup/error issue (iOS/Safari compatibility)",
        message,
        source,
      );
      return true;
    }
  }

  return false;
};

interface KoraPayConfig {
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
    amount: string;
    status: string;
  }) => void;
  onFailed?: (data: { reference: string; status: string }) => void;
  onPending?: () => void;
  merchant_bears_cost?: boolean;
}

const PLANS: Record<
  string,
  {
    name: string;
    duration: string;
    price: number;
    credits: number;
    ai?: boolean;
    service?: boolean;
    business?: boolean;
    [key: string]: any;
  }
> = {
  basic: {
    name: "Basic Job Post",
    duration: "7 days",
    price: 2000,
    credits: 1,
  },
  standard: {
    name: "Standard Job Post",
    duration: "14 days",
    price: 3500,
    credits: 1,
  },
  premium: {
    name: "Premium Job Post",
    duration: "30 days",
    price: 5000,
    credits: 3,
  },
  ai_monthly: {
    name: "AI Career Tools Monthly",
    duration: "30 days",
    price: 1500,
    credits: 0,
    ai: true,
  },
  ai_annual: {
    name: "AI Career Tools Annual",
    duration: "365 days",
    price: 15000,
    credits: 0,
    ai: true,
  },
  service_verified: {
    name: "Verified Professional Listing",
    duration: "30 days",
    price: 3000,
    credits: 0,
    service: true,
  },
  service_featured: {
    name: "Featured Professional Listing",
    duration: "30 days",
    price: 5000,
    credits: 0,
    service: true,
  },
  business_weekly: {
    name: "Weekly Ad",
    duration: "7 days",
    price: 2000,
    credits: 0,
    business: true,
  },
  business_monthly: {
    name: "Monthly Ad",
    duration: "30 days",
    price: 7500,
    credits: 0,
    business: true,
  },
  business_featured: {
    name: "Featured Business",
    duration: "30 days",
    price: 15000,
    credits: 0,
    business: true,
  },
};

type CheckoutStep = "kora-checkout" | "processing" | "success";

const KORA_SCRIPT_SRC =
  "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
const MAX_KORA_SCRIPT_LOAD_RETRIES = 3;
const PENDING_PAYMENT_STORAGE_KEY = "jobbridge_pending_payment_ref";

function getSuccessTarget(plan: (typeof PLANS)[string]): string {
  if (plan.ai) return "/ai-resume";
  if (plan.service) return "/providers";
  if ((plan as any).business) return "/business";
  return "/recruiter?postJob=true";
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, fetchSubscription, fetchAiSubscription, isAuthenticated } = useAuth();
  const { push } = useToasts();

  const planKey = searchParams.get("plan") || "basic";
  const plan = PLANS[planKey] || PLANS.basic;
  const loginRedirect = `/login?redirect=${encodeURIComponent(`/payment?plan=${planKey}`)}`;

  const [step, setStep] = useState<CheckoutStep>("kora-checkout");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [successCountdown, setSuccessCountdown] = useState(3);
  const [error, setError] = useState<ReactNode>("");
  const [koraReady, setKoraReady] = useState(false);
  const [koraLoading, setKoraLoading] = useState(false);
  const koraRetryCountRef = useRef(0);
  const [paymentReference, setPaymentReference] = useState<string>(() => {
    try {
      return sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const originalPaymentReferenceRef = useRef<string>("");
  const koraCompletedRef = useRef(false);
  const receiptSentRef = useRef<Set<string>>(new Set());

  const cleanupKora = () => {
    if (typeof window === "undefined") return;
    const script = document.getElementById("kora-script");
    if (script) {
      script.remove();
    }
    if ((window as any).Korapay) {
      try {
        // Remove the global KoraPay object after checkout so it does not keep
        // running cleanup logic on other pages or after a completed payment.
        delete (window as any).Korapay;
      } catch {
        // ignore non-configurable deletions
      }
    }
    setKoraReady(false);
    setKoraLoading(false);
  };

  const customerEmail = user?.email || "user@example.com";
  const customerName = useMemo(() => {
    const metaName = user?.user_metadata?.full_name;
    if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
    if (user?.email) return user.email.split("@")[0];
    return "JobBridge User";
  }, [user?.email, user?.user_metadata?.full_name]);

  const successTarget = getSuccessTarget(plan);

  // Auto-redirect after 3 seconds for seamless UX
  useEffect(() => {
    if (!paid) return;

    setSuccessCountdown(3);
    const redirectTimer = setTimeout(() => {
      navigate(successTarget);
    }, 3000);

    const countdownTimer = setInterval(() => {
      setSuccessCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      clearTimeout(redirectTimer);
      clearInterval(countdownTimer);
    };
  }, [paid, successTarget, navigate]);

  const clearPendingReference = () => {
    try {
      sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    originalPaymentReferenceRef.current = "";
    setPaymentReference("");
  };

  const loadKoraScript = () => {
    if (typeof window === "undefined") return;
    if (window.Korapay) {
      setKoraReady(true);
      setKoraLoading(false);
      setError("");
      return;
    }

    if (document.getElementById("kora-script")) {
      setKoraLoading(true);
      return;
    }

    setKoraLoading(true);
    const script = document.createElement("script");
    script.id = "kora-script";
    script.type = "text/javascript";
    script.src = KORA_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    const finalizeLoad = () => {
      if (window.Korapay) {
        setKoraReady(true);
        setKoraLoading(false);
        setError("");
        return;
      }
      koraRetryCountRef.current += 1;
      const shouldRetry = koraRetryCountRef.current < MAX_KORA_SCRIPT_LOAD_RETRIES;
      if (shouldRetry) {
        const existing = document.getElementById("kora-script");
        existing?.remove();
        setTimeout(loadKoraScript, 1200);
        return;
      }

      setKoraLoading(false);
      console.error("[Kora] Script loaded but Korapay global is missing");
      setError(
        "Unable to initialize the payment gateway right now. Please refresh this page or try again in a few moments.",
      );
    };

    script.onload = () => {
      window.setTimeout(finalizeLoad, 600);
    };
    script.onerror = () => {
      koraRetryCountRef.current += 1;
      const shouldRetry = koraRetryCountRef.current < MAX_KORA_SCRIPT_LOAD_RETRIES;
      if (shouldRetry) {
        const existing = document.getElementById("kora-script");
        existing?.remove();
        setTimeout(loadKoraScript, 1200);
        return;
      }

      setKoraLoading(false);
      console.error("[Kora] Failed to load script after retries");
      setError(
        "Unable to load the payment gateway right now. Please refresh this page or try again in a few moments.",
      );
    };
    document.body.appendChild(script);
  };

  useEffect(() => {
    loadKoraScript();
  }, []);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (typeof event.message === "string" && suppressKoraPay(event.message, event.filename)) {
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason || {};
      const message = typeof reason?.message === "string" ? reason.message : String(reason);
      const source = typeof reason?.filename === "string" ? reason.filename : undefined;
      if (suppressKoraPay(message, source)) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      cleanupKora();
    };
  }, []);

  useEffect(() => {
    if (!paymentReference) return;
    setStep((current) => (current === "success" ? current : "processing"));
    setPaying(true);
  }, [paymentReference]);

  useEffect(() => {
    if (!paymentReference || step !== "processing") return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const poll = async () => {
      attempts += 1;

      try {
        const payment = await fetchPaymentByReference(paymentReference);
        if (cancelled) return;

        if (!payment) {
          if (attempts >= maxAttempts) {
            setPaying(false);
            setError(
              "We are still waiting for payment confirmation. Please refresh this page in a moment or contact support with your reference.",
            );
          }
          return;
        }

        const status = String(payment.status || "").toLowerCase();

        if (status === "verified" || status === "completed") {
          if (plan.ai) await fetchAiSubscription();
          else await fetchSubscription();

          if (!receiptSentRef.current.has(paymentReference) && user?.email) {
            receiptSentRef.current.add(paymentReference);
            sendEmail({
              type: "payment",
              email: user.email,
              name: customerName,
              plan: plan.name,
              amount: String(plan.price),
            });
          }
          // If this was a business advert purchase, create the advert from pending data
          if ((plan as any).business) {
            try {
              const raw = sessionStorage.getItem('jb_pending_advert');
              if (raw) {
                const pending = JSON.parse(raw);

                // Avoid duplicate advert creation if the webhook already inserted it.
                const existingAds = await fetchAdvertisementsByOwner(user.id);
                const hasDuplicate = existingAds.some(
                  (ad) =>
                    ad.title === pending.title &&
                    ad.package === planKey &&
                    ad.owner_id === user.id,
                );

                if (!hasDuplicate) {
                  const durationDays = plan.duration && plan.duration.includes('30') ? 30 : 7;
                  const starts_at = new Date().toISOString();
                  const expires_at = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
                  await createAdvertisement({
                    owner_id: user.id,
                    business_name: pending.businessName || user.user_metadata?.full_name || user.email,
                    title: pending.title,
                    description: pending.description,
                    category: pending.category || 'Other',
                    package: planKey,
                    is_featured: pending.featured || false,
                    starts_at,
                    expires_at,
                    amount_paid: plan.price,
                  });

                  if (user?.email) {
                    try {
                      sendEmail({ type: 'advert_created', email: user.email, name: customerName });
                    } catch (e) {
                      console.warn('Failed to send advert created email:', e);
                    }
                  }
                }

                try { sessionStorage.removeItem('jb_pending_advert'); } catch {}
              }
            } catch (e) {
              console.warn('Failed to create advertisement after payment:', e);
            }
          }

          clearPendingReference();
          setPaying(false);
          setError("");
          setPaid(true);
          setStep("success");
          return;
        }

        if (status === "failed" || status === "refunded") {
          clearPendingReference();
          setPaying(false);
          setStep("kora-checkout");
          setError(
            `Payment ${status}. No plan was activated. Please try again or contact support with ref: ${paymentReference}`,
          );
          return;
        }

        if (attempts >= maxAttempts) {
          setPaying(false);
          setError(
            `Payment received. We're still waiting for secure verification from KoraPay for ref: ${paymentReference}.`,
          );
        }
      } catch (pollError) {
        console.error("[Payment] Polling error:", pollError);
        if (attempts >= maxAttempts) {
          setPaying(false);
          setError(
            `Could not confirm payment status yet. Please refresh this page and check ref: ${paymentReference}`,
          );
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    paymentReference,
    step,
    plan.ai,
    plan.name,
    plan.price,
    fetchAiSubscription,
    fetchSubscription,
    user?.email,
    customerName,
  ]);

  const handlePayWithKora = async () => {
    if (!user?.id) {
      navigate(loginRedirect);
      return;
    }

    if (!koraReady || typeof window.Korapay === "undefined") {
      setError("Loading secure payment gateway. Please wait a moment.");
      loadKoraScript();
      return;
    }

    const publicKey = import.meta.env.VITE_KORA_PUBLIC_KEY || "";
    if (!publicKey) {
      setError(
        <>
          Kora not configured. Contact{" "}
          <a
            href="mailto:jobbridgesupport@gmail.com"
            className="underline font-medium"
          >
            support
          </a>
          .
        </>,
      );
      return;
    }

    const reference =
      "JB-KORA-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    originalPaymentReferenceRef.current = reference;
    const functionsBaseUrl = getSupabaseFunctionsUrl();
    const notificationUrl = functionsBaseUrl
      ? `${functionsBaseUrl}/kora-webhook`
      : undefined;

    setPaying(true);
    setError("");
    setStep("processing");
    setPaid(false);
    koraCompletedRef.current = false;

    try {
      const pendingAdvert = (() => {
        if (!(plan as any).business) return null;
        try {
          const raw = sessionStorage.getItem('jb_pending_advert');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      const paymentMetadata: Record<string, unknown> = {
        source: 'korapay_checkout_standard',
        plan_name: plan.name,
      };
      if (pendingAdvert) {
        paymentMetadata.advert = pendingAdvert;
      }

      await recordPayment({
        user_id: user.id,
        plan: planKey,
        amount: plan.price,
        reference,
        status: 'pending',
        currency: 'NGN',
        metadata: paymentMetadata,
      });

      try {
        sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, reference);
      } catch {
        // ignore storage failures
      }
      setPaymentReference(reference);
      // record user tapping Pay
      try { recordPaymentClick('pay_button'); } catch {}
      push({
        message: `KoraPay checkout initialized. Complete your payment to activate ${plan.name}.`,
        type: "info",
      });

      if (user.email) {
        sendEmail({
          type: "payment_initiated",
          email: user.email,
          name: customerName,
          plan: plan.name,
          amount: String(plan.price),
        });
      }
    } catch (recordError) {
      console.error("[Payment] Failed to create pending payment:", recordError);
      setPaying(false);
      setStep("kora-checkout");
      setError("Could not start payment securely. Please try again.");
      return;
    }

    try {
      window.Korapay.initialize({
        key: publicKey,
        reference,
        amount: plan.price,
        currency: "NGN",
        notification_url: notificationUrl,
        customer: {
          name: customerName,
          email: customerEmail,
        },
        metadata: {
          plan: planKey,
          user_id: user.id,
        },
        onSuccess: (data) => {
          try {
            koraCompletedRef.current = true;
            const nextReference = data.reference || reference;
            if (nextReference !== reference) {
              try {
                sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, nextReference);
              } catch {
                // ignore storage failures
              }
              setPaymentReference(nextReference);
            }
            setStep("processing");
            setPaying(true);
            setError(
              `Payment received. Verifying securely with KoraPay${nextReference ? ` (ref: ${nextReference})` : ""}...`,
            );
            push({
              message: "Payment submitted successfully. Verifying securely now.",
              type: "success",
            });

            // Attempt immediate server-side verification via Edge Function.
            (async () => {
              try {
                const functionsBaseUrl = getSupabaseFunctionsUrl();
                if (functionsBaseUrl) {
                  const res = await fetch(`${functionsBaseUrl}/verify-payment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reference: nextReference }),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (res.ok && body?.verified) {
                    // server confirmed — refresh subscriptions and navigate
                    try {
                      if (plan.ai) await fetchAiSubscription();
                      else await fetchSubscription();
                    } catch {}
                    clearPendingReference();
                    setPaying(false);
                    setError("");
                    setPaid(true);
                    setStep("success");
                    window.setTimeout(() => { try { navigate(successTarget); } catch {} }, 600);
                    return;
                  }
                }

                // If server-side verify not available or not yet successful,
                // keep the page in processing and allow the user to manually continue.
                setStep("processing");
                setPaying(true);
                setError(`Payment received. Verifying securely with KoraPay${nextReference ? ` (ref: ${nextReference})` : ""}...`);
              } catch (err) {
                console.warn("Server verify attempt failed, falling back to polling", err);
                setStep("processing");
                setPaying(true);
              }
            })();
          } catch (e) {
            console.error("[Payment] Error in onSuccess callback:", e);
          } finally {
            cleanupKora();
          }
        },
        onFailed: (data) => {
          try {
            koraCompletedRef.current = true;
            const failedReference = data.reference || reference;
            setPaymentReference(failedReference);
            setStep("processing");
            setPaying(true);
            setError(
              `KoraPay reported a failed payment. We are verifying it now. Ref: ${failedReference}`,
            );
            push({
              message: "KoraPay reported a failed payment. We are verifying it now.",
              type: "error",
            });
          } catch (e) {
            console.error("[Payment] Error in onFailed callback:", e);
          } finally {
            cleanupKora();
          }
        },
        onPending: () => {
          try {
            koraCompletedRef.current = true;
            setStep("processing");
            setPaying(true);
            setError(
              `Payment submitted. Waiting for secure verification for ref: ${reference}`,
            );
            push({
              message: "Payment is pending. We are verifying it in the background.",
              type: "info",
            });
          } catch (e) {
            console.error("[Payment] Error in onPending callback:", e);
          } finally {
            cleanupKora();
          }
        },
        onClose: () => {
          try {
            // Add a small delay to allow KoraPay to finish cleanup
            // This prevents DOM access errors on iOS/Safari
            window.setTimeout(() => {
              try {
                if (!koraCompletedRef.current) {
                  clearPendingReference();
                  setPaying(false);
                  setStep("kora-checkout");
                  setError("Payment cancelled before completion.");
                }
              } catch (e) {
                console.error("[Payment] Error during delayed onClose:", e);
              } finally {
                cleanupKora();
              }
            }, 100);
          } catch (e) {
            console.error("[Payment] Error in onClose callback:", e);
          }
        },
      });
    } catch (koraError) {
      console.error("[Payment] Failed to initialize KoraPay:", koraError);
      setPaying(false);
      setStep("kora-checkout");
      setError(
        "Failed to open the payment gateway. Please refresh the page and try again.",
      );
    }
  };

  function renderKoraCheckoutScreen() {
    if (!isAuthenticated) {
      return (
        <div className="max-w-[420px] mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Please log in to continue
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              You must be logged in to complete payment. Sign in now to finish checkout.
            </p>
          </div>
          <button
            onClick={() => {
              window.location.href = loginRedirect;
            }}
            className="w-full py-3.5 rounded-2xl bg-[#1A4BCE] text-white font-semibold text-base transition-all duration-200 hover:bg-[#1A4BCE]/90"
          >
            Login to continue
          </button>
        </div>
      );
    }

    const isProcessing = step === "processing";

    return (
      <div className="max-w-[420px] mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A4BCE] to-blue-500 shadow-lg shadow-[#1A4BCE]/25 mb-4">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Pay with KoraPay
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">{plan.name}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-50">
            <span className="text-sm text-gray-500">Plan</span>
            <span className="text-sm font-semibold text-gray-900">
              {plan.name}
            </span>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-gray-50">
            <span className="text-sm text-gray-500">Duration</span>
            <span className="text-sm font-medium text-gray-700">
              {plan.duration}
            </span>
          </div>
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-xl font-bold text-[#1A4BCE]">
              {formatNaira(plan.price)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#1A4BCE]/5 to-blue-50 border border-[#1A4BCE]/10 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A4BCE] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {isProcessing
                  ? "Server Verification in Progress"
                  : "Secure Checkout"}
              </p>
              <p className="text-xs text-gray-500">Powered by KoraPay</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(isProcessing
              ? [
                  "Pending payment recorded",
                  "Webhook verification",
                  "Plan activates after server confirmation",
                ]
              : ["Pay with Card", "USSD", "Bank Transfer"]
            ).map((method) => (
              <span
                key={method}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 text-xs font-medium text-gray-600 border border-gray-100"
              >
                <svg
                  className="w-3 h-3 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {method}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <div
            className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${isProcessing ? "bg-blue-50 border border-blue-100 text-blue-700" : "bg-red-50 border border-red-100 text-red-700"}`}
          >
            <Circle
              className={`w-4 h-4 shrink-0 mt-0.5 ${isProcessing ? "text-blue-500" : "text-red-500"}`}
              fill="currentColor"
            />
            <span>{error}</span>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4">
            <button
              onClick={async () => {
                // Manual continue: call server verify then navigate if confirmed
                if (!paymentReference) return;
                const functionsBaseUrl = getSupabaseFunctionsUrl();
                if (!functionsBaseUrl) {
                  push({ message: "Verification service unavailable. Please wait or contact support.", type: "error" });
                  return;
                }

                try {
                  push({ message: "Checking payment status...", type: "info" });
                  const res = await fetch(`${functionsBaseUrl}/verify-payment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reference: paymentReference }),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (res.ok && body?.verified) {
                    try {
                      if (plan.ai) await fetchAiSubscription();
                      else await fetchSubscription();
                    } catch {}
                    clearPendingReference();
                    setPaid(true);
                    setStep("success");
                    setPaying(false);
                    push({ message: "Payment verified — redirecting...", type: "success" });
                    setTimeout(() => navigate(successTarget), 600);
                    return;
                  }
                  push({ message: "Verification still pending. We'll continue to poll in the background.", type: "info" });
                } catch (e) {
                  console.error("Manual verify failed:", e);
                  push({ message: "Verification failed. Please try again later or contact support.", type: "error" });
                }
              }}
              className="w-full mt-3 py-3 rounded-2xl bg-white text-blue-700 font-semibold text-base border border-blue-100"
            >
              Continue to feature (check now)
            </button>
          </div>
        )}

        <button
          onClick={handlePayWithKora}
          disabled={paying || (!koraReady && koraLoading) || isProcessing}
          className="w-full py-3.5 rounded-2xl bg-[#1A4BCE] text-white font-semibold text-base
                     transition-all duration-200 hover:bg-[#1A4BCE]/90 active:scale-[0.98]
                     shadow-lg shadow-[#1A4BCE]/25 hover:shadow-xl hover:shadow-[#1A4BCE]/30
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {paying ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {isProcessing ? "Verifying payment..." : "Processing..."}
            </span>
          ) : !koraReady ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {koraLoading ? "Loading payment gateway..." : "Retrying gateway setup..."}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Pay {formatNaira(plan.price)} securely
            </span>
          )}
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          Your plan activates after secure server-side verification
        </p>
      </div>
    );
  }

  function renderSuccessScreen() {
    return (
      <div className="max-w-[420px] mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Payment Successful!
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Your <strong className="text-gray-900">{plan.name}</strong> plan is
            now active.
          </p>
        </div>

        <div className="rounded-2xl border bg-emerald-50 border-emerald-100 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">
                Plan Activated
              </p>
              <p className="text-xs text-gray-600">
                Your {plan.name} is ready to use
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-5 mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            What's next
          </p>
          <div className="space-y-3">
            {[
              "Your plan is active — start using it now",
              "A receipt will be sent to your email",
              plan.ai
                ? "Explore AI Career Tools"
                : plan.service
                  ? "Manage your professional listing"
                  : "Post your jobs and reach candidates",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1A4BCE]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="w-3.5 h-3.5 text-[#1A4BCE]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 text-left">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate(successTarget)}
            className="w-full py-3.5 rounded-2xl bg-[#1A4BCE] text-white font-semibold text-base
                       transition-all duration-200 hover:bg-[#1A4BCE]/90 active:scale-[0.98]
                       shadow-lg shadow-[#1A4BCE]/25 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {plan.ai
              ? "Go to AI Resume Studio"
              : plan.service
                ? "Go to My Profile"
                : "Go to Dashboard"}
          </button>
          
          {successCountdown > 0 && (
            <p className="text-xs text-gray-500 text-center">
              Redirecting in <strong>{successCountdown}</strong> second{successCountdown !== 1 ? 's' : ''}...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {paid && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div
            className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4"
            style={{ animation: "slideUp 0.35s ease-out" }}
          >
            {renderSuccessScreen()}
          </div>
        </div>
      )}

      <div
        className={`min-h-screen bg-white pb-24 ${paid ? "opacity-20 pointer-events-none select-none" : ""}`}
      >
        <Header />

        <div className="max-w-7xl mx-auto px-4 mt-6 mb-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
            <div className="relative px-6 py-10 sm:px-12 sm:py-14 text-white">
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300 font-semibold">
                Secure payment
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight max-w-3xl">
                Pay for your plan with KoraPay and complete checkout securely.
              </h2>
              <p className="mt-4 max-w-2xl text-sm sm:text-base text-cyan-100/90 leading-7">
                Use card, USSD or bank transfer and get fast verification from our secure payment gateway.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Fast verification", icon: "⚡" },
                  { label: "Card, USSD, Bank Transfer", icon: "💳" },
                  { label: "Encrypted checkout", icon: "🔒" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
                  >
                    <div className="text-2xl">{item.icon}</div>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1A4BCE] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 py-8">
            <button
              onClick={() => navigate("/pricing")}
              className="inline-flex items-center gap-1.5 text-sm text-blue-200 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to pricing
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Complete Checkout
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              Pay for <strong className="text-white">{plan.name}</strong> with
              KoraPay and activate after secure verification
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 -mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 ml-2">
                      jobbridge.com.ng/payment
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Sparkles className="w-3 h-3 text-[#1A4BCE]" />
                    Secure Checkout
                  </div>
                </div>
              </div>
              <div className="p-6">{renderKoraCheckoutScreen()}</div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 ml-2">
                      Order Summary
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Sparkles className="w-3 h-3 text-[#1A4BCE]" />
                    Summary
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="max-w-[420px] mx-auto">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A4BCE] to-blue-500 shadow-lg shadow-[#1A4BCE]/20 mb-4">
                      <Receipt className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                      Order Summary
                    </h2>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
                      <div className="w-12 h-12 rounded-xl bg-[#1A4BCE]/10 flex items-center justify-center text-lg font-bold text-[#1A4BCE]">
                        {plan.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {plan.name}
                        </p>
                        <p className="text-xs text-gray-500">{plan.duration}</p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Credits</span>
                        <span className="font-medium text-gray-900">
                          {plan.ai
                            ? "—"
                            : `${plan.credits} job post${plan.credits > 1 ? "s" : ""}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium text-gray-900">
                          {formatNaira(plan.price)}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">
                          Total
                        </span>
                        <span className="text-xl font-bold text-[#1A4BCE]">
                          {formatNaira(plan.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-5">
                    <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#1A4BCE]" />
                      {step === "success"
                        ? "Completed"
                        : step === "processing"
                          ? "Verification in progress"
                          : "What happens next"}
                    </p>
                    <div className="space-y-3">
                      {[
                        step === "success"
                          ? "Plan activated successfully"
                          : step === "processing"
                            ? "Your payment is waiting for backend verification"
                            : "Complete checkout with KoraPay",
                        step === "success"
                          ? "Receipt sent to your email"
                          : step === "processing"
                            ? "Webhook + Kora API reconciliation in progress"
                            : "Server verifies the payment before activation",
                        plan.ai
                          ? "AI Career Tools ready"
                          : plan.service
                            ? "Professional listing ready"
                            : `${plan.credits} job post credit${plan.credits > 1 ? "s" : ""} added after verification`,
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              step === "success"
                                ? "bg-emerald-100"
                                : step === "processing"
                                  ? "bg-blue-100"
                                  : "bg-[#1A4BCE]/10"
                            }`}
                          >
                            {step === "success" ? (
                              <svg
                                className="w-3.5 h-3.5 text-emerald-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : step === "processing" ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-[#1A4BCE]" />
                            )}
                          </div>
                          <p
                            className={`text-sm ${step === "success" ? "text-gray-700" : "text-gray-500"}`}
                          >
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Protected by SSL encryption</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8 mb-6">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center justify-center gap-4 flex-wrap text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-gray-400" />
              Secure checkout
            </span>
            <span className="hidden sm:inline text-gray-200">|</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gray-400" />
              SSL encrypted
            </span>
            <span className="hidden sm:inline text-gray-200">|</span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-gray-400" />
              Powered by KoraPay
            </span>
          </div>
        </div>

        <BottomNav />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
