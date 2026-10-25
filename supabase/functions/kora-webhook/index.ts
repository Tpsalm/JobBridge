import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  buildSeedPaymentPayload,
  buildSeedProfilePayload,
  isLocalTestOverrideEnabled,
  normalizeSeedUserId,
  shouldAutoSeedPayment,
} from "../_shared/payment-seeding.ts";
import { cardTokenFromVerification, persistKoraCardToken } from "../_shared/korapay-recurring.ts";
import {
  retrieveAuthorization,
  verifyCharge as verifyKoraCharge,
} from "../_shared/korapay-direct-debit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_API_BASE = "https://api.korapay.com/merchant/api/v1";
const KORA_ALLOW_SIMULATED_VERIFICATION = isLocalTestOverrideEnabled(
  Deno.env.get("JOBBRIDGE_ENV"),
  Deno.env.get("KORA_ALLOW_SIMULATED_VERIFICATION"),
  SUPABASE_URL,
);
const SKIP_KORA_SIGNATURE_CHECK = isLocalTestOverrideEnabled(
  Deno.env.get("JOBBRIDGE_ENV"),
  Deno.env.get("SKIP_KORA_SIGNATURE_CHECK"),
  SUPABASE_URL,
);

const ALLOWED_EVENTS = new Set([
  "charge.success",
  "charge.failed",
  "direct_debit.auth",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-korapay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface KoraWebhookPayload {
  event: string;
  type?: string;
  status?: string;
  data: {
    reference?: string;
    amount?: string | number;
    amount_expected?: string | number;
    amount_paid?: string | number;
    fee?: string | number;
    status?: string;
    currency?: string;
    payment_reference?: string;
    transaction_reference?: string;
    transaction_status?: string;
    payment_method?: string;
    authorization_code?: string;
    direct_debit?: {
      authorization_code?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

interface KoraChargeVerificationResponse {
  status: boolean;
  message?: string;
  data?: {
    reference?: string;
    payment_reference?: string;
    transaction_reference?: string;
    status?: string;
    amount?: string | number;
    amount_paid?: string | number;
    currency?: string;
    [key: string]: unknown;
  };
}

interface PaymentRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  amount: number;
  currency: string | null;
  reference: string;
  subscription_id?: string | null;
  billing_phase?: string | null;
  idempotency_key?: string | null;
}

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function planLabel(plan: string): string {
  switch (plan) {
    case "basic":
      return "Basic Job Post";
    case "standard":
      return "Standard Job Post";
    case "premium":
    case "job_premium":
      return "Premium Job Post";
    case "svc_basic":
      return "Basic Service Provider";
    case "svc_verified":
      return "Verified Service Provider";
    case "svc_featured":
      return "Featured Professional";
    case "ai_monthly":
      return "AI Career Tools Monthly";
    case "ai_annual":
      return "AI Career Tools Annual";
    case "service_verified":
      return "Verified Professional Listing";
    case "service_featured":
      return "Featured Professional Listing";
    default:
      return "JobBridge Plan";
  }
}

async function ensureSeedUser(
  supabase: ReturnType<typeof createClient>,
  payload: KoraWebhookPayload,
): Promise<{ id: string; createUserResult?: unknown; createUserError?: unknown }> {
  const data = payload.data || {};
  const metadata = (data.metadata as Record<string, unknown> | undefined) || {};
  const providedUserId = normalizeSeedUserId(metadata.user_id || data.user_id || "");
  if (providedUserId) {
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", providedUserId)
      .maybeSingle();

    if (!profileError && existingProfile?.id) {
      return { id: providedUserId };
    }
  }

  const email = String(metadata.email || data.email || "").trim();
  if (!email) {
    return providedUserId;
  }

  const password = `${Math.random().toString(36).slice(2)}A!1`;
  const fullName = String(metadata.full_name || metadata.name || email.split("@")[0] || "Simulated User");
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "job_seeker",
    },
  });

  if (createUserError || !createdUser?.user?.id) {
    console.error("[Kora Webhook] Failed to create seed auth user:", createUserError?.message || "unknown");

    // If the error indicates the email already exists, try to resolve the existing
    // auth user id by checking `profiles` or using the admin listUsers if available.
    try {
      // 1) Try to find an existing profile with this email
      if (email) {
        const { data: existingProfileByEmail, error: profErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (!profErr && existingProfileByEmail?.id) {
          return { id: existingProfileByEmail.id, createUserResult: createdUser || null, createUserError: createUserError || null };
        }
      }

      // 2) If admin.listUsers is available, try to find user by email
      // Protect calls in try/catch since method may not exist in this runtime
      const adminAny: any = (supabase as any).auth?.admin;
      if (adminAny && typeof adminAny.listUsers === "function") {
        try {
          const listRes = await adminAny.listUsers();
          const users = listRes?.data?.users || listRes?.users || [];
          const found = users.find((u: any) => String(u.email || "").toLowerCase() === email.toLowerCase());
          if (found && found.id) {
            return { id: found.id, createUserResult: createdUser || null, createUserError: createUserError || null };
          }
        } catch (e) {
          console.warn("[Kora Webhook] listUsers lookup failed:", e);
        }
      }
    } catch (lookupErr) {
      console.warn("[Kora Webhook] fallback lookup after createUser failed:", lookupErr);
    }

    return { id: providedUserId || "", createUserResult: createdUser || null, createUserError: createUserError || null };
  }

  return { id: createdUser.user.id, createUserResult: createdUser, createUserError: null };
}

async function insertNotification(
  supabase: ReturnType<typeof createClient>,
  input: {
    userId: string;
    type: "payment";
    title: string;
    content: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    content: input.content,
    data: input.data || {},
  });

  if (error) {
    console.error(
      "[Kora Webhook] Failed to insert notification:",
      error.message,
    );
  }
}

async function sendPaymentConfirmationEmail(
  supabase: ReturnType<typeof createClient>,
  payment: PaymentRow,
  reference: string,
): Promise<void> {
  try {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      payment.user_id,
    );

    if (userError || !userData?.user?.email) {
      console.warn(
        "[Kora Webhook] Could not resolve user email for payment confirmation email:",
        userError?.message || "No email",
      );
      return;
    }

    async function sendPaymentFailureEmail(
      supabase: ReturnType<typeof createClient>,
      payment: Pick<PaymentRow, "user_id" | "plan" | "amount">,
      reference: string,
    ): Promise<void> {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(payment.user_id);
        if (error || !data?.user?.email) {
          console.warn("[Kora Webhook] Could not resolve user email for failed payment notification.");
          return;
        }
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "payment_failed",
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.email,
            plan: planLabel(payment.plan),
            amount: String(payment.amount),
            reference,
          }),
        });
        if (!response.ok) {
          console.error("[Kora Webhook] Failed-payment email was rejected:", response.status);
        }
      } catch (error) {
        console.error("[Kora Webhook] Failed-payment email could not be sent:", error);
      }
    }

    const emailPayload = {
      type: "payment",
      email: userData.user.email,
      name: userData.user.user_metadata?.full_name || userData.user.email,
      plan: payment.plan,
      amount: String(payment.amount),
    };

    const emailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const emailResponse = await fetch(emailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const emailText = await emailResponse.text();
    if (!emailResponse.ok) {
      console.error(
        "[Kora Webhook] Payment confirmation email failed:",
        emailResponse.status,
        emailText,
      );
      return;
    }

    console.log(
      `[Kora Webhook] Payment confirmation email queued for ${reference} to ${userData.user.email}`,
    );
  } catch (error) {
    console.error("[Kora Webhook] Error sending payment confirmation email:", error);
  }
}

