-- =========================================================================
-- JobBridge — Monetization Engine (Phase 1)
--
-- WHY:
--   Adds the recurring-subscription + pay-per-post billing core described in
--   the monetization design. Two product lines:
--     Product A (job_post):  pay-per-post lifecycle.
--                            job_basic   = NGN 2,000 / 7d  (one_time)
--                            job_standard= NGN 3,500 / 14d (one_time)
--                            job_premium = NGN 5,000 / 30d (recurring auto-renew)
--     Product B (service):   monthly provider tiers.
--            svc_basic / svc_verified / svc_featured = NGN 1,500/3,000/5,000 / 30d
--
--   Phase 1 launch: every tier row has is_launch_free = true so a single
--   is_launch_free flag (server-side, per-plan) forces price to 0 while
--   keeping the expiry/limits intact. A `promo_codes` table provides a
--   secondary override for later campaigns.
--
--   This is ADDITIVE. Existing `payments`/`jobs`/`profiles` flows keep working;
--   the subscription engine is layered on top via new tables + columns.
--
-- Run in the Supabase SQL Editor (or via supabase db push).
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Plans catalogue (source of truth for price, cycle, limits)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_line  TEXT NOT NULL CHECK (product_line IN ('job_post','service')),
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  base_price_ngn INTEGER NOT NULL CHECK (base_price_ngn >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'one_time'
    CHECK (billing_cycle IN ('one_time','recurring')),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  is_recurring  BOOLEAN NOT NULL DEFAULT false,
  is_launch_free BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  product_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.plans
  (key, product_line, name, base_price_ngn, billing_cycle, duration_days, is_recurring, is_launch_free, product_config)
VALUES
  ('job_basic',    'job_post', 'Basic Job Post',    2000, 'one_time',  7,  false, true,
     '{"visibility_days":7,"post_allowance":1,"expire_behavior":"soft_hide_immediate"}'::jsonb),
  ('job_standard', 'job_post', 'Standard Job Post', 3500, 'one_time',  14, false, true,
   '{"visibility_days":14,"post_allowance":1,"expire_behavior":"soft_hide_immediate"}'::jsonb),
  ('job_premium',  'job_post', 'Premium Job Post',  5000, 'recurring',  30, true,  true,
   '{"visibility_days":30,"post_allowance":1,"expire_behavior":"soft_hide_grace","grace_days":3}'::jsonb),
  ('svc_basic',    'service',  'Basic Service Provider',    1500, 'recurring', 30, true, true,
   '{"visibility_days":30,"verified":false,"featured":false,"grace_days":3}'::jsonb),
  ('svc_verified', 'service', 'Verified Service Provider',  3000, 'recurring', 30, true, true,
   '{"visibility_days":30,"verified":true,"featured":false,"grace_days":3}'::jsonb),
  ('svc_featured', 'service', 'Featured Professional',      5000, 'recurring', 30, true, true,
   '{"visibility_days":30,"verified":true,"featured":true,"grace_days":3}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Promo codes (secondary override; Phase 1 free launch is via plans flag)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  applies_to_plan_key TEXT,
  max_uses INTEGER DEFAULT NULL,
  uses_consumed INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Subscriptions (recurring billing source of truth)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL REFERENCES public.plans(key),
  product_line TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','trialing','past_due','canceled','expired','paused')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  -- Paystack tokenized customer/recurring source for NGN auto-debits.
  paystack_token_key TEXT,
  kora_card_token_key TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  -- launch-free cycle marker: do not charge while true; roll over live at next cycle.
  launch_free_period BOOLEAN NOT NULL DEFAULT false,
  leftover_price_ngn INTEGER NOT NULL DEFAULT 0,
  grace_ends_at TIMESTAMPTZ,
  failed_retries INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_attempt_ref TEXT,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period_end
  ON public.subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON public.subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) payments: recurring-billing columns (idempotency-safe)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_phase TEXT
    CHECK (billing_phase IN ('initial','renewal','retry','manual')),
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_payments_subscription
  ON public.payments(subscription_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5) jobs: per-post billing / expiry enforcement
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS post_plan TEXT REFERENCES public.plans(key),
  ADD COLUMN IF NOT EXISTS post_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT
    CHECK (billing_mode IN ('one_time','recurring')),
  ADD COLUMN IF NOT EXISTS post_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) profiles: provider visibility gate (kept denormalized for feeds)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_subscription_id UUID,
  ADD COLUMN IF NOT EXISTS visibility_until TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────
