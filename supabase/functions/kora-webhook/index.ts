import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const KORA_SECRET_KEY =
  Deno.env.get("KORA_SECRET_KEY") || Deno.env.get("VITE_KORA_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_API_BASE = "https://api.korapay.com/merchant/api/v1";

const ALLOWED_EVENTS = new Set(["charge.success", "charge.failed"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-korapay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface KoraWebhookPayload {
  event: string;
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
      return "Premium Job Post";
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

async function verifySignature(
  payload: KoraWebhookPayload,
  signature: string | null,
): Promise<boolean> {
  if (!signature || !KORA_SECRET_KEY) return false;

  try {
    const dataStr = JSON.stringify(payload.data);
    const keyBytes = new TextEncoder().encode(KORA_SECRET_KEY);
    const dataBytes = new TextEncoder().encode(dataStr);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hex === signature;
  } catch {
    return false;
  }
}

async function verifyCharge(
  reference: string,
): Promise<KoraChargeVerificationResponse> {
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
    const signature = req.headers.get("x-korapay-signature");
    const payload: KoraWebhookPayload = await req.json();

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

    const isValid = await verifySignature(payload, signature);
    if (!isValid) {
      console.error("[Kora Webhook] Invalid signature — ignoring request");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const reference =
      payload.data.reference || payload.data.payment_reference || "";
    if (!reference) {
      console.error("[Kora Webhook] No reference in payload");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: payment, error: findError } = await supabase
      .from("payments")
      .select("id, user_id, plan, status, amount, currency, reference")
      .eq("reference", reference)
      .maybeSingle<PaymentRow>();

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
      verification = await verifyCharge(reference);
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
