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
): Promise<{ id?: string; created?: boolean; skipped?: boolean; error?: string } | null> {
  if (!token || !userId) return null;
  const mapped = planKeyFor(paymentPlan);
  if (!mapped) return { skipped: true };

  // Resolve duration/line from the plans catalogue (single source of truth).
  const { data: planRow } = await supabase
    .from("plans")
    .select("duration_days, product_line")
    .eq("key", mapped.plan_key)
    .maybeSingle();
  const durationDays = planRow?.duration_days || 30;
  const productLine = planRow?.product_line || mapped.product_line;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + durationDays * 86400000).toISOString();
  const base = {
    kora_card_token_key: token,
    auto_renew: true,
    updated_at: now.toISOString(),
  };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_key", mapped.plan_key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("subscriptions")
      .update(base)
      .eq("id", existing.id);
    if (error) {
      console.warn("[korapay-recurring] subscription update failed:", error.message);
      return { error: error.message };
    }
    return { id: existing.id, created: false };
  }

  const { plan_key } = mapped;
  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_key,
      product_line: productLine,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd,
      kora_card_token_key: token,
      auto_renew: true,
      launch_free_period: false,
      metadata: { source: "kora_checkout" },
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[korapay-recurring] subscription insert failed:", error.message);
    return { error: error.message };
  }

  // New service subscription → open the marketplace visibility window so the
  // provider is listed immediately (public feed gates on visibility_until).
  if (productLine === "service" && inserted?.id) {
    try {
      await supabase
        .from("profiles")
        .update({
          visibility_until: periodEnd,
          is_active: true,
          service_subscription_id: inserted.id,
          updated_at: now.toISOString(),
        })
        .eq("id", userId);
      await supabase.from("service_providers").update({ is_active: true, updated_at: now.toISOString() }).eq("profile_id", userId);
    } catch (e) {
      console.warn("[korapay-recurring] could not open provider visibility:", e);
    }
  }

  return { id: inserted?.id, created: true };
}
