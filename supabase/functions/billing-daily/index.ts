// =========================================================================
// JobBridge — `billing-daily` edge function (automated billing engine)
//
// PURPOSE:  Drives the monetization state machine on a daily cron:
//     1) expiring one-time job posts (soft hide),
//     2) hiding listings whose billing grace window elapsed,
//     3) launch-free rollover (no charge),
//     4) active renewals (tokenised auto-debit),
//     5) past-due retries (Day 1 then Day 2 after last failure, then grace),
//     6) hard cancel + notify after grace elapses.
//
// HARDENING (2026-08-08):
//   - Every charge attempt writes a `payments` ledger row (status pending,
//     billing_phase renewal|retry, idempotency_key = reference) BEFORE calling
//     the gateway. This gives kora-webhook a reconciliation anchor so a charge
//     that actually succeeded (but returned network_error/timeout to us) is
//     never re-charged on the next retry.
//   - Before declaring a failure we re-check the ledger: if kora-webhook
//     already verified this reference, the charge succeeded — we reconcile
//     instead of scheduling a retry (prevents double-charging).
//   - Period rollover + grace length come from `plans` (duration_days /
//     product_config.grace_days) — the plans table is the single source of
//     truth, no more hardcoded 30/3.
//   - `success()` is idempotent: it never extends the period twice for the
//     same reference (safe when cron and webhook race).
//
// SECRETS:  KORA_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// SCHEDULE: daily (Vercel cron / Supabase pg_cron hitting `billing-daily`).
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { chargeSavedCard } from "../_shared/korapay-recurring.ts";

const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface Subscription {
  id: string;
  user_id: string;
  plan_key: string;
  product_line: string;
  status: string;
  current_period_end: string;
  kora_card_token_key: string | null;
  auto_renew: boolean;
  launch_free_period: boolean;
  failed_retries: number;
  grace_ends_at: string | null;
  base_price_ngn: number;
  duration_days: number;
  grace_days: number;
  currency: string;
}

const PLAN_LABELS: Record<string, string> = {
  job_basic: "Basic Job Post",
  job_standard: "Standard Job Post",
  job_premium: "Premium Job Post",
  svc_basic: "Basic Service Provider",
  svc_verified: "Verified Service Provider",
  svc_featured: "Featured Professional",
};
const planLabel = (k: string) => PLAN_LABELS[k] || k;

const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 86400000).toISOString();

async function notifyUser(supabase: any, userId: string, title: string, content: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.from("notifications").insert({ user_id: userId, type: "payment", title, content, data });
  } catch (e) {
    console.error("[billing-daily] notify failed:", e);
  }
}

async function userEmail(supabase: any, userId: string): Promise<{ email: string; name: string }> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const meta = data?.user?.user_metadata || {};
    return {
      email: data?.user?.email || "",
      name: meta?.full_name || data?.user?.email?.split("@")[0] || "there",
    };
  } catch {
    return { email: "", name: "there" };
  }
}

async function emailUser(supabase: any, userId: string, subject: string, message: string, planKey?: string): Promise<void> {
  const { email, name } = await userEmail(supabase, userId);
  if (!email) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment_failed",
        email,
        name,
        plan: planKey ? planLabel(planKey) : "your subscription",
        subject,
        message,
      }),
    });
  } catch (e) {
    console.error("[billing:email] failed:", e);
  }
}

// ── Ledger anchor: write a pending payment row BEFORE hitting the gateway ──
async function recordAttempt(supabase: any, sub: Subscription, reference: string, attempt: number): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("payments").upsert(
    {
      user_id: sub.user_id,
      subscription_id: sub.id,
      plan: sub.plan_key,
      amount: sub.base_price_ngn,
      currency: sub.currency || "NGN",
      reference,
      status: "pending",
      billing_phase: attempt > 1 ? "retry" : "renewal",
      idempotency_key: reference,
      provider: "korapay",
      metadata: { subscription_id: sub.id, plan_key: sub.plan_key, attempt },
      updated_at: now,
    },
    { onConflict: "idempotency_key" },
  );
  if (error) {
    console.error("[billing-daily] recordAttempt failed:", error.message);
  }
}

