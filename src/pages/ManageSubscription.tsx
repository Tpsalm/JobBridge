import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  Receipt,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";

type PaymentRecord = {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  reference: string;
  provider_reference: string | null;
  failure_code: string | null;
  created_at: string;
};

type SubscriptionRecord = {
  id: string;
  plan_key: string;
  plan_name: string;
  price_ngn: number;
  billing_period_days: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start_at: string | null;
  trial_end_at: string | null;
  next_billing_at: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  payment_method_type: string | null;
  payment_method_bank: string | null;
  payment_method_last4: string | null;
  payment_method_expires_at: string | null;
  failed_retries: number;
  payments: PaymentRecord[];
};

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(value: number | string, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency === "NGN" ? "NGN" : currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function remainingTime(value: string | null, now: number): string {
  if (!value) return "—";
  const remaining = new Date(value).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Ended";
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character: string) => character.toUpperCase());
}

export default function ManageSubscription() {
  const { user, profile, loading: authLoading } = useAuth();
  const { push } = useToasts();
  const location = useLocation();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [manualPaying, setManualPaying] = useState(false);
  const [receipt, setReceipt] = useState<PaymentRecord | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "successful" | "failed">("all");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const view = location.pathname.endsWith("/history")
    ? "history"
    : location.pathname.endsWith("/cancel")
      ? "cancel"
      : "overview";

  const loadSubscription = useCallback(async (quiet = false) => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    const { data, error: queryError } = await supabase.rpc("get_my_service_subscription");
    if (queryError) {
      console.error("[ManageSubscription] Could not load subscription:", queryError.message);
      setError("We could not load your subscription right now. Please try again.");
    } else {
      setError("");
      setSubscription((data as SubscriptionRecord | null) ?? null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextChargeAt = useMemo(() => {
    if (!subscription) return null;
    return subscription.next_billing_at ||
      (subscription.status === "trialing" && subscription.auto_renew
        ? subscription.trial_end_at
        : null);
  }, [subscription]);

  useEffect(() => {
    if (!subscription?.payments?.some((payment) => payment.status === "pending")) return;
    const timer = window.setInterval(() => void loadSubscription(true), 10_000);
    return () => window.clearInterval(timer);
  }, [loadSubscription, subscription?.payments]);

  const cancelSubscription = async () => {
    setCancelling(true);
    const { error: cancelError } = await supabase.functions.invoke(
      "cancel-service-subscription",
      { body: {} },
    );
    if (cancelError) {
      console.error("[ManageSubscription] Cancellation failed:", cancelError.message);
      push({ message: "Subscription could not be cancelled. Please try again.", type: "error" });
      setCancelling(false);
      return;
    }
    push({ message: "Automatic renewal has been cancelled.", type: "success" });
    setCancelling(false);
    await loadSubscription(true);
  };

  const makeManualPayment = async () => {
    if (!subscription) return;
    const amount = formatAmount(subscription.price_ngn);
    if (!window.confirm(`Pay ${amount} now using your saved bank authorization? This will renew your subscription for ${subscription.billing_period_days} days.`)) {
      return;
    }
    setManualPaying(true);
    const { data, error: paymentError } = await supabase.functions.invoke(
      "pay-service-subscription-manually",
      { body: {} },
    );
    if (paymentError) {
      console.error("[ManageSubscription] Manual payment failed:", paymentError.message);
      push({ message: paymentError.message || "Manual payment could not be started.", type: "error" });
    } else if (data?.status === "payment_confirmed") {
      push({ message: "Your payment was confirmed and your profile access has been renewed.", type: "success" });
      await loadSubscription(true);
    } else if (data?.status === "payment_failed") {
      push({ message: "The payment failed. Review your payment method and try again.", type: "error" });
      await loadSubscription(true);
    } else {
      push({ message: "Payment is processing. Do not submit another payment; this page will reflect the verified result.", type: "info" });
      await loadSubscription(true);
    }
    setManualPaying(false);
  };

  const planPaymentUrl = subscription
    ? `/payment?plan=${encodeURIComponent(subscription.plan_key)}&update_method=1`
    : "/pricing#services";
  const activePeriodEnd = subscription?.status === "trialing"
    ? subscription.trial_end_at
    : subscription?.current_period_end;
  const periodHasEnded = activePeriodEnd
    ? new Date(activePeriodEnd).getTime() <= now
    : false;
  const canCancel = Boolean(
    subscription &&
    subscription.auto_renew &&
    !subscription.cancel_at_period_end &&
    !["canceled", "expired"].includes(subscription.status),
  );
  const nextChargeIsDue = Boolean(
    subscription?.status === "past_due" ||
    subscription?.status === "expired" ||
    (subscription && periodHasEnded),
  );
  const hasPendingPayment = Boolean(
    subscription?.payments?.some((payment) => payment.status === "pending"),
  );
  const manualPaymentAvailable = Boolean(
    subscription?.payment_method_type === "kora_direct_debit" &&
    subscription.payment_method_expires_at &&
    new Date(subscription.payment_method_expires_at).getTime() > now &&
    periodHasEnded &&
    !hasPendingPayment,
  );
  const successfulPaymentStatuses = ["success", "successful", "verified", "completed"];
  const historyPayments = (subscription?.payments || []).filter((payment) => {
    if (paymentFilter === "successful") return successfulPaymentStatuses.includes(payment.status);
    if (paymentFilter === "failed") return payment.status === "failed";
    return true;
  });

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="mx-auto flex max-w-5xl justify-center px-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-700" aria-label="Loading subscription" />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!user || profile?.role !== "provider") {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <section className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Provider account required</h1>
          <p className="mt-3 text-slate-600">Sign in with a service-provider account to manage its subscription.</p>
          <Link to="/login?redirect=%2Fmanage-subscription" className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">
            Sign in
          </Link>
        </section>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <Link to={view === "overview" ? "/profile" : "/manage-subscription"} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> {view === "overview" ? "Provider dashboard" : "Manage subscription"}
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {view === "history" ? "Payment history" : view === "cancel" ? "Cancel subscription" : "Manage subscription"}
            </h1>
            <p className="mt-2 text-slate-600">
              {view === "history"
                ? "Review payments and download your receipts."
                : view === "cancel"
                  ? "Review what happens to your plan before confirming cancellation."
                  : "Manage your service-provider plan, renewals and payment history."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSubscription(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {!subscription ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CreditCard className="mx-auto h-10 w-10 text-blue-700" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">No service subscription yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-600">Choose a provider plan and add a card through Korapay’s secure checkout to start your subscription.</p>
            <Link to="/pricing#services" className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">
              View provider plans
            </Link>
          </div>
        ) : (
          <>
            {view === "overview" && (subscription.status === "past_due" || periodHasEnded) && (
              <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Payment attention needed</p>
                    <p className="mt-1 text-sm">Your latest subscription period has ended or renewal is overdue. Your listing may be hidden until a payment is confirmed.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {manualPaymentAvailable && (
                    <button type="button" disabled={manualPaying} onClick={() => void makeManualPayment()} className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {manualPaying ? "Processing…" : `Pay ${formatAmount(subscription.price_ngn)} now`}
                    </button>
                  )}
                  <Link to={planPaymentUrl} className="rounded-lg border border-amber-900 px-4 py-2 text-sm font-semibold text-amber-950">
                    {nextChargeIsDue ? "Update payment method" : "Review payment"}
                  </Link>
                </div>
              </div>
            )}

            {view === "overview" && <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current plan</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950">{subscription.plan_name}</h2>
                    <p className="mt-2 text-slate-600">
                      {formatAmount(subscription.price_ngn)} / {subscription.billing_period_days === 30 ? "month" : `${subscription.billing_period_days} days`}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${subscription.status === "active" || subscription.status === "trialing" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    {statusLabel(subscription.status)}
                  </span>
                </div>
                <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-slate-500">{subscription.trial_start_at ? "Trial started" : "Current period started"}</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDate(subscription.trial_start_at || subscription.current_period_start)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{subscription.trial_end_at ? "Trial ends" : "Current period ends"}</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDate(subscription.trial_end_at || subscription.current_period_end)}</p>
                  </div>
                  {subscription.status === "trialing" && (
                    <div>
                      <p className="text-sm text-slate-500">Trial time remaining</p>
                      <p className="mt-1 font-semibold text-slate-900">{remainingTime(subscription.trial_end_at, now)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500">Next scheduled charge</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDate(nextChargeAt)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {nextChargeAt && subscription.auto_renew && !subscription.cancel_at_period_end
                        ? `${formatAmount(subscription.price_ngn)} will be charged`
                        : "No automatic charge is scheduled"}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/pricing#services" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">
                    Change or upgrade plan
                  </Link>
                  <Link to={planPaymentUrl} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
                    Change payment method
                  </Link>
                  <Link to="/manage-subscription/history" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
                    Payment history
                  </Link>
                  {canCancel && (
                    <Link to="/manage-subscription/cancel" className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                      Cancel subscription
                    </Link>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">Renewal and payment method</h2>
                <div className="mt-5 flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <p className="font-semibold text-slate-900">Automatic renewal</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {subscription.auto_renew && !subscription.cancel_at_period_end
                        ? "On — monthly renewal is authorized"
                        : "Off — no further automatic renewal"}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-blue-700" />
                  <div>
                    <p className="font-semibold text-slate-900">Saved payment method</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {subscription.payment_method_type === "kora_direct_debit"
                        ? `${subscription.payment_method_bank || "Nigerian bank account"} account ending ${subscription.payment_method_last4 || "••••"}`
                        : subscription.payment_method_type === "kora_saved_card"
                          ? `Korapay saved card${subscription.payment_method_last4 ? ` ending ${subscription.payment_method_last4}` : ""}`
                          : "No active payment method"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {subscription.payment_method_type === "kora_saved_card"
                        ? "Card details are processed by Korapay; JobBridge stores only the reusable token and optional last four digits."
                        : subscription.payment_method_type === "kora_direct_debit"
                          ? "Only the bank and last four digits are shown. Full account details are not stored here."
                          : "No payment details are stored."}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-3">
                  {subscription.auto_renew ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /> : <XCircle className="mt-0.5 h-5 w-5 text-slate-500" />}
                  <div>
                    <p className="font-semibold text-slate-900">Authorization status</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {subscription.auto_renew
                        ? subscription.payment_method_type === "kora_saved_card"
                          ? "Automatic card billing is active."
                          : "Recurring payment authorization is active."
                        : "Automatic renewal is disabled."}
                    </p>
                  </div>
                </div>
                {subscription.failed_retries > 0 && (
                  <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    {subscription.failed_retries} failed payment attempt{subscription.failed_retries === 1 ? "" : "s"} recorded. Check your payment method or renew your plan.
                  </p>
                )}
              </section>
            </div>}

            {(view === "overview" || view === "cancel") && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{view === "cancel" ? "Your cancellation request" : "Subscription cancellation"}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">You can cancel at any time. Cancellation stops future debit requests; access remains until the end of your current trial or paid period.</p>
                </div>
                {canCancel && view === "overview" && (
                  <Link to="/manage-subscription/cancel" className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Cancel subscription
                  </Link>
                )}
                {!canCancel && (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <CheckCircle2 className="h-4 w-4" /> Renewal is off
                  </span>
                )}
              </div>
              {view === "cancel" && canCancel && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-950">Are you sure you want to cancel?</p>
                  <p className="mt-1 text-sm text-red-900">
                    {activePeriodEnd
                      ? `No future subscription payments will be requested. Your profile remains active until ${formatDate(activePeriodEnd)}.`
                      : "No future debits will be requested. Your trial access has not started."}
                  </p>
                  <h3 className="mt-5 text-sm font-bold text-red-950">What happens next?</h3>
                  <ul className="mt-3 space-y-2 text-sm text-red-900">
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> No future charges will be made.</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> Your profile remains visible until the current period ends.</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> You can subscribe again whenever you are ready.</li>
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" disabled={cancelling} onClick={() => void cancelSubscription()} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                      Confirm Cancellation
                    </button>
                    <Link to="/manage-subscription" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Go Back</Link>
                  </div>
                </div>
              )}
            </section>}

            {(view === "overview" || view === "history") && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Payment history</h2>
                  <p className="mt-1 text-sm text-slate-600">Transaction references and payment outcomes for this subscription.</p>
                </div>
                {view === "overview" ? (
                  <Link to="/manage-subscription/history" className="text-sm font-semibold text-blue-700 hover:underline">View all</Link>
                ) : subscription.status === "active" && <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
              </div>
              {view === "history" && (
                <div className="mt-5 flex gap-2" role="group" aria-label="Filter payment history">
                  {(["all", "successful", "failed"] as const).map((filter) => (
                    <button key={filter} type="button" onClick={() => setPaymentFilter(filter)} aria-pressed={paymentFilter === filter} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${paymentFilter === filter ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {filter === "successful" ? "Successful" : filter}
                    </button>
                  ))}
                </div>
              )}
              {historyPayments.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Date</th>
                        <th className="pb-3 pr-4 font-semibold">Reference</th>
                        <th className="pb-3 pr-4 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="py-3 pr-4 text-slate-700">{formatDate(payment.created_at)}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-700">{payment.provider_reference || payment.reference}</td>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{formatAmount(payment.amount, payment.currency)}</td>
                          <td className="py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${["success", "successful", "verified", "completed"].includes(payment.status) ? "bg-emerald-100 text-emerald-800" : payment.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
                              {statusLabel(payment.status)}
                            </span>
                            {payment.failure_code && <p className="mt-1 text-xs text-red-700">Failure: {payment.failure_code}</p>}
                            {successfulPaymentStatuses.includes(payment.status) && (
                              <button type="button" onClick={() => setReceipt(payment)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                                <Receipt className="h-3.5 w-3.5" /> View receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  {subscription.payments?.length ? "No payments match this filter." : "No subscription payments have been recorded yet."}
                </p>
              )}
            </section>}
          </>
        )}
      </section>
      {receipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <style>{`@media print { body * { visibility: hidden !important; } #service-payment-receipt, #service-payment-receipt * { visibility: visible !important; } #service-payment-receipt { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; } }`}</style>
          <div id="service-payment-receipt" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-800">JobBridge</p>
                <h2 id="receipt-title" className="mt-1 text-2xl font-bold text-slate-950">Payment receipt</h2>
                <p className="mt-1 text-sm text-slate-500">Service-provider subscription</p>
              </div>
              <Receipt className="h-7 w-7 text-blue-700" />
            </div>
            <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Provider</dt><dd className="text-right font-medium text-slate-900">{user.email}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan</dt><dd className="text-right font-medium text-slate-900">{subscription?.plan_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Amount paid</dt><dd className="text-right font-bold text-slate-950">{formatAmount(receipt.amount, receipt.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment date</dt><dd className="text-right font-medium text-slate-900">{formatDate(receipt.created_at)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Transaction reference</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs text-slate-900">{receipt.provider_reference || receipt.reference}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-semibold capitalize text-emerald-700">{statusLabel(receipt.status)}</dd></div>
            </dl>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 print:hidden">
              <button type="button" onClick={() => setReceipt(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>
              <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
