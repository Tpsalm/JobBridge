/**
 * Normalize Supabase Auth errors into user-friendly messages.
 *
 * This is a pure function extracted from AuthContext so it can be unit-tested
 * independently. Both signUp and signIn in AuthContext delegate to this.
 *
 * @param error - The raw error object thrown/caught from supabase-js Auth methods.
 * @param context - 'signup' or 'signin' — slightly different wording per flow.
 * @returns A user-friendly error message string.
 */
export function normalizeAuthError(
  error: any,
  context: "signup" | "signin" = "signup",
): string {
  if (!error) {
    return context === "signup"
      ? "Signup failed. Please try again."
      : "Sign in failed. Please check your credentials and try again.";
  }

  const errName: string = error?.name || "";
  const errMessage: string = error?.message ?? "";
  const errStatus = error?.status;
  const errCode = error?.code;
  const strMessage = typeof errMessage === "string" ? errMessage : "";
  const verb = context === "signup" ? "sign up" : "sign in";
  const verbCapitalized =
    context === "signup" ? "Signup" : "Sign in";

  let fullMsg = "";

  // ── Handle by error type (class name) ──

  // AuthRetryableFetchError: network failure, DNS, timeout, CORS
  if (errName === "AuthRetryableFetchError") {
    if (errStatus === 0 || errStatus === undefined) {
      fullMsg =
        "Unable to reach the authentication service. Please check your internet connection and try again.";
    } else if (errStatus === 429) {
      fullMsg = `Too many ${verb} attempts. Please wait a few minutes and try again.`;
    } else {
      fullMsg =
        "Authentication service temporarily unavailable. Please try again later.";
    }
    return fullMsg;
  }

  // AuthWeakPasswordError: password didn't meet requirements
  if (errName === "AuthWeakPasswordError") {
    if (context === "signup") {
      const reasons = error?.reasons;
      if (Array.isArray(reasons) && reasons.length > 0) {
        return "Password is too weak: " + reasons.join(", ") + ".";
      }
      if (strMessage.trim()) return strMessage.trim();
    }
    return "Password does not meet the minimum requirements. Please choose a stronger password.";
  }

  // AuthInvalidCredentialsError: wrong email or password format
  if (errName === "AuthInvalidCredentialsError") {
    return strMessage.trim() || "Invalid email or password format.";
  }

  // AuthSessionMissingError: no session found
  if (errName === "AuthSessionMissingError") {
    return "Your session has expired. Please sign in again.";
  }

  // AuthInvalidJwtError: JWT token is invalid
  if (errName === "AuthInvalidJwtError") {
    return "Authentication token is invalid. Please sign in again.";
  }

  // AuthInvalidTokenResponseError: invalid token response from server
  if (errName === "AuthInvalidTokenResponseError") {
    return "Invalid response from authentication server. Please try again.";
  }

  // AuthImplicitGrantRedirectError / AuthPKCEGrantCodeExchangeError (OAuth/PKCE)
  if (
    errName === "AuthImplicitGrantRedirectError" ||
    errName === "AuthPKCEGrantCodeExchangeError"
  ) {
    return `Authentication flow error. Please try ${verb} again.`;
  }

  // AuthUnknownError: unexpected errors
  if (errName === "AuthUnknownError") {
    return "An unexpected authentication error occurred. Please try again.";
  }

  // AuthApiError or other auth errors from Supabase API
  if (errName === "AuthApiError" || error?.__isAuthError) {
    if (strMessage.trim()) {
      fullMsg = strMessage.trim();
    } else if (errStatus) {
      fullMsg = `${verbCapitalized} failed (status ${errStatus}). Please try again.`;
    }
  }

  // ── Fallback: try common error shapes ──
  if (!fullMsg) {
    if (strMessage.trim()) {
      fullMsg = strMessage.trim();
    } else if (error?.error_description) {
      fullMsg = String(error.error_description);
    } else if (error?.msg) {
      fullMsg = String(error.msg);
    } else if (errStatus !== undefined && errStatus !== null) {
      fullMsg = `${verbCapitalized} failed (status ${errStatus}). Please try again.`;
    } else if (typeof error === "object" && error !== null) {
      try {
        const serialized = JSON.stringify(error);
        if (serialized && serialized !== "{}") {
          fullMsg = serialized;
        }
      } catch {
        /* fall through */
      }
    }
  }

  // ── Last resort: never show empty/raw object ──
  if (!fullMsg || fullMsg === "{}" || fullMsg === "[object Object]") {
    fullMsg =
      context === "signup"
        ? "Signup failed. Please try again or use a different email."
        : "Sign in failed. Please check your credentials and try again.";
  }

  // ── Human-friendly message overrides (keyword-based) ──
  const lowerMsg = fullMsg.toLowerCase();

  if (context === "signup") {
    if (
      lowerMsg.includes("user already registered") ||
      lowerMsg.includes("already been registered")
    ) {
      fullMsg = "An account with this email already exists. Please sign in instead.";
    } else if (lowerMsg.includes("invalid email")) {
      fullMsg = "Please enter a valid email address.";
    } else if (
      lowerMsg.includes("password should be at least") ||
      lowerMsg.includes("password is too weak") ||
      lowerMsg.includes("weak password")
    ) {
      fullMsg =
        "Password must be at least 6 characters long and meet the requirements.";
    } else if (
      lowerMsg.includes("signup is disabled") ||
      lowerMsg.includes("signups not allowed")
    ) {
      fullMsg =
        "New account registration is temporarily disabled. Please contact support.";
    }
  }

  if (context === "signin") {
    if (
      lowerMsg.includes("invalid login credentials") ||
      lowerMsg.includes("invalid email or password")
    ) {
      fullMsg = "Invalid email or password. Please check and try again.";
    } else if (
      lowerMsg.includes("email not confirmed") ||
      lowerMsg.includes("email_not_confirmed")
    ) {
      fullMsg =
        "Your email address hasn't been confirmed yet. Please check your inbox (and spam folder) for the confirmation link, then try signing in again.";
    } else if (
      lowerMsg.includes("user not found") ||
      lowerMsg.includes("no user found")
    ) {
      fullMsg =
        "No account found with this email address. Please check the email or sign up.";
    } else if (
      lowerMsg.includes("otp expired") ||
      lowerMsg.includes("otp_expired") ||
      lowerMsg.includes("token expired") ||
      lowerMsg.includes("token_expired")
    ) {
      fullMsg =
        "Your confirmation link has expired. Please request a new one by signing up again or using the resend option.";
    } else if (
      lowerMsg.includes("invalid_grant") ||
      lowerMsg.includes("invalid grant")
    ) {
      fullMsg =
        "Your session has expired or the link is no longer valid. Please sign in again.";
    }
  }

  // Shared keyword overrides
  if (
    lowerMsg.includes("email rate limit") ||
    lowerMsg.includes("too many requests")
  ) {
    fullMsg = `Too many ${verb} attempts. Please wait a few minutes and try again.`;
  } else if (
    lowerMsg.includes("network") ||
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("connection") ||
    lowerMsg.includes("unreachable")
  ) {
    fullMsg =
      "Unable to connect to the authentication service. Please check your internet connection and try again.";
  }

  // ── Error code-based overrides ──
  if (errCode && typeof errCode === "string") {
    const sharedCodeMap: Record<string, string> = {
      over_email_send_rate_limit:
        "Too many email verification attempts. Please wait a few minutes.",
      over_request_rate_limit:
        "Too many attempts. Please wait a few minutes and try again.",
    };

    const signupCodeMap: Record<string, string> = {
      email_exists:
        "An account with this email already exists. Please sign in instead.",
      user_already_exists:
        "An account with this email already exists. Please sign in instead.",
      signups_disabled:
        "New account registration is temporarily disabled. Please contact support.",
      validation_error: "Please check your input and try again.",
      invalid_credentials: "Invalid email or password format.",
      bad_json:
        "There was a problem with the signup request. Please try again.",
    };

    const signinCodeMap: Record<string, string> = {
      user_not_found:
        "No account found with this email address. Please check the email or sign up.",
      invalid_credentials:
        "Invalid email or password. Please check and try again.",
      invalid_grant:
        "Your session has expired or the link is no longer valid. Please sign in again.",
      otp_expired:
        "Your confirmation link has expired. Please sign up again or use the resend option.",
      token_expired:
        "Your confirmation link has expired. Please sign up again or use the resend option.",
      email_not_confirmed:
        "Your email address hasn't been confirmed yet. Please check your inbox for the confirmation link.",
    };

    const codeKey = errCode.toLowerCase();
    const codeMap =
      context === "signup"
        ? { ...sharedCodeMap, ...signupCodeMap }
        : { ...sharedCodeMap, ...signinCodeMap };

    if (codeMap[codeKey]) {
      fullMsg = codeMap[codeKey];
    }
  }

  return fullMsg;
}
