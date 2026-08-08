// =========================================================================
// JobBridge — client-side billing helpers
// Plan metadata mirroring the catalogue seeded in
// supabase/migrations/20260807_002_monetization_engine.sql
// =========================================================================

export type BillingProductLine = "job_post" | "service";

export interface PlanMeta {
  key: string;
  product_line: BillingProductLine;
  name: string;
  base_price_ngn: number;
  duration_days: number;
  is_recurring: boolean; // job_premium + all svc_* auto-renew
  is_launch_free: boolean;
  billing_cycle: "one_time" | "recurring";
}

// Map the legacy plan keys (used by Payment.tsx / profile.subscription_tier)
// to the canonical monetization catalogue keys.
export const LEGACY_TO_PLAN_KEY: Record<string, string> = {
  basic: "job_basic",
  standard: "job_standard",
  premium: "job_premium",
  service_monthly: "svc_basic",
  service_verified: "svc_verified",
  service_featured: "svc_featured",
  ai_monthly: "ai_monthly",
  ai_annual: "ai_annual",
  business_weekly: "job_basic",
  business_monthly: "job_standard",
  business_featured: "job_premium",
};

const PLANS: Record<string, PlanMeta> = {
  job_basic: {
    key: "job_basic",
    product_line: "job_post",
    name: "Basic Job Post",
    base_price_ngn: 2000,
    duration_days: 7,
    is_recurring: false,
    is_launch_free: true,
    billing_cycle: "one_time",
  },
  job_standard: {
    key: "job_standard",
    product_line: "job_post",
    name: "Standard Job Post",
    base_price_ngn: 3500,
    duration_days: 14,
    is_recurring: false,
    is_launch_free: true,
    billing_cycle: "one_time",
  },
  job_premium: {
    key: "job_premium",
    product_line: "job_post",
    name: "Premium Job Post",
    base_price_ngn: 5000,
    duration_days: 30,
    is_recurring: true,
    is_launch_free: true,
    billing_cycle: "recurring",
  },
  svc_basic: {
    key: "svc_basic",
    product_line: "service",
    name: "Basic Service Provider",
    base_price_ngn: 1500,
    duration_days: 30,
    is_recurring: true,
    is_launch_free: true,
    billing_cycle: "recurring",
  },
  svc_verified: {
    key: "svc_verified",
    product_line: "service",
    name: "Verified Service Provider",
    base_price_ngn: 3000,
    duration_days: 30,
    is_recurring: true,
    is_launch_free: true,
    billing_cycle: "recurring",
  },
  svc_featured: {
    key: "svc_featured",
    product_line: "service",
    name: "Featured Professional",
    base_price_ngn: 5000,
    duration_days: 30,
    is_recurring: true,
    is_launch_free: true,
    billing_cycle: "recurring",
  },
};

export function getPlan(key: string | null | undefined): PlanMeta | null {
  if (!key) return null;
  return PLANS[key] || null;
}

export function planKeyForLegacy(legacy: string | null | undefined): string | null {
  if (!legacy) return null;
  return LEGACY_TO_PLAN_KEY[legacy] || null;
}

/** Resolve the auto-expiry/grace behaviour for a job post based on its plan. */
export function resolveJobPost(
  legacyPlanKey: string | null | undefined,
  now = new Date(),
): {
  post_plan?: string;
  billing_mode: "one_time" | "recurring";
  post_expires_at: string;
  grace_ends_at?: string;
} {
  const canonical = planKeyForLegacy(legacyPlanKey || "basic");
  const plan = getPlan(canonical);
  const isRecurring = plan?.is_recurring ?? false;
  const days = plan?.duration_days ?? 7;

  const postExpiresAt = new Date(now.getTime() + days * 86400000).toISOString();
  const result: {
    post_plan?: string;
    billing_mode: "one_time" | "recurring";
    post_expires_at: string;
    grace_ends_at?: string;
  } = {
    post_plan: canonical || "job_basic",
    billing_mode: isRecurring ? "recurring" : "one_time",
    post_expires_at: postExpiresAt,
  };
  // Premium posts get a 3-day grace before hidden, matching cron behaviour.
  if (isRecurring) {
    result.grace_ends_at = new Date(now.getTime() + (days + 3) * 86400000).toISOString();
  }
  return result;
}