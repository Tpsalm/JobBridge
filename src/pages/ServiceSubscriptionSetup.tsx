import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getFunctionInvokeErrorMessage } from "../lib/supabaseHelpers";
import { SERVICE_PROVIDER_PLANS } from "../lib/trial";

export const KORAPAY_DIRECT_DEBIT_DOCS_URL =
  "https://developers.korapay.com/docs/overview-1";

export const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Globus Bank", code: "103" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Lotus Bank", code: "303" },
  { name: "Moniepoint Microfinance Bank", code: "50515" },
  { name: "Nova Merchant Bank", code: "637" },
  { name: "OPay Digital Services", code: "999992" },
  { name: "Optimus Bank", code: "000036" },
  { name: "Palmpay", code: "999991" },
  { name: "Parallex Bank", code: "526" },
  { name: "Polaris Bank", code: "076" },
  { name: "Premium Trust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "TajBank", code: "302" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

const SERVICE_PLAN_KEYS: Record<string, string> = {
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  svc_basic: "svc_basic",
  svc_verified: "svc_verified",
  svc_featured: "svc_featured",
};

function databasePlanKey(planKey: string): string | null {
  return SERVICE_PLAN_KEYS[planKey] ||
    (/^svc_[a-z0-9_]{1,40}$/.test(planKey) ? planKey : null);
}

type SetupResponse = {
  status: "authorization_pending";
  authorization_reference: string;
  activation_instructions: string;
  trial_days?: number;
  first_charge_at?: string;
  plan_name?: string;
  token_payment?: {
    amount_ngn?: number;
    account_number?: string;
    account_name?: string;
    bank_name?: string;
  };
  monthly_amount_ngn: number;
  mandate_expires_at: string;
};

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeNigeriaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("234") && digits.length === 13
    ? `0${digits.slice(3)}`
    : digits;
}

