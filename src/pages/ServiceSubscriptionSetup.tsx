import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getFunctionInvokeErrorMessage } from "../lib/supabaseHelpers";
import { SERVICE_PROVIDER_PLANS } from "../lib/trial";

const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Ecobank", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank", code: "011" },
  { name: "FCMB", code: "214" },
  { name: "Globus Bank", code: "103" },
  { name: "GTBank", code: "058" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Lotus Bank", code: "303" },
  { name: "Nova Merchant Bank", code: "637" },
  { name: "Optimus Bank", code: "000036" },
  { name: "Parallex Bank", code: "526" },
  { name: "Polaris Bank", code: "076" },
  { name: "Premium Trust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC", code: "221" },
  { name: "Standard Chartered", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "TajBank", code: "302" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "UBA", code: "033" },
  { name: "Union Bank", code: "032" },
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
  const { user, profile, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
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
  const [planDetails, setPlanDetails] = useState<{ name: string; price: number; durationDays: number } | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadError, setPlanLoadError] = useState("");
  const selectedBank = useMemo(
    () => BANKS.find((bank) => bank.code === bankCode),
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
          data.payment_method_type === "kora_direct_debit" &&
          data.trial_start_at
        ) {
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
  }, [user?.id]);

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
  const billingFrequency = planDetails?.durationDays === 30
    ? "monthly"
    : `every ${planDetails?.durationDays ?? 30} days`;

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
      navigate(`/login?redirect=${encodeURIComponent(`/payment?plan=${planKey}`)}`);
      return;
    }
    if (!selectedBank || accountNumber.replace(/\D/g, "").length !== 10) {
      setError("Enter a 10-digit bank account number and select a supported bank.");
      return;
    }
    if (!/^0\d{10}$/.test(normalizedPhone)) {
      setError("Your profile must have a valid Nigerian phone number before you continue.");
      return;
    }
    if (!consented) {
      setError("Authorize the recurring monthly Direct Debit to continue.");
      return;
    }
    if (!acknowledgedTokenPayment) {
      setError("Acknowledge KoraPay's separate ₦50 mandate verification payment to continue.");
      return;
    }

    setSubmitting(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke(
      "start-service-subscription",
      {
        body: {
          plan_key: planKey,
          account_number: accountNumber,
          bank_code: selectedBank.code,
          bank_name: selectedBank.name,
          phone: normalizedPhone,
          consented: true,
          consent_version: "service-subscription-v1",
          token_payment_acknowledged: true,
        },
      },
    );
    setSubmitting(false);
    if (invokeError || data?.error) {
      const message = data?.error || await getFunctionInvokeErrorMessage(
        invokeError,
        "Could not start the bank authorization.",
      );
      console.error("[ServiceSubscriptionSetup] subscription authorization failed:", message);
      setError(message);
      return;
    }
    setSetup(data as SetupResponse);
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
                  ? navigate("/pricing#services")
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
              {step === 3 ? "Start 21-Day Free Trial" : step === 4 ? "Add Payment Method" : step === 5 ? "Review & Confirm" : "Trial Activated!"}
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
                <Check className="h-3.5 w-3.5" /> Trial activated
              </p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Your JobBridge trial is active</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                Your provider profile is ready. Manage your plan, payment authorization, and billing history any time.
              </p>
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left">
                <p className="text-sm font-semibold text-slate-900">{planName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {setup?.trial_days === 0 ? "Subscription is active" : "21-day free trial"} · ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} after trial, if eligible
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
              <Link to={`/login?redirect=${encodeURIComponent(`/payment?plan=${planKey}`)}`} className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Sign in</Link>
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
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> 21-Day Free Trial
                  </div>
                  <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Try JobBridge Free for 21 Days</h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Get full access to provider features and see how JobBridge can help grow your business.</p>
                  <h2 className="mt-7 text-sm font-bold text-slate-900">What&apos;s included:</h2>
                  <ul className="mt-3 space-y-3">
                    {["Full access to all features", "Create and manage your services", "Get customer bookings", "Cancel anytime"].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-5 text-blue-950">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                    <p>After 21 days, your selected plan will automatically convert to a paid subscription unless you cancel. The trial starts after KoraPay confirms your bank authorization and is subject to trial eligibility.</p>
                  </div>
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected plan</p>
                    <p className="mt-1 font-semibold text-slate-950">{planName}</p>
                    <p className="mt-1 text-sm text-slate-600">₦{planPrice.toLocaleString("en-NG")} {billingFrequency} after the trial</p>
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
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Banknote className="h-5 w-5" /></span>
                    <div>
                      <h1 className="text-xl font-bold text-slate-950">Add Payment Method</h1>
                      <p className="mt-1 text-sm text-slate-600">Secure bank Direct Debit authorization</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-5 text-blue-950">
                    KoraPay securely verifies your bank account for recurring subscription payments. JobBridge stores only your bank name and account last four digits.
                  </div>
                  <form onSubmit={continueToReview} className="mt-6 space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Bank
                      <select value={bankCode} onChange={(event) => setBankCode(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                        <option value="">Select your bank</option>
                        {BANKS.map((bank) => <option value={bank.code} key={bank.code}>{bank.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      10-digit bank account number
                      <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="off" required placeholder="Enter account number" className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Phone number on your provider profile
                      <input value={phone} readOnly className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 font-normal text-slate-500" />
                    </label>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950">
                      <div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>A separate ₦50 NIBSS token payment is required by KoraPay to activate the bank mandate. It is not your JobBridge subscription fee; KoraPay will show transfer instructions after you confirm.</p></div>
                    </div>
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                    <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800">
                      Save Bank &amp; Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}

              {step === 5 && (
                <>
                  {setup ? (
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="h-5 w-5" /></span>
                        <div>
                          <h1 className="text-xl font-bold text-slate-950">Complete bank authorization</h1>
                          <p className="mt-1 text-sm text-slate-600">Your trial will begin after KoraPay confirms the mandate.</p>
                        </div>
                      </div>
                      <p className="mt-5 text-sm leading-6 text-slate-700">{setup.activation_instructions}</p>
                      {setup.token_payment?.account_number && (
                        <dl className="mt-5 space-y-3 rounded-2xl bg-blue-50 p-4 text-sm">
                          <div className="flex justify-between gap-4"><dt>One-time mandate payment</dt><dd className="font-semibold">₦{setup.token_payment.amount_ngn || 50}</dd></div>
                          <div className="flex justify-between gap-4"><dt>Bank</dt><dd className="text-right font-semibold">{setup.token_payment.bank_name}</dd></div>
                          <div className="flex justify-between gap-4"><dt>Account name</dt><dd className="text-right font-semibold">{setup.token_payment.account_name}</dd></div>
                          <div className="flex justify-between gap-4"><dt>Account number</dt><dd className="font-semibold">{setup.token_payment.account_number}</dd></div>
                        </dl>
                      )}
                      <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-5 text-slate-600">
                        {setup.trial_days === 0 ? "No trial is available for this account; your paid subscription starts once authorization is confirmed." : "Your 21-day trial starts only after KoraPay confirms the authorization."}
                        {" "}The mandate expires {formatDate(setup.mandate_expires_at)}.
                      </p>
                      {authorized ? (
                        <button type="button" onClick={goToDashboard} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white">Go to Dashboard <ArrowRight className="h-4 w-4" /></button>
                      ) : (
                        <div className="mt-6 flex flex-col gap-3">
                          <Link to="/manage-subscription" className="inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white">Check authorization status</Link>
                          <p className="text-center text-xs text-slate-500">This page checks for confirmation automatically. You can also return to Manage Subscription later.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Final review</p>
                      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Review &amp; Confirm</h1>
                      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-950">21-Day Free Trial</p>
                            <p className="mt-1 text-sm text-slate-600">No subscription charge during an eligible trial · then ₦{planPrice.toLocaleString("en-NG")} {billingFrequency}</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Trial</span>
                        </div>
                        <p className="mt-3 text-xs text-blue-700">{planName}</p>
                        <Link to="/pricing#services" className="mt-3 inline-block text-xs font-semibold text-blue-700">View plan details</Link>
                      </div>
                      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Banknote className="h-5 w-5" /></span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{selectedBank?.name} account •••• {accountNumber.slice(-4)}</p>
                              <p className="mt-1 text-xs text-slate-500">KoraPay Direct Debit authorization</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setStep(4)} className="text-sm font-semibold text-blue-700">Change</button>
                        </div>
                      </div>
                      <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
                        <div className="flex justify-between gap-4"><dt className="text-slate-600">Estimated first charge</dt><dd className="text-right font-semibold text-slate-900">{formatDate(trialEndEstimate)}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-slate-600">Billing frequency</dt><dd className="font-semibold text-slate-900">{billingFrequency}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-slate-600">Subscription price</dt><dd className="font-semibold text-slate-900">₦{planPrice.toLocaleString("en-NG")}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-slate-600">Automatic renewal</dt><dd className="font-semibold text-emerald-700">On · cancel anytime</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-slate-600">Mandate verification</dt><dd className="font-semibold text-slate-900">₦50 one-time</dd></div>
                      </dl>
                      <p className="mt-3 text-xs leading-5 text-slate-500">The final charge date is confirmed when KoraPay activates your authorization. If your account is not eligible for a free trial, billing begins after authorization.</p>
                      <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm leading-5 text-slate-700">
                        <input type="checkbox" checked={acknowledgedTokenPayment} onChange={(event) => setAcknowledgedTokenPayment(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600" />
                        <span>I understand KoraPay requires a separate ₦50 NIBSS token payment to activate the bank mandate.</span>
                      </label>
                      <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm leading-5 text-slate-700">
                        <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600" />
                        <span>I authorize recurring Direct Debit payments of ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} for {planName} after any eligible trial. I understand I can cancel before a charge is submitted.</span>
                      </label>
                      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                      <form onSubmit={handleSubmit}>
                        <button type="submit" disabled={submitting || planLoading || Boolean(planLoadError) || !planDetails || !consented || !acknowledgedTokenPayment} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting authorization…</> : <><ShieldCheck className="h-4 w-4" /> Authorize &amp; Start Trial</>}
                        </button>
                      </form>
                      {planLoadError && <p role="alert" className="mt-3 text-sm text-red-700">{planLoadError}</p>}
                      <p className="mt-4 text-center text-xs leading-5 text-slate-500">Your account details are processed securely by KoraPay. JobBridge does not store your full account number.</p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {step !== 6 && !setup && (
          <p className="mt-5 text-center text-xs text-slate-500">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Secure authorization powered by KoraPay
          </p>
        )}
      </div>
    </main>
  );
}
