import { describe, it, expect } from "vitest";
import {
  koraTrialReference,
  getTrialBillingStartDate,
  SERVICE_PROVIDER_PLANS,
} from "../trial";

describe("service-provider subscription utilities", () => {
  it("generates unique KoraPay trial references", () => {
    const ref1 = koraTrialReference();
    const ref2 = koraTrialReference();
    expect(ref1).toMatch(/^JB-SVC-\d+-[a-z0-9]+$/);
    expect(ref2).toMatch(/^JB-SVC-\d+-[a-z0-9]+$/);
    expect(ref1).not.toBe(ref2);
  });

  it("defines all service-provider subscription tiers", () => {
    expect(SERVICE_PROVIDER_PLANS.service_monthly.price).toBe(1500);
    expect(SERVICE_PROVIDER_PLANS.service_verified.price).toBe(3000);
    expect(SERVICE_PROVIDER_PLANS.service_featured.price).toBe(5000);
  });

  it("calculates a future trial end date", () => {
    const { date, formatted } = getTrialBillingStartDate(30);
    expect(date.getTime()).toBeGreaterThan(Date.now());
    expect(formatted).toBeTruthy();
  });
});