export default function ServiceSubscriptionSetup({ planKey }: { planKey: string }) {
  const { user, profile } = useAuth();
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

  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [consented, setConsented] = useState(false);
  const [acknowledgedTokenPayment, setAcknowledgedTokenPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [step, setStep] = useState<3 | 4 | 5 | 6>(3);
  const [error, setError] = useState("");
  const [planDetails, setPlanDetails] = useState<{
    name: string;
    price: number;
    durationDays: number;
  } | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadError, setPlanLoadError] = useState("");
  const [checkingActivation, setCheckingActivation] = useState(false);

  const selectedBank = useMemo(
    () => NIGERIAN_BANKS.find((bank) => bank.code === bankCode),
    [bankCode],
  );

  useEffect(() => {
    if (profile?.phone) setPhone(profile.phone);
  }, [profile?.phone]);

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
        console.error(
          "[ServiceSubscriptionSetup] plan could not be loaded:",
          queryError?.message || "Plan is inactive.",
        );
        setPlanLoadError(
          "The current plan price could not be confirmed. Refresh the page or contact support.",
        );
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
    return () => {
      active = false;
    };
  }, [planKey]);

  // Live polling: checks if Kora webhook has activated the mandate
  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    const refresh = async () => {
      const { data, error: queryError } = await supabase.rpc(
        "get_my_service_subscription",
      );
      if (queryError) {
        console.error(
          "[ServiceSubscriptionSetup] subscription refresh failed:",
          queryError.message,
        );
        return;
      }
      if (!disposed && data) {
        if (
          data.payment_method_type === "kora_direct_debit" &&
          (data.trial_start_at || data.status === "active") &&
          !updatePaymentMethod
        ) {
          setAuthorized(true);
          setStep(6);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [user?.id, updatePaymentMethod]);

  const checkStatusNow = async () => {
    if (!user?.id) return;
    setCheckingActivation(true);
    try {
      const { data, error: queryError } = await supabase.rpc(
        "get_my_service_subscription",
      );
      if (queryError) {
        setError("Could not check authorization status. Please try again.");
      } else if (
        data &&
        data.payment_method_type === "kora_direct_debit" &&
        (data.trial_start_at || data.status === "active")
      ) {
        setAuthorized(true);
        setStep(6);
      } else {
        setError(
          "Authorization is still pending approval from your bank via NIBSS. Complete the ₦50 token verification payment to activate.",
        );
      }
    } finally {
      setCheckingActivation(false);
    }
  };

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

  const normalizedPhone = normalizeNigeriaPhone(phone);
  const trialEndEstimate = new Date(Date.now() + 21 * 86400000);
  const planName = planDetails?.name || plan.name;
  const planPrice = planDetails?.price ?? plan.price;
  const billingFrequency =
    planDetails?.durationDays === 30
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
    if (!selectedBank || accountNumber.replace(/\D/g, "").length !== 10) {
      setError("Enter a 10-digit bank account number and select a supported bank.");
      return;
    }
    if (!/^0\d{10}$/.test(normalizedPhone)) {
      setError("Your profile must have a valid Nigerian phone number before you continue.");
      return;
    }
    setError("");
    setStep(5);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || profile?.role !== "provider") {
      navigate(`/login?redirect=${encodeURIComponent(paymentRoute)}`);
      return;
    }
    if (!selectedBank || accountNumber.replace(/\D/g, "").length !== 10) {
      setError("Enter a 10-digit bank account number and select a supported bank.");
      return;
    }
    if (!acknowledgedTokenPayment) {
      setError("Please acknowledge the ₦50 NIBSS token verification payment required by Korapay policy.");
      return;
    }
    if (!consented) {
      setError("Please provide explicit consent for recurring Direct Debit subscription payments.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { data, error: invokeError } = await supabase.functions.invoke<
      SetupResponse & { error?: string }
    >("start-service-subscription", {
      body: {
        plan_key: planKey,
        account_number: accountNumber.replace(/\D/g, ""),
        bank_code: selectedBank.code,
        bank_name: selectedBank.name,
        phone: normalizedPhone,
        consented: true,
        consent_version: "service-subscription-v1",
        token_payment_acknowledged: true,
        replace_existing: updatePaymentMethod,
      },
    });

    setSubmitting(false);

    if (invokeError || data?.error || data?.status !== "authorization_pending") {
      const message =
        data?.error ||
        (await getFunctionInvokeErrorMessage(
          invokeError,
          "Korapay could not initiate your Direct Debit authorization. Check your account details and try again.",
        ));
      console.error("[ServiceSubscriptionSetup] Direct Debit initiation failed:", message);
      setError(message);
      return;
    }

    setSetup(data);
    setStep(6);
  };

  const goToDashboard = () => navigate("/profile");

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 pb-12 pt-5 text-slate-900 sm:pt-10">
      <div className="mx-auto max-w-xl">
        {/* Navigation & Step Indicator */}
        <div className="flex items-center gap-3">
          {step !== 6 && (
            <button
              type="button"
              onClick={() =>
                setup
                  ? navigate("/manage-subscription")
                  : step === 3
                  ? navigate(updatePaymentMethod ? "/manage-subscription" : "/pricing#services")
                  : setStep((step - 1) as 3 | 4 | 5)
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label={step === 3 ? "Back to subscription plans" : "Go back"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              JobBridge Service Provider Subscription
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {updatePaymentMethod
                ? "Update Direct Debit Bank Mandate"
                : step === 3
                ? "Plan & Trial Terms"
                : step === 4
                ? "Bank Account Details"
                : step === 5
                ? "Review & Authorize Mandate"
                : "Mandate Created"}
            </p>
          </div>
          {step !== 6 && (
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Step {step - 2} of 3
            </span>
          )}
        </div>

        {/* Step Progress Bar */}
        {step !== 6 && (
          <div className="mt-5 flex gap-2" aria-label="Subscription setup progress">
            {[3, 4, 5].map((item) => (
              <div
                key={item}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step >= item ? "bg-blue-600" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* Korapay Policy & Documentation Notice Card */}
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs leading-5 text-blue-950">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div className="flex-1">
              <span className="font-semibold text-blue-900">
                Korapay Direct Debit Policy Standard:
              </span>{" "}
              This subscription uses Korapay&apos;s NIBSS Direct Debit mandate infrastructure for transparent, secure pull-payments.
              {" "}
              <a
                href={KORAPAY_DIRECT_DEBIT_DOCS_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-blue-700 underline hover:text-blue-900"
              >
                Read Korapay Documentation Standard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)]">
          {/* STEP 6: MANDATE CREATED / PENDING ACTIVATION */}
          {step === 6 && (
            <div className="px-6 py-10 text-center sm:px-9">
              {authorized ? (
                <>
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-9 w-9" />
                  </span>
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                    <Check className="h-3.5 w-3.5" /> Mandate Active
                  </p>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                    Your Subscription is Active
                  </h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                    Korapay has confirmed your Direct Debit mandate. Your 21-day free trial is running and your professional listing is active on JobBridge.
                  </p>
                  <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left text-sm">
                    <p className="font-semibold text-slate-900">{planName}</p>
                    <p className="mt-1 text-slate-600">
                      Recurring amount: ₦{planPrice.toLocaleString("en-NG")} / {billingFrequency}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToDashboard}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800"
                  >
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link
                    to="/manage-subscription"
                    className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Manage Subscription
                  </Link>
                </>
              ) : (
                <>
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Clock3 className="h-9 w-9" />
                  </span>
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Authorization Initiated
                  </p>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                    Complete Your Mandate Approval
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Your Direct Debit mandate was registered with Korapay under reference{" "}
                    <span className="font-mono font-semibold text-slate-900">
                      {setup?.authorization_reference || "NIBSS-MANDATE"}
                    </span>
                    . In accordance with Korapay policy, complete the one-time ₦50 NIBSS token verification payment online to activate.
                  </p>

                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left text-xs leading-5 text-amber-950">
                    <p className="font-bold uppercase tracking-wider text-amber-900">
                      Korapay Activation Instructions:
                    </p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                      <li>
                        Authorize the ₦50 NIBSS token verification payment via your bank’s USSD, mobile banking prompt, or authorization link.
                      </li>
                      <li>
                        Once approved by your bank, Korapay immediately marks the mandate as active and notifies JobBridge.
                      </li>
                      <li>
                        Your 21-day free trial begins upon confirmation. No plan fee will be debited until your trial ends.
                      </li>
                    </ol>
                  </div>

                  {error && (
                    <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={checkingActivation}
                      onClick={() => void checkStatusNow()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-60"
                    >
                      {checkingActivation ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Checking with Korapay…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" /> Check Activation Status
                        </>
                      )}
                    </button>
                    <Link
                      to="/manage-subscription"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Go to Manage Subscription
                    </Link>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    We automatically check for activation every few seconds. You can safely leave this page anytime.
                  </p>
                </>
              )}
            </div>
          )}

          {/* STEP 3: PLAN & TRIAL TERMS */}
          {step === 3 && (
            <div className="p-6 sm:p-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-800">
                  Provider Plan
                </span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">{planName}</h2>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-950">
                    ₦{planPrice.toLocaleString("en-NG")}
                  </span>
                  <span className="text-sm font-medium text-slate-500">/ {billingFrequency}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>21 days free trial included before first charge</span>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Korapay Direct Debit Mandate Terms:
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <strong className="text-slate-800">21 days free trial:</strong> Starts only after your bank confirms the mandate via Korapay.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <strong className="text-slate-800">First plan charge:</strong> ₦{planPrice.toLocaleString("en-NG")} is initiated 21 days after mandate confirmation.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <strong className="text-slate-800">Subsequent renewals:</strong> ₦{planPrice.toLocaleString("en-NG")} every month while renewal is active.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <strong className="text-slate-800">Cancel anytime:</strong> Cancel with one click in Manage Subscription before renewal date to avoid charges.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <strong className="text-slate-800">Mandate lifespan:</strong> In line with Korapay documentation, authorizations are valid for 1 year from setup.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p>
                    <strong>NIBSS Verification Requirement:</strong> Korapay requires a one-time ₦50 NIBSS token verification payment to validate account ownership and activate the mandate. This is separate from your JobBridge subscription fee.
                  </p>
                </div>
              </div>

              {planLoadError && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {planLoadError}
                </p>
              )}

              <form onSubmit={continueToPaymentMethod} className="mt-6">
                <button
                  type="submit"
                  disabled={planLoading || Boolean(planLoadError)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
                >
                  Continue to Bank Details <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 4: BANK ACCOUNT DETAILS */}
          {step === 4 && (
            <form onSubmit={continueToReview} className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-950">Add Bank Account for Mandate</h2>
              <p className="mt-1 text-sm text-slate-600">
                Provide your Nigerian bank account details to register the Direct Debit mandate with Korapay.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="bankSelect" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select Your Nigerian Bank
                  </label>
                  <select
                    id="bankSelect"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Choose a bank…</option>
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="accountNumber" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    10-Digit NUBAN Account Number
                  </label>
                  <input
                    id="accountNumber"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="e.g. 0123456789"
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="phoneInput" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Nigerian Phone Number (from Profile)
                  </label>
                  <input
                    id="phoneInput"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Must match the Nigerian phone number registered with your bank account.
                  </p>
                </div>
              </div>

              {/* Data Protection / PCI Guarantee */}
              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Strict Privacy Guarantee:</strong> JobBridge never stores your complete bank account credentials or BVN. In strict adherence to Korapay Direct Debit policy, only your bank name and masked account number (last 4 digits) are recorded.
                </span>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!selectedBank || accountNumber.length !== 10}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
                >
                  Review Mandate <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: REVIEW & AUTHORIZE MANDATE */}
          {step === 5 && (
            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-950">Review & Authorize Direct Debit</h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm your mandate authorization terms under the Korapay Direct Debit standard.
              </p>

              {/* Selected Bank Card */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Banknote className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedBank?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Account ending •••• {accountNumber.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Detailed Terms */}
              <dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Subscription Plan</dt>
                  <dd className="font-semibold text-slate-900">{planName}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Recurring Price</dt>
                  <dd className="font-semibold text-slate-900">
                    ₦{planPrice.toLocaleString("en-NG")} / {billingFrequency}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Free Trial Period</dt>
                  <dd className="font-semibold text-emerald-700">21 Days Free</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Estimated First Plan Charge</dt>
                  <dd className="font-semibold text-slate-900">{formatDate(trialEndEstimate)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Mandate Verification Fee</dt>
                  <dd className="font-semibold text-amber-800">₦50 one-time (NIBSS)</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Mandate Validity</dt>
                  <dd className="font-semibold text-slate-900">1 Year (Renewable)</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-slate-500">Cancellation</dt>
                  <dd className="font-semibold text-slate-900">Anytime from Manage Subscription</dd>
                </div>
              </dl>

              {/* Required Consent Checkboxes */}
              <div className="mt-5 space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-xs leading-5 text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={acknowledgedTokenPayment}
                    onChange={(e) => setAcknowledgedTokenPayment(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>
                    <strong>Mandate Verification Fee Acknowledgment:</strong> I understand and agree that Korapay requires a separate one-time ₦50 NIBSS token verification payment to activate this Direct Debit authorization on my bank account.
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-xs leading-5 text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={(e) => setConsented(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>
                    <strong>Direct Debit Authorization Consent:</strong> I authorize JobBridge to initiate recurring Direct Debit pull-payments of ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} for {planName} from my specified bank account following my 21-day trial, in full compliance with Korapay&apos;s Direct Debit Documentation Policy (
                    <a
                      href={KORAPAY_DIRECT_DEBIT_DOCS_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-blue-700 underline"
                    >
                      developers.korapay.com/docs/overview-1
                    </a>
                    ). I understand I can cancel this authorization at any time before a renewal charge is submitted.
                  </span>
                </label>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedBank ||
                    accountNumber.length !== 10 ||
                    !consented ||
                    !acknowledgedTokenPayment
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Registering Mandate with Korapay…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Authorize Direct Debit Mandate
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Footer badge */}
        <p className="mt-6 text-center text-xs text-slate-500">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-blue-700" />
          Secured by Korapay Direct Debit Infrastructure (NIBSS Standard)
        </p>
      </div>
    </main>
  );
}
