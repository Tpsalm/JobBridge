// =============================================================================
// JobBridge — Service provider card subscription setup
// -----------------------------------------------------------------------------
// Three step wizard used by `/payment?plan=svc_*` and by “Update payment
// method” from Manage Subscription:
//
//   Step 1 — Start Subscription : plan, price, what happens next
//   Step 2 — Add Payment Method : the card entry screen (card details)
//   Step 3 — Review & Confirm   : charges, consent, Korapay secure checkout
//   Done   — Subscription set up
//
// The ₦100 card-setup charge and every recurring plan charge are authorised
// inside Korapay’s PCI-DSS compliant checkout. JobBridge only stores the
// reusable Korapay token and the card’s last four digits — never the PAN or
// the security code.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { invokeSubscriptionFunction } from "../lib/subscriptionSession";
import { getSupabaseFunctionsUrl } from "../lib/supabaseHelpers";
import {
  SERVICE_PROVIDER_PLANS,
  getKoraPublicKey,
  loadKoraScript,
  type KoraPayConfig,
} from "../lib/trial";

const CARD_SETUP_AMOUNT_NGN = 100;
const CARD_SETUP_CONSENT_VERSION = "service-card-v1";

const SERVICE_PLAN_KEYS: Record<string, string> = {
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  svc_basic: "svc_basic",
  svc_verified: "svc_verified",
  svc_featured: "svc_featured",
};

function databasePlanKey(planKey: string): string | null {
  return (
    SERVICE_PLAN_KEYS[planKey] ||
    (/^svc_[a-z0-9_]{1,40}$/.test(planKey) ? planKey : null)
  );
}

type Step = 3 | 4 | 5 | 6;

type CardDraft = {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
};

type FieldErrors = Partial<Record<keyof CardDraft, string>>;

type CardSetupResponse = {
  error?: string;
  status?: string;
  reference?: string;
  amount_ngn?: number;
  setup_charge_ngn?: number;
  plan_name?: string;
  plan_amount_ngn?: number;
  next_charge_at?: string | null;
  billing_period_days?: number;
  payment_method_last4?: string | null;
  subscription_id?: string;
  existing_subscription?: boolean;
  card_update?: boolean;
  card_updated?: boolean;
};

type PlanDetails = { name: string; price: number; durationDays: number };

type CardBrand = "visa" | "mastercard" | "verve" | "card";


function detectCardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5060|5061|5078|5079|5080|6500)/.test(digits)) return "verve";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  return "card";
}

function brandLabel(brand: CardBrand): string {
  if (brand === "visa") return "Visa";
  if (brand === "mastercard") return "Mastercard";
  if (brand === "verve") return "Verve";
  return "Card";
}

