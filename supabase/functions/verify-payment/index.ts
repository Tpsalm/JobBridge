import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { buildReferenceCandidates, isChargeNotFoundError } from "../_shared/reference-normalization.ts";
import { cardTokenFromVerification, persistKoraCardToken } from "../_shared/korapay-recurring.ts";

const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || Deno.env.get("VITE_KORA_SECRET_KEY") || "";
const KORA_ALLOW_SIMULATED_VERIFICATION = Boolean(Deno.env.get("KORA_ALLOW_SIMULATED_VERIFICATION"));
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

function parseAdvertMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed?.advert ? parsed.advert as Record<string, unknown> : parsed;
    } catch {
      return null;
    }
  }
  if (typeof metadata === "object" && metadata !== null) {
    const metaObj = metadata as Record<string, unknown>;
    return metaObj.advert ? (metaObj.advert as Record<string, unknown>) : metaObj;
  }
  return null;
}

const BUSINESS_PLANS = new Set(["business_weekly", "business_monthly", "business_featured"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !KORA_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── UNIVERSAL DIRECT ACTIVATION MODE ────────────────────────────────────────
    // Called from Payment.tsx after successful KoraPay checkout to immediately
    // activate ANY subscription via the service role (bypasses RLS).
    // Supports: ai_tools, recruiter (credits), service plan, business advert creation.
    const requestBody = body as Record<string, unknown>;

    // Universal activation: called with activate_plan, plan_key, user_id, duration_days, credits, etc.
    if (requestBody?.activate_plan === true && requestBody?.user_id && requestBody?.plan_key) {
      const userId = String(requestBody.user_id);
      const planKey = String(requestBody.plan_key);
      const durationDays = Number(requestBody.duration_days) || 30;
      const creditsToAdd = Number(requestBody.credits) || 0;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // Determine subscription tier based on plan key
      const isAiPlan = planKey === "ai_monthly" || planKey === "ai_annual";
      const isServicePlan = planKey === "service_monthly" || planKey === "service_verified" || planKey === "service_featured";
      const isRecruiterPlan = planKey === "basic" || planKey === "standard" || planKey === "premium";
      const isBusinessPlan = planKey === "business_weekly" || planKey === "business_monthly" || planKey === "business_featured";

      const tier = isAiPlan ? "ai_tools" : planKey;

      // 1) Update profile subscription
      const profileUpdates: Record<string, unknown> = {
        is_premium: true, // All paid plans (including business) set is_premium so subscription.status shows "active"
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
        updated_at: now,
      };

      // Read current credits and add new ones
      if (isRecruiterPlan || isServicePlan || isBusinessPlan) {
        const { data: profileData } = await supabase.from("profiles").select("credits").eq("id", userId).maybeSingle();
        const currentCredits = Number(profileData?.credits || 0);
        profileUpdates.credits = isServicePlan ? currentCredits : currentCredits + creditsToAdd;
      } else if (isAiPlan) {
        profileUpdates.credits = 0;
      }

      // Service plan flags
      if (planKey === "service_monthly") {
        profileUpdates.is_verified = false;
        profileUpdates.is_featured = false;
      } else if (planKey === "service_verified") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = false;
      } else if (planKey === "service_featured") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = true;
      }

      // Service subscribers must appear in the public marketplace feed
      // (feed gates on profiles.visibility_until > now + is_active).
      if (isServicePlan) {
        profileUpdates.visibility_until = expiresAt;
        profileUpdates.is_active = true;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);

      if (profileErr) {
        console.error("[verify-payment] Universal activation profile update failed:", profileErr.message);
      } else {
        console.log(`[verify-payment] Profile activated for user ${userId}, plan ${planKey}, ${durationDays} days`);
        if (isServicePlan) {
          await supabase.from("service_providers").update({ is_active: true }).eq("profile_id", userId).catch(() => {});
        }
      }

      // 2) For business plans, create the advertisement from pending data
      let advertCreated = false;
      if (isBusinessPlan) {
        try {
          const pendingRaw = typeof requestBody.pending_advert === "string" 
            ? JSON.parse(requestBody.pending_advert) 
            : requestBody.pending_advert;

          if (pendingRaw && typeof pendingRaw === "object") {
            const packageType = planKey === "business_weekly" ? "weekly" : planKey === "business_monthly" ? "monthly" : "featured";
            const startsAt = new Date().toISOString();
            const adDurationDays = planKey === "business_weekly" ? 7 : 30;
            const adExpiresAt = new Date(Date.now() + adDurationDays * 24 * 60 * 60 * 1000).toISOString();

            const { error: advertErr } = await supabase.from("advertisements").insert([{
              owner_id: userId,
              business_name: String(pendingRaw.businessName || userId),
              title: String(pendingRaw.title || "Business Advert"),
              description: String(pendingRaw.description || ""),
              category: String(pendingRaw.category || "Other"),
              package: packageType,
              is_featured: planKey === "business_featured" || Boolean(pendingRaw.featured),
              starts_at: startsAt,
              expires_at: adExpiresAt,
              status: "active",
              views: 0,
              clicks: 0,
              payment_status: "paid",
              amount_paid: Number(requestBody.amount) || 0,
              created_at: now,
              updated_at: now,
            }]);

            if (advertErr) {
              console.error("[verify-payment] Business advert creation failed:", advertErr.message);
            } else {
              advertCreated = true;
              console.log(`[verify-payment] Business advert created for user ${userId}, plan ${planKey}`);
            }
          }
        } catch (advertErr) {
          console.error("[verify-payment] Business advert processing error:", advertErr);
        }
      }

      // 3) Save the KoraPay card token (if present) so monthly renewals auto-debit.
      const cardToken = String(requestBody.card_token || "");
      const tokenResult = cardToken
        ? await persistKoraCardToken(supabase, userId, planKey, cardToken)
        : null;
      if (cardToken && tokenResult && !tokenResult.skipped && !tokenResult.error) {
        console.log(`[verify-payment] Card token saved for user ${userId}, plan ${planKey}`);
      } else if (tokenResult?.error) {
        console.error("[verify-payment] Failed to persist card token:", tokenResult.error);
      }

      const result: Record<string, unknown> = { 
        verified: true,
        activated: tier,
        profile_updated: !profileErr,
      };
      if (isBusinessPlan) {
        result.advert_created = advertCreated;
      }

      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Backward-compat: AI-only activation (used by previous code version)
    if (requestBody?.activate_ai === true && requestBody?.user_id) {
      const userId = String(requestBody.user_id);
      const durationDays = Number(requestBody.duration_days) || 30;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      
      const { error: activateErr } = await supabase
        .from("profiles")
        .update({
          is_premium: true,
          subscription_tier: "ai_tools",
          subscription_expires_at: expiresAt,
          credits: 0,
          updated_at: now,
        })
        .eq("id", userId);

      if (activateErr) {
        console.error("[verify-payment] Direct AI activation failed:", activateErr.message);
        return new Response(JSON.stringify({ verified: false, error: "Activation failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[verify-payment] Direct AI activation successful for user ${userId}, duration ${durationDays} days`);
      return new Response(JSON.stringify({ verified: true, activated: "ai_tools" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const candidateRefs = buildReferenceCandidates(body as Record<string, unknown>);
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

    const explicitSimulate = Boolean(requestBody?.simulate || requestBody?.simulate_verification || false);
    let paymentMetadata: any = null;
    try {
      paymentMetadata = typeof paymentRow.metadata === 'string' ? JSON.parse(paymentRow.metadata) : paymentRow.metadata;
    } catch {
      paymentMetadata = paymentRow.metadata;
    }
    const seededByKora = paymentMetadata && (paymentMetadata.seeded_by === 'kora-webhook' || paymentMetadata.source === 'simulated_webhook_seed');
    // Auto-detect: always simulate for seeded test payments or known test refs (JB-SIM*)
    const isTestReference = candidateRefs.some((r) => typeof r === 'string' && r.startsWith('JB-SIM'));
    const shouldSimulate = seededByKora || isTestReference || (KORA_ALLOW_SIMULATED_VERIFICATION && explicitSimulate);

    if (shouldSimulate) {
      console.log('[verify-payment] Simulating verification for', candidateRefs[0]);
      chargeReference = candidateRefs[0];
      chargeResponse = {
        status: true,
        message: 'Simulated verification',
        data: {
          reference: chargeReference,
          payment_reference: `SIM-${chargeReference}`,
          transaction_reference: `SIM-TX-${chargeReference}`,
          status: 'success',
          amount: paymentRow.amount,
          amount_paid: paymentRow.amount,
          currency: paymentRow.currency || 'NGN',
        },
      };
    } else {
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
    }

    if (!chargeResponse) {
      const detail = (lastVerifyError && typeof lastVerifyError === 'object' && 'message' in lastVerifyError) ? lastVerifyError : { message: String(lastVerifyError || 'Verification failed') };
      const responseBody = { verified: false, detail, charge_not_found: isChargeNotFoundError(detail) };
      return new Response(JSON.stringify(responseBody), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const charge = chargeResponse.data || {};
    const actualAmount = toNumber(charge.amount_paid) ?? toNumber(charge.amount) ?? null;
    const expectedAmount = Number(paymentRow.amount || 0);

    const status = (charge.status || charge.transaction_status || "").toLowerCase();
    if (status !== "success" && status !== "completed") {
      return new Response(JSON.stringify({ verified: false, status }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (actualAmount !== null && expectedAmount && actualAmount !== expectedAmount) {
      // mismatch
      await supabase.from("payments").update({ status: "failed", provider: "korapay", provider_reference: charge.payment_reference || charge.transaction_reference || chargeReference, metadata: { verification_response: charge } }).eq("id", paymentRow.id);
      return new Response(JSON.stringify({ verified: false, reason: "amount_mismatch" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update payment to verified
    const { error: updateErr } = await supabase.from("payments").update({ status: "verified", provider: "korapay", provider_reference: charge.payment_reference || charge.transaction_reference || chargeReference, currency: charge.currency || paymentRow.currency || "NGN", metadata: { verification_response: charge } }).eq("id", paymentRow.id).neq("status", "verified");
    if (updateErr) console.error("[verify-payment] update error", updateErr.message);

    // Card-token capture for recurring auto-debit (KoraPay saved card).
    const savedCardToken = cardTokenFromVerification(chargeResponse);
    if (savedCardToken) {
      const tokenRes = await persistKoraCardToken(supabase, paymentRow.user_id, paymentRow.plan, savedCardToken);
      if (tokenRes?.error) {
        console.error("[verify-payment] Failed to persist card token:", tokenRes.error);
      } else if (tokenRes && !tokenRes.skipped) {
        console.log(`[verify-payment] Card token saved for user ${paymentRow.user_id}, plan ${paymentRow.plan}`);
      }
    }

    // Activate profile similar to webhook
    const tier = (paymentRow.plan === "ai_monthly" || paymentRow.plan === "ai_annual") ? "ai_tools" : paymentRow.plan;
    const durationDays = paymentRow.plan === "basic" ? 7 : paymentRow.plan === "standard" ? 14 : paymentRow.plan === "premium" ? 30 : paymentRow.plan === "ai_monthly" ? 30 : paymentRow.plan === "ai_annual" ? 365 : paymentRow.plan === "business_weekly" ? 7 : 30;
    // Business advert plans must grant 1 advert credit so the user can create their ad.
    const creditsToAdd = paymentRow.plan === "basic" || paymentRow.plan === "standard" ? 1 : paymentRow.plan === "premium" ? 2 : BUSINESS_PLANS.has(paymentRow.plan) ? 1 : 0;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: profileData } = await supabase.from("profiles").select("credits").eq("id", paymentRow.user_id).maybeSingle();
    if (profileData) {
      const creditCount = Number(profileData.credits || 0) + creditsToAdd;
      const profileUpdates: Record<string, unknown> = {
        is_premium: true,
        subscription_tier: tier,
        subscription_expires_at: expiresAt,
        credits: creditCount,
        updated_at: new Date().toISOString(),
      };
      if (paymentRow.plan === "service_monthly") {
        profileUpdates.is_verified = false;
        profileUpdates.is_featured = false;
      } else if (paymentRow.plan === "service_verified") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = false;
      } else if (paymentRow.plan === "service_featured") {
        profileUpdates.is_verified = true;
        profileUpdates.is_featured = true;
      }
      const { error: upErr } = await supabase.from("profiles").update(profileUpdates).eq("id", paymentRow.user_id);
      if (upErr) console.error("[verify-payment] profile update failed", upErr.message);
    }

    // Send email notification on success
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(paymentRow.user_id);
      if (userData?.user?.email) {
        const emailPayload = {
          type: "payment",
          email: userData.user.email,
          name: userData.user.user_metadata?.full_name || userData.user.email,
          plan: paymentRow.plan,
          amount: String(paymentRow.amount),
        };
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        });
        console.log(`[verify-payment] Payment confirmation email sent to ${userData.user.email}`);
      }
    } catch (emailErr) {
      console.error("[verify-payment] failed to send email:", emailErr);
    }

    // Business advert fallback: create advert if plan was a paid business package
    if (BUSINESS_PLANS.has(paymentRow.plan)) {
      try {
        const advertDetails = parseAdvertMetadata(paymentRow.metadata);
        const packageType = paymentRow.plan === 'business_weekly'
          ? 'weekly'
          : paymentRow.plan === 'business_monthly'
            ? 'monthly'
            : 'featured';

        const existingAdQuery = supabase
          .from('advertisements')
          .select('id')
          .eq('owner_id', paymentRow.user_id)
          .eq('package', packageType)
          .limit(1);

        if (advertDetails?.title) {
          existingAdQuery.eq('title', String(advertDetails.title));
        }

        const { data: existingAd } = await existingAdQuery.maybeSingle();
        if (!existingAd) {
          const startsAt = new Date().toISOString();
          const durationDays = paymentRow.plan === 'business_weekly' ? 7 : 30;
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
          const title = String(advertDetails?.title || 'New Business Advert');
          const businessName = String(advertDetails?.businessName || paymentRow.user_id);
          const description = String(advertDetails?.description || 'Promote your business to JobBridge users');
          const category = String(advertDetails?.category || 'Other');
          const imageUrl = advertDetails?.image_url ? String(advertDetails.image_url) : advertDetails?.imageUrl ? String(advertDetails.imageUrl) : null;
          const websiteUrl = advertDetails?.website_url ? String(advertDetails.website_url) : advertDetails?.websiteUrl ? String(advertDetails.websiteUrl) : null;
          const featured = paymentRow.plan === 'business_featured' || Boolean(advertDetails?.featured);

          const { error: advertErr } = await supabase.from('advertisements').insert([{ 
            owner_id: paymentRow.user_id,
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
            amount_paid: paymentRow.amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

          if (advertErr) {
            console.error('[verify-payment] Failed to create business advert fallback:', advertErr.message || advertErr);
          } else {
            console.log('[verify-payment] Created fallback business advert for payment', paymentRow.reference);
          }
        }
      } catch (advertError) {
        console.error('[verify-payment] business advert fallback failed:', advertError);
      }
    }

    // Optionally return updated profile for debugging / simulated flows
    if (shouldSimulate || explicitSimulate || (requestBody && requestBody.debug)) {
      try {
        const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', paymentRow.user_id).maybeSingle();
        return new Response(JSON.stringify({ verified: true, profile: updatedProfile }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.warn('[verify-payment] failed to fetch updated profile for debug response', e);
        return new Response(JSON.stringify({ verified: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ verified: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[verify-payment] error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
