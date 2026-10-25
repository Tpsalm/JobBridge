import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Save, ShieldCheck } from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

type ProviderPlan = {
  key: string;
  name: string;
  base_price_ngn: number;
  billing_cycle: string;
  duration_days: number;
  is_active: boolean;
  product_config: Record<string, unknown>;
};

type AdminSubscription = {
  id: string;
  user_id: string;
  plan_key: string;
  status: string;
  trial_start_at: string | null;
  trial_end_at: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  auto_renew: boolean;
  failed_retries: number;
};

type ProviderName = { id: string; full_name: string | null };
type AdminPayment = {
  id: string;
  subscription_id: string;
  plan: string;
  reference: string;
  provider_reference: string | null;
  amount: number;
  status: string;
  created_at: string;
};
type AdminSummary = {
  subscriptions: number;
  trialing: number;
  active: number;
  canceled: number;
  expired: number;
  past_due: number;
  revenue_ngn: number;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
  : "—";

export default function AdminServiceSubscriptions() {
  const { profile, loading: authLoading } = useAuth();
  const { push } = useToasts();
  const [plans, setPlans] = useState<ProviderPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});
  const [revenue, setRevenue] = useState(0);
  const [summary, setSummary] = useState<AdminSummary>({
    subscriptions: 0, trialing: 0, active: 0, canceled: 0, expired: 0, past_due: 0, revenue_ngn: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState(1500);
  const [newPlanDays, setNewPlanDays] = useState(30);
  const [newPlanBenefits, setNewPlanBenefits] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  const load = useCallback(async () => {
    if (profile?.role !== "admin") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [planResult, subscriptionResult, summaryResult] = await Promise.all([
      supabase
        .from("plans")
        .select("key, name, base_price_ngn, billing_cycle, duration_days, is_active, product_config")
        .eq("product_line", "service")
        .order("base_price_ngn"),
      supabase
        .from("subscriptions")
        .select("id, user_id, plan_key, status, trial_start_at, trial_end_at, current_period_end, next_billing_at, auto_renew, failed_retries")
        .eq("product_line", "service")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.rpc("get_admin_service_subscription_summary"),
    ]);
    if (planResult.error || subscriptionResult.error || summaryResult.error) {
      const reason = planResult.error?.message || subscriptionResult.error?.message || summaryResult.error?.message || "Unable to load subscription data.";
      console.error("[AdminServiceSubscriptions] load failed:", reason);
      setError("Subscription administration data could not be loaded.");
      setLoading(false);
      return;
    }
    const loadedPlans = (planResult.data || []) as ProviderPlan[];
    const loadedSubscriptions = (subscriptionResult.data || []) as AdminSubscription[];
    const metrics = summaryResult.data as AdminSummary;
    setSummary(metrics);
    setRevenue(Number(metrics.revenue_ngn));
    setPlans(loadedPlans);
    setSubscriptions(loadedSubscriptions);

    const userIds = [...new Set(loadedSubscriptions.map((item) => item.user_id))];
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profilesError) {
        console.error("[AdminServiceSubscriptions] provider names unavailable:", profilesError.message);
      } else {
        setProviderNames(Object.fromEntries(
          ((profiles || []) as ProviderName[]).map((provider) => [provider.id, provider.full_name || provider.id]),
        ));
      }
    }

    if (loadedSubscriptions.length) {
      const { data: paymentRows, error: paymentsError } = await supabase
        .from("payments")
        .select("id, subscription_id, plan, reference, provider_reference, amount, status, created_at")
        .in("subscription_id", loadedSubscriptions.map((item) => item.id))
        .order("created_at", { ascending: false })
        .limit(500);
      if (paymentsError) {
        console.error("[AdminServiceSubscriptions] revenue unavailable:", paymentsError.message);
        setPayments([]);
      } else {
        const rows = (paymentRows || []) as AdminPayment[];
        setPayments(rows);
      }
    } else {
      setPayments([]);
    }
    setLoading(false);
  }, [profile?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const editPlan = (key: string, change: Partial<ProviderPlan>) => {
    setPlans((current) => current.map((plan) => plan.key === key ? { ...plan, ...change } : plan));
  };

  const savePlan = async (plan: ProviderPlan) => {
    const retryText = typeof plan.product_config.retry_delay_days === "string"
      ? plan.product_config.retry_delay_days
      : Array.isArray(plan.product_config.retry_delay_days)
      ? plan.product_config.retry_delay_days.join(",")
      : "1,2";
    const retryDelays = retryText.trim()
      ? retryText.split(",").map((value) => Number(value.trim()))
      : [];
    if (retryDelays.some((days) => !Number.isInteger(days) || days < 1 || days > 30)) {
      push({ message: "Retry delays must be whole days between 1 and 30, separated by commas.", type: "error" });
      return;
    }
    setSavingPlan(plan.key);
    const { error: updateError } = await supabase
      .from("plans")
      .update({
        name: plan.name.trim(),
        base_price_ngn: plan.base_price_ngn,
        billing_cycle: "recurring",
        is_recurring: true,
        duration_days: plan.duration_days,
        is_active: plan.is_active,
        product_config: {
          ...plan.product_config,
          benefits: String(
            Array.isArray(plan.product_config.benefits)
              ? plan.product_config.benefits.join("\n")
              : plan.product_config.benefits || "",
          ).split("\n").map((item) => item.trim()).filter(Boolean),
          retry_delay_days: retryDelays,
        },
      })
      .eq("key", plan.key);
    if (updateError) {
      console.error("[AdminServiceSubscriptions] plan update failed:", updateError.message);
      push({ message: "The plan could not be saved. Check your permissions and try again.", type: "error" });
    } else {
      push({ message: `${plan.name} saved.`, type: "success" });
      await load();
    }
    setSavingPlan(null);
  };

  const createPlan = async () => {
    const normalizedName = newPlanName.trim();
    const suffix = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const key = `svc_${suffix}`;
    if (!normalizedName || !/^[a-z0-9_]{1,40}$/.test(suffix)) {
      push({ message: "Enter a plan name that can be converted to a valid plan key.", type: "error" });
      return;
    }
    if (!Number.isSafeInteger(newPlanPrice) || newPlanPrice <= 0 ||
      !Number.isInteger(newPlanDays) || newPlanDays < 1 || newPlanDays > 366) {
      push({ message: "Enter a valid price and billing period.", type: "error" });
      return;
    }
    setCreatingPlan(true);
    const { error: createError } = await supabase.from("plans").insert({
      key,
      product_line: "service",
      name: normalizedName,
      base_price_ngn: newPlanPrice,
      billing_cycle: "recurring",
      duration_days: newPlanDays,
      is_recurring: true,
      is_launch_free: false,
      product_config: {
        visibility_days: newPlanDays,
        verified: false,
        featured: false,
        grace_days: 0,
        retry_delay_days: [1, 2],
        benefits: newPlanBenefits.split("\n").map((item) => item.trim()).filter(Boolean),
      },
    });
    if (createError) {
      console.error("[AdminServiceSubscriptions] plan creation failed:", createError.message);
      push({ message: createError.code === "23505" ? "A plan with that generated key already exists." : "The plan could not be created.", type: "error" });
    } else {
      push({ message: `${normalizedName} plan created.`, type: "success" });
      setNewPlanName("");
      setNewPlanPrice(1500);
      setNewPlanDays(30);
      setNewPlanBenefits("");
      await load();
    }
    setCreatingPlan(false);
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-blue-700" /></div>
        <BottomNav />
      </main>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <section className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Admin access required</h1>
          <p className="mt-3 text-slate-600">You do not have permission to view subscription administration.</p>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800"><ShieldCheck className="h-4 w-4" /> Admin dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Provider subscriptions</h1>
            <p className="mt-2 text-slate-600">Manage plan pricing and review trial, billing and payment status.</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Refresh data
          </button>
        </div>
        {error && <p role="alert" className="mt-6 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" />{error}</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Subscriptions", summary.subscriptions],
            ["Trials", summary.trialing],
            ["Active", summary.active],
            ["Cancelled", summary.canceled],
            ["Expired", summary.expired],
            ["Payment failed", summary.past_due],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Verified subscription revenue (all recorded periods)</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{money(revenue)}</p>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-950">Provider plans</h2>
          <p className="mt-1 text-sm text-slate-600">Plan benefits and prices are editable. Verified badges remain controlled by the separate verification process.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const benefits = Array.isArray(plan.product_config.benefits)
                ? (plan.product_config.benefits as string[]).join("\n")
                : "";
              const retryDays = typeof plan.product_config.retry_delay_days === "string"
                ? plan.product_config.retry_delay_days
                : Array.isArray(plan.product_config.retry_delay_days)
                ? plan.product_config.retry_delay_days.join(",")
                : "1,2";
              return (
                <article key={plan.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700">Plan name
                    <input value={plan.name} onChange={(event) => editPlan(plan.key, { name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">Monthly price (NGN)
                    <input type="number" min="1" step="100" value={plan.base_price_ngn} onChange={(event) => editPlan(plan.key, { base_price_ngn: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">Billing period (days)
                    <input type="number" min="1" max="366" value={plan.duration_days} onChange={(event) => editPlan(plan.key, { duration_days: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">Benefits (one per line)
                    <textarea rows={4} value={benefits} onChange={(event) => editPlan(plan.key, { product_config: { ...plan.product_config, benefits: event.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">Payment retry delays (days, comma-separated)
                    <input value={retryDays} onChange={(event) => editPlan(plan.key, { product_config: { ...plan.product_config, retry_delay_days: event.target.value } })} placeholder="1,2" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={plan.is_active} onChange={(event) => editPlan(plan.key, { is_active: event.target.checked })} />
                    Available to providers
                  </label>
                  <button type="button" disabled={savingPlan === plan.key || !plan.name.trim() || !Number.isSafeInteger(plan.base_price_ngn) || plan.base_price_ngn <= 0 || !Number.isInteger(plan.duration_days) || plan.duration_days < 1 || plan.duration_days > 366} onClick={() => void savePlan(plan)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {savingPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save plan
                  </button>
                </article>
              );
            })}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void createPlan(); }} className="mt-4 grid gap-4 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h3 className="font-bold text-slate-900">Create a provider plan</h3>
              <p className="mt-1 text-sm text-slate-600">A unique service plan key is generated from its name. New plans never grant a verified badge automatically.</p>
            </div>
            <label className="text-sm font-semibold text-slate-700">Plan name
              <input required value={newPlanName} onChange={(event) => setNewPlanName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Recurring price (NGN)
              <input required type="number" min="1" step="100" value={newPlanPrice} onChange={(event) => setNewPlanPrice(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Billing period (days)
              <input required type="number" min="1" max="366" value={newPlanDays} onChange={(event) => setNewPlanDays(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Benefits (one per line)
              <textarea rows={3} value={newPlanBenefits} onChange={(event) => setNewPlanBenefits(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" />
            </label>
            <button type="submit" disabled={creatingPlan} className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create plan
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Subscription register</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3 pr-3">Provider</th><th className="pb-3 pr-3">Plan</th><th className="pb-3 pr-3">Status</th><th className="pb-3 pr-3">Trial expiry</th><th className="pb-3 pr-3">Next charge</th><th className="pb-3 pr-3">Renewal</th><th className="pb-3">Failed attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 font-medium text-slate-900">{providerNames[item.user_id] || item.user_id.slice(0, 8)}</td>
                    <td className="py-3 pr-3 text-slate-700">{item.plan_key}</td>
                    <td className="py-3 pr-3 capitalize text-slate-700">{item.status.replace(/_/g, " ")}</td>
                    <td className="py-3 pr-3 text-slate-700">{date(item.trial_end_at)}</td>
                    <td className="py-3 pr-3 text-slate-700">{date(item.next_billing_at)}</td>
                    <td className="py-3 pr-3 text-slate-700">{item.auto_renew ? "Automatic" : "Off"}</td>
                    <td className="py-3 text-slate-700">{item.failed_retries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!subscriptions.length && <p className="py-6 text-center text-sm text-slate-500">No provider subscriptions found.</p>}
          </div>
        </section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Recent transactions</h2>
          <p className="mt-1 text-sm text-slate-600">Latest 500 subscription payments. Verified statuses are included in the revenue total above.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="pb-3 pr-3">Date</th><th className="pb-3 pr-3">Plan</th><th className="pb-3 pr-3">Reference</th><th className="pb-3 pr-3">Amount</th><th className="pb-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-3 pr-3 text-slate-700">{date(payment.created_at)}</td>
                    <td className="py-3 pr-3 text-slate-700">{payment.plan}</td>
                    <td className="py-3 pr-3 font-mono text-xs text-slate-700">{payment.provider_reference || payment.reference}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-900">{money(Number(payment.amount))}</td>
                    <td className="py-3 capitalize text-slate-700">{payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payments.length && <p className="py-6 text-center text-sm text-slate-500">No subscription transactions found.</p>}
          </div>
        </section>
      </section>
      <BottomNav />
    </main>
  );
}