/** Luhn checksum — every issued Visa / Mastercard / Verve card passes it. */
function passesLuhn(digits: string): boolean {
  if (digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (Number.isNaN(value)) return false;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

function groupCardNumber(digits: string): string {
  return digits.slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function maskNumber(digits: string): string {
  if (!digits) return "•••• •••• •••• ••••";
  const masked = digits.slice(0, -4).replace(/\d/g, "•");
  return groupCardNumber(`${masked}${digits.slice(-4)}`);
}

function validateCard(card: CardDraft): FieldErrors {
  const errors: FieldErrors = {};
  const digits = card.number.replace(/\D/g, "");

  if (!digits) {
    errors.number = "Enter your card number.";
  } else if (digits.length < 15 || digits.length > 19) {
    errors.number = "A card number has between 15 and 19 digits.";
  } else if (!passesLuhn(digits)) {
    errors.number = "That card number is not valid. Check it and try again.";
  }

  if (!card.name.trim() || card.name.trim().length < 3) {
    errors.name = "Enter the name exactly as it appears on the card.";
  }

  const expiry = card.expiry.replace(/\D/g, "");
  if (expiry.length !== 4) {
    errors.expiry = "Use the MM/YY format.";
  } else {
    const month = Number(expiry.slice(0, 2));
    const year = 2000 + Number(expiry.slice(2));
    const now = new Date();
    if (month < 1 || month > 12) {
      errors.expiry = "Enter a month between 01 and 12.";
    } else if (
      year < now.getFullYear() ||
      (year === now.getFullYear() && month < now.getMonth() + 1)
    ) {
      errors.expiry = "This card has expired.";
    }
  }

  const cvv = card.cvv.replace(/\D/g, "");
  if (cvv.length < 3 || cvv.length > 4) {
    errors.cvv = "The CVV is the 3 or 4 digit code on the card.";
  }

  return errors;
}

function formatNaira(value: number): string {
  return `₦${Number.isFinite(value) ? value.toLocaleString("en-NG") : "0"}`;
}

function formatChargeDate(value?: string | null): string {
  if (!value) return "Next billing run";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Next billing run";
  return date.toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ServiceSubscriptionSetup({ planKey }: { planKey: string }) {
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const updatePaymentMethod = useMemo(
    () => new URLSearchParams(location.search).get("update_method") === "1",
    [location.search],
  );

  const fallbackPlan = SERVICE_PROVIDER_PLANS[planKey];

  const [step, setStep] = useState<Step>(updatePaymentMethod ? 4 : 3);
  const [card, setCard] = useState<CardDraft>({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<CardSetupResponse | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadError, setPlanLoadError] = useState("");
  const [koraReady, setKoraReady] = useState(false);
  const [koraLoading, setKoraLoading] = useState(true);
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  const cardTokenRef = useRef("");
  const paymentReferenceRef = useRef("");

  const cardDigits = card.number.replace(/\D/g, "");
  const cardBrand = useMemo(() => detectCardBrand(cardDigits), [cardDigits]);

  /* ------------------------------------------------------- cardholder name */
  useEffect(() => {
    const holder = profile?.full_name || user?.user_metadata?.full_name || "";
    if (!holder) return;
    setCard((current) => (current.name ? current : { ...current, name: holder }));
  }, [profile?.full_name, user?.user_metadata?.full_name]);

  /* ------------------------------------------------------------------- plan */
  useEffect(() => {
    let active = true;
    const resolvedKey = databasePlanKey(planKey);
    if (!resolvedKey) {
      setPlanLoadError("This provider plan is not available.");
      setPlanLoading(false);
      return;
    }

    const loadPlan = async () => {
      setPlanLoading(true);
      const { data, error: queryError } = await supabase
        .from("plans")
        .select("name, base_price_ngn, duration_days")
        .eq("key", resolvedKey)
        .eq("product_line", "service")
        .eq("is_active", true)
        .maybeSingle();

      if (!active) return;

      if (queryError || !data) {
        // Never block the wizard because the catalogue hiccuped — fall back to
        // the published plan card so the provider can still add a card.
        console.error(
          "[ServiceSubscriptionSetup] plan lookup failed:",
          queryError?.message || "Plan is inactive.",
        );
        if (SERVICE_PROVIDER_PLANS[planKey]) {
          setPlanDetails({
            name: SERVICE_PROVIDER_PLANS[planKey].name,
            price: SERVICE_PROVIDER_PLANS[planKey].price,
            durationDays: 30,
          });
          setPlanLoadError("");
        } else {
          setPlanDetails(null);
          setPlanLoadError(
            "We could not confirm this plan’s price. Refresh the page or contact support.",
          );
        }
      } else {
        setPlanDetails({
          name: data.name,
          price: Number(data.base_price_ngn),
          durationDays: Number(data.duration_days) || 30,
        });
        setPlanLoadError("");
      }
      setPlanLoading(false);
    };

    void loadPlan();
    return () => {
      active = false;
    };
  }, [planKey]);

  /* -------------------------------------------------------- Korapay script */
  const prepareKoraCheckout = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (window.Korapay) {
      setKoraReady(true);
      setKoraLoading(false);
      return true;
    }

    setKoraLoading(true);
    const loaded = await loadKoraScript();
    setKoraLoading(false);

    if (loaded && window.Korapay) {
      setKoraReady(true);
      return true;
    }

    console.error("[ServiceSubscriptionSetup] Korapay checkout script did not load.");
    setKoraReady(false);
    return false;
  }, []);

  // Warm the checkout script while the provider is still reading step one, so
  // tapping “Pay ₦100 & save card” opens Korapay immediately.
  useEffect(() => {
    void prepareKoraCheckout();
  }, [prepareKoraCheckout]);

  /* ------------------------------------------- detect server-side activation */
  useEffect(() => {
    // Only start watching once the provider has actually opened the Korapay
    // window: Korapay may confirm by webhook after the popup closes early.
    if (!user?.id || !checkoutStarted) return;
    let disposed = false;

    const refresh = async () => {
      const { data, error: queryError } = await supabase.rpc(
        "get_my_service_subscription",
      );
      if (queryError || disposed || !data) return;
      const record = data as {
        payment_method_type?: string | null;
        payment_method_last4?: string | null;
        plan_name?: string | null;
        price_ngn?: number | null;
        next_billing_at?: string | null;
      };
      if (record.payment_method_type !== "kora_saved_card") return;
      setSetup((current) => {
        if (current) return current;
        setStep(6);
        return {
          status: "card_saved",
          setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
          plan_name: record.plan_name || undefined,
          plan_amount_ngn: Number(record.price_ngn) || undefined,
          next_charge_at: record.next_billing_at || null,
          payment_method_last4: record.payment_method_last4 || null,
          existing_subscription: true,
          card_updated: updatePaymentMethod,
        };
      });
    };

    void refresh();
    const timer = window.setInterval(refresh, 6000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [user?.id, updatePaymentMethod, checkoutStarted]);

  /* ---------------------------------------------------------------- derived */
  const planName =
    planDetails?.name || fallbackPlan?.name || "Service Provider Subscription";
  const planPrice = planDetails?.price ?? fallbackPlan?.price ?? 0;
  const billingPeriodDays = planDetails?.durationDays ?? 30;
  const billingFrequency =
    billingPeriodDays === 30 ? "monthly" : `every ${billingPeriodDays} days`;
  const planFeatures = fallbackPlan?.features ?? [];
  const paymentRoute = `/payment?plan=${encodeURIComponent(planKey)}${
    updatePaymentMethod ? "&update_method=1" : ""
  }`;
  const loginRoute = `/login?redirect=${encodeURIComponent(paymentRoute)}`;
  const showWizard = Boolean(fallbackPlan) || planLoading || Boolean(planDetails);

  /* --------------------------------------------------------------- handlers */
  const handleNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    setCard((current) => ({ ...current, number: groupCardNumber(digits) }));
    setFieldErrors((current) => ({ ...current, number: undefined }));
  };

  const handleNameChange = (value: string) => {
    setCard((current) => ({ ...current, name: value.slice(0, 80) }));
    setFieldErrors((current) => ({ ...current, name: undefined }));
  };

  const handleExpiryChange = (value: string) => {
    setCard((current) => ({ ...current, expiry: formatExpiryInput(value) }));
    setFieldErrors((current) => ({ ...current, expiry: undefined }));
  };

  const handleCvvChange = (value: string) => {
    setCard((current) => ({
      ...current,
      cvv: value.replace(/\D/g, "").slice(0, 4),
    }));
    setFieldErrors((current) => ({ ...current, cvv: undefined }));
  };

  const goBack = () => {
    setError("");
    if (setup) {
      navigate("/manage-subscription");
      return;
    }
    if (step === 3) {
      navigate(updatePaymentMethod ? "/manage-subscription" : "/pricing#services");
      return;
    }
    if (step === 4 && updatePaymentMethod) {
      navigate("/manage-subscription");
      return;
    }
    setStep((current) => (current - 1) as Step);
  };

  const continueToPaymentMethod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStep(4);
  };

  const continueToReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateCard(card);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Check your card details before continuing.");
      return;
    }
    setError("");
    // The security code is never transmitted by JobBridge — Korapay collects
    // the card itself — so drop it from memory as soon as it has been checked.
    setCard((current) => ({ ...current, cvv: "" }));
    setStep(5);
  };

  const finishCardSetup = useCallback(
    async (reference: string, token: string) => {
      setVerifying(true);
      setError("");
      const result = await invokeSubscriptionFunction<CardSetupResponse>(
        "start-service-card-subscription",
        { action: "complete", reference, card_token: token || undefined },
        "Korapay confirmed the checkout, but JobBridge could not finish the subscription.",
      );
      setVerifying(false);

      if (result.data?.status === "card_saved") {
        setSetup(result.data);
        setError("");
        setStep(6);
        return;
      }

      const message =
        result.data?.error ||
        result.message ||
        "Korapay confirmed the checkout, but JobBridge could not finish the subscription.";
      console.error("[ServiceSubscriptionSetup] card setup completion failed:", message);
      setError(`${message} Keep this page open and retry the check — do not pay again.`);
    },
    [],
  );

  const waitForCardToken = async (): Promise<string> => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      if (cardTokenRef.current) return cardTokenRef.current;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return "";
  };

  const startCardCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || verifying) return;

    if (!user?.id || !isAuthenticated) {
      navigate(loginRoute);
      return;
    }
    if (!consented) {
      setError(
        "Tick the authorization box so we can charge the ₦100 card setup fee and the scheduled plan payments.",
      );
      return;
    }

    const publicKey = getKoraPublicKey();
    if (!publicKey) {
      setError("Card payments are not configured yet. Please contact support.");
      return;
    }

    setSubmitting(true);
    setError("");

    const initResult = await invokeSubscriptionFunction<CardSetupResponse>(
      "start-service-card-subscription",
      {
        action: "initialize",
        plan_key: planKey,
        replace_existing: updatePaymentMethod,
        consented: true,
        consent_version: CARD_SETUP_CONSENT_VERSION,
      },
      "Could not start the secure card checkout.",
    );

    if (initResult.data?.status === "already_completed") {
      setSubmitting(false);
      setSetup({
        status: "card_saved",
        setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
        plan_amount_ngn: planPrice,
        next_charge_at: initResult.data.next_charge_at || null,
        billing_period_days: billingPeriodDays,
        plan_name: planName,
        existing_subscription: true,
        card_updated: initResult.data.card_updated,
      });
      setStep(6);
      return;
    }

    const reference = initResult.data?.reference;
    if (!initResult.data || initResult.message || !reference) {
      setSubmitting(false);
      const message =
        initResult.data?.error ||
        initResult.message ||
        "Could not start the secure card checkout. Please try again.";
      console.error("[ServiceSubscriptionSetup] checkout init failed:", message);
      setError(message);
      return;
    }

    const ready = await prepareKoraCheckout();
    if (!ready || !window.Korapay) {
      setSubmitting(false);
      setError(
        "The secure card window could not load. Check your internet connection and tap “Pay ₦100 & save card” again.",
      );
      return;
    }

    paymentReferenceRef.current = reference;
    cardTokenRef.current = "";
    setCheckoutStarted(true);

    const functionsUrl = getSupabaseFunctionsUrl();
    const holderName =
      card.name.trim() ||
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      "JobBridge Provider";

    const checkout: KoraPayConfig = {
      key: publicKey,
      reference,
      amount: CARD_SETUP_AMOUNT_NGN,
      currency: "NGN",
      customer: { name: holderName, email: user.email || "" },
      narration: `JobBridge ${planName} card setup`,
      channels: ["card"],
      default_channel: "card",
      notification_url: functionsUrl ? `${functionsUrl}/kora-webhook` : undefined,
      metadata: {
        source: "service_card_setup",
        plan: databasePlanKey(planKey) || planKey,
        user_id: user.id,
        card_brand: brandLabel(cardBrand),
        card_last4: cardDigits.slice(-4),
      },
      onTokenized: (tokenData) => {
        cardTokenRef.current =
          tokenData?.token || tokenData?.card?.token || tokenData?.card_token || "";
      },
      onSuccess: async (paymentData) => {
        const token =
          paymentData?.token ||
          paymentData?.card?.token ||
          paymentData?.card_token ||
          (await waitForCardToken());
        if (token) cardTokenRef.current = token;
        await finishCardSetup(reference, token);
      },
      onFailed: (paymentData) => {
        setSubmitting(false);
        paymentReferenceRef.current = "";
        setError(
          `Korapay could not complete the ₦100 card payment, so no subscription was started. Reference: ${
            paymentData?.reference || reference
          }`,
        );
      },
      onPending: () => {
        setSubmitting(false);
        setError(
          `Korapay is still confirming the ₦100 payment. Wait for its status to settle before retrying. Reference: ${reference}`,
        );
      },
      onClose: () => {
        setSubmitting(false);
      },
    };

    try {
      window.Korapay.initialize(checkout);
    } catch (checkoutError) {
      console.error("[ServiceSubscriptionSetup] Korapay checkout failed to open:", checkoutError);
      setError("The secure card window could not open. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const retryVerification = async () => {
    if (!paymentReferenceRef.current) return;
    await finishCardSetup(paymentReferenceRef.current, cardTokenRef.current);
  };

  /* ------------------------------------------------------------ step views */
  const planStep = (
    <div className="p-5 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        Step 1 of 3
      </p>
      <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
        Start your provider subscription
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Save a card once and your JobBridge provider plan keeps running
        automatically. You stay visible to clients without renewing manually.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800">
              {fallbackPlan?.badge || "Provider plan"}
            </span>
            <p className="mt-2 truncate text-lg font-bold text-slate-950">{planName}</p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="text-base font-semibold text-slate-900">
                {formatNaira(planPrice)}
              </span>{" "}
              / {billingFrequency}
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <CreditCard className="h-5 w-5" />
          </span>
        </div>

        {planFeatures.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-200/80 pt-4 text-sm text-slate-700">
            {planFeatures.slice(0, 4).map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="leading-5">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 space-y-2.5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-5 text-blue-950">
        <p className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <span>
            A one-time <strong>{formatNaira(CARD_SETUP_AMOUNT_NGN)}</strong> card
            setup charge is taken today to verify the card and store it safely
            with Korapay.
          </span>
        </p>
        <p className="flex gap-2">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <span>
            Your plan charge of {formatNaira(planPrice)} starts on its billing
            schedule, then renews {billingFrequency}. Cancel any time before a
            charge is submitted.
          </span>
        </p>
      </div>

      {planLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the latest plan price…
        </p>
      )}

      {planLoadError && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {planLoadError}
        </p>
      )}

      <form onSubmit={continueToPaymentMethod} className="mt-5">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 active:scale-[0.99]"
        >
          Add card details
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-3 text-center text-xs leading-5 text-slate-500">
        You can review every charge before anything is paid.
      </p>
    </div>
  );

  const cardStep = (
    <div className="p-5 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        Step 2 of 3
      </p>
      <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
        {updatePaymentMethod ? "Add your replacement card" : "Add your card details"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Enter the card that should pay for {planName}. It is stored by Korapay and
        reused for every renewal — no re-entering next month.
      </p>

      <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950 p-5 text-white shadow-xl shadow-slate-900/25">
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <span className="grid h-9 w-7 place-items-center rounded-md bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900">
            <CreditCard className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            {brandLabel(cardBrand)}
          </span>
        </div>
        <p className="relative mt-5 font-mono text-base tracking-[0.18em] text-white/95 sm:text-lg">
          {maskNumber(cardDigits)}
        </p>
        <div className="relative mt-4 flex items-end justify-between gap-3 text-[11px] uppercase tracking-wider text-white/70">
          <div className="min-w-0">
            <p className="text-[9px] text-white/50">Card holder</p>
            <p className="truncate text-xs font-semibold normal-case tracking-normal text-white">
              {card.name.trim() || "Your name"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/50">Expires</p>
            <p className="text-xs font-semibold text-white">
              {card.expiry || "MM/YY"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={continueToReview} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor="card-number" className="block text-sm font-semibold text-slate-800">
            Card number
          </label>
          <div className="relative mt-1.5">
            <input
              id="card-number"
              name="card-number"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4084 0840 8408 4081"
              value={card.number}
              onChange={(event) => handleNumberChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.number)}
              aria-describedby={fieldErrors.number ? "card-number-error" : undefined}
              className={`w-full rounded-xl border bg-white py-3 pl-11 pr-3 text-base tracking-wide text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                fieldErrors.number
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
              }`}
            />
            <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          </div>
          {fieldErrors.number && (
            <p id="card-number-error" className="mt-1.5 text-xs font-medium text-red-600">
              {fieldErrors.number}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="card-name" className="block text-sm font-semibold text-slate-800">
            Name on card
          </label>
          <input
            id="card-name"
            name="ccname"
            type="text"
            autoComplete="cc-name"
            placeholder="As printed on the card"
            value={card.name}
            onChange={(event) => handleNameChange(event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
              fieldErrors.name
                ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
            }`}
          />
          {fieldErrors.name && (
            <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="card-expiry" className="block text-sm font-semibold text-slate-800">
              Expiry date
            </label>
            <input
              id="card-expiry"
              name="card-expiry"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={card.expiry}
              onChange={(event) => handleExpiryChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.expiry)}
              className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                fieldErrors.expiry
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
              }`}
            />
            {fieldErrors.expiry && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.expiry}</p>
            )}
          </div>
          <div>
            <label htmlFor="card-cvv" className="block text-sm font-semibold text-slate-800">
              CVV
            </label>
            <input
              id="card-cvv"
              name="card-cvv"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={card.cvv}
              onChange={(event) => handleCvvChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.cvv)}
              className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                fieldErrors.cvv
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-300 focus:border-blue-600 focus:ring-blue-100"
              }`}
            />
            {fieldErrors.cvv && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.cvv}</p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs leading-5 text-emerald-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            Korapay tokenises this card in its PCI-DSS secure window before the{" "}
            {formatNaira(CARD_SETUP_AMOUNT_NGN)} charge. JobBridge never stores your
            full card number or security code.
          </span>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 active:scale-[0.99]"
          >
            Continue to review
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );

  const reviewStep = (
    <div className="p-5 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        Step 3 of 3
      </p>
      <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
        Review &amp; confirm
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Check the plan, the card and the charges below. Nothing is charged until
        you confirm in Korapay’s secure window.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950">{planName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {formatNaira(planPrice)} every {billingPeriodDays} days
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(4)}
            className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Change
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
            <CreditCard className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {brandLabel(cardBrand)} •••• {cardDigits.slice(-4) || "••••"}
            </p>
            <p className="truncate text-xs text-slate-500">
              Expires {card.expiry || "MM/YY"} · {card.name.trim() || "Your name"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          Edit
        </button>
      </div>

      <dl className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl bg-slate-50 text-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-slate-600">Card setup charge today</dt>
          <dd className="font-semibold text-slate-900">
            {formatNaira(CARD_SETUP_AMOUNT_NGN)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-slate-600">
            {updatePaymentMethod ? "Next plan payment" : "First plan payment"}
          </dt>
          <dd className="text-right font-semibold text-slate-900">
            {updatePaymentMethod
              ? `${formatNaira(planPrice)} on its existing schedule`
              : `${formatNaira(planPrice)} on the next billing run`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-slate-600">Billing frequency</dt>
          <dd className="font-semibold text-slate-900">{billingFrequency}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-slate-600">Automatic renewal</dt>
          <dd className="font-semibold text-emerald-700">On · cancel anytime</dd>
        </div>
      </dl>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm leading-5 text-slate-700 transition hover:border-slate-300">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
        />
        <span>
          {updatePaymentMethod
            ? `I authorise an immediate ${formatNaira(CARD_SETUP_AMOUNT_NGN)} Korapay charge to save my replacement card. My existing ${formatNaira(planPrice)} ${billingFrequency} renewal schedule stays unchanged.`
            : `I authorise an immediate ${formatNaira(CARD_SETUP_AMOUNT_NGN)} Korapay card setup charge, then ${formatNaira(planPrice)} for ${planName} on the billing schedule and automatic ${billingFrequency} renewals. I can cancel any time before a charge is submitted.`}
        </span>
      </label>

      {error && (
        <div className="mt-4">
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
          {paymentReferenceRef.current && (
            <button
              type="button"
              disabled={verifying || submitting}
              onClick={() => void retryVerification()}
              className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 disabled:opacity-50"
            >
              {verifying ? "Verifying payment…" : "Retry verification (no new charge)"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={startCardCheckout} className="mt-5">
        <button
          type="submit"
          disabled={submitting || verifying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opening secure checkout…
            </>
          ) : verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Confirming with Korapay…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Pay {formatNaira(CARD_SETUP_AMOUNT_NGN)} &amp; save card
            </>
          )}
        </button>
      </form>

      <p className="mt-3 text-center text-xs leading-5 text-slate-500">
        {koraLoading
          ? "Preparing Korapay’s secure card window…"
          : koraReady
            ? "Korapay’s secure window opens over this page to confirm your card."
            : "Tap the button again if the secure card window does not appear."}
      </p>
    </div>
  );

  const successStep = (
    <div className="px-5 py-9 text-center sm:px-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-9 w-9" />
      </span>
      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
        <Check className="h-3.5 w-3.5" /> Card saved
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {setup?.card_updated || updatePaymentMethod
          ? "Your payment method is updated"
          : "Your subscription is set up"}
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
        Korapay stored your card securely.{" "}
        {setup?.existing_subscription
          ? "Your next plan payment keeps its existing schedule."
          : "Your first plan payment is taken on the next billing run."}
      </p>

      <div className="mt-6 space-y-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-left text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-600">Plan</span>
          <span className="text-right font-semibold text-slate-900">
            {setup?.plan_name || planName}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-600">Plan amount</span>
          <span className="text-right font-semibold text-slate-900">
            {formatNaira(setup?.plan_amount_ngn ?? planPrice)} / {billingFrequency}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-600">Card setup charge paid</span>
          <span className="text-right font-semibold text-slate-900">
            {formatNaira(setup?.setup_charge_ngn ?? CARD_SETUP_AMOUNT_NGN)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-600">Next plan payment</span>
          <span className="text-right font-semibold text-slate-900">
            {formatChargeDate(setup?.next_charge_at)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-600">Card on file</span>
          <span className="text-right font-semibold text-slate-900">
            {setup?.payment_method_last4
              ? `•••• ${setup.payment_method_last4}`
              : `${brandLabel(cardBrand)} •••• ${cardDigits.slice(-4) || "••••"}`}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800"
        >
          Go to provider dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
        <Link
          to="/manage-subscription"
          className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Manage subscription
        </Link>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Renewals are attempted automatically. Update or remove this card any time
        from Manage Subscription.
      </p>
    </div>
  );

  const content =
    setup || step === 6
      ? successStep
      : step === 5
        ? reviewStep
        : step === 4
          ? cardStep
          : planStep;

  const stepTitle =
    content === successStep
      ? "Subscription set up"
      : content === reviewStep
        ? "Review & confirm"
        : content === cardStep
          ? "Add payment method"
          : "Start subscription";

  /* ---------------------------------------------------------------- guards */
  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f5f8ff] px-4 py-20">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
          <p className="text-sm font-medium text-slate-600">
            Preparing your secure subscription setup…
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f5f8ff] px-4 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-7 text-center shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)]">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">
            Sign in to add your card
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your card is saved against your JobBridge provider account, so please
            sign in before continuing.
          </p>
          <Link
            to={loginRoute}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800"
          >
            Sign in to continue
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing#services"
            className="mt-3 block text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Back to provider plans
          </Link>
        </div>
      </main>
    );
  }

  if (!showWizard) {
    return (
      <main className="min-h-screen bg-[#f5f8ff] px-4 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-7 text-center shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)]">
          <h1 className="text-xl font-bold tracking-tight text-slate-950">
            Plan not found
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {planLoadError || "This provider plan is not available right now."}
          </p>
          <Link
            to="/pricing#services"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
          >
            Return to provider plans
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }


  /* --------------------------------------------------------------- render */
  return (
    <main className="min-h-screen bg-[#f5f8ff] pb-14 pt-4 text-slate-900 sm:pt-7 lg:pb-20">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 lg:max-w-5xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
              JobBridge provider
            </p>
            <p className="truncate text-sm font-semibold text-slate-800">{stepTitle}</p>
          </div>
          {content !== successStep && (
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              Step {Math.min(Math.max(step - 2, 1), 3)} of 3
            </span>
          )}
        </div>

        {content !== successStep && (
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {[3, 4, 5].map((marker) => (
              <span
                key={marker}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  Math.min(step, 5) >= marker ? "bg-blue-700" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_312px] lg:items-start">
          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]">
            {content}
          </section>

          <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Your plan
              </p>
              <p className="mt-2 font-bold leading-tight text-slate-950">{planName}</p>
              <p className="mt-1 text-sm text-slate-600">
                {formatNaira(planPrice)} / {billingFrequency}
              </p>
              <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">
                <div className="flex items-center justify-between gap-3">
                  <span>Card setup</span>
                  <span className="font-semibold text-slate-800">
                    {formatNaira(CARD_SETUP_AMOUNT_NGN)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Renewals</span>
                  <span className="font-semibold text-emerald-700">Automatic</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Safe by design
              </p>
              <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Korapay tokenises your card. JobBridge keeps only the brand and the
                    last four digits.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <span>
                    Card details are entered inside Korapay’s PCI-DSS secure window, never
                    on JobBridge servers.
                  </span>
                </li>
                <li className="flex gap-2">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>
                    Cancel before a charge is submitted and nothing further is taken.
                  </span>
                </li>
              </ul>
            </div>

            <Link
              to="/manage-subscription"
              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Manage my subscription
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </aside>
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
          Secured by Korapay · No charge without your confirmation
        </p>
      </div>
    </main>
  );
};