async function reconcileRenewal(
  supabase: ReturnType<typeof createClient>,
  payment: PaymentRow,
  reference: string,
): Promise<void> {
  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end, last_attempt_ref, plan_key, product_line")
      .eq("id", payment.subscription_id)
      .maybeSingle();
    if (!sub) {
      console.warn("[Kora Webhook] reconcileRenewal: no subscription for", payment.subscription_id);
      return;
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("duration_days")
      .eq("key", sub.plan_key)
      .maybeSingle();
    const durationDays = plan?.duration_days || 30;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + durationDays * 86400000).toISOString();

    // Idempotent: never roll the period twice for the same reference — the
    // cron (`billing-daily`) may race this webhook.
    const alreadyRolled =
      sub.last_attempt_ref === reference &&
      sub.current_period_end &&
      new Date(sub.current_period_end) >= new Date(periodEnd);

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
      }).eq("id", payment.subscription_id);
    }

    // Restore listing visibility (may have entered grace during retries).
    if (sub.product_line === "job_post") {
      await supabase.from("jobs").update({ is_active: true, grace_ends_at: null }).eq("subscription_id", payment.subscription_id);
    } else {
      await supabase.from("profiles").update({ visibility_until: periodEnd, is_active: true }).eq("id", payment.user_id);
      await supabase.from("service_providers").update({ is_active: true }).eq("profile_id", payment.user_id);
    }
  } catch (e) {
    console.error("[Kora Webhook] reconcileRenewal error:", e);
  }
}

async function verifySignature(
  signature: string | null,
  rawBodyBytes: ArrayBuffer,
): Promise<boolean> {
  if (!signature || !KORA_SECRET_KEY) {
    return false;
  }

  try {
    const keyBytes = new TextEncoder().encode(KORA_SECRET_KEY);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      rawBodyBytes,
    );
    const expected = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    const supplied = signature.trim().replace(/^sha256=/i, "").toLowerCase();
    if (supplied.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index++) {
      difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
    }
    return difference === 0;
  } catch (err) {
    console.error("[Kora Webhook] Signature verification error:", err);
    return false;
  }
}

