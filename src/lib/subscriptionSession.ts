// =========================================================================
// JobBridge — service-provider subscription session helpers
// -------------------------------------------------------------------------
// The provider subscription edge functions authenticate the caller with the
// bearer token sent by `supabase.functions.invoke`. Two failure modes used to
// produce the misleading "Please sign in with a verified email address."
// toast:
//
//   1. The access token had expired (Supabase tokens last one hour) and the
//      client never refreshed it before invoking the function.
//   2. The user reached the Review & Confirm step without a session at all
//      (e.g. they landed on the page straight after signup, when email
//      confirmation is still pending).
//   3. The edge functions verified the token through a `global.headers` shim
//      that never read the caller's Authorization header, so a perfectly valid
//      token was treated as missing (fixed server-side in the subscription
//      functions by calling `auth.getUser(accessToken)`).
//
// These helpers make the token fresh before every privileged call, send it
// explicitly, retry once on a 401, and translate gateway errors into copy a
// provider can act on.
// =========================================================================

import { supabase } from "./supabase";
import { getFunctionInvokeErrorMessage } from "./supabaseHelpers";

/** Refresh the access token when it is this close to expiring. */
const REFRESH_THRESHOLD_SECONDS = 120;

export type SubscriptionSessionCheck =
  | { ok: true; userId: string; email: string; accessToken: string }
  | {
      ok: false;
      reason: "unauthenticated" | "missing-email" | "error";
      message: string;
    };

export const SIGN_IN_REQUIRED_MESSAGE =
  "Please sign in to continue with your subscription.";

/**
 * Exchange the refresh token for a brand new access token, bypassing the
 * "is it close to expiry?" heuristic used by the Supabase client.
 */
async function forceRefreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  } catch (error) {
    console.error("[subscriptionSession] forced token refresh failed:", error);
    return null;
  }
}

/**
 * Guarantee a usable Supabase session before calling a privileged edge
 * function. Refreshes the access token when it is missing or about to expire.
 */
export async function ensureSubscriptionSession(): Promise<SubscriptionSessionCheck> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    let session = data.session;

    const expiresAt = session?.expires_at ?? 0;
    const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
    const needsRefresh = !session || !session.access_token || secondsLeft <= REFRESH_THRESHOLD_SECONDS;

    if (needsRefresh) {
      const freshToken = await forceRefreshAccessToken();
      if (freshToken) {
        const refreshed = await supabase.auth.getSession();
        if (refreshed.data.session) session = refreshed.data.session;
      }
    }

    if (!session?.user?.id) {
      return {
        ok: false,
        reason: "unauthenticated",
        message: SIGN_IN_REQUIRED_MESSAGE,
      };
    }

    if (!session.user.email) {
      return {
        ok: false,
        reason: "missing-email",
        message:
          "Add an email address to your JobBridge account before starting a subscription.",
      };
    }

    return {
      ok: true,
      userId: session.user.id,
      email: session.user.email,
      accessToken: session.access_token,
    };
  } catch (error) {
    console.error("[subscriptionSession] session check failed:", error);
    return {
      ok: false,
      reason: "error",
      message:
        "We could not confirm your session. Refresh the page and try again.",
    };
  }
}

function statusFromInvokeError(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) return context.status;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export type SubscriptionInvokeResult<T> = {
  data: T | null;
  /** Human readable failure reason, null when the call succeeded. */
  message: string | null;
  /** True when the gateway rejected the access token (HTTP 401). */
  unauthorized: boolean;
};

/**
 * Invoke a subscription edge function with a guaranteed-fresh token and a
 * single automatic retry when the function or the gateway rejects the token.
 */
export async function invokeSubscriptionFunction<T extends { error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<SubscriptionInvokeResult<T>> {
  const session = await ensureSubscriptionSession();
  if (!session.ok) {
    return {
      data: null,
      message: session.message,
      unauthorized: session.reason === "unauthenticated",
    };
  }

  // Send the access token explicitly. `functions.invoke` normally attaches the
  // session token itself, but passing it here guarantees the exact token we
  // just validated is the one the edge function verifies.
  const call = (accessToken: string) =>
    supabase.functions.invoke<T>(functionName, {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  let { data, error } = await call(session.accessToken);

  if (error && statusFromInvokeError(error) === 401) {
    // The function rejected the token (expired or rotated by another tab):
    // force a refresh and retry exactly once.
    const retryToken = await forceRefreshAccessToken();
    if (retryToken) {
      ({ data, error } = await call(retryToken));
    }
  }

  if (!error) {
    const payloadError =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : null;
    return { data: data ?? null, message: payloadError, unauthorized: false };
  }

  const unauthorized = statusFromInvokeError(error) === 401;
  const raw = await getFunctionInvokeErrorMessage(error, fallbackMessage);
  // A 401 here is never "please sign in": the session was confirmed above, so
  // the important thing is to reassure the provider that nothing was charged.
  const message =
    unauthorized && /sign in|verified email|authentication required|session|jwt/i.test(raw)
      ? "We could not verify your JobBridge sign-in for this step. Refresh the page and try again — no payment has been taken."
      : raw;

  return { data: data ?? null, message, unauthorized };
}
