import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Subscription cancellation is not configured." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cancellation, error: cancelError } = await authClient.rpc(
      "cancel_my_service_subscription",
    );
    if (cancelError) {
      return new Response(JSON.stringify({ error: cancelError.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessUntil = cancellation?.access_until || null;
    const { error: notificationError } = await serviceClient
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "payment",
        title: "Subscription cancelled",
        content: accessUntil
          ? `Automatic renewal is off. Your provider access remains available until ${new Date(accessUntil).toLocaleDateString("en-GB")}.`
          : "Automatic renewal is off. No provider trial was activated.",
        data: {
          subscription_id: cancellation?.subscription_id,
          access_until: accessUntil,
          status: "canceled",
        },
      });
    if (notificationError) {
      console.error("[cancel-service-subscription] cancellation notification failed:", notificationError.message);
    }

    if (user.email) {
      const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription_cancelled",
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          accessUntil: accessUntil
            ? new Date(accessUntil).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
            : "",
        }),
      });
      if (!emailResponse.ok) {
        console.error("[cancel-service-subscription] cancellation email was rejected:", emailResponse.status);
      }
    }

    return new Response(JSON.stringify(cancellation), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cancel-service-subscription] cancellation failed:", error);
    return new Response(JSON.stringify({ error: "Could not cancel the subscription. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
