import { describe, it, expect, beforeEach } from "vitest";
import {
  detectCardBrand,
  formatCardNumber,
  formatCardExpiry,
  formatCardCvv,
  validateCardDetails,
  generateSecureCardToken,
  savePendingTrial,
  takePendingTrial,
  koraTrialReference,
} from "../trial";

// Simple in-memory sessionStorage mock for node test environment
const mockStorage: Record<string, string> = {};
const storageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
};

Object.defineProperty(globalThis, "sessionStorage", {
  value: storageMock,
  writable: true,
});

describe("trial utilities and card processing", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("detectCardBrand", () => {
    it("detects Visa cards", () => {
      expect(detectCardBrand("4123456789012345")).toBe("visa");
      expect(detectCardBrand("4000 1234")).toBe("visa");
    });

    it("detects Mastercard cards", () => {
      expect(detectCardBrand("5123456789012345")).toBe("mastercard");
      expect(detectCardBrand("5523 4567")).toBe("mastercard");
      expect(detectCardBrand("2221 0000")).toBe("mastercard");
      expect(detectCardBrand("2720 9999")).toBe("mastercard");
    });

    it("detects Verve cards", () => {
      expect(detectCardBrand("5061234567890123")).toBe("verve");
      expect(detectCardBrand("6500123456789012")).toBe("verve");
      expect(detectCardBrand("5078123456789012")).toBe("verve");
    });

    it("returns generic for unknown card prefixes", () => {
      expect(detectCardBrand("3000123456789012")).toBe("generic");
      expect(detectCardBrand("")).toBe("generic");
    });
  });

  describe("formatters", () => {
    it("formats card numbers with 4-digit grouping", () => {
      expect(formatCardNumber("1234567812345678")).toBe("1234 5678 1234 5678");
      expect(formatCardNumber("1234abc5678")).toBe("1234 5678");
    });

    it("formats expiry date with MM/YY slash", () => {
      expect(formatCardExpiry("1228")).toBe("12/28");
      expect(formatCardExpiry("05")).toBe("05");
      expect(formatCardExpiry("122028")).toBe("12/20");
    });

    it("formats CVV to numbers up to 4 digits", () => {
      expect(formatCardCvv("123a")).toBe("123");
      expect(formatCardCvv("12345")).toBe("1234");
    });
  });

  describe("validateCardDetails", () => {
    it("fails on empty or invalid card length", () => {
      const result = validateCardDetails({
        cardNumber: "",
        expiry: "",
        cvv: "",
        cardHolder: "",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("cardNumber");
      expect(result.error).toContain("16 to 19-digit");
    });

    it("fails on invalid expiry formatting", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "1234",
        cvv: "123",
        cardHolder: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("expiry");
    });

    it("fails on invalid month", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "13/28",
        cvv: "123",
        cardHolder: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("expiry");
      expect(result.error).toContain("01 and 12");
    });

    it("fails on expired card", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "01/20",
        cvv: "123",
        cardHolder: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("expiry");
      expect(result.error).toContain("expired");
    });

    it("fails on invalid CVV", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "12/32",
        cvv: "1",
        cardHolder: "John Doe",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("cvv");
    });

    it("fails on missing cardholder name", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "12/32",
        cvv: "123",
        cardHolder: " ",
      });
      expect(result.valid).toBe(false);
      expect(result.field).toBe("cardHolder");
    });

    it("validates valid card details", () => {
      const result = validateCardDetails({
        cardNumber: "4111 2222 3333 4444",
        expiry: "12/32",
        cvv: "123",
        cardHolder: "Jane Doe",
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("generateSecureCardToken", () => {
    it("generates a card token with brand and last4", () => {
      const token = generateSecureCardToken({
        cardNumber: "5399 1234 5678 9012",
        expiry: "11/30",
        cvv: "999",
        cardHolder: "Samuel Tobi",
      });

      expect(token).toMatch(/^kora_tok_mastercard_9012_1130_\d+_[a-z0-9]+$/);
    });
  });

  describe("pending trial storage", () => {
    it("saves and retrieves pending trial token matching email", () => {
      savePendingTrial("tok_sample_123", "User@Example.com");
      const retrieved = takePendingTrial("user@example.com");
      expect(retrieved).toBe("tok_sample_123");

      // Should be cleared after taking
      const secondTake = takePendingTrial("user@example.com");
      expect(secondTake).toBeNull();
    });

    it("returns null when email does not match", () => {
      savePendingTrial("tok_sample_123", "user1@example.com");
      const retrieved = takePendingTrial("user2@example.com");
      expect(retrieved).toBeNull();
    });
  });

  describe("koraTrialReference", () => {
    it("generates unique reference with JB-SVC prefix", () => {
      const ref1 = koraTrialReference();
      const ref2 = koraTrialReference();
      expect(ref1).toMatch(/^JB-SVC-\d+-[a-z0-9]+$/);
      expect(ref2).toMatch(/^JB-SVC-\d+-[a-z0-9]+$/);
      expect(ref1).not.toBe(ref2);
    });
  });
});
