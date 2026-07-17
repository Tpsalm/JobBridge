import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || Deno.env.get("VITE_KORA_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_API_BASE = "https://api.korapay.com/merchant/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !KORA_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || body?.ref || "").trim();
    const fallbackReference = String(body?.fallback_reference || body?.fallbackRef || "").trim();
    const originalReference = String(body?.original_reference || body?.originalRef || "").trim();
    if (!reference && !fallbackReference && !originalReference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const candidateRefs = Array.from(
      new Set(
        [reference, fallbackReference, originalReference]
          .map((item) => String(item || "").trim())
          .filter((item) => item.length > 0),
      ),
    );

    if (candidateRefs.length === 0) {
      return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orConditions = candidateRefs
      .map((ref) => `reference.eq.${ref},provider_reference.eq.${ref}`)
      .join(",");

    const { data: paymentRow, error: findErr } = await supabase
      .from("payments")
      .select("id, user_id, plan, status, amount, currency, reference, provider_reference, metadata")
      .or(orConditions)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("[verify-payment] lookup error", findErr.message);
      return new Response(JSON.stringify({ error: "Lookup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!paymentRow) {
      return new Response(JSON.stringify({ error: "No payment record found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call Kora verify endpoint using candidate references until one succeeds
    let chargeResponse: any = null;
    let chargeReference = candidateRefs[0];
    let lastVerifyError: any = null;
    for (const candidate of candidateRefs) {
      try {
        const resp = await fetch(`${KORA_API_BASE}/charges/${encodeURIComponent(candidate)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${KORA_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        });

        const text = await resp.text();
        const bodyJson = text ? JSON.parse(text) : null;

        if (resp.ok && bodyJson?.status) {
          chargeReference = candidate;
          chargeResponse = bodyJson;
          break;
        }

        lastVerifyError = bodyJson || text;
      } catch (verifyErr) {
        lastVerifyError = verifyErr;
      }
    }

    if (!chargeResponse) {
      return new Response(JSON.stringify({ verified: false, detail: lastVerifyError }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const charge = chargeResponse.data || {};
    const actualAmount = toNumber(charge.amount_paid) ?? toNumber(charge.amount) ?? null;
    const expectedAmount = Number(payment.amount || 0);

    const status = (charge.status || charge.transaction_status || "").toLowerCase();
    if (status !== "success" && status !== "completed") {
      return new Response(JSON.stringify({ verified: false, status }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (actualAmount !== null && expectedAmount && actualAmount !== expectedAmount) {
      // mismatch
      await supabase.from("payments").update({ status: "failed", provider: "korapay", provider_reference: charge.payment_reference || charge.transaction_reference || reference, metadata: { verification_response: charge } }).eq("id", payment.id);
      return new Response(JSON.stringify({ verified: false, reason: "amount_mismatch" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update payment to verified
    const { error: updateErr } = await supabase.from("payments").update({ status: "verified", provider: "korapay", provider_reference: charge.payment_reference || charge.transaction_reference || reference, currency: charge.currency || payment.currency || "NGN", metadata: { verification_response: charge } }).eq("id", payment.id).neq("status", "verified");
    if (updateErr) console.error("[verify-payment] update error", updateErr.message);

    // Activate profile similar to webhook
    const tier = (payment.plan === "ai_monthly" || payment.plan === "ai_annual") ? "ai_tools" : payment.plan;
    const durationDays = payment.plan === "basic" ? 7 : payment.plan === "standard" ? 14 : payment.plan === "premium" ? 30 : payment.plan === "ai_monthly" ? 30 : payment.plan === "ai_annual" ? 365 : 30;
    const creditsToAdd = payment.plan === "basic" || payment.plan === "standard" ? 1 : payment.plan === "premium" ? 3 : 0;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: profileData } = await supabase.from("profiles").select("credits").eq("id", payment.user_id).maybeSingle();
    if (profileData) {
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
      const { error: upErr } = await supabase.from("profiles").update(profileUpdates).eq("id", payment.user_id);
      if (upErr) console.error("[verify-payment] profile update failed", upErr.message);
    }

    return new Response(JSON.stringify({ verified: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[verify-payment] error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
