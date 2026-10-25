// =========================================================================
// JobBridge — KoraPay "Flexible Card Payments" (recurring / saved-card)
//
// Used by the billing worker and webhook to auto-debit a card that was
// tokenized during checkout. Amounts are in the account currency (NGN).
// Docs: https://docs.korapay.com  —  POST /merchant/api/v1/charges/card
// =========================================================================

export const KORA_API_BASE = "https://api.korapay.com";

export interface KoraChargeResult {
  ok: boolean;
  status?: string; // success | failed | processing
  reference?: string;
  transactionReference?: string;
  amountCharged?: number;
  currency?: string;
  failureCode?: string;
  message?: string;
  raw?: unknown;
}

function fmtError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function serializeCharge(data: any): KoraChargeResult {
  const d = data?.data || {};
  const status = String(d?.status ?? "");
  const ok = data?.status === true && status === "success";

  return {
    ok,
    status,
    reference: d?.payment_reference || d?.reference,
    transactionReference: d?.transaction_reference,
    amountCharged: Number(d?.amount_charged ?? d?.amount ?? 0),
    currency: d?.currency || "NGN",
    failureCode: d?.failed_code || d?.failure_code || d?.message || undefined,
    message: data?.message || d?.message,
    raw: data,
  };
}

/**
 * Charge a previously-tokenized card (KoraPay saved card) for a subscription
 * renewal. `token` is the `card.token` returned by a prior checkout/verify
 * where the customer opted to save their card.
 */
