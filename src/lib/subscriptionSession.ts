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
//
// These helpers make the token fresh before every privileged call, retry once
// on a 401, and translate gateway errors into copy a provider can act on.
// =========================================================================

import { supabase } from "./supabase";
import { getFunctionInvokeErrorMessage } from "./supabaseHelpers";

/** Refresh the access token when it is this close to expiring. */
const REFRESH_THRESHOLD_SECONDS = 120;

export type SubscriptionSessionCheck =
  | { ok: true; userId: string; email: string }
  | {
      ok: false;
      reason: "unauthenticated" | "missing-email" | "error";
      message: string;
    };

export const SIGN_IN_REQUIRED_MESSAGE =
  "Please sign in to continue with your subscription.";

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
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        session = refreshed.session;
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

    return { ok: true, userId: session.user.id, email: session.user.email };
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
 * single automatic retry when the gateway answers 401.
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

  const call = () =>
    supabase.functions.invoke<T>(functionName, { body });

  let { data, error } = await call();

  if (error && statusFromInvokeError(error) === 401) {
    // Token raced out of date between the check and the call: refresh + retry.
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) {
      ({ data, error } = await call());
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
  const message = await getFunctionInvokeErrorMessage(error, fallbackMessage);
  const friendly =
    unauthorized && /sign in|verified email|authentication required/i.test(message)
      ? `${SIGN_IN_REQUIRED_MESSAGE} Your sign-in session expired — sign in again to finish setting up your card.`
      : message;

  return { data: data ?? null, message: friendly, unauthorized };
}