-- 7) Helper: is_admin (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8) RLS
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans: public read (pricing page), admin manage.
DROP POLICY IF EXISTS "Public can read active plans" ON public.plans;
CREATE POLICY "Public can read active plans" ON public.plans FOR SELECT
  USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Promo codes: admins only.
DROP POLICY IF EXISTS "Admins manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Subscriptions: owner read/write-own (cancel/update), admin full.
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can cancel own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can cancel own subscriptions" ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 9) Job-post expiry RPC (idempotent; mirrors advertisements_auto_expire)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_job_posts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  -- One-time posts (basic/standard): soft-hide the exact moment it expires.
  UPDATE public.jobs
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND billing_mode = 'one_time'
    AND post_expires_at IS NOT NULL
    AND post_expires_at <= NOW();

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_job_posts() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_job_posts() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10) Grace-period visibility RPC (premium job + service tiers)
--     Hides after grace_ends_at passes (default 3 days) or on hard cancel.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_billing_visibility()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER := 0;
  _tmp INTEGER := 0;
BEGIN
  -- Jobs with recurring billing that are past grace → hide.
  UPDATE public.jobs
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND billing_mode = 'recurring'
    AND grace_ends_at IS NOT NULL
    AND grace_ends_at <= NOW();

  GET DIAGNOSTICS _tmp = ROW_COUNT;
  _count := _count + _tmp;

  -- Provider subscriptions: after grace, set visibility until 0 (hide from feeds).
  UPDATE public.profiles
  SET visibility_until = NULL, updated_at = NOW()
  WHERE visibility_until IS NOT NULL
    AND visibility_until <= NOW()
    AND (
      service_subscription_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.id = service_subscription_id
          AND s.status IN ('canceled','expired','past_due')
          AND s.grace_ends_at IS NOT NULL
          AND s.grace_ends_at <= NOW()
      )
    );

  GET DIAGNOSTICS _tmp = ROW_COUNT;
  _count := _count + _tmp;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 11) Friendly GET for the billing worker: subscriptions due for renewal.
--     Returns only subscriptions eligible for a charge right now:
--       - active + auto_renew where period ended, OR
--       - past_due where next_attempt_at has passed.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_due_subscriptions()
RETURNS TABLE (
  id UUID, user_id UUID, plan_key TEXT, product_line TEXT, status TEXT,
  current_period_end TIMESTAMPTZ, paystack_token_key TEXT, kora_card_token_key TEXT,
  auto_renew BOOLEAN, launch_free_period BOOLEAN, failed_retries INTEGER,
  next_attempt_at TIMESTAMPTZ, grace_ends_at TIMESTAMPTZ, base_price_ngn INTEGER,
  currency TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id, s.user_id, s.plan_key, s.product_line, s.status,
    s.current_period_end, s.paystack_token_key, s.kora_card_token_key,
    s.auto_renew, s.launch_free_period, s.failed_retries, s.next_attempt_at,
    s.grace_ends_at, p.base_price_ngn, 'NGN'::TEXT AS currency
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE (
        (s.status = 'active' AND s.auto_renew = true AND s.current_period_end <= NOW())
     OR (s.status = 'past_due' AND s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.list_due_subscriptions() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 12) Immediate sweeps (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
SELECT public.expire_job_posts();
SELECT public.enforce_billing_visibility();