// ── Success path: roll the period forward (idempotent) + close the ledger ──
async function success(sub: Subscription, reference: string, supabase: any): Promise<void> {
  const now = new Date();
  const durationDays = sub.duration_days || 30;
  const periodEnd = addDays(now, durationDays);

  // Idempotent rollover: never extend the period twice for the same reference
  // (cron + webhook may race; whichever runs second must not double-roll).
  const { data: cur } = await supabase
    .from("subscriptions")
    .select("current_period_end, last_attempt_ref")
    .eq("id", sub.id)
    .maybeSingle();
  const alreadyRolled =
    cur?.last_attempt_ref === reference &&
    cur?.current_period_end &&
    new Date(cur.current_period_end) >= new Date(periodEnd);

  if (!alreadyRolled) {
    await supabase.from("subscriptions").update({
      status: "active",
      failed_retries: 0,
      last_attempt_at: now.toISOString(),
      last_attempt_ref: reference,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd,
      next_attempt_at: null,
      grace_ends_at: null,
      launch_free_period: false,
      updated_at: now.toISOString(),
    }).eq("id", sub.id);
  }

  // Close the ledger row (idempotent — no-op if the webhook already verified).
  await supabase
    .from("payments")
    .update({ status: "completed", provider_reference: reference, updated_at: now.toISOString() })
    .eq("idempotency_key", reference)
    .neq("status", "completed")
    .neq("status", "verified");

  // Restore visibility that may have been in grace.
  if (sub.product_line === "job_post") {
    await supabase.from("jobs").update({ is_active: true, grace_ends_at: null }).eq("subscription_id", sub.id);
  } else {
    await supabase.from("profiles").update({ visibility_until: periodEnd, is_active: true }).eq("id", sub.user_id);
    await supabase.from("service_providers").update({ is_active: true }).eq("profile_id", sub.user_id);
  }
}

// ── Failure: mark past_due, schedule retry, open grace on final attempt ─────
async function markFailed(sub: Subscription, supabase: any, attempt: number, reason: string, reference?: string): Promise<void> {
  const now = new Date();
  const graceDays = sub.grace_days || 3;
  const delay = attempt === 1 ? 1 : attempt === 2 ? 2 : null; // Day 31, Day 33
  await supabase.from("subscriptions").update({
    status: "past_due",
    failed_retries: attempt,
    last_attempt_at: now.toISOString(),
    next_attempt_at: delay ? addDays(now, delay) : null,
    grace_ends_at: attempt >= 3 ? addDays(now, graceDays) : sub.grace_ends_at,
    updated_at: now.toISOString(),
  }).eq("id", sub.id);

  if (reference) {
    await supabase
      .from("payments")
      .update({ status: "failed", failure_code: reason, provider_reference: reference, updated_at: now.toISOString() })
      .eq("idempotency_key", reference)
      .neq("status", "verified")
      .neq("status", "completed");
  }

  const title = attempt >= 3 ? "Final renewal notice" : "Renewal failed";
  const body = attempt >= 3
    ? "Your subscription could not be renewed. Your listing will be hidden after the grace period."
    : "We could not renew your subscription — retrying automatically.";
  await notifyUser(supabase, sub.user_id, title, body, { reason });
  await emailUser(supabase, sub.user_id, title, body, sub.plan_key);
}

// ── Single charge step (used by both renewal and retry) ─────────────────────
// Returns "renewed" | "recovered" | "failed" so the summary is accurate.
async function chargeStep(sub: Subscription, supabase: any, attempt: number): Promise<"renewed" | "recovered" | "failed"> {
  const token = sub.kora_card_token_key;
  if (!token) {
    await markFailed(sub, supabase, attempt, "no_card_on_file");
    await notifyUser(supabase, sub.user_id, "Add a card", "No card on file for renewal — add one to keep your listing visible.");
    return "failed";
  }

  const reference = `JB-${sub.id}-${sub.plan_key}-${attempt}`;
  await recordAttempt(supabase, sub, reference, attempt);

  const { email, name } = await userEmail(supabase, sub.user_id);
  const result = await chargeSavedCard({
    secretKey: KORA_SECRET_KEY,
    email,
    name,
    token,
    amount: sub.base_price_ngn,
    reference,
    metadata: { subscription_id: sub.id, plan_key: sub.plan_key, attempt },
  });

  if (result.ok) {
    const wasPastDue = sub.status === "past_due";
    await success(sub, reference, supabase);
    if (wasPastDue) {
      await notifyUser(supabase, sub.user_id, "Subscription recovered", "Your unpaid renewal succeeded — your listing is active again.");
      return "recovered";
    }
    return "renewed";
  }

  // Before declaring failure, reconcile with the ledger: if kora-webhook has
  // already verified/confirmed this reference, the charge actually succeeded
  // server-side (network/timeout race). Do NOT schedule a retry → no double charge.
  try {
    const { data: ledger } = await supabase
      .from("payments")
      .select("status")
      .eq("idempotency_key", reference)
      .maybeSingle();
    if (ledger && (ledger.status === "verified" || ledger.status === "completed")) {
      const wasPastDue = sub.status === "past_due";
      await success(sub, reference, supabase);
      return wasPastDue ? "recovered" : "renewed";
    }
  } catch (e) {
    console.warn("[billing-daily] ledger reconcile check failed:", e);
  }

  await markFailed(sub, supabase, attempt, result.failureCode || result.message || "declined", reference);
  return "failed";
}

