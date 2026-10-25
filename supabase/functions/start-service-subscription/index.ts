import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  createVariableAuthorization,
  dateOnly,
  hmacIdentity,
} from "../_shared/korapay-direct-debit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || "";
const TRIAL_IDENTITY_HMAC_SECRET =
  Deno.env.get("SERVICE_TRIAL_HMAC_SECRET") || "";

const PLANS: Record<string, string> = {
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  svc_basic: "svc_basic",
  svc_verified: "svc_verified",
  svc_featured: "svc_featured",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("234") && digits.length === 13
    ? `0${digits.slice(3)}`
    : digits;
  return /^0\d{10}$/.test(local) ? local : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY ||
    !KORA_SECRET_KEY || !TRIAL_IDENTITY_HMAC_SECRET
  ) {
    return json({ error: "Service subscription setup is not configured." }, 500);
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
    if (body?.consented !== true || body?.consent_version !== "service-subscription-v1") {
      return json({ error: "Explicit recurring-payment consent is required." }, 400);
    }
    if (body?.token_payment_acknowledged !== true) {
      return json({ error: "Acknowledge the separate ₦50 mandate verification payment to continue." }, 400);
    }
    const requestedPlanKey = String(body?.plan_key || "");
    const planKey = PLANS[requestedPlanKey] ||
      (/^svc_[a-z0-9_]{1,40}$/.test(requestedPlanKey) ? requestedPlanKey : null);
    if (!planKey) return json({ error: "Choose a valid service-provider plan." }, 400);

    const accountNumber = String(body?.account_number || "").replace(/\D/g, "");
    const bankCode = String(body?.bank_code || "");
    const phone = normalizePhone(String(body?.phone || ""));
    if (!/^\d{10}$/.test(accountNumber) || !/^[0-9]{3,6}$/.test(bankCode) || !phone) {
      return json({ error: "Enter a valid 10-digit account number, supported bank and Nigerian phone number." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, specialty, service_category, trial_start_date")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (
      !profile || profile.role !== "provider" ||
      !(profile.specialty || profile.service_category)
    ) {
      return json({ error: "Complete your service-provider profile before choosing a subscription." }, 403);
    }
    const { data: existing, error: existingError } = await supabase
      .from("subscriptions")
      .select("id, status, payment_method_type, metadata, trial_start_at, current_period_end, kora_authorization_code, pending_kora_authorization_code")
      .eq("user_id", user.id)
      .eq("product_line", "service")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    const existingMetadata = existing?.metadata as Record<string, unknown> | null;
    const authorizationPending = Boolean(
      existing?.pending_kora_authorization_code ||
      (existing?.status === "trialing" &&
        !existing?.trial_start_at &&
        existingMetadata?.authorization_status === "pending"),
    );
    if (authorizationPending) {
      return json({ error: "A bank authorization is already pending. Finish it or cancel it from Manage Subscription before starting another." }, 409);
    }
    const usedTrial = Boolean(profile.trial_start_date || existing?.trial_start_at);
    const replacement = Boolean(
      existing &&
      (usedTrial ||
        (existing.status !== "canceled" && existing.status !== "expired")),
    );
    let trialEligible = !replacement && !usedTrial;

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("name, base_price_ngn, duration_days")
      .eq("key", planKey)
      .eq("product_line", "service")
      .eq("is_active", true)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan || Number(plan.base_price_ngn) <= 0) {
      return json({ error: "That subscription plan is unavailable." }, 404);
    }

    const name = String(profile.full_name || user.user_metadata?.full_name || "").trim();
    if (!name) return json({ error: "Add your full name to your provider profile before continuing." }, 400);
    const storedPhone = normalizePhone(String(profile.phone || ""));
    if (!storedPhone || storedPhone !== phone) {
      return json({ error: "Use the Nigerian phone number saved on your provider profile." }, 400);
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 21 * 86400000);
    const firstPeriodEnd = trialEligible ? trialEnd : now;
    const mandateEnd = new Date(now);
    mandateEnd.setUTCFullYear(mandateEnd.getUTCFullYear() + 1);
    const subscriptionId = replacement ? existing!.id : crypto.randomUUID();
    if (!replacement) {
      const { error: insertError } = await supabase.from("subscriptions").insert({
        id: subscriptionId,
        user_id: user.id,
        plan_key: planKey,
        product_line: "service",
        status: "trialing",
        current_period_start: now.toISOString(),
        current_period_end: firstPeriodEnd.toISOString(),
        auto_renew: false,
        launch_free_period: false,
        payment_method_type: "kora_direct_debit",
        payment_method_bank: String(body?.bank_name || "").slice(0, 80),
        payment_method_last4: accountNumber.slice(-4),
        consent_at: now.toISOString(),
        consent_version: "service-subscription-v1",
        metadata: {
          authorization_status: "initiating",
          trial_days: trialEligible ? 21 : 0,
        },
      });
      if (insertError) throw insertError;

      if (trialEligible) {
        const emailHash = await hmacIdentity(
          TRIAL_IDENTITY_HMAC_SECRET,
          `email:${user.email.trim().toLowerCase()}`,
        );
        const phoneHash = await hmacIdentity(
          TRIAL_IDENTITY_HMAC_SECRET,
          `phone:${phone}`,
        );
        const { data: eligible, error: claimError } = await supabase.rpc(
          "reserve_service_provider_trial",
          {
            p_user_id: user.id,
            p_subscription_id: subscriptionId,
            p_email_hash: emailHash,
            p_phone_hash: phoneHash,
          },
        );
        if (claimError) throw claimError;
        if (!eligible) {
          trialEligible = false;
          const { error: noTrialUpdateError } = await supabase
            .from("subscriptions")
            .update({
              current_period_end: now.toISOString(),
              metadata: { authorization_status: "initiating", trial_days: 0 },
              updated_at: now.toISOString(),
            })
            .eq("id", subscriptionId);
          if (noTrialUpdateError) throw noTrialUpdateError;
        }
      }
    }

    try {
      const result = await createVariableAuthorization(KORA_SECRET_KEY, {
        amount: Number(plan.base_price_ngn),
        name,
        email: user.email,
        phone,
        accountNumber,
        bankCode,
        startDate: dateOnly(now),
        endDate: dateOnly(mandateEnd),
      });

      const pendingMetadata = replacement
        ? {
            ...(existingMetadata || {}),
            pending_authorization_status: "pending",
            pending_authorization_reference: result.reference,
            pending_plan_key: planKey,
          }
        : {
            authorization_status: "pending",
            authorization_reference: result.reference,
            trial_days: trialEligible ? 21 : 0,
          };
      const updateValues = replacement
        ? {
            pending_kora_authorization_code: result.authorization_code,
            pending_kora_authorization_expires_at: mandateEnd.toISOString(),
            pending_plan_key: planKey,
            pending_payment_method_bank: result.customer_bank_name || String(body?.bank_name || ""),
            pending_payment_method_last4: accountNumber.slice(-4),
            metadata: pendingMetadata,
            updated_at: new Date().toISOString(),
          }
        : {
            kora_authorization_code: result.authorization_code,
            kora_authorization_expires_at: mandateEnd.toISOString(),
            payment_method_bank: result.customer_bank_name || String(body?.bank_name || ""),
            metadata: pendingMetadata,
            updated_at: new Date().toISOString(),
          };
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update(updateValues)
        .eq("id", subscriptionId);
      if (updateError) {
        console.error("[start-service-subscription] authorization reference could not be saved:", updateError.message);
        return json({ error: `KoraPay started the mandate, but JobBridge could not record it. Contact support with reference ${result.reference}.` }, 500);
      }

      return json({
        subscription_id: subscriptionId,
        status: "authorization_pending",
        authorization_reference: result.reference,
        activation_instructions: result.description ||
          "Complete KoraPay's required ₦50 NIBSS token payment to activate the Direct Debit mandate.",
        token_payment: {
          amount_ngn: 50,
          account_number: result.customer_account_number,
          account_name: result.customer_account_name,
          bank_name: result.customer_bank_name,
        },
        plan_name: plan.name,
        monthly_amount_ngn: Number(plan.base_price_ngn),
        mandate_expires_at: dateOnly(mandateEnd),
        trial_days: replacement ? 0 : trialEligible ? 21 : 0,
        first_charge_at: replacement
          ? existing?.current_period_end
          : trialEligible
          ? trialEnd.toISOString()
          : now.toISOString(),
      });
    } catch (error) {
      if (!replacement) {
        await supabase.rpc("release_service_provider_trial_claim", {
          p_user_id: user.id,
          p_subscription_id: subscriptionId,
        });
        await supabase.from("subscriptions").delete().eq("id", subscriptionId);
      }
      console.error("[start-service-subscription] KoraPay mandate initiation failed:", error);
      return json({ error: "KoraPay could not start the bank authorization. Check the details and try again." }, 502);
    }
  } catch (error) {
    console.error("[start-service-subscription] setup failed:", error);
    return json({ error: "Could not start your provider subscription. Please try again." }, 500);
  }
});
