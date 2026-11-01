import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyCharge } from "../_shared/korapay-direct-debit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || "";
const CARD_SETUP_AMOUNT_NGN = 100;
const CARD_SETUP_CONSENT_VERSION = "service-card-v1";

const PLAN_KEYS: Record<string, string> = {
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  svc_basic: "svc_basic",
  svc_verified: "svc_verified",
  svc_featured: "svc_featured",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceTier(planKey: string): string {
  if (planKey === "svc_basic") return "service_monthly";
  if (planKey === "svc_verified") return "service_verified";
  return "service_featured";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY ||
    !KORA_SECRET_KEY
  ) {
    return json({ error: "Card subscription setup is not configured." }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401);

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user?.id || !user.email) {
      return json({ error: "Please sign in with a verified email address." }, 401);
    }

    const body = await req.json();
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const action = String(body?.action || "");

    if (action === "initialize") {
      if (
        body?.consented !== true ||
        body?.consent_version !== CARD_SETUP_CONSENT_VERSION
      ) {
        return json({ error: "Explicit card-payment consent is required." }, 400);
      }
      const requestedPlanKey = String(body?.plan_key || "");
      const planKey = PLAN_KEYS[requestedPlanKey] ||
        (/^svc_[a-z0-9_]{1,40}$/.test(requestedPlanKey)
          ? requestedPlanKey
          : null);
      if (!planKey) return json({ error: "Choose a valid provider plan." }, 400);

      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id, role, specialty, service_category")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (
        !profile || profile.role !== "provider" ||
        !(profile.specialty || profile.service_category)
      ) {
        return json({
          error: "Complete your service-provider profile before choosing a plan.",
        }, 403);
      }

      const { data: existing, error: existingError } = await serviceClient
        .from("subscriptions")
        .select("id, plan_key, status, auto_renew, next_billing_at, next_attempt_at, current_period_end, pending_kora_authorization_code, metadata")
        .eq("user_id", user.id)
        .eq("product_line", "service")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      const metadata = existing?.metadata as Record<string, unknown> | null;
      if (
        existing?.pending_kora_authorization_code ||
        metadata?.authorization_status === "pending"
      ) {
        return json({
          error: "A bank authorization is already pending. Complete or cancel it before adding a card.",
        }, 409);
      }
      const hasCurrentSubscription = Boolean(
        existing &&
        !["canceled", "expired"].includes(String(existing.status)),
      );
      const cardUpdate = Boolean(
        body?.replace_existing === true &&
        existing &&
        hasCurrentSubscription &&
        existing.plan_key === planKey &&
        existing.auto_renew === true &&
        ["active", "trialing", "past_due"].includes(String(existing.status)),
      );
      if (body?.replace_existing === true && !cardUpdate) {
        return json({
          error: "There is no active renewable subscription with this plan to update. Choose a provider plan to start a new subscription.",
        }, 409);
      }
      if (hasCurrentSubscription && !cardUpdate) {
        return json({
          error: "A provider subscription already exists. Use its current plan to replace the payment method, or manage the existing subscription first.",
        }, 409);
      }
      if (cardUpdate && existing) {
        const { data: pendingCharge, error: pendingChargeError } =
          await serviceClient
            .from("payments")
            .select("id")
            .eq("subscription_id", existing.id)
            .in("billing_phase", ["renewal", "retry", "manual"])
            .eq("status", "pending")
            .limit(1)
            .maybeSingle();
        if (pendingChargeError) throw pendingChargeError;
        if (pendingCharge) {
          return json({
            error: "A subscription payment is already being confirmed. Wait for its result before replacing the card.",
          }, 409);
        }
      }

      const { data: plan, error: planError } = await serviceClient
        .from("plans")
        .select("name, base_price_ngn, duration_days")
        .eq("key", planKey)
        .eq("product_line", "service")
        .eq("is_active", true)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan || Number(plan.base_price_ngn) <= 0) {
        return json({ error: "That provider plan is unavailable." }, 404);
      }

      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentSetup, error: recentSetupError } = await serviceClient
        .from("payments")
        .select("reference, status, metadata")
        .eq("user_id", user.id)
        .eq("plan", planKey)
        .eq("billing_phase", "card_setup")
        .eq("metadata->>card_update", cardUpdate ? "true" : "false")
        .in("status", ["pending", "verified"])
        .gte("created_at", recentCutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentSetupError) throw recentSetupError;
      if (recentSetup?.status === "verified") {
        const setupMetadata = recentSetup.metadata as Record<string, unknown> | null;
        const subscriptionId = String(setupMetadata?.subscription_id || "");
        const { data: completedSubscription, error: completedError } =
          await serviceClient
            .from("subscriptions")
            .select("next_billing_at, next_attempt_at, status, payment_method_type")
            .eq("id", subscriptionId)
            .maybeSingle();
        if (completedError) throw completedError;
        if (completedSubscription?.payment_method_type === "kora_saved_card") {
          return json({
            status: "already_completed",
            next_charge_at: completedSubscription.status === "past_due"
              ? completedSubscription.next_attempt_at ||
                completedSubscription.next_billing_at
              : completedSubscription.next_billing_at,
            card_updated: setupMetadata?.card_update === true,
          });
        }
        return json({
          error: `Your ₦100 card payment was confirmed, but card setup is incomplete. Contact support with reference ${recentSetup.reference}.`,
        }, 409);
      }
      if (recentSetup?.status === "pending") {
        return json({
          status: "checkout_pending",
          reference: recentSetup.reference,
          card_update: Boolean(
            (recentSetup.metadata as Record<string, unknown> | null)?.card_update,
          ),
          next_charge_at: existing?.status === "past_due"
            ? existing.next_attempt_at || existing.next_billing_at || existing.current_period_end
            : existing?.next_billing_at || existing?.current_period_end || null,
          amount_ngn: CARD_SETUP_AMOUNT_NGN,
          plan_name: plan.name,
          plan_amount_ngn: Number(plan.base_price_ngn),
        });
      }

      const reference =
        `JB-SVC-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const subscriptionId = cardUpdate && existing ? existing.id : crypto.randomUUID();
      const { error: paymentError } = await serviceClient.from("payments").insert({
        user_id: user.id,
        subscription_id: cardUpdate ? subscriptionId : null,
        plan: planKey,
        amount: CARD_SETUP_AMOUNT_NGN,
        currency: "NGN",
        reference,
        status: "pending",
        billing_phase: "card_setup",
        idempotency_key: reference,
        provider: "korapay",
        metadata: {
          source: "service_card_setup",
          subscription_id: subscriptionId,
          card_update: cardUpdate,
          consent_version: CARD_SETUP_CONSENT_VERSION,
          consented_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });
      if (paymentError) throw paymentError;

      return json({
        status: "checkout_ready",
        reference,
        amount_ngn: CARD_SETUP_AMOUNT_NGN,
        card_update: cardUpdate,
        next_charge_at: cardUpdate
          ? existing?.status === "past_due"
            ? existing.next_attempt_at || existing.next_billing_at || existing.current_period_end
            : existing?.next_billing_at || existing?.current_period_end || null
          : null,
        plan_name: plan.name,
        plan_amount_ngn: Number(plan.base_price_ngn),
      });
    }

    if (action !== "complete") {
      return json({ error: "Choose a valid card setup action." }, 400);
    }

    const reference = String(body?.reference || "").trim();
    const cardToken = String(body?.card_token || "").trim();
    if (!reference || reference.length > 120 || cardToken.length > 2048) {
      return json({ error: "A valid Korapay payment reference is required." }, 400);
    }

    const { data: payment, error: paymentLookupError } = await serviceClient
      .from("payments")
      .select("id, user_id, plan, amount, currency, reference, provider_reference, status, billing_phase, metadata")
      .eq("user_id", user.id)
      .eq("reference", reference)
      .eq("billing_phase", "card_setup")
      .maybeSingle();
    if (paymentLookupError) throw paymentLookupError;
    if (!payment || Number(payment.amount) !== CARD_SETUP_AMOUNT_NGN) {
      return json({ error: "The card setup payment could not be found." }, 404);
    }
    if (payment.status === "failed") {
      return json({ error: "The ₦100 card payment failed. Start a new checkout to try again." }, 409);
    }

    const setupMetadata = payment.metadata as Record<string, unknown> | null;
    const subscriptionId = String(setupMetadata?.subscription_id || "");
    if (
      !subscriptionId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(subscriptionId)
    ) {
      throw new Error("Card setup payment has no valid subscription reference.");
    }

    const verified = await verifyCharge(KORA_SECRET_KEY, reference);
    const actualAmount = Number(verified.amount_paid ?? verified.amount);
    const verifiedReferences = [
      verified.reference,
      verified.payment_reference,
      verified.transaction_reference,
    ].filter((value): value is string => Boolean(value));
    const expectedReferences = [reference, payment.provider_reference].filter(
      (value): value is string => Boolean(value),
    );
    const verificationResponse = setupMetadata?.verification_response as
      | {
        token?: string;
        card_token?: string;
        card?: { token?: string };
      }
      | null;
    const webhookPayload = setupMetadata?.payload as
      | {
        token?: string;
        card_token?: string;
        card?: { token?: string };
      }
      | null;
    const verifiedCardToken = String(
      verified.card?.token ||
        verified.card_token ||
        verified.token ||
        verificationResponse?.card?.token ||
        verificationResponse?.card_token ||
        verificationResponse?.token ||
        webhookPayload?.card?.token ||
        webhookPayload?.card_token ||
        webhookPayload?.token ||
        "",
    );
    if (
      !verifiedReferences.some((value) => expectedReferences.includes(value)) ||
      String(verified.currency || "").toUpperCase() !== "NGN" ||
      actualAmount !== CARD_SETUP_AMOUNT_NGN ||
      !["success", "completed"].includes(String(verified.status || "").toLowerCase())
    ) {
      return json({
        error: "Korapay has not confirmed the exact ₦100 card payment yet. Wait for confirmation and retry.",
      }, 409);
    }
    if (!verifiedCardToken || (cardToken && verifiedCardToken !== cardToken)) {
      return json({
        error: "Korapay has not verified the saved card token for this payment. Wait for webhook confirmation and retry.",
      }, 409);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, specialty, service_category")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (
      !profile || profile.role !== "provider" ||
      !(profile.specialty || profile.service_category)
    ) {
      return json({ error: "Complete your service-provider profile before setup." }, 403);
    }

    const { data: plan, error: planError } = await serviceClient
      .from("plans")
      .select("name, base_price_ngn, duration_days")
      .eq("key", payment.plan)
      .eq("product_line", "service")
      .eq("is_active", true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan || Number(plan.base_price_ngn) <= 0) {
      return json({ error: "The selected provider plan is unavailable." }, 404);
    }

    const { data: existingSubscription, error: existingSubscriptionError } =
      await serviceClient
        .from("subscriptions")
        .select("id, plan_key, status, auto_renew, current_period_start, current_period_end, next_attempt_at, payment_method_type, next_billing_at, metadata")
        .eq("user_id", user.id)
        .eq("product_line", "service")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (existingSubscriptionError) throw existingSubscriptionError;
    const cardUpdate = setupMetadata?.card_update === true;
    if (
      existingSubscription &&
      existingSubscription.id !== subscriptionId &&
      !["canceled", "expired"].includes(String(existingSubscription.status))
    ) {
      return json({
        error: "A provider subscription already exists. Contact support before completing this card setup.",
      }, 409);
    }

    const now = new Date();
    const existingMetadata = existingSubscription?.metadata as
      | Record<string, unknown>
      | null;
    if (
      cardUpdate &&
      (
        !existingSubscription ||
        existingSubscription.id !== subscriptionId ||
        existingSubscription.plan_key !== payment.plan ||
        existingSubscription.auto_renew !== true ||
        !["active", "trialing", "past_due"].includes(
          String(existingSubscription.status),
        )
      )
    ) {
      return json({
        error: "The existing subscription changed before the replacement card was saved. Contact support before retrying.",
      }, 409);
    }
    const alreadyCompletedForReference =
      existingSubscription?.id === subscriptionId &&
      existingSubscription.payment_method_type === "kora_saved_card" &&
      (
        cardUpdate
          ? existingMetadata?.last_card_setup_reference === reference
          : existingMetadata?.setup_charge_reference === reference
      ) &&
      Boolean(existingSubscription.next_billing_at);
    const updateNextChargeAt = cardUpdate
      ? (existingSubscription?.status === "past_due"
        ? existingSubscription.next_attempt_at
        : null) ||
        existingSubscription?.next_billing_at ||
        existingSubscription?.current_period_end ||
        null
      : null;
    if (cardUpdate && !updateNextChargeAt) {
      return json({
        error: "The existing subscription has no scheduled billing date. Contact support before replacing its card.",
      }, 409);
    }
    const firstPlanChargeAt = alreadyCompletedForReference
      ? new Date(existingSubscription.next_billing_at!)
      : cardUpdate
        ? new Date(updateNextChargeAt!)
        : new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const chargeAtIso = firstPlanChargeAt.toISOString();
    const savedCardFields = {
      kora_card_token_key: verifiedCardToken,
      payment_method_type: "kora_saved_card",
      payment_method_bank: null,
      payment_method_last4: verified.card?.last_four || null,
      kora_authorization_code: null,
      kora_authorization_expires_at: null,
      pending_kora_authorization_code: null,
      pending_kora_authorization_expires_at: null,
      pending_plan_key: null,
      pending_payment_method_bank: null,
      pending_payment_method_last4: null,
      consent_at: String(setupMetadata?.consented_at || nowIso),
      consent_version: CARD_SETUP_CONSENT_VERSION,
      updated_at: nowIso,
    };
    if (cardUpdate && !alreadyCompletedForReference) {
      const { error: updateError } = await serviceClient
        .from("subscriptions")
        .update({
          ...savedCardFields,
          metadata: {
            ...(existingMetadata || {}),
            payment_method_source: "korapay_card",
            last_card_setup_reference: reference,
            last_card_setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
          },
        })
        .eq("id", subscriptionId);
      if (updateError) throw updateError;
    } else if (!cardUpdate) {
      const subscription = {
        id: subscriptionId,
        user_id: user.id,
        plan_key: payment.plan,
        product_line: "service",
        status: "active",
        current_period_start: alreadyCompletedForReference
          ? existingSubscription?.current_period_start || nowIso
          : nowIso,
        current_period_end: chargeAtIso,
        next_billing_at: chargeAtIso,
        next_attempt_at: chargeAtIso,
        auto_renew: true,
        cancel_at_period_end: false,
        canceled_at: null,
        cancel_reason: null,
        launch_free_period: false,
        failed_retries: 0,
        grace_ends_at: null,
        ...savedCardFields,
        trial_start_at: null,
        trial_end_at: null,
        metadata: {
          source: "service_card_setup",
          setup_charge_reference: reference,
          setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
          first_plan_charge_at: chargeAtIso,
          billing_duration_days: Number(plan.duration_days),
        },
      };
      const { error: upsertError } = await serviceClient
        .from("subscriptions")
        .upsert(subscription, { onConflict: "id" });
      if (upsertError) throw upsertError;

      const { error: profileUpdateError } = await serviceClient
        .from("profiles")
        .update({
          role: "provider",
          subscription_tier: serviceTier(String(payment.plan)),
          subscription_expires_at: chargeAtIso,
          service_subscription_id: subscriptionId,
          visibility_until: chargeAtIso,
          is_premium: true,
          is_active: true,
          is_featured: payment.plan === "svc_featured",
          updated_at: nowIso,
        })
        .eq("id", user.id);
      if (profileUpdateError) throw profileUpdateError;

      const { error: providerUpdateError } = await serviceClient
        .from("service_providers")
        .update({ is_active: true, updated_at: nowIso })
        .eq("profile_id", user.id);
      if (providerUpdateError) throw providerUpdateError;
    }

    const providerReference =
      verified.transaction_reference || verified.payment_reference || reference;
    const { error: paymentUpdateError } = await serviceClient
      .from("payments")
      .update({
        status: "verified",
        provider: "korapay",
        provider_reference: providerReference,
        metadata: {
          ...setupMetadata,
          source: "service_card_setup",
          verified_amount_ngn: actualAmount,
          provider_reference: providerReference,
        },
        updated_at: nowIso,
      })
      .eq("id", payment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    if (!alreadyCompletedForReference) {
      const { error: notificationError } = await serviceClient
        .from("notifications")
        .insert({
        user_id: user.id,
        type: "payment",
        title: cardUpdate
          ? "Your provider payment card was updated"
          : "Card saved — first plan payment scheduled",
        content: cardUpdate
          ? `Your ₦100 card setup payment is confirmed. Your next ${plan.name} payment remains scheduled for ${firstPlanChargeAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.`
          : `Your ₦100 card setup payment is confirmed. Your first ${plan.name} payment of ₦${Number(plan.base_price_ngn).toLocaleString("en-NG")} is scheduled for ${firstPlanChargeAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.`,
        data: {
          reference,
          subscription_id: subscriptionId,
          setup_amount_ngn: CARD_SETUP_AMOUNT_NGN,
          plan_amount_ngn: Number(plan.base_price_ngn),
          next_billing_at: chargeAtIso,
        },
        });
      if (notificationError) {
        console.error("[start-service-card-subscription] notification failed:", notificationError.message);
      }
    }

    return json({
      status: "card_saved",
      subscription_id: subscriptionId,
      setup_charge_ngn: CARD_SETUP_AMOUNT_NGN,
      plan_name: plan.name,
      plan_amount_ngn: Number(plan.base_price_ngn),
      next_charge_at: chargeAtIso,
      billing_period_days: Number(plan.duration_days),
      payment_method_last4: verified.card?.last_four || null,
      existing_subscription: cardUpdate,
      card_updated: cardUpdate,
    });
  } catch (error) {
    console.error("[start-service-card-subscription] setup failed:", error);
    return json({ error: "Could not set up your card subscription. Please try again or contact support." }, 500);
  }
});