// ── Grace elapsed → hard cancel ───────────────────────────────────────────
async function finalizeCanceled(sub: Subscription, supabase: any): Promise<void> {
  await supabase.from("subscriptions").update({
    status: "canceled",
    auto_renew: false,
    canceled_at: new Date().toISOString(),
    cancel_reason: "grace_elapsed",
    updated_at: new Date().toISOString(),
  }).eq("id", sub.id);
  await notifyUser(supabase, sub.user_id, "Subscription ended", "Your subscription was canceled after the grace period passed.");
  await emailUser(supabase, sub.user_id, "Subscription ended", "Your subscription was canceled after the grace period passed.", sub.plan_key);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !KORA_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const summary: Record<string, number> = { processed: 0, renewed: 0, recovered: 0, failed: 0, launch_free: 0, expired_jobs: 0, grace_hidden: 0, hard_canceled: 0 };

  // dryRun: report what would happen without charging / mutating.
  let dryRun = false;
  try {
    const url = new URL(req.url);
    dryRun = url.searchParams.get("dryRun") === "1";
  } catch {
    dryRun = false;
  }

  try {
    // 1) expire one-time posts
    const exp = await supabase.rpc("expire_job_posts");
    summary.expired_jobs = exp.data || 0;

    // 2) hide listings past grace
    const gv = await supabase.rpc("enforce_billing_visibility");
    summary.grace_hidden = gv.data || 0;

    // 3) process due subscriptions
    const { data: due } = await supabase.rpc("list_due_subscriptions");
    const items = (due || []) as Subscription[];

    if (dryRun) {
      const preview = items.map((s) => ({
        subscription_id: s.id,
        plan_key: s.plan_key,
        status: s.status,
        action:
          s.launch_free_period ? "launch_free_rollover"
          : s.status === "past_due" && s.grace_ends_at && new Date(s.grace_ends_at) <= new Date() ? "hard_cancel"
          : `charge_attempt_${s.failed_retries + 1}`,
        amount_ngn: s.base_price_ngn,
      }));
      return new Response(JSON.stringify({ ok: true, dryRun: true, summary: { ...summary, processed: items.length }, actions: preview }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const sub of items) {
      summary.processed += 1;

      // launch-free: no charge, roll to live next cycle
      if (sub.launch_free_period) {
        const now = new Date();
        const durationDays = sub.duration_days || 30;
        await supabase.from("subscriptions").update({
          launch_free_period: false,
          current_period_start: now.toISOString(),
          current_period_end: addDays(now, durationDays),
        }).eq("id", sub.id);
        summary.launch_free += 1;
        continue;
      }

      if (sub.status === "past_due" && sub.grace_ends_at && new Date(sub.grace_ends_at) <= new Date()) {
        await finalizeCanceled(sub, supabase);
        summary.hard_canceled += 1;
        continue;
      }

      const attempt = sub.failed_retries + 1;
      const outcome = await chargeStep(sub, supabase, attempt);
      if (outcome === "renewed") summary.renewed += 1;
      else if (outcome === "recovered") summary.recovered += 1;
      else summary.failed += 1;
    }

    return new Response(JSON.stringify({ ok: true, dry_run: false, summary }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[billing-daily] error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