export async function chargeSavedCard({
  secretKey,
  email,
  name,
  token,
  amount,
  reference,
  currency = "NGN",
  metadata,
}: {
  secretKey: string;
  email: string;
  name?: string;
  token: string;
  amount: number;
  reference: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<KoraChargeResult> {
  try {
    const res = await fetch(`${KORA_API_BASE}/merchant/api/v1/charges/card`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        reference,
        customer: { email, name: name || email },
        card: { token },
        metadata,
      }),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    // KoraPay returns HTTP 200 with `status:false` on decline/insufficient funds.
    return serializeCharge(json);
  } catch (e) {
    return { ok: false, failureCode: "network_error", message: fmtError(e), raw: e };
  }
}

/**
 * Extract a savable card token from a KoraPay verification/webhook payload
 * (present when the customer saved their card during checkout).
 */
export function cardTokenFromVerification(data: any): string | null {
  const d = data?.data || {};
  const card = d?.card || {};
  return card?.token || d?.token || null;
}

/**
 * Map a client payment plan key onto the monetization `plans` catalogue.
 * Returns null for plans that must NOT become recurring subscriptions
 * (one-time job posts, AI tools, business adverts).
 */
export function planKeyFor(planKey: string): { plan_key: string; product_line: string } | null {
  const p = (planKey || "").toLowerCase();
  switch (p) {
    case "premium":
    case "job_premium":
      return { plan_key: "job_premium", product_line: "job_post" };
    case "service_monthly":
    case "svc_basic":
      return { plan_key: "svc_basic", product_line: "service" };
    case "service_verified":
    case "svc_verified":
      return { plan_key: "svc_verified", product_line: "service" };
    case "service_featured":
    case "svc_featured":
      return { plan_key: "svc_featured", product_line: "service" };
    default:
      return null;
  }
}

/**
 * Save a KoraPay saved-card token against the user's subscription so the
 * billing worker can auto-debit renewals. Upserts (finds-or-creates) the
 * subscription row keyed by user + monetization plan. No-ops for plans that
 * are not recurring (`planKeyFor` returned null) or when token is empty.
 *
 * HARDENING (2026-08-08):
 *   - Duration is read from the `plans` catalogue (single source of truth).
 *   - On FIRST subscription creation for a `service` plan, the marketplace
 *     visibility window is opened immediately (profiles.visibility_until =
 *     period end, is_active = true, service_subscription_id linked) and the
 *     dedicated service_providers row is activated — otherwise a brand-new
 *     provider would stay hidden from the public feed until their first
 *     renewal succeeded.
 */
export async function persistKoraCardToken(
  supabase: any,
  userId: string,
  paymentPlan: string,
  token: string,
  trial = false,
): Promise<{ id?: string; created?: boolean; skipped?: boolean; error?: string } | null> {
  if (!token || !userId) return null;
  const mapped = planKeyFor(paymentPlan);
  if (!mapped) return { skipped: true };
  if (mapped.product_line === "service") {
    return {
      error: "Service-provider subscriptions require an active KoraPay Direct Debit authorization.",
    };
  }

  const now = new Date();
  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .select("duration_days, product_line")
    .eq("key", mapped.plan_key)
    .eq("is_active", true)
    .maybeSingle();
  if (planError || !planRow) {
    const message = planError?.message || `Plan ${mapped.plan_key} is unavailable`;
    console.error("[korapay-recurring] could not load subscription plan:", message);
    return { error: message };
  }

  const [{ data: activeSubscription, error: activeError }, { data: samePlan, error: samePlanError }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("product_line", mapped.product_line)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_key", mapped.plan_key)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (activeError || samePlanError) {
    const message = activeError?.message || samePlanError?.message || "Could not read the current subscription";
    console.error("[korapay-recurring] subscription lookup failed:", message);
    return { error: message };
  }

  const existing = activeSubscription || samePlan;
  const durationDays = planRow.duration_days;
  const productLine = planRow.product_line;
  const periodEnd = new Date(now.getTime() + durationDays * 86400000).toISOString();
  const initialStatus = trial ? "trialing" : "active";
  const subscriptionValues = {
    plan_key: mapped.plan_key,
    product_line: productLine,
    status: initialStatus,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
    kora_card_token_key: token,
    auto_renew: true,
    launch_free_period: false,
    failed_retries: 0,
    next_attempt_at: null,
    grace_ends_at: null,
    canceled_at: null,
    cancel_reason: null,
    metadata: { source: trial ? "kora_trial" : "kora_checkout" },
    updated_at: now.toISOString(),
  };

  let subscriptionId: string;
  let created = false;
  if (existing) {
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update(subscriptionValues)
      .eq("id", existing.id);
    if (updateError) {
      console.error("[korapay-recurring] subscription update failed:", updateError.message);
      return { error: updateError.message };
    }
    subscriptionId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("subscriptions")
      .insert({
      user_id: userId,
      ...subscriptionValues,
    })
      .select("id")
      .maybeSingle();
    if (insertError || !inserted) {
      const message = insertError?.message || "Subscription insert returned no row";
      console.error("[korapay-recurring] subscription insert failed:", message);
      return { error: message };
    }
    subscriptionId = inserted.id;
    created = true;
  }

  if (productLine === "service") {
    const isVerified = paymentPlan !== "service_monthly";
    const isFeatured = paymentPlan === "service_featured";
    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("specialty, service_category")
      .eq("id", userId)
      .maybeSingle();
    if (profileLookupError || !profile) {
      const message = profileLookupError?.message || "Provider profile was not found";
      console.error("[korapay-recurring] provider profile lookup failed:", message);
      return { error: message };
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "provider",
        is_premium: true,
        subscription_tier: paymentPlan,
        subscription_expires_at: periodEnd,
        trial_start_date: trial ? now.toISOString() : null,
        trial_end_date: trial ? periodEnd : null,
        trial_plan: paymentPlan,
        visibility_until: periodEnd,
        is_verified: isVerified,
        is_featured: isFeatured,
        is_active: true,
        service_subscription_id: subscriptionId,
        updated_at: now.toISOString(),
      })
      .eq("id", userId);
    if (profileError) {
      console.error("[korapay-recurring] provider profile activation failed:", profileError.message);
      return { error: profileError.message };
    }

    const { data: provider, error: providerLookupError } = await supabase
      .from("service_providers")
      .select("id")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle();
    if (providerLookupError) {
      console.error("[korapay-recurring] provider listing lookup failed:", providerLookupError.message);
      return { error: providerLookupError.message };
    }

    const listing = {
      specialty: profile.specialty || profile.service_category || "Service Professional",
      is_verified: isVerified,
      is_active: true,
      updated_at: now.toISOString(),
    };
    const { error: providerError } = provider
      ? await supabase.from("service_providers").update(listing).eq("id", provider.id)
      : await supabase.from("service_providers").insert({ profile_id: userId, ...listing });
    if (providerError) {
      console.error("[korapay-recurring] provider listing activation failed:", providerError.message);
      return { error: providerError.message };
    }
  }

  return { id: subscriptionId, created };
}
