import { describe, expect, it } from "vitest";
import { normalizeHttpUrl } from "../security";

describe("normalizeHttpUrl", () => {
  it("adds HTTPS when a company enters a host without a scheme", () => {
    expect(normalizeHttpUrl(" careers.google.com/jobs ")).toBe(
      "https://careers.google.com/jobs",
    );
  });

  it("preserves valid HTTP and HTTPS application URLs", () => {
    expect(normalizeHttpUrl("https://example.com/apply")).toBe(
      "https://example.com/apply",
    );
    expect(normalizeHttpUrl("http://example.com/apply")).toBe(
      "http://example.com/apply",
    );
  });

  it("rejects unsafe schemes, user information, and malformed URLs", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("https://user:password@example.com")).toBeNull();
    expect(normalizeHttpUrl("https://")).toBeNull();
  });
});
