import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  debitAuthorization,
  KoraDirectDebitError,
  verifyCharge,
} from "../_shared/korapay-direct-debit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KORA_SECRET_KEY = Deno.env.get("KORA_SECRET_KEY") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notify(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  content: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await serviceClient.from("notifications").insert({
    user_id: userId,
    type: "payment",
    title,
    content,
    data,
  });
  if (error) console.error("[pay-service-subscription-manually] notification failed:", error.message);
}

async function notifyEmail(
  email: string | undefined,
  name: string,
  plan: string,
  amount: number,
  succeeded: boolean,
): Promise<void> {
  if (!email) return;
  try {
    const result = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: succeeded ? "payment" : "payment_failed",
        email,
        name,
        plan,
        amount: String(amount),
      }),
    });
    if (!result.ok) {
      console.error("[pay-service-subscription-manually] payment email rejected:", result.status);
    }
  } catch (error) {
    console.error("[pay-service-subscription-manually] payment email could not be sent:", error);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !KORA_SECRET_KEY) {
    return response({ error: "Manual subscription payments are not configured." }, 500);
  }
  const authorization = req.headers.get("Authorization");
  if (!authorization) return response({ error: "Authentication required." }, 401);

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return response({ error: "Authentication required." }, 401);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: attempt, error: attemptError } = await serviceClient.rpc(
      "create_service_manual_payment",
      { p_user_id: user.id },
    );
    if (attemptError) {
      console.warn("[pay-service-subscription-manually] payment could not be reserved:", attemptError.message);
      return response({ error: attemptError.message }, 409);
    }

    let debitAccepted = false;
    try {
      const debit = await debitAuthorization(
        KORA_SECRET_KEY,
        String(attempt.authorization_code),
        {
          amount: Number(attempt.amount_ngn),
          reference: String(attempt.reference),
          narration: `Manual ${String(attempt.plan_name)} subscription renewal`,
        },
      );
      debitAccepted = true;
      const gatewayReference = String(debit.transaction_reference || attempt.reference);
      await serviceClient.from("payments")
        .update({ provider_reference: gatewayReference, updated_at: new Date().toISOString() })
        .eq("id", attempt.payment_id)
        .eq("status", "pending");
      const debitStatus = String(debit.status || "").toLowerCase();
      if (debitStatus !== "success" && debitStatus !== "failed") {
        return response({
          status: "payment_processing",
          reference: String(attempt.reference),
          message: "KoraPay is processing the payment. The subscription will update after confirmation.",
        }, 202);
      }

      const verified = await verifyCharge(KORA_SECRET_KEY, gatewayReference);
      const amount = Number(verified.amount_paid ?? verified.amount);
      const finalStatus = String(verified.status || "").toLowerCase();
      if (
        String(verified.reference || gatewayReference) !== gatewayReference ||
        String(verified.currency || "").toUpperCase() !== "NGN" ||
        amount !== Number(attempt.amount_ngn) ||
        (finalStatus !== "success" && finalStatus !== "failed")
      ) {
        return response({
          status: "payment_processing",
          reference: String(attempt.reference),
          message: "KoraPay has not confirmed a final result yet.",
        }, 202);
      }

      const { data: settlement, error: settleError } = await serviceClient.rpc(
        "settle_service_subscription_payment",
        {
          p_payment_id: attempt.payment_id,
          p_gateway_reference: gatewayReference,
          p_succeeded: finalStatus === "success",
          p_failure_code: finalStatus === "failed" ? "manual_payment_failed" : null,
        },
      );
      if (settleError) throw settleError;
      const succeeded = settlement?.state === "succeeded";
      const planName = String(attempt.plan_name);
      const paymentAmount = Number(attempt.amount_ngn);
      await notify(
        serviceClient,
        user.id,
        succeeded ? "Manual subscription payment confirmed" : "Manual subscription payment failed",
        succeeded
          ? `Your ${planName} subscription payment of ₦${paymentAmount.toLocaleString("en-NG")} was confirmed.`
          : `Your payment for ${planName} could not be confirmed. Review your payment method or try again.`,
        { reference: gatewayReference, subscription_id: attempt.subscription_id, status: succeeded ? "verified" : "failed" },
      );
      await notifyEmail(
        user.email,
        String(user.user_metadata?.full_name || user.email || "there"),
        planName,
        paymentAmount,
        succeeded,
      );
      return response({
        status: succeeded ? "payment_confirmed" : "payment_failed",
        reference: gatewayReference,
      });
    } catch (error) {
      if (
        error instanceof KoraDirectDebitError &&
        !debitAccepted &&
        error.httpStatus !== null &&
        error.httpStatus < 500 &&
        error.httpStatus !== 409
      ) {
        const { data: settlement, error: settleError } = await serviceClient.rpc(
          "settle_service_subscription_payment",
          {
            p_payment_id: attempt.payment_id,
            p_gateway_reference: String(attempt.reference),
            p_succeeded: false,
            p_failure_code: error.message.slice(0, 120),
          },
        );
        if (settleError) throw settleError;
        const planName = String(attempt.plan_name);
        const amount = Number(attempt.amount_ngn);
        await notify(
          serviceClient,
          user.id,
          "Manual subscription payment failed",
          `Your payment for ${planName} could not be completed. Review your payment method or try again.`,
          { reference: String(attempt.reference), status: "failed" },
        );
        await notifyEmail(user.email, String(user.user_metadata?.full_name || user.email || "there"), planName, amount, false);
        return response({ status: "payment_failed", reference: String(attempt.reference), settlement: settlement?.state });
      }
      console.error("[pay-service-subscription-manually] payment result is uncertain:", error);
      return response({
        status: "payment_processing",
        reference: String(attempt.reference),
        message: "The payment result is not confirmed yet. Do not submit another payment; JobBridge will update this subscription after KoraPay responds.",
      }, 202);
    }
  } catch (error) {
    console.error("[pay-service-subscription-manually] manual payment failed:", error);
    return response({ error: "The manual payment could not be started. Please try again." }, 500);
  }
});
