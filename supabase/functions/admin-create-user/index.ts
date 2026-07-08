import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ROLES = new Set([
  "job_seeker",
  "recruiter",
  "provider",
  "admin",
]);

function jsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get("origin")),
      "Content-Type": "application/json",
    },
  });
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(req, 500, { error: "Server not configured" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!jwt) {
    return jsonResponse(req, 401, { error: "Missing bearer token" });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await adminClient.auth.getUser(jwt);

    if (authError || !authUser) {
      return jsonResponse(req, 401, { error: "Invalid session" });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, email, full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return jsonResponse(req, 403, { error: "Admin access required" });
    }

    const rawBody = await req.json();
    const email = sanitizeText(rawBody?.email, 320).toLowerCase();
    const password = typeof rawBody?.password === "string" ? rawBody.password : "";
    const fullName = sanitizeText(rawBody?.full_name, 200);
    const role = sanitizeText(rawBody?.role, 50) || "job_seeker";
    const company = sanitizeText(rawBody?.company, 200) || null;
    const phone = sanitizeText(rawBody?.phone, 50) || null;
    const location = sanitizeText(rawBody?.location, 200) || null;
    const bio = sanitizeText(rawBody?.bio, 1000) || null;

    if (!validateEmail(email)) {
      return jsonResponse(req, 400, { error: "A valid email is required" });
    }

    if (password.length < 8) {
      return jsonResponse(req, 400, {
        error: "Password must be at least 8 characters",
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return jsonResponse(req, 400, { error: "Invalid role supplied" });
    }

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
          company,
        },
      });

    if (createError || !created.user) {
      return jsonResponse(req, 400, {
        error: createError?.message || "Failed to create user",
      });
    }

    const profilePayload = {
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      company,
      phone,
      location,
      bio,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await adminClient
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertError) {
      return jsonResponse(req, 500, {
        error: "User created but profile sync failed",
        details: upsertError.message,
        user_id: created.user.id,
      });
    }

    await adminClient.from("admin_events").insert({
      admin_id: profile.id,
      admin_name: profile.full_name || profile.email || "Admin",
      action_type: "user_create",
      target_type: "profile",
      target_id: created.user.id,
      details: {
        email,
        role,
      },
    });

    return jsonResponse(req, 200, {
      user: {
        id: created.user.id,
        email,
        full_name: fullName,
        role,
      },
    });
  } catch (error) {
    console.error("[admin-create-user] Unexpected error:", error);
    return jsonResponse(req, 500, {
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});
