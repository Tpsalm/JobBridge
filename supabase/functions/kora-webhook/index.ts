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
// When set to 'true' the function will skip HMAC signature verification.
// Use only for testing in a controlled environment and remove afterwards.
const SKIP_KORA_SIGNATURE_CHECK =
  (Deno.env.get("SKIP_KORA_SIGNATURE_CHECK") || "").toLowerCase() === "true";
const KORA_DEBUG_RESPONSE =
  (Deno.env.get("KORA_DEBUG_RESPONSE") || "").toLowerCase() === "true";

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
  rawBodyBytes: ArrayBuffer,
): Promise<{
  valid: boolean;
  normalizedHeaderCandidates: string[];
  computedVariants: Array<{ name: string; hex: string; base64: string }>;
}> {
  if (!signature || !KORA_SECRET_KEY) {
    return { valid: false, normalizedHeaderCandidates: [], computedVariants: [] };
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

    const headerSig = (signature || "").trim();
    // Accept header formats like 'sha256=<hex>' or raw hex/base64, with either colon or equals.
    const headerCandidates = headerSig.split(",").map((s) => s.trim()).filter(Boolean);

    function normalizeHeader(h: string) {
      let candidate = h.trim();
      if (candidate.startsWith("sha256='") || candidate.startsWith("SHA256='")) {
        candidate = candidate.slice(candidate.indexOf("=") + 2, -1);
      }
      if (candidate.startsWith("sha256=") || candidate.startsWith("SHA256=")) {
        candidate = candidate.slice(candidate.indexOf("=") + 1);
      }
      if (candidate.startsWith("sha256:") || candidate.startsWith("SHA256:")) {
        candidate = candidate.slice(candidate.indexOf(":") + 1);
      }
      if (candidate.startsWith("hmac-sha256=")) {
        candidate = candidate.slice("hmac-sha256=".length);
      }
      if (candidate.startsWith("hmac-sha256:")) {
        candidate = candidate.slice("hmac-sha256:".length);
      }
      if (candidate.startsWith("hmac=")) {
        candidate = candidate.slice("hmac=".length);
      }
      candidate = candidate.trim().replace(/^['"]|['"]$/g, "");
      return candidate;
    }

    const normalizedHeaderCandidates = headerCandidates.map(normalizeHeader).filter(Boolean);

    const trimmedRawBody = rawBody.replace(/[\r\n]+$/, "");
    const normalizedRawBody = rawBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const trimmedNormalizedRawBody = normalizedRawBody.replace(/[\r\n]+$/, "");

    const trimmedRawBodyBytes = new TextEncoder().encode(trimmedRawBody);
    const normalizedRawBodyBytes = new TextEncoder().encode(normalizedRawBody);
    const trimmedNormalizedRawBodyBytes = new TextEncoder().encode(trimmedNormalizedRawBody);

    const variants = [
      { name: 'rawBodyBytes', data: rawBodyBytes },
      { name: 'rawBody', data: rawBody },
      { name: 'rawBodyTrimmed', data: trimmedRawBody },
      { name: 'rawBodyNormalized', data: normalizedRawBody },
      { name: 'rawBodyNormalizedTrimmed', data: trimmedNormalizedRawBody },
      { name: 'rawBodyTrimmedBytes', data: trimmedRawBodyBytes },
      { name: 'rawBodyNormalizedBytes', data: normalizedRawBodyBytes },
      { name: 'rawBodyNormalizedTrimmedBytes', data: trimmedNormalizedRawBodyBytes },
      { name: 'fullPayloadJson', data: JSON.stringify(payload) },
      { name: 'jsonData', data: JSON.stringify(payload.data) },
      { name: 'stablePayload', data: stableStringify(payload) },
      { name: 'stableData', data: stableStringify(payload.data) },
      { name: 'stable_no_ws_payload', data: stableStringify(payload).replace(/\s+/g, '') },
      { name: 'stable_no_ws_data', data: stableStringify(payload.data).replace(/\s+/g, '') },
      { name: 'jsonData_no_ws', data: JSON.stringify(payload.data).replace(/\s+/g, '') },
    ];

    const bytesToHex = (b: ArrayBuffer) =>
      Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
    const bytesToBase64 = (b: ArrayBuffer) => {
      // Deno-friendly base64 encoding
      const u8 = new Uint8Array(b);
      let binary = "";
      for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
      // btoa is available in Deno runtime
      return btoa(binary);
    };

    const computedVariants: Array<{ name: string; hex: string; base64: string }> = [];
    let valid = false;

    for (const { name, data: dataStr } of variants) {
      try {
        const dataBytes = dataStr instanceof ArrayBuffer ? new Uint8Array(dataStr) : new TextEncoder().encode(String(dataStr));
        const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
        const hex = bytesToHex(sig);
        const b64 = bytesToBase64(sig);
        computedVariants.push({ name, hex, base64: b64 });
        console.log(`[Kora Webhook] Variant ${name} -> hex:${hex} base64:${b64}`);

        for (const candidate of normalizedHeaderCandidates) {
          if (!candidate) continue;
          if (candidate === hex || candidate === b64) {
            console.log("[Kora Webhook] Signature verified using variant", name);
            valid = true;
            break;
          }
          // sometimes header may include prefix like 'sha256=' or 'hmac='; try normalize
          if (candidate.endsWith(hex) || candidate.endsWith(b64)) {
            console.log("[Kora Webhook] Signature verified using suffix match on variant", name);
            valid = true;
            break;
          }
        }

        if (valid) break;
      } catch (e) {
        console.warn(`[Kora Webhook] Failed to compute HMAC for variant ${name}:`, e);
      }
    }

    if (!valid) {
      console.warn(
        "[Kora Webhook] Signature verification failed for all payload variants",
      );
    }
    return { valid, normalizedHeaderCandidates, computedVariants };
  } catch (err) {
    console.error("[Kora Webhook] Signature verification error:", err);
    return { valid: false, normalizedHeaderCandidates: [], computedVariants: [] };
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
    const signature = req.headers.get('x-korapay-signature');
    const rawBodyBuffer = await req.arrayBuffer();
    const rawBody = new TextDecoder().decode(rawBodyBuffer);
    let payload: KoraWebhookPayload;

    try {
      payload = rawBody ? JSON.parse(rawBody) : { event: '', data: {} };
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

    let isValid = false;
    let debugInfo: any = undefined;
    if (SKIP_KORA_SIGNATURE_CHECK) {
      console.warn("[Kora Webhook] SKIP_KORA_SIGNATURE_CHECK is enabled — skipping signature verification");
      isValid = true;
    } else {
      const result = await verifySignature(payload, signature, rawBody, rawBodyBuffer);
      isValid = result.valid;
      if (KORA_DEBUG_RESPONSE) {
        debugInfo = {
          normalized_header_candidates: result.normalizedHeaderCandidates,
          computed_variants: result.computedVariants,
        };
      }
    }
    console.log("[Kora Webhook] Signature check result:", isValid);
    if (!isValid) {
      console.error("[Kora Webhook] Invalid signature — ignoring request");
      const body: Record<string, unknown> = {
        error: "Invalid signature",
        reference: payload.data?.reference || null,
        signature: signature || null,
      };
      if (KORA_DEBUG_RESPONSE) {
        body['debug'] = {
          ...debugInfo,
          raw_body_length: rawBody.length,
          raw_body_preview: rawBody.slice(0, 1024),
        };
      }
      return new Response(
        JSON.stringify(body),
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
