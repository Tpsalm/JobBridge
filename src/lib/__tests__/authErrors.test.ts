import { describe, it, expect } from "vitest";
import { normalizeAuthError } from "../authErrors";

// ─── Shared helper for error objects ─────────────────────────────────────
function makeError(overrides: Record<string, any> = {}) {
  return {
    name: "",
    message: "",
    status: undefined,
    code: undefined,
    ...overrides,
  };
}

// ─── Signup Context Tests ────────────────────────────────────────────────
describe("normalizeAuthError (signup context)", () => {
  it("returns fallback when error is null/undefined", () => {
    expect(normalizeAuthError(null, "signup")).toBe(
      "Signup failed. Please try again.",
    );
    expect(normalizeAuthError(undefined, "signup")).toBe(
      "Signup failed. Please try again.",
    );
  });

  it("handles AuthRetryableFetchError with status 0 (network down)", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      message: "",
      status: 0,
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Unable to reach the authentication service. Please check your internet connection and try again.",
    );
  });

  it("handles AuthRetryableFetchError with status 429 (rate limited)", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      message: "",
      status: 429,
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Too many sign up attempts. Please wait a few minutes and try again.",
    );
  });

  it("handles AuthRetryableFetchError with other status (generic)", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      message: "",
      status: 503,
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Authentication service temporarily unavailable. Please try again later.",
    );
  });

  it("handles AuthRetryableFetchError with no status", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      message: "",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Unable to reach the authentication service. Please check your internet connection and try again.",
    );
  });

  it("handles AuthWeakPasswordError with reasons array", () => {
    const err = makeError({
      name: "AuthWeakPasswordError",
      message: "Password should be at least 6 characters",
      reasons: ["too short", "no numbers"],
    });
    const msg = normalizeAuthError(err, "signup");
    expect(msg).toBe("Password is too weak: too short, no numbers.");
  });

  it("handles AuthWeakPasswordError with message but no reasons", () => {
    const err = makeError({
      name: "AuthWeakPasswordError",
      message: "Password should be at least 6 characters",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Password should be at least 6 characters",
    );
  });

  it("handles AuthWeakPasswordError with no message or reasons", () => {
    const err = makeError({ name: "AuthWeakPasswordError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Password does not meet the minimum requirements. Please choose a stronger password.",
    );
  });

  it("handles AuthInvalidCredentialsError", () => {
    const err = makeError({
      name: "AuthInvalidCredentialsError",
      message: "Invalid email or password",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Invalid email or password",
    );
  });

  it("handles AuthSessionMissingError", () => {
    const err = makeError({ name: "AuthSessionMissingError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("handles AuthInvalidJwtError", () => {
    const err = makeError({ name: "AuthInvalidJwtError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Authentication token is invalid. Please sign in again.",
    );
  });

  it("handles AuthInvalidTokenResponseError", () => {
    const err = makeError({ name: "AuthInvalidTokenResponseError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Invalid response from authentication server. Please try again.",
    );
  });

  it("handles AuthImplicitGrantRedirectError", () => {
    const err = makeError({ name: "AuthImplicitGrantRedirectError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Authentication flow error. Please try sign up again.",
    );
  });

  it("handles AuthPKCEGrantCodeExchangeError", () => {
    const err = makeError({ name: "AuthPKCEGrantCodeExchangeError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Authentication flow error. Please try sign up again.",
    );
  });

  it("handles AuthUnknownError", () => {
    const err = makeError({ name: "AuthUnknownError" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "An unexpected authentication error occurred. Please try again.",
    );
  });

  it("handles AuthApiError with message", () => {
    const err = makeError({
      name: "AuthApiError",
      message: "User already registered",
    });
    // Should go through keyword override
    const msg = normalizeAuthError(err, "signup");
    expect(msg).toBe(
      "An account with this email already exists. Please sign in instead.",
    );
  });

  it("handles AuthApiError with just status", () => {
    const err = makeError({ name: "AuthApiError", message: "", status: 400 });
    const msg = normalizeAuthError(err, "signup");
    expect(msg).toContain("Signup failed (status 400)");
  });

  it("falls back to error_description when message is empty", () => {
    const err = makeError({
      message: "",
      error_description: "Something went wrong in OAuth",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Something went wrong in OAuth",
    );
  });

  it("falls back to msg property", () => {
    const err = makeError({ message: "", msg: "Custom message" });
    expect(normalizeAuthError(err, "signup")).toBe("Custom message");
  });

  it("falls back to serialized object", () => {
    const err = { foo: "bar", baz: 123 };
    expect(normalizeAuthError(err, "signup")).toBe('{"foo":"bar","baz":123}');
  });

  it("returns last resort for empty object", () => {
    expect(normalizeAuthError({}, "signup")).toBe(
      "Signup failed. Please try again or use a different email.",
    );
  });

  // ── Keyword overrides ──
  it('overrides "user already registered"', () => {
    const err = makeError({
      name: "AuthApiError",
      message: "User already registered",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "An account with this email already exists. Please sign in instead.",
    );
  });

  it('overrides "already been registered"', () => {
    const err = makeError({
      name: "AuthApiError",
      message: "An account with this email already been registered",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "An account with this email already exists. Please sign in instead.",
    );
  });

  it('overrides "invalid email"', () => {
    const err = makeError({
      name: "AuthApiError",
      message: "Invalid email",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Please enter a valid email address.",
    );
  });

  it('overrides "password should be at least"', () => {
    const err = makeError({
      message: "Password should be at least 6 characters",
    });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Password must be at least 6 characters long and meet the requirements.",
    );
  });

  it('overrides "signup is disabled"', () => {
    const err = makeError({ message: "Signup is disabled temporarily" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "New account registration is temporarily disabled. Please contact support.",
    );
  });

  it('overrides "email rate limit"', () => {
    const err = makeError({ message: "Email rate limit exceeded" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Too many sign up attempts. Please wait a few minutes and try again.",
    );
  });

  it('overrides "too many requests"', () => {
    const err = makeError({ message: "Too many requests" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Too many sign up attempts. Please wait a few minutes and try again.",
    );
  });

  it('overrides network-related keywords', () => {
    const err = makeError({ message: "Network error: fetch failed" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Unable to connect to the authentication service. Please check your internet connection and try again.",
    );
  });

  // ── Error code overrides ──
  it("maps error code email_exists", () => {
    const err = makeError({ code: "email_exists" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "An account with this email already exists. Please sign in instead.",
    );
  });

  it("maps error code user_already_exists", () => {
    const err = makeError({ code: "user_already_exists" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "An account with this email already exists. Please sign in instead.",
    );
  });

  it("maps error code over_email_send_rate_limit", () => {
    const err = makeError({ code: "over_email_send_rate_limit" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Too many email verification attempts. Please wait a few minutes.",
    );
  });

  it("maps error code over_request_rate_limit", () => {
    const err = makeError({ code: "over_request_rate_limit" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Too many attempts. Please wait a few minutes and try again.",
    );
  });

  it("maps error code signups_disabled", () => {
    const err = makeError({ code: "signups_disabled" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "New account registration is temporarily disabled. Please contact support.",
    );
  });

  it("maps error code validation_error", () => {
    const err = makeError({ code: "validation_error" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Please check your input and try again.",
    );
  });

  it("maps error code invalid_credentials", () => {
    const err = makeError({ code: "invalid_credentials" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "Invalid email or password format.",
    );
  });

  it("maps error code bad_json", () => {
    const err = makeError({ code: "bad_json" });
    expect(normalizeAuthError(err, "signup")).toBe(
      "There was a problem with the signup request. Please try again.",
    );
  });
});

// ─── Signin Context Tests ────────────────────────────────────────────────
describe("normalizeAuthError (signin context)", () => {
  it("handles AuthRetryableFetchError with signin wording", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      status: 0,
    });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Unable to reach the authentication service. Please check your internet connection and try again.",
    );
  });

  it("handles AuthRetryableFetchError 429 with signin wording", () => {
    const err = makeError({
      name: "AuthRetryableFetchError",
      status: 429,
    });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Too many sign in attempts. Please wait a few minutes and try again.",
    );
  });

  it("handles AuthInvalidCredentialsError for signin", () => {
    const err = makeError({
      name: "AuthInvalidCredentialsError",
      message: "Invalid login credentials",
    });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Invalid login credentials",
    );
  });

  it("handles AuthUnknownError for signin", () => {
    const err = makeError({ name: "AuthUnknownError" });
    expect(normalizeAuthError(err, "signin")).toBe(
      "An unexpected authentication error occurred. Please try again.",
    );
  });

  it('overrides "invalid login credentials" for signin', () => {
    const err = makeError({
      message: "Invalid login credentials",
    });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Invalid email or password. Please check and try again.",
    );
  });

  it('overrides "invalid email or password" for signin', () => {
    const err = makeError({
      message: "Invalid email or password",
    });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Invalid email or password. Please check and try again.",
    );
  });

  it('overrides "email not confirmed" for signin', () => {
    const err = makeError({ message: "Email not confirmed" });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Please confirm your email first. Check your inbox (and spam folder) for the confirmation link, then try signing in.",
    );
  });

  it('overrides "email_not_confirmed" for signin', () => {
    const err = makeError({
      name: "AuthApiError",
      code: "email_not_confirmed",
    });
    const msg = normalizeAuthError(err, "signin");
    expect(msg).toContain("Please confirm your email first");
  });

  it('overrides "too many requests" for signin', () => {
    const err = makeError({ message: "Too many requests" });
    expect(normalizeAuthError(err, "signin")).toBe(
      "Too many sign in attempts. Please wait a few minutes and try again.",
    );
  });

  it("returns last resort for empty object in signin", () => {
    expect(normalizeAuthError({}, "signin")).toBe(
      "Sign in failed. Please check your credentials and try again.",
    );
  });

  it("returns fallback for null in signin", () => {
    expect(normalizeAuthError(null, "signin")).toBe(
      "Sign in failed. Please check your credentials and try again.",
    );
  });

  it("uses __isAuthError flag for identification", () => {
    const err = makeError({
      __isAuthError: true,
      message: "Some auth error",
    });
    expect(normalizeAuthError(err, "signin")).toBe("Some auth error");
  });
});

// ─── Signup context error code not used for signin ───────────────────────
describe("normalizeAuthError — code map only applies to signup", () => {
  it("does NOT apply code map for signin context", () => {
    const err = makeError({ code: "email_exists" });
    // For signin, there's no code map, so it falls through to last resort
    const msg = normalizeAuthError(err, "signin");
    // Should not contain the email_exists code map message
    expect(msg).not.toContain("already exists");
  });
});