async function verifyCharge(
  reference: string,
  payload: KoraWebhookPayload,
): Promise<KoraChargeVerificationResponse> {
  const shouldSimulate =
    KORA_ALLOW_SIMULATED_VERIFICATION &&
    Boolean(payload.data?.simulate_verification || payload.data?.test_mode);

  if (shouldSimulate) {
    console.log(
      "[Kora Webhook] Simulating charge verification for reference:",
      reference,
    );
    return {
      status: true,
      message: "Simulated verification",
      data: {
        reference,
        payment_reference:
          payload.data.payment_reference || payload.data.transaction_reference ||
          reference,
        transaction_reference:
          payload.data.transaction_reference ||
          payload.data.payment_reference ||
          reference,
        status: "success",
        amount: payload.data.amount_paid ?? payload.data.amount_expected ?? payload.data.amount,
        amount_paid: payload.data.amount_paid ?? payload.data.amount_expected ?? payload.data.amount,
        currency: payload.data.currency || "NGN",
      },
    };
  }

  console.log("[Kora Webhook] Verifying charge for reference:", reference);
  console.log("[Kora Webhook] Verification payload:", JSON.stringify(payload.data));
  const response = await fetch(
    `${KORA_API_BASE}/charges/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${KORA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  const bodyText = await response.text();
  console.log("[Kora Webhook] Verify charge response status:", response.status);
  console.log("[Kora Webhook] Verify charge response body:", bodyText);
  let body: KoraChargeVerificationResponse | null = null;

  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.status) {
    throw new Error(
      body?.message || `Kora verify failed with status ${response.status}`,
    );
  }

  return body;
}

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

async function processDirectDebitAuthorization(
  supabase: ReturnType<typeof createClient>,
  payload: KoraWebhookPayload,
): Promise<Response> {
  const authCode = String(payload.data.authorization_code || payload.data.reference || "");
  if (!authCode) return new Response("ok", { status: 200, headers: corsHeaders });

  let { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_key, status, metadata, current_period_end, trial_start_at, pending_kora_authorization_code, pending_kora_authorization_expires_at, pending_plan_key, pending_payment_method_bank, pending_payment_method_last4")
    .eq("kora_authorization_code", authCode)
    .eq("product_line", "service")
    .maybeSingle();

  if (!subscription) {
    const lookup = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_key, status, metadata, current_period_end, trial_start_at, pending_kora_authorization_code, pending_kora_authorization_expires_at, pending_plan_key, pending_payment_method_bank, pending_payment_method_last4")
      .eq("pending_kora_authorization_code", authCode)
      .eq("product_line", "service")
      .maybeSingle();
    subscription = lookup.data;
    error = lookup.error;
  }
  if (error) {
    console.error("[Kora Webhook] Direct Debit authorization lookup failed:", error.message);
    return new Response("Retry", { status: 500, headers: corsHeaders });
  }
  if (!subscription) return new Response("ok", { status: 200, headers: corsHeaders });

  const replacingAuthorization =
    subscription.pending_kora_authorization_code === authCode;
  if (!replacingAuthorization &&
    (subscription.status === "canceled" || subscription.status === "expired")) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  let verifiedAuthorization;
  try {
    verifiedAuthorization = await retrieveAuthorization(
      KORA_SECRET_KEY,
      authCode,
    );
  } catch (verifyError) {
    console.error("[Kora Webhook] Direct Debit authorization verification failed:", verifyError);
    return new Response("Retry", { status: 502, headers: corsHeaders });
  }

  if (verifiedAuthorization.status === "active") {
    const metadata = subscription.metadata && typeof subscription.metadata === "object"
      ? subscription.metadata as Record<string, unknown>
      : {};
    const planKey = replacingAuthorization
      ? String(subscription.pending_plan_key || "")
      : subscription.plan_key;
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("base_price_ngn")
      .eq("key", planKey)
      .maybeSingle();
    if (planError) {
      console.error("[Kora Webhook] Direct Debit plan lookup failed:", planError.message);
      return new Response("Retry", { status: 500, headers: corsHeaders });
    }

    if (
      verifiedAuthorization.debit_type !== "variable" ||
      verifiedAuthorization.currency !== "NGN" ||
      Number(verifiedAuthorization.amount) !== Number(plan?.base_price_ngn)
    ) {
      console.error("[Kora Webhook] Direct Debit authorization does not match the selected plan.");
      return new Response("Invalid authorization", { status: 400, headers: corsHeaders });
    }

    const now = new Date();
    if (replacingAuthorization) {
      const accessEnd = new Date(subscription.current_period_end);
      const nextAttempt = accessEnd <= now ? now.toISOString() : accessEnd.toISOString();
      const nextStatus = accessEnd <= now ? "past_due" : "active";
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          plan_key: planKey,
          kora_authorization_code: authCode,
          kora_authorization_expires_at: subscription.pending_kora_authorization_expires_at,
          pending_kora_authorization_code: null,
          pending_kora_authorization_expires_at: null,
          pending_plan_key: null,
          payment_method_bank: subscription.pending_payment_method_bank,
          payment_method_last4: subscription.pending_payment_method_last4,
          pending_payment_method_bank: null,
          pending_payment_method_last4: null,
          status: nextStatus,
          auto_renew: true,
          cancel_at_period_end: false,
          canceled_at: null,
          cancel_reason: null,
          next_billing_at: nextAttempt,
          next_attempt_at: nextAttempt,
          metadata: {
            ...metadata,
            authorization_status: "active",
            authorization_reference: verifiedAuthorization.reference,
            pending_authorization_status: null,
            pending_authorization_reference: null,
            pending_plan_key: null,
          },
          updated_at: now.toISOString(),
        })
        .eq("id", subscription.id)
        .eq("pending_kora_authorization_code", authCode)
        .neq("status", "canceled");
      if (updateError) {
        console.error("[Kora Webhook] Replacement mandate activation failed:", updateError.message);
        return new Response("Retry", { status: 500, headers: corsHeaders });
      }
      await supabase.from("profiles").update({
        subscription_tier: planKey === "svc_basic"
          ? "service_monthly"
          : planKey === "svc_verified"
          ? "service_verified"
          : "service_featured",
        is_featured: planKey === "svc_featured",
        updated_at: now.toISOString(),
      }).eq("id", subscription.user_id);
      await insertNotification(supabase, {
        userId: subscription.user_id,
        type: "payment",
        title: "Subscription authorization updated",
        content: nextStatus === "past_due"
          ? "Your bank authorization is active. Your outstanding subscription payment will be retried."
          : `Your ${planLabel(planKey)} plan and bank authorization are now active.`,
        data: { subscription_id: subscription.id, status: nextStatus },
      });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const trialDays = Number(metadata.trial_days ?? 21);
    if (subscription.trial_start_at) return new Response("ok", { status: 200, headers: corsHeaders });
    const trialEnd = new Date(now.getTime() + 21 * 86400000);
    const hasTrial = trialDays === 21;
    const periodEnd = hasTrial ? trialEnd : now;
    const { error: activateError } = await supabase
      .from("subscriptions")
      .update({
        status: hasTrial ? "trialing" : "past_due",
        auto_renew: true,
        trial_start_at: hasTrial ? now.toISOString() : null,
        trial_end_at: hasTrial ? trialEnd.toISOString() : null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_at: periodEnd.toISOString(),
        next_attempt_at: periodEnd.toISOString(),
        failed_retries: 0,
        metadata: {
          ...metadata,
          authorization_status: "active",
          authorization_reference: verifiedAuthorization.reference,
        },
        updated_at: now.toISOString(),
      })
      .eq("id", subscription.id)
      .eq("status", "trialing");
    if (activateError) {
      console.error("[Kora Webhook] Direct Debit subscription activation failed:", activateError.message);
      return new Response("Retry", { status: 500, headers: corsHeaders });
    }

    if (hasTrial) {
      const legacyPlan = subscription.plan_key === "svc_basic"
        ? "service_monthly"
        : subscription.plan_key === "svc_verified"
        ? "service_verified"
        : "service_featured";
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: "provider",
          subscription_tier: legacyPlan,
          subscription_expires_at: trialEnd.toISOString(),
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
          trial_plan: legacyPlan,
          service_subscription_id: subscription.id,
          visibility_until: trialEnd.toISOString(),
          is_premium: true,
          is_active: true,
          is_featured: subscription.plan_key === "svc_featured",
          updated_at: now.toISOString(),
        })
        .eq("id", subscription.user_id);
      if (profileError) {
        console.error("[Kora Webhook] Provider trial profile activation failed:", profileError.message);
        return new Response("Retry", { status: 500, headers: corsHeaders });
      }
      const { error: listingError } = await supabase
        .from("service_providers")
        .update({ is_active: true, updated_at: now.toISOString() })
        .eq("profile_id", subscription.user_id);
      if (listingError) {
        console.error("[Kora Webhook] Provider listing activation failed:", listingError.message);
        return new Response("Retry", { status: 500, headers: corsHeaders });
      }
      await insertNotification(supabase, {
        userId: subscription.user_id,
        type: "payment",
        title: "Your 21-day free trial has started",
        content: `Your ${planLabel(subscription.plan_key)} trial is active. Your first monthly charge is scheduled for ${trialEnd.toLocaleDateString("en-GB")}.`,
        data: {
          subscription_id: subscription.id,
          trial_end_at: trialEnd.toISOString(),
          next_billing_at: trialEnd.toISOString(),
        },
      });
    } else {
      await insertNotification(supabase, {
        userId: subscription.user_id,
        type: "payment",
        title: "Bank authorization confirmed",
        content: `Your ${planLabel(subscription.plan_key)} authorization is active. Your first ₦${Number(plan?.base_price_ngn).toLocaleString("en-NG")} payment is being scheduled.`,
        data: { subscription_id: subscription.id, next_billing_at: now.toISOString() },
      });
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (
    verifiedAuthorization.status === "deactivated" ||
    verifiedAuthorization.status === "expired"
  ) {
    if (replacingAuthorization) {
      await supabase.from("subscriptions").update({
        pending_kora_authorization_code: null,
        pending_kora_authorization_expires_at: null,
        pending_plan_key: null,
        pending_payment_method_bank: null,
        pending_payment_method_last4: null,
        metadata: {
          ...(subscription.metadata || {}),
          pending_authorization_status: verifiedAuthorization.status,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", subscription.id);
    } else {
      await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          auto_renew: false,
          metadata: { ...(subscription.metadata || {}), authorization_status: verifiedAuthorization.status },
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
      if (!subscription.trial_start_at) {
        await supabase.rpc("release_service_provider_trial_claim", {
          p_user_id: subscription.user_id,
          p_subscription_id: subscription.id,
        });
      }
    }
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
}

async function processDirectDebitCharge(
  supabase: ReturnType<typeof createClient>,
  payload: KoraWebhookPayload,
): Promise<Response> {
  const authorizationCode = String(
    payload.data.direct_debit?.authorization_code || "",
  );
  const gatewayReference = String(
    payload.data.reference || payload.data.payment_reference || "",
  );
  if (!authorizationCode || !gatewayReference) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_key, product_line")
    .eq("kora_authorization_code", authorizationCode)
    .eq("product_line", "service")
    .maybeSingle();
  if (subscriptionError) {
    console.error("[Kora Webhook] Direct Debit subscription lookup failed:", subscriptionError.message);
    return new Response("Retry", { status: 500, headers: corsHeaders });
  }
  if (!subscription) return new Response("ok", { status: 200, headers: corsHeaders });

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, user_id, plan, amount, currency, reference, status, billing_phase, metadata")
    .eq("subscription_id", subscription.id)
    .in("billing_phase", ["renewal", "retry", "manual"])
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError) {
    console.error("[Kora Webhook] Direct Debit payment lookup failed:", paymentError.message);
    return new Response("Retry", { status: 500, headers: corsHeaders });
  }
  if (!payment) return new Response("ok", { status: 200, headers: corsHeaders });

  let verifiedCharge;
  try {
    verifiedCharge = await verifyKoraCharge(KORA_SECRET_KEY, gatewayReference);
  } catch (verifyError) {
    console.error("[Kora Webhook] Direct Debit charge verification failed:", verifyError);
    return new Response("Retry", { status: 502, headers: corsHeaders });
  }
  const actualAmount = toNumber(verifiedCharge.amount_paid) ?? toNumber(verifiedCharge.amount);
  if (
    String(verifiedCharge.reference || gatewayReference) !== gatewayReference ||
    String(verifiedCharge.currency || "").toUpperCase() !== "NGN" ||
    actualAmount !== Number(payment.amount)
  ) {
    console.error("[Kora Webhook] Direct Debit amount or currency did not match the ledger.");
    return new Response("Invalid charge", { status: 400, headers: corsHeaders });
  }

  const status = String(verifiedCharge.status || "").toLowerCase();
  if (status !== "success" && status !== "failed") {
    return new Response("KoraPay charge is not final", { status: 503, headers: corsHeaders });
  }
  const { data: settlement, error: settlementError } = await supabase.rpc(
    "settle_service_subscription_payment",
    {
      p_payment_id: payment.id,
      p_gateway_reference: gatewayReference,
      p_succeeded: status === "success",
      p_failure_code: status === "failed"
        ? String(payload.data.status || "direct_debit_failed").slice(0, 120)
        : null,
    },
  );
  if (settlementError) {
    console.error("[Kora Webhook] Direct Debit payment settlement failed:", settlementError.message);
    return new Response("Retry", { status: 500, headers: corsHeaders });
  }
  if (settlement?.state === "failed") {
    await insertNotification(supabase, {
      userId: String(settlement.user_id),
      type: "payment",
      title: "Subscription payment failed",
      content: `Your ${planLabel(String(settlement.plan_key))} renewal did not go through. Update your bank mandate or try again.`,
      data: {
        reference: gatewayReference,
        plan: settlement.plan_key,
        amount: settlement.amount,
        status: "failed",
      },
    });
    const failedPayment = {
      ...payment,
      plan: String(settlement.plan_key),
      amount: Number(settlement.amount),
    };
    await sendPaymentFailureEmail(supabase, failedPayment, gatewayReference);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (
    settlement?.state === "already_failed" ||
    settlement?.state === "already_settled" ||
    settlement?.state === "not_found"
  ) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  const periodEnd = settlement?.next_billing_at;
  await insertNotification(supabase, {
    userId: String(settlement.user_id),
    type: "payment",
    title: "Subscription payment successful",
    content: `Your ${planLabel(String(settlement.plan_key))} subscription was renewed for ₦${Number(settlement.amount).toLocaleString("en-NG")}.`,
    data: {
      reference: gatewayReference,
      plan: settlement.plan_key,
      amount: settlement.amount,
      status: "verified",
      next_billing_at: periodEnd,
    },
  });
  await sendPaymentConfirmationEmail(supabase, {
    ...payment,
    subscription_id: String(settlement.subscription_id),
    plan: String(settlement.plan_key),
    amount: Number(settlement.amount),
    provider_reference: gatewayReference,
  } as PaymentRow, gatewayReference);
  return new Response("ok", { status: 200, headers: corsHeaders });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !KORA_SECRET_KEY) {
    console.error("[Kora Webhook] Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const signature = req.headers.get('x-korapay-signature');
    const rawBodyBuffer = await req.arrayBuffer();
    const rawBody = new TextDecoder().decode(rawBodyBuffer);
    let payload: KoraWebhookPayload;

    try {
      payload = rawBody ? JSON.parse(rawBody) : { event: '', data: {} };
      payload.event = payload.event || payload.type || "";
    } catch (parseError) {
      console.error("[Kora Webhook] Failed to parse payload:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      "[Kora Webhook] Received event:",
      payload.event,
      "ref:",
      payload.data?.reference,
    );

    if (!ALLOWED_EVENTS.has(payload.event)) {
      console.log(`[Kora Webhook] Ignoring event type: ${payload.event}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const isValid = SKIP_KORA_SIGNATURE_CHECK
      ? true
      : await verifySignature(signature, rawBodyBuffer);
    if (SKIP_KORA_SIGNATURE_CHECK) {
      console.warn("[Kora Webhook] Local-only signature verification override is enabled.");
    }
    console.log("[Kora Webhook] Signature check result:", isValid);
    if (!isValid) {
      console.error("[Kora Webhook] Invalid signature — ignoring request");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (payload.event === "direct_debit.auth") {
      return await processDirectDebitAuthorization(supabase, payload);
    }
    if (payload.data.payment_method === "direct_debit" || payload.data.direct_debit) {
      return await processDirectDebitCharge(supabase, payload);
    }

    const reference =
      payload.data.reference || payload.data.payment_reference || "";
    if (!reference) {
      console.error("[Kora Webhook] No reference in payload");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (KORA_ALLOW_SIMULATED_VERIFICATION && shouldAutoSeedPayment(payload)) {
      const ensureRes = await ensureSeedUser(supabase, payload);
      const resolvedUserId = ensureRes?.id || '';
      let seedPayment = buildSeedPaymentPayload(payload);
      let seedProfile = buildSeedProfilePayload(payload);

      // If helper returned null but we resolved a user id, build minimal seeds
      const pdata = (payload.data || {}) as Record<string, unknown>;
      const pmeta = ((pdata.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
      if (!seedPayment && resolvedUserId) {
        const reference = String(pdata.reference || pdata.payment_reference || pdata.transaction_reference || 'JB-TEST-SEED');
        const amount = Number(pdata.amount_paid ?? pdata.amount_expected ?? pdata.amount ?? 1500);
        seedPayment = {
          user_id: resolvedUserId,
          plan: String(pmeta.plan || pdata.plan || 'ai_monthly'),
          status: 'pending',
          amount: Number.isFinite(amount) ? amount : 1500,
          currency: String(pdata.currency || 'NGN'),
          reference,
          metadata: { ...(pmeta || {}), source: pmeta.source || 'simulated_webhook_seed', seeded_by: 'kora-webhook' },
        };
      }

      if (!seedProfile && resolvedUserId) {
        seedProfile = {
          id: resolvedUserId,
          email: String(pmeta.email || pdata.email || `${resolvedUserId}@jobbridge.test`),
          full_name: String(pmeta.full_name || pmeta.name || pdata.name || 'Simulated User'),
          role: 'job_seeker',
          credits: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const seedResults: Record<string, unknown> = {};

      // If user was created/ensured, prefer that auth id for seeded rows
      const createdUserId = (ensureRes as any)?.id || (ensureRes as any)?.createUserResult?.user?.id;
      if (createdUserId) {
        if (seedPayment) {
          seedPayment.user_id = createdUserId;
          // ensure metadata has the resolved user id
          seedPayment.metadata = { ...(seedPayment.metadata || {}), user_id: createdUserId };
        }
        if (seedProfile) {
          seedProfile.id = createdUserId;
          seedProfile.email = (ensureRes as any)?.createUserResult?.user?.email || seedProfile.email;
          seedProfile.full_name = (ensureRes as any)?.createUserResult?.user?.user_metadata?.full_name || seedProfile.full_name;
        }
      }

      // include createUser debug info if available
      if ((ensureRes as any)?.createUserResult || (ensureRes as any)?.createUserError) {
        seedResults.createUser = {
          result: (ensureRes as any)?.createUserResult || null,
          error: (ensureRes as any)?.createUserError || null,
        };
      }

      if (seedPayment) {
        try {
          // Remove any stale payment rows for this reference to avoid FK mismatches
          try {
            await supabase.from("payments").delete().eq("reference", seedPayment.reference);
          } catch (e) {
            // ignore
          }
          const res = await supabase.from("payments").insert(seedPayment);
          seedResults.payment = res;
          if (res.error) {
            console.error("[Kora Webhook] Failed to seed payment row:", res.error.message);
          } else {
            console.log("[Kora Webhook] Seeded payment row for reference", seedPayment.reference);
          }
        } catch (seedErr) {
          seedResults.payment = { error: String(seedErr) };
          console.error("[Kora Webhook] Payment seeding error:", seedErr);
        }
      }

      if (seedProfile) {
        try {
          // Remove stale profile records that might reference missing auth users
          try {
            await supabase.from("profiles").delete().eq("id", seedProfile.id);
          } catch (e) {
            // ignore
          }
          const res = await supabase.from("profiles").insert(seedProfile);
          seedResults.profile = res;
          if (res.error) {
            console.error("[Kora Webhook] Failed to seed profile row:", res.error.message);
          } else {
            console.log("[Kora Webhook] Seeded profile row for id", seedProfile.id);
          }
        } catch (seedErr) {
          seedResults.profile = { error: String(seedErr) };
          console.error("[Kora Webhook] Profile seeding error:", seedErr);
        }
      }

      // If caller requested debug seed feedback, return it directly
      if (payload.data && (payload.data as Record<string, unknown>).debug_seed) {
        return new Response(JSON.stringify({ seeded: true, results: seedResults }), { status: 200, headers: corsHeaders });
      }
    }

    // Primary lookup: match by JobBridge reference
    let { data: payment, error: findError } = await supabase
      .from("payments")
      .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata, subscription_id, billing_phase, idempotency_key")
      .eq("reference", reference)
      .maybeSingle<PaymentRow>();

    // Fallbacks: sometimes Kora returns a different internal reference
    // (transaction_reference/payment_reference). Try these fallbacks so
    // a payment record is reliably resolved to its plan.
    if (!payment && !findError) {
      const altRefs = [
        payload.data?.payment_reference,
        payload.data?.transaction_reference,
      ]
        .filter(Boolean)
        .map(String);

      if (altRefs.length) {
        const { data: altMatch, error: altErr } = await supabase
          .from("payments")
          .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata, subscription_id, billing_phase, idempotency_key")
          .in("reference", altRefs)
          .limit(1)
          .maybeSingle<PaymentRow>();
        if (altErr) {
          console.error("[Kora Webhook] Alt lookup error:", altErr.message);
        } else if (altMatch) {
          payment = altMatch;
        }
      }
    }

    // Additional fallback: match by provider_reference field or metadata (user_id + plan)
    if (!payment && !findError) {
      const provRef = payload.data?.transaction_reference || payload.data?.payment_reference || null;
      if (provRef) {
        const { data: provMatch, error: provErr } = await supabase
          .from("payments")
          .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata, subscription_id, billing_phase, idempotency_key")
          .or(`provider_reference.eq.${provRef},provider_reference.eq.${reference}`)
          .limit(1)
          .maybeSingle<PaymentRow>();
        if (provErr) {
          console.error("[Kora Webhook] Provider-ref lookup error:", provErr.message);
        } else if (provMatch) {
          payment = provMatch;
        }
      }
    }

    // Metadata-based fallback: if Kora includes metadata.plan and metadata.user_id,
    // try to match a recent pending payment for that user and plan.
    if (!payment && payload.data?.metadata) {
      try {
        const metaPlan = payload.data.metadata.plan as string | undefined;
        const metaUser = payload.data.metadata.user_id as string | undefined;
        const amt = payload.data?.amount;
        if (metaPlan && metaUser) {
          const q = supabase
            .from("payments")
            .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata, subscription_id, billing_phase, idempotency_key")
            .eq("user_id", metaUser)
            .eq("plan", metaPlan)
            .in("status", ["pending"])
            .order("created_at", { ascending: false })
            .limit(1);
          // If amount is present, prefer matching by amount too
          if (typeof amt === "number") {
            q.eq("amount", amt);
          }
          const { data: metaMatch, error: metaErr } = await q.maybeSingle<PaymentRow>();
          if (metaErr) {
            console.error("[Kora Webhook] Metadata lookup error:", metaErr.message);
          } else if (metaMatch) {
            payment = metaMatch;
          }
        }
      } catch (e) {
        console.error("[Kora Webhook] Metadata fallback error:", e);
      }
    }

    if (findError) {
      console.error("[Kora Webhook] Error finding payment:", findError.message);
      return new Response(JSON.stringify({ error: "Payment lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment) {
      console.warn(
        `[Kora Webhook] No payment found for reference: ${reference}`,
      );
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (payload.event === "charge.failed") {
      if (payment.status !== "failed") {
        const { error: failedUpdateError } = await supabase
          .from("payments")
          .update({
            status: "failed",
            provider: "korapay",
            provider_reference:
              payload.data.transaction_reference ||
              payload.data.payment_reference ||
              reference,
            currency: payload.data.currency || payment.currency || "NGN",
            metadata: {
              webhook_event: payload.event,
              webhook_status:
                payload.data.status ||
                payload.data.transaction_status ||
                "failed",
              payload: payload.data,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (failedUpdateError) {
          console.error(
            "[Kora Webhook] Error updating failed payment:",
            failedUpdateError.message,
          );
          return new Response(
            JSON.stringify({ error: "Payment update failed" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        await insertNotification(supabase, {
          userId: payment.user_id,
          type: "payment",
          title: "Payment failed",
          content: `Your payment for ${planLabel(payment.plan)} could not be completed. Reference: ${reference}.`,
          data: {
            reference,
            plan: payment.plan,
            amount: payment.amount,
            status: "failed",
          },
        });
      }

      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (payment.status === "verified" || payment.status === "completed") {
      console.log(
        `[Kora Webhook] Payment ${reference} already ${payment.status}`,
      );
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    let verification: KoraChargeVerificationResponse;
    try {
      verification = await verifyCharge(reference, payload);
    } catch (verifyError) {
      console.error("[Kora Webhook] Charge verification failed:", verifyError);
      return new Response(
        JSON.stringify({ error: "Charge verification failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const verifiedCharge = verification.data || {};
    const expectedAmount = payment.amount;
    const actualAmount =
      toNumber(verifiedCharge.amount_paid) ??
      toNumber(verifiedCharge.amount) ??
      toNumber(payload.data.amount_paid) ??
      toNumber(payload.data.amount_expected) ??
      toNumber(payload.data.amount);
    const actualCurrency =
      verifiedCharge.currency ||
      payload.data.currency ||
      payment.currency ||
      "NGN";
    const verifyStatus = (
      verifiedCharge.status ||
      payload.data.status ||
      ""
    ).toLowerCase();
    const verifiedReference =
      verifiedCharge.reference || verifiedCharge.payment_reference || reference;

    const verificationPassed =
      verifyStatus === "success" &&
      actualAmount === expectedAmount &&
      actualCurrency === (payment.currency || "NGN") &&
      (verifiedReference === payment.reference ||
        verifiedCharge.payment_reference === payment.reference);

    if (!verificationPassed) {
      console.error("[Kora Webhook] Verification mismatch", {
        reference,
        expectedAmount,
        actualAmount,
        expectedCurrency: payment.currency || "NGN",
        actualCurrency,
        verifyStatus,
        verifiedReference,
      });

      const { error: mismatchUpdateError } = await supabase
        .from("payments")
        .update({
          status: "failed",
          provider: "korapay",
          provider_reference:
            verifiedCharge.transaction_reference ||
            verifiedCharge.payment_reference ||
            reference,
          currency: actualCurrency,
          metadata: {
            webhook_event: payload.event,
            verification_status: verifyStatus,
            verification_passed: false,
            payload: payload.data,
            verification_response: verifiedCharge,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (mismatchUpdateError) {
        console.error(
          "[Kora Webhook] Error updating mismatch payment:",
          mismatchUpdateError.message,
        );
        return new Response(
          JSON.stringify({ error: "Mismatch update failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      await insertNotification(supabase, {
        userId: payment.user_id,
        type: "payment",
        title: "Payment verification failed",
        content: `We could not verify your payment for ${planLabel(payment.plan)}. Please contact support with reference ${reference}.`,
        data: {
          reference,
          plan: payment.plan,
          amount: payment.amount,
          status: "failed",
          verification_status: verifyStatus,
        },
      });

      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "verified",
        provider: "korapay",
        provider_reference:
          verifiedCharge.transaction_reference ||
          verifiedCharge.payment_reference ||
          reference,
        currency: actualCurrency,
        metadata: {
          webhook_event: payload.event,
          verification_status: verifyStatus,
          verification_passed: true,
          payload: payload.data,
          verification_response: verifiedCharge,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .neq("status", "verified");

    if (updateError) {
      console.error(
        "[Kora Webhook] Error updating payment:",
        updateError.message,
      );
      return new Response(JSON.stringify({ error: "Payment update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ([
      "service_monthly",
      "service_verified",
      "service_featured",
      "svc_basic",
      "svc_verified",
      "svc_featured",
    ].includes(payment.plan)) {
      await insertNotification(supabase, {
        userId: payment.user_id,
        type: "payment",
        title: "Payment received — subscription needs review",
        content: "This payment used the retired provider checkout and did not activate or renew your service listing. Contact support with your transaction reference.",
        data: { reference, status: "verified", plan: payment.plan },
      });
      console.error("[Kora Webhook] A legacy provider checkout was verified but was not used to activate a subscription.");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // ── Recurring renewal/retry reconciliation ────────────────────────────
    // Auto-debit charges (ledger rows written by billing-daily) carry a
    // subscription_id. Reconcile the subscription lifecycle here instead of
    // the legacy one-time checkout path: roll the period, reset retries,
    // clear grace, restore visibility. This closes the double-charge race
    // where the gateway succeeds but the cron saw a network/timeout error.
    const isRecurringCharge =
      Boolean(payment.subscription_id) ||
      payment.billing_phase === "renewal" ||
      payment.billing_phase === "retry" ||
      payment.billing_phase === "manual";

    if (isRecurringCharge) {
      await reconcileRenewal(supabase, payment, reference);
      await sendPaymentConfirmationEmail(supabase, payment, reference);
      await insertNotification(supabase, {
        userId: payment.user_id,
        type: "payment",
        title: "Renewal confirmed",
        content: `Your ${planLabel(payment.plan)} has been renewed successfully.`,
        data: { reference, plan: payment.plan, amount: payment.amount, status: "verified", billing_phase: payment.billing_phase },
      });
      console.log(`[Kora Webhook] Renewal ${reference} reconciled for subscription ${payment.subscription_id}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Card-token capture for recurring auto-debit (KoraPay saved card).
    const savedCardToken = cardTokenFromVerification(verification);
    if (savedCardToken) {
      const tokenRes = await persistKoraCardToken(supabase, payment.user_id, payment.plan, savedCardToken);
      if (tokenRes?.error) {
        console.error("[Kora Webhook] Failed to persist card token:", tokenRes.error);
      } else if (tokenRes && !tokenRes.skipped) {
        console.log(`[Kora Webhook] Card token saved for user ${payment.user_id}, plan ${payment.plan}`);
      }
    }

    // Activate the subscription on the user's profile as a fallback
    // in case the database trigger is not present or not enabled.
    const tier =
      payment.plan === "ai_monthly" || payment.plan === "ai_annual"
        ? "ai_tools"
        : payment.plan === "service_verified"
          ? "service_verified"
          : payment.plan === "service_featured"
            ? "service_featured"
            : payment.plan;
    const durationDays =
      payment.plan === "basic"
        ? 7
        : payment.plan === "standard"
          ? 14
          : payment.plan === "premium"
            ? 30
            : payment.plan === "ai_monthly"
              ? 30
              : payment.plan === "ai_annual"
                ? 365
                : payment.plan === "service_verified"
                  ? 30
                  : payment.plan === "service_featured"
                    ? 30
                    : payment.plan === "business_weekly"
                      ? 7
                      : payment.plan === "business_monthly" || payment.plan === "business_featured"
                        ? 30
                        : 7;
    const creditsToAdd =
      payment.plan === "basic" || payment.plan === "standard"
        ? 1
        : payment.plan === "premium"
          ? 3
          : payment.plan === "business_weekly" ||
              payment.plan === "business_monthly" ||
              payment.plan === "business_featured"
            ? 1
            : 0;
    const expiresAt = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const isBusinessPlan =
      payment.plan === "business_weekly" ||
      payment.plan === "business_monthly" ||
      payment.plan === "business_featured";

    const { data: profileData, error: profileFetchError } = await supabase
      .from("profiles")
      .select("credits, advert_credits")
      .eq("id", payment.user_id)
      .maybeSingle();

    if (!profileFetchError && profileData) {
      const profileUpdates: Record<string, unknown> = {
        is_premium: true,
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };
      if (isBusinessPlan) {
        // Advert plans must grant ADVERT credits (profiles.advert_credits),
        // not job-post credits — Business.tsx gates advert creation on
        // `advert_credits`.
        profileUpdates.advert_credits =
          Number(profileData.advert_credits || 0) + creditsToAdd;
      } else {
        profileUpdates.credits = Number(profileData.credits || 0) + creditsToAdd;
      }

      if (payment.plan === "service_monthly") {
        profileUpdates.is_verified = false;
        profileUpdates.is_featured = false;
      } else if (payment.plan === "service_verified") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = false;
      } else if (payment.plan === "service_featured") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = true;
      }

      // Service subscribers must appear in the public marketplace feed
      // (feed gates on profiles.visibility_until > now + is_active).
      const isServicePlan =
        payment.plan === "service_monthly" ||
        payment.plan === "service_verified" ||
        payment.plan === "service_featured";
      if (isServicePlan) {
        profileUpdates.visibility_until = expiresAt;
        profileUpdates.is_active = true;
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", payment.user_id);

      if (profileUpdateError) {
        console.error(
          "[Kora Webhook] Failed to activate subscription on profile:",
          profileUpdateError.message,
        );
      } else if (isServicePlan) {
        await supabase
          .from("service_providers")
          .update({ is_active: true })
          .eq("profile_id", payment.user_id)
          .catch(() => {});
      }
    } else if (profileFetchError) {
      console.error(
        "[Kora Webhook] Failed to read profile credits:",
        profileFetchError.message,
      );
    }

      // If this payment corresponds to a business advertisement plan,
      // create an advertisement server-side as a fallback when the client
      // did not persist it (e.g. webhook-only flows).
      try {
        const businessPlans = new Set(["business_weekly", "business_monthly", "business_featured"]);
        const isBusinessPlan = businessPlans.has(payment.plan);

        let advertDetails: Record<string, unknown> | null = null;
        try {
          const rawMeta = (payment as any).metadata;
          const parsedMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
          advertDetails = parsedMeta?.advert ? (parsedMeta.advert as Record<string, unknown>) : parsedMeta;
        } catch (e) {
          console.warn('[Kora Webhook] Could not parse payment.metadata for advert payload', e);
        }

        if (isBusinessPlan) {
          const durationDays = payment.plan === 'business_weekly' ? 7 : 30;
          const startsAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
          const packageType = payment.plan === 'business_weekly' ? 'weekly' : payment.plan === 'business_monthly' ? 'monthly' : 'featured';

          const businessName = (advertDetails?.businessName as string) || payment.user_id;
          const title = (advertDetails?.title as string) || 'New Business Advert';
          const description = (advertDetails?.description as string) || 'Promote your business to JobBridge users';
          const category = (advertDetails?.category as string) || 'Other';
          const imageUrl = (advertDetails?.image_url as string) || (advertDetails?.imageUrl as string) || null;
          const websiteUrl = (advertDetails?.website_url as string) || (advertDetails?.link_url as string) || (advertDetails?.linkUrl as string) || null;
          const featured = payment.plan === 'business_featured' || Boolean(advertDetails?.featured);

          const { data: advertData, error: advertErr } = await supabase
            .from('advertisements')
            .insert([{ 
              owner_id: payment.user_id,
              business_name: businessName,
              title,
              description,
              category,
              package: packageType,
              is_featured: featured,
              image_url: imageUrl,
              website_url: websiteUrl,
              starts_at: startsAt,
              expires_at: expiresAt,
              status: 'active',
              views: 0,
              clicks: 0,
              payment_status: 'paid',
              amount_paid: actualAmount,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select('id')
            .limit(1)
            .maybeSingle();

          if (advertErr) {
            console.error('[Kora Webhook] Failed to create advertisement record:', advertErr.message);
          } else {
            console.log('[Kora Webhook] Created advertisement for user', payment.user_id, advertData?.id || '(no-id)');
            try {
              await insertNotification(supabase, {
                userId: payment.user_id,
                type: 'payment',
                title: 'Advertisement created',
                content: 'Your business advert has been created. Visit your Business page to edit and publish details.',
                data: { reference, plan: payment.plan },
              });

              const { data: userData, error: userError } = await supabase.auth.admin.getUserById(payment.user_id);
              if (!userError && userData?.user?.email) {
                const emailPayload = {
                  type: 'advert_created',
                  email: userData.user.email,
                  name: userData.user.user_metadata?.full_name || userData.user.email,
                  advert_id: advertData?.id || null,
                  advertId: advertData?.id || null,
                };
                await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(emailPayload),
                });
              }
            } catch (e) {
              console.error('[Kora Webhook] Failed to notify or email about advert creation:', e);
            }
          }
        }
      } catch (e) {
        console.error('[Kora Webhook] Error handling server-side advert creation:', e);
      }

      await sendPaymentConfirmationEmail(supabase, payment, reference);

    await insertNotification(supabase, {
      userId: payment.user_id,
      type: "payment",
      title: "Payment confirmed",
      content: `Your payment for ${planLabel(payment.plan)} has been verified successfully.`,
      data: {
        reference,
        plan: payment.plan,
        amount: payment.amount,
        status: "verified",
      },
    });

    console.log(
      `[Kora Webhook] Payment ${reference} verified successfully — plan will auto-activate`,
    );
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[Kora Webhook] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
