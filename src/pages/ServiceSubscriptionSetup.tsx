import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Info, Loader2, ShieldCheck } from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
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
        const metadata = data as Record<string, unknown>;
        if (
          metadata.payment_method_type === "kora_direct_debit" &&
          metadata.trial_start_at
        ) {
          setAuthorized(true);
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

  const trialEndEstimate = new Date(Date.now() + 21 * 86400000);
  const normalizedPhone = normalizeNigeriaPhone(phone);
  const planName = planDetails?.name || plan.name;
  const planPrice = planDetails?.price ?? plan.price;
  const billingFrequency = planDetails?.durationDays === 30
    ? "monthly"
    : `every ${planDetails?.durationDays ?? 30} days`;

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
      const message = data?.error || invokeError?.message || "Could not start the bank authorization.";
      setError(message);
      return;
    }
    setSetup(data as SetupResponse);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <section className="bg-gradient-to-br from-blue-800 to-indigo-900 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link to="/pricing#services" className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Provider plans
          </Link>
          <h1 className="mt-5 text-3xl font-bold">Start your 21-day free trial</h1>
          <p className="mt-2 text-blue-100">
            {planName} · ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} after your trial.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-5 grid max-w-5xl gap-6 px-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
          {authorized ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-4 text-xl font-semibold">Your trial is active</h2>
              <p className="mt-2 text-gray-600">Your profile is now eligible to appear in the provider marketplace.</p>
              <Link to="/manage-subscription" className="mt-5 inline-block rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">
                Manage subscription
              </Link>
            </div>
          ) : setup ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Complete bank authorization</h2>
              <p className="mt-2 text-gray-600">{setup.activation_instructions}</p>
              {setup.token_payment?.account_number && (
                <dl className="mt-5 space-y-3 rounded-xl bg-blue-50 p-4 text-sm">
                  <div className="flex justify-between gap-4"><dt>Activation payment</dt><dd className="font-semibold">₦{setup.token_payment.amount_ngn || 50}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Bank</dt><dd className="font-semibold">{setup.token_payment.bank_name}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Account name</dt><dd className="font-semibold">{setup.token_payment.account_name}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Account number</dt><dd className="font-semibold">{setup.token_payment.account_number}</dd></div>
                </dl>
              )}
              <p className="mt-4 text-xs text-gray-500">
                JobBridge has not started your trial yet. It starts after KoraPay confirms that your bank authorization is active. Keep this page open or check Manage Subscription later.
              </p>
              <p className="mt-3 text-xs text-gray-500">
                This mandate is valid until {formatDate(setup.mandate_expires_at)}; re-authorization will be required before it expires.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/manage-subscription" className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white">Check status</Link>
                <button type="button" onClick={() => setSetup(null)} className="rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700">Try another bank account</button>
              </div>
            </div>
          ) : !isAuthenticated ? (
            <div className="py-8 text-center">
              <h2 className="text-xl font-semibold">Sign in to continue</h2>
              <p className="mt-2 text-gray-600">Your provider account and profile are required to set up a subscription.</p>
              <Link to={`/login?redirect=${encodeURIComponent(`/payment?plan=${planKey}`)}`} className="mt-5 inline-block rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">Sign in</Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Loading your provider profile…</div>
          ) : profile?.role !== "provider" ? (
            <div className="py-8 text-center">
              <h2 className="text-xl font-semibold">Provider account required</h2>
              <p className="mt-2 text-gray-600">Create a service-provider profile before setting up this plan.</p>
              <Link to="/signup" className="mt-5 inline-block rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">Create provider profile</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Set up bank authorization</h2>
                <p className="mt-1 text-sm text-gray-600">KoraPay processes the authorization securely. JobBridge stores only the bank name and account last four digits.</p>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Bank
                <select value={bankCode} onChange={(event) => setBankCode(event.target.value)} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3">
                  <option value="">Select a supported bank</option>
                  {BANKS.map((bank) => <option value={bank.code} key={bank.code}>{bank.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                10-digit bank account number
                <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="off" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Nigerian phone number on your profile
                <input value={phone} readOnly className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-gray-600" />
              </label>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>KoraPay requires a one-time ₦50 NIBSS token payment to activate the mandate. This is separate from your JobBridge subscription fee. KoraPay's current public docs do not specify whether or when that token payment is reversed; confirm the treatment with KoraPay before production launch.</p></div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">Trial and billing terms</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>21 days free, starting only when KoraPay confirms your mandate.</li>
                  <li>First charge: ₦{planPrice.toLocaleString("en-NG")} 21 days after KoraPay confirms your authorization. The exact charge date appears in Manage Subscription.</li>
                  <li>Then ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} while automatic renewal is enabled.</li>
                  <li>A separate ₦50 NIBSS token payment is required to activate the mandate. It is not your subscription charge; KoraPay shows the transfer instructions after setup.</li>
                  <li>Cancel anytime before a charge is submitted. Access continues through the current paid/trial period.</li>
                  <li>The Direct Debit authorization expires one year after setup and must be renewed to keep automatic billing.</li>
                </ul>
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={acknowledgedTokenPayment} onChange={(event) => setAcknowledgedTokenPayment(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-700" />
                <span>I understand that KoraPay requires a separate ₦50 NIBSS token payment to activate the mandate, in addition to the recurring subscription charges authorized below.</span>
              </label>

              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-700" />
                <span>I authorize JobBridge to initiate recurring Direct Debit payments of ₦{planPrice.toLocaleString("en-NG")} {billingFrequency} for {planName} after my 21-day free trial, and I agree to the cancellation and mandate-expiry terms above.</span>
              </label>

              {planLoadError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{planLoadError}</p>}
              {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={submitting || planLoading || Boolean(planLoadError) || !planDetails || !consented || !acknowledgedTokenPayment} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting authorization…</> : <><ShieldCheck className="h-4 w-4" /> Authorize recurring payments</>}
              </button>
            </form>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
          <h2 className="font-semibold text-gray-900">Subscription summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Plan</dt><dd className="font-medium">{planName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Trial</dt><dd className="font-medium">21 days</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">First charge (estimate)</dt><dd className="text-right font-medium">{formatDate(trialEndEstimate)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Recurring amount</dt><dd className="font-medium">₦{planPrice.toLocaleString("en-NG")} / {planDetails?.durationDays === 30 ? "month" : `${planDetails?.durationDays ?? 30} days`}</dd></div>
          </dl>
          <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">The final charge date is set when the authorization becomes active and will appear in Manage Subscription.</p>
          <Link to="/manage-subscription" className="mt-4 inline-block text-sm font-semibold text-blue-700">Manage an existing subscription</Link>
        </aside>
      </section>
      <BottomNav />
    </main>
  );
}
