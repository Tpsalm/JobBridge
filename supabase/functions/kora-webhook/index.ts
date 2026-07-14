import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const KORA_SECRET_KEY =
  Deno.env.get("KORA_SECRET_KEY") || Deno.env.get("VITE_KORA_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_API_BASE = "https://api.korapay.com/merchant/api/v1";
const KORA_ALLOW_SIMULATED_VERIFICATION =
  (Deno.env.get("KORA_ALLOW_SIMULATED_VERIFICATION") || "").toLowerCase() ===
    "true";

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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

  return `{${entries.join(",")}}`;
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

async function verifySignature(
  payload: KoraWebhookPayload,
  signature: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signature || !KORA_SECRET_KEY) return false;

  try {
    const keyBytes = new TextEncoder().encode(KORA_SECRET_KEY);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const variants = [      rawBody,      JSON.stringify(payload.data),
      stableStringify(payload.data),
      stableStringify(payload.data).replace(/\\s+/g, ""),
    ];

    for (const dataStr of variants) {
      const dataBytes = new TextEncoder().encode(dataStr);
      const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hex === signature) {
        console.log("[Kora Webhook] Signature verified using variant", dataStr);
        return true;
      }
    }

    console.warn(
      "[Kora Webhook] Signature verification failed for all payload variants",
    );
    return false;
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
    const rawBody = await req.text();
    let payload: KoraWebhookPayload;

    try {
      payload = rawBody ? JSON.parse(rawBody) : { event: "", data: {} };
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
    console.log("[Kora Webhook] Signature header:", signature || "<missing>");
    console.log("[Kora Webhook] Raw payload:", rawBody);

    if (!ALLOWED_EVENTS.has(payload.event)) {
      console.log(`[Kora Webhook] Ignoring event type: ${payload.event}`);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const isValid = await verifySignature(payload, signature, rawBody);
    console.log("[Kora Webhook] Signature check result:", isValid);
    if (!isValid) {
      console.error("[Kora Webhook] Invalid signature — ignoring request");
      return new Response(
        JSON.stringify({
          error: "Invalid signature",
          reference: payload.data?.reference || null,
          signature: signature || null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reference =
      payload.data.reference || payload.data.payment_reference || "";
    if (!reference) {
      console.error("[Kora Webhook] No reference in payload");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Primary lookup: match by JobBridge reference
    let { data: payment, error: findError } = await supabase
      .from("payments")
      .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata")
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
          .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata")
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
          .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata")
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
            .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata")
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
                    : 7;
    const creditsToAdd =
      payment.plan === "basic" || payment.plan === "standard"
        ? 1
        : payment.plan === "premium"
          ? 3
          : 0;
    const expiresAt = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: profileData, error: profileFetchError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", payment.user_id)
      .maybeSingle();

    if (!profileFetchError && profileData) {
      const creditCount = Number(profileData.credits || 0) + creditsToAdd;
      const profileUpdates: Record<string, unknown> = {
        is_premium: true,
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
        credits: creditCount,
        updated_at: new Date().toISOString(),
      };

      if (payment.plan === "service_verified") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = false;
      } else if (payment.plan === "service_featured") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = true;
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
      }
    } else if (profileFetchError) {
      console.error(
        "[Kora Webhook] Failed to read profile credits:",
        profileFetchError.message,
      );
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
