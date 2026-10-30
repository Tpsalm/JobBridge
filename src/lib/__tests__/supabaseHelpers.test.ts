import { describe, expect, it } from "vitest";
import { getFunctionInvokeErrorMessage } from "../supabaseHelpers";

describe("getFunctionInvokeErrorMessage", () => {
  it("uses the edge function's error response when available", async () => {
    const error = {
      context: new Response(JSON.stringify({ error: "Plan is unavailable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    };

    await expect(
      getFunctionInvokeErrorMessage(error, "Try again."),
    ).resolves.toBe("Plan is unavailable.");
  });

  it("reports the HTTP status when the edge function response has no error", async () => {
    const error = { context: new Response("Unexpected response", { status: 502 }) };

    await expect(
      getFunctionInvokeErrorMessage(error, "Try again."),
    ).resolves.toBe("The server rejected the request (HTTP 502). Try again.");
  });

  it("falls back to the error message when no response context exists", async () => {
    await expect(
      getFunctionInvokeErrorMessage(new Error("Network unavailable."), "Try again."),
    ).resolves.toBe("Network unavailable.");
  });

  it("uses the fallback when the error has no usable message", async () => {
    await expect(
      getFunctionInvokeErrorMessage(null, "Try again."),
    ).resolves.toBe("Try again.");
  });
});
