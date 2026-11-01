import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  getFunctionInvokeErrorMessage,
  getSupabaseFunctionsUrl,
} from "../lib/supabaseHelpers";
import {
  getKoraPublicKey,
  loadKoraScript,
  SERVICE_PROVIDER_PLANS,
  type KoraPayConfig,
} from "../lib/trial";

const SERVICE_PLAN_KEYS: Record<string, string> = {
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  svc_basic: "svc_basic",
  svc_verified: "svc_verified",
  svc_featured: "svc_featured",
};
const CARD_SETUP_AMOUNT_NGN = 100;
const CARD_SETUP_CONSENT_VERSION = "service-card-v1";

function databasePlanKey(planKey: string): string | null {
  return SERVICE_PLAN_KEYS[planKey] ||
    (/^svc_[a-z0-9_]{1,40}$/.test(planKey) ? planKey : null);
}

type SetupResponse = {
  status: "card_saved";
  setup_charge_ngn: number;
  plan_name?: string;
  plan_amount_ngn: number;
  next_charge_at: string;
  billing_period_days: number;
  payment_method_last4?: string | null;
  existing_subscription?: boolean;
  card_updated?: boolean;
};

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ServiceSubscriptionSetup({ planKey }: { planKey: string }) {
  const { user, profile, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const updatePaymentMethod =
    new URLSearchParams(location.search).get("update_method") === "1";
  const plan = SERVICE_PROVIDER_PLANS[planKey] || (
    /^svc_[a-z0-9_]{1,40}$/.test(planKey)
      ? {
          id: planKey,
          name: "Service Provider Subscription",
          price: 0,
          monthlyPriceFormatted: "",
          duration: "Monthly",
          features: [],
        }
      : undefined
  );
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [koraReady, setKoraReady] = useState(false);
  const [step, setStep] = useState<3 | 4 | 5 | 6>(3);
  const [error, setError] = useState("");
  const [planDetails, setPlanDetails] = useState<{ name: string; price: number; durationDays: number } | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadError, setPlanLoadError] = useState("");
  const cardTokenRef = useRef("");
  const paymentReferenceRef = useRef("");

  useEffect(() => {
    let active = true;
    void loadKoraScript().then((ready) => {
      if (active) {
        setKoraReady(ready);
        if (!ready) setError("Korapay could not be loaded. Check your connection and try again.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const selectedDatabasePlanKey = databasePlanKey(planKey);
    if (!selectedDatabasePlanKey) {
      setPlanLoadError("This provider plan is not available.");
      setPlanLoading(false);
      return;
    }
    const loadPlan = async () => {
      setPlanLoading(true);
      setPlanLoadError("");
      const { data, error: queryError } = await supabase
        .from("plans")
        .select("name, base_price_ngn, duration_days")
        .eq("key", selectedDatabasePlanKey)
        .eq("product_line", "service")
        .eq("is_active", true)
        .maybeSingle();
      if (!active) return;
      if (queryError || !data) {
        console.error("[ServiceSubscriptionSetup] plan could not be loaded:", queryError?.message || "Plan is inactive.");
        setPlanLoadError("The current plan price could not be confirmed. Refresh the page or contact support.");
        setPlanDetails(null);
      } else {
        setPlanDetails({
          name: data.name,
          price: Number(data.base_price_ngn),
          durationDays: Number(data.duration_days),
        });
      }
      setPlanLoading(false);
    };
    void loadPlan();
    return () => { active = false; };
  }, [planKey]);

  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    const refresh = async () => {
      const { data, error: queryError } = await supabase.rpc(
        "get_my_service_subscription",
      );
      if (queryError) {
        console.error("[ServiceSubscriptionSetup] subscription refresh failed:", queryError.message);
        return;
      }
      if (!disposed && data) {
        if (
          data.payment_method_type === "kora_saved_card" &&
          data.auto_renew &&
          data.next_billing_at &&
          !updatePaymentMethod
        ) {
          setSetup({
            status: "card_saved",
            setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
            plan_name: data.plan_name,
            plan_amount_ngn: Number(data.price_ngn || 0),
            next_charge_at: data.next_billing_at,
            billing_period_days: Number(data.billing_period_days || 30),
            payment_method_last4: data.payment_method_last4,
            existing_subscription: true,
          });
          setAuthorized(true);
          setStep(6);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [user?.id, updatePaymentMethod]);

  if (!plan) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Plan not found</h1>
          <Link className="mt-4 inline-block text-blue-700" to="/pricing#services">
            Return to provider plans
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  const planName = planDetails?.name || plan.name;
  const planPrice = planDetails?.price ?? plan.price;
  const billingFrequency = planDetails?.durationDays === 30
    ? "monthly"
    : `every ${planDetails?.durationDays ?? 30} days`;
  const paymentRoute = `/payment?plan=${encodeURIComponent(planKey)}${updatePaymentMethod ? "&update_method=1" : ""}`;

  const continueToPaymentMethod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStep(4);
  };

  const continueToReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStep(5);
  };

  const finishCardSetup = async (reference: string, token: string) => {
    setSubmitting(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke<SetupResponse & { error?: string }>(
      "start-service-card-subscription",
      {
        body: {
          action: "complete",
          reference,
          card_token: token || undefined,
        },
      },
    );
    setSubmitting(false);
    if (invokeError || data?.error || data?.status !== "card_saved") {
      const message = data?.error || await getFunctionInvokeErrorMessage(
        invokeError,
        "Korapay confirmed checkout, but JobBridge could not finish setting up the subscription.",
      );
      console.error("[ServiceSubscriptionSetup] card setup completion failed:", message);
      setError(`${message} Keep this page open and retry verification; do not pay again.`);
      return;
    }
    setSetup(data);
    setAuthorized(true);
    setStep(6);
  };

  const waitForCardToken = async (): Promise<string> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (cardTokenRef.current) return cardTokenRef.current;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || profile?.role !== "provider") {
      navigate(`/login?redirect=${encodeURIComponent(paymentRoute)}`);
      return;
    }
    if (!consented) {
      setError("Consent to the ₦100 card setup charge and scheduled subscription charges to continue.");
      return;
    }
    const publicKey = getKoraPublicKey();
    if (!publicKey) {
      setError("Korapay is not configured. Please contact support.");
      return;
    }
    if (!window.Korapay) {
      setError("Loading Korapay's secure checkout. Please try again in a moment.");
      setKoraReady(false);
      return;
    }

    setSubmitting(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke<{
      status?: string;
      reference?: string;
      error?: string;
      next_charge_at?: string;
      card_updated?: boolean;
    }>(
      "start-service-card-subscription",
      {
        body: {
          action: "initialize",
          plan_key: planKey,
          replace_existing: updatePaymentMethod,
          consented: true,
          consent_version: CARD_SETUP_CONSENT_VERSION,
        },
      },
    );
    if (invokeError || data?.error) {
      setSubmitting(false);
      const message = data?.error || await getFunctionInvokeErrorMessage(
        invokeError,
        "Could not start the secure card checkout.",
      );
      console.error("[ServiceSubscriptionSetup] card checkout initialization failed:", message);
      setError(message);
      return;
    }
    if (data?.status === "already_completed" && data.next_charge_at) {
      setSubmitting(false);
      setSetup({
        status: "card_saved",
        setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
        plan_amount_ngn: planPrice,
        next_charge_at: data.next_charge_at,
        billing_period_days: planDetails?.durationDays || 30,
        plan_name: planName,
        existing_subscription: true,
        card_updated: data.card_updated,
      });
      setAuthorized(true);
      setStep(6);
      return;
    }
    if (!data?.reference) {
      setSubmitting(false);
      setError("Korapay did not return a checkout reference. Please try again.");
      return;
    }

    const reference = data.reference;
    paymentReferenceRef.current = reference;
    cardTokenRef.current = "";
    const functionsUrl = getSupabaseFunctionsUrl();
    const checkout: KoraPayConfig = {
      key: publicKey,
      reference,
      amount: CARD_SETUP_AMOUNT_NGN,
      currency: "NGN",
      customer: {
        name: profile?.full_name || user.user_metadata?.full_name || user.email || "JobBridge Provider",
        email: user.email || "",
      },
      narration: "JobBridge provider card setup",
      channels: ["card"],
      default_channel: "card",
      notification_url: functionsUrl ? `${functionsUrl}/kora-webhook` : undefined,
      metadata: {
        source: "service_card_setup",
        plan: databasePlanKey(planKey) || planKey,
        user_id: user.id,
      },
      onTokenized: (tokenData) => {
        cardTokenRef.current =
          tokenData?.token || tokenData?.card?.token || tokenData?.card_token || "";
      },
      onSuccess: async (paymentData) => {
        const token = paymentData?.token ||
          paymentData?.card?.token ||
          paymentData?.card_token ||
          await waitForCardToken();
        if (token) cardTokenRef.current = token;
        await finishCardSetup(reference, token);
      },
      onFailed: (paymentData) => {
        setSubmitting(false);
        paymentReferenceRef.current = "";
        setError(
          `Korapay could not complete the ₦100 card payment. No provider subscription was started. Reference: ${paymentData?.reference || reference}`,
        );
      },
      onPending: () => {
        setSubmitting(false);
        setError(
          `Korapay is still confirming the ₦100 payment. Do not retry checkout until its status is confirmed. Reference: ${reference}`,
        );
      },
      onClose: () => setSubmitting(false),
    };
    try {
      window.Korapay.initialize(checkout);
      setSubmitting(false);
    } catch (checkoutError) {
      console.error("[ServiceSubscriptionSetup] Korapay checkout failed to open:", checkoutError);
      setSubmitting(false);
      setError("Korapay checkout could not be opened. Please try again.");
    }
  };

  const goToDashboard = () => navigate("/profile");

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 pb-10 pt-5 text-slate-900 sm:pt-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          {step !== 6 && (
            <button
              type="button"
              onClick={() => setup
                ? navigate("/manage-subscription")
                : step === 3
                  ? navigate(updatePaymentMethod ? "/manage-subscription" : "/pricing#services")
                  : setStep((step - 1) as 3 | 4 | 5)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label={step === 3 ? "Back to subscription plans" : "Go back"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">JobBridge provider subscription</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {step === 3 ? "Start Subscription" : step === 4 ? "Add Payment Method" : step === 5 ? "Review & Confirm" : "Subscription Set Up"}
            </p>
          </div>
          {step !== 6 && (
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Step {step - 2} of 3
            </span>
          )}
        </div>

        <div className="mt-5 flex gap-2" aria-label="Subscription setup progress">
          {[3, 4, 5].map((item) => (
            <div key={item} className={`h-1.5 flex-1 rounded-full ${step >= item ? "bg-blue-600" : "bg-slate-200"}`} />
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] sm:mt-8">
          {authorized || step === 6 ? (
            <div className="px-6 py-10 text-center sm:px-9">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-9 w-9" />
              </span>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                <Check className="h-3.5 w-3.5" /> Card saved
              </p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Your subscription is set up</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                Your card is saved securely with Korapay. {setup?.existing_subscription ? "Your next scheduled plan payment is shown below." : "The first plan payment will be initiated on the first hourly billing run at or after the scheduled time."}
              </p>
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left">
                <p className="text-sm font-semibold text-slate-900">{setup?.plan_name || planName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {setup?.existing_subscription
                    ? `${setup.card_updated ? "Card updated; ₦100 setup charge paid. " : ""}Next plan payment: ₦${(setup.plan_amount_ngn || planPrice).toLocaleString("en-NG")} on ${setup.next_charge_at ? formatDate(setup.next_charge_at) : "the scheduled billing date"}`
                    : `₦${setup?.setup_charge_ngn ?? CARD_SETUP_AMOUNT_NGN} card setup charge paid · ₦${(setup?.plan_amount_ngn ?? planPrice).toLocaleString("en-NG")} first plan payment due ${setup?.next_charge_at ? formatDate(setup.next_charge_at) : "in 48 hours"}`}
                </p>
              </div>
              <button type="button" onClick={goToDashboard} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800">
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
              <Link to="/manage-subscription" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900">
                Manage subscription
              </Link>
            </div>
          ) : !isAuthenticated ? (
            <div className="px-6 py-10 text-center sm:px-9">
              <h1 className="text-2xl font-bold">Sign in to continue</h1>
              <p className="mt-2 text-sm text-slate-600">Your provider account and profile are required to set up a subscription.</p>
              <Link to={`/login?redirect=${encodeURIComponent(paymentRoute)}`} className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Sign in</Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Loading your provider profile…</div>
          ) : profile?.role !== "provider" ? (
            <div className="px-6 py-10 text-center sm:px-9">
              <h1 className="text-2xl font-bold">Provider account required</h1>
              <p className="mt-2 text-sm text-slate-600">Create a service-provider profile before setting up this plan.</p>
              <Link to="/signup" className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Create provider profile</Link>
            </div>
          ) : (
            <div className="p-5 sm:p-8">
              {step === 3 && (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">
                    <CreditCard className="h-4 w-4" /> Provider subscription
                  </div>
                  <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{updatePaymentMethod ? "Update your card" : "Set up your provider plan"}</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Add a card through Korapay’s secure checkout. Your card details are never entered into or stored by JobBridge.</p>
                  <h2 className="mt-7 text-sm font-bold text-slate-900">What&apos;s included:</h2>
                  <ul className="mt-3 space-y-3">
                    {["Full access to your selected provider plan", "Create and manage your services", "Get customer bookings", "Cancel automatic renewal anytime"].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-5 text-blue-950">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                    <p>{updatePaymentMethod
                      ? "Korapay charges ₦100 immediately to save the replacement card. Your existing plan billing schedule remains unchanged."
                      : `Korapay charges ₦100 immediately to create the reusable card token. The selected plan price is scheduled for 48 hours later; billing is initiated on the first hourly billing run at or after that time. The plan then renews every ${planDetails?.durationDays ?? 30} days unless you cancel.`}</p>
                  </div>
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected plan</p>
                    <p className="mt-1 font-semibold text-slate-950">{planName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {updatePaymentMethod
                        ? `₦${planPrice.toLocaleString("en-NG")} every ${planDetails?.durationDays ?? 30} days`
                        : `₦${planPrice.toLocaleString("en-NG")} every ${planDetails?.durationDays ?? 30} days after the initial 48-hour period`}
                    </p>
                  </div>
                  {planLoadError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{planLoadError}</p>}
                  <form onSubmit={continueToPaymentMethod}>
                    <button type="submit" disabled={planLoading || Boolean(planLoadError) || !planDetails} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {planLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CreditCard className="h-5 w-5" /></span>
                    <div>
                      <h1 className="text-xl font-bold text-slate-950">Use a card</h1>
                      <p className="mt-1 text-sm text-slate-600">Card details are collected by Korapay</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-5 text-blue-950">
                    You’ll enter your card details only inside Korapay’s hosted checkout. JobBridge stores the reusable Korapay token and, when provided, the card’s last four digits — never the full card number or security code.
                  </div>
                  <form onSubmit={continueToReview} className="mt-6 space-y-4">
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <p>Korapay checkout will open after you review the charges. Only card payments are enabled for this setup.</p>
                    </div>
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800">
                      Review charges <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}

              {step === 5 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Final review</p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Review &amp; Confirm</h1>
                  <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-950">{planName}</p>
                        <p className="mt-1 text-sm text-slate-600">₦{planPrice.toLocaleString("en-NG")} every {planDetails?.durationDays ?? 30} days</p>
                      </div>
                      <button type="button" onClick={() => setStep(4)} className="text-sm font-semibold text-blue-700">Change</button>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-600">Card setup charge today</dt><dd className="font-semibold text-slate-900">₦{CARD_SETUP_AMOUNT_NGN}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-600">{updatePaymentMethod ? "Next plan payment" : "First plan payment"}</dt><dd className="font-semibold text-slate-900">
                      {updatePaymentMethod
                        ? `₦${planPrice.toLocaleString("en-NG")} on its existing schedule`
                        : `₦${planPrice.toLocaleString("en-NG")} in 48 hours`}
                    </dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-600">Billing frequency after first charge</dt><dd className="font-semibold text-slate-900">{billingFrequency}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-600">Automatic renewal</dt><dd className="font-semibold text-emerald-700">On · cancel anytime</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {updatePaymentMethod
                      ? "Updating the card will not change your current plan, billing date, or renewal schedule."
                      : "The scheduled plan charge is initiated on the first hourly billing run at or after 48 hours from successful card setup. It then renews according to the plan billing period."}
                  </p>
                  <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm leading-5 text-slate-700">
                    <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600" />
                    <span>{updatePaymentMethod
                      ? `I authorize an immediate ₦100 Korapay charge to save my replacement card. My existing ₦${planPrice.toLocaleString("en-NG")} ${billingFrequency} renewal schedule will not change.`
                      : `I authorize an immediate ₦100 Korapay card setup charge, then a ₦${planPrice.toLocaleString("en-NG")} plan charge initiated at or after 48 hours, followed by automatic ${billingFrequency} renewals for ${planName}. I understand I can cancel renewal before a charge is submitted.`}</span>
                  </label>
                  {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  {error && paymentReferenceRef.current && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void finishCardSetup(paymentReferenceRef.current, cardTokenRef.current)}
                      className="mt-3 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-800 disabled:opacity-50"
                    >
                      {submitting ? "Verifying payment…" : "Retry verification (no new charge)"}
                    </button>
                  )}
                  <form onSubmit={handleSubmit}>
                    <button type="submit" disabled={submitting || planLoading || Boolean(planLoadError) || !planDetails || !consented || !koraReady} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout…</> : !koraReady ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading secure checkout…</> : <><ShieldCheck className="h-4 w-4" /> Pay ₦100 &amp; Save Card</>}
                    </button>
                  </form>
                  {planLoadError && <p role="alert" className="mt-3 text-sm text-red-700">{planLoadError}</p>}
                  <p className="mt-4 text-center text-xs leading-5 text-slate-500">Korapay securely collects your card details. JobBridge does not store your full card number or security code.</p>
                </>
              )}
            </div>
          )}
        </section>

        {step !== 6 && !setup && (
          <p className="mt-5 text-center text-xs text-slate-500">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Secure card checkout powered by Korapay
          </p>
        )}
      </div>
    </main>
  );
}
