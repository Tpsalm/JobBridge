-- =========================================================================
-- JobBridge — Harden billing visibility & fix hardcore monetization gaps
--
-- Fixes (audited 2026-08-08):
--   1) `service_providers.is_active` was referenced by api/get-providers.ts
--      and supabase/functions/billing-daily/index.ts but NEVER created by any
--      migration (20260727_001_service_providers_add_is_active.sql shipped
--      empty). `profiles.is_active` was also referenced by get-providers but
--      missing. Both columns are added idempotently + backfilled.
--   2) `enforce_billing_visibility()` only cleared `profiles.visibility_until`
--      and never flipped `service_providers.is_active`/`profiles.is_active`,
--      so lapsed providers stayed listed in the marketplace (revenue leak).
--      It now hides listings the moment their visibility window closes.
--   3) Jobs RLS only gated on `is_active = true`, so expired / unpaid posts
--      stayed public until the next cron run. Policies now enforce
--      post_paid + post_expires_at + grace_ends_at at QUERY time. Legacy
--      rows (post_plan IS NULL) remain visible so the live feed is not nuked.
--   4) `list_due_subscriptions()` now returns `duration_days` + `grace_days`
--      from the plans catalogue so the billing worker honours the plan as the
--      single source of truth instead of hardcoding 30 / 3.
--
-- ADDITIVE + IDEMPOTENT: safe to run in the Supabase SQL editor or `db push`.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Add missing active flags (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill service_providers.is_active so lapsed providers start hidden.
UPDATE public.service_providers sp
SET is_active = false, updated_at = NOW()
FROM public.profiles p
WHERE sp.profile_id = p.id
  AND p.visibility_until IS NOT NULL
  AND p.visibility_until <= NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Harden enforce_billing_visibility() — hide the moment visibility lapses
--    (jobs past grace, provider profiles past visibility window, and their
--    dedicated service_providers rows).
-- ─────────────────────────────────────────────────────────────────────────
-- DROP first for full idempotency across re-runs (avoids "cannot change
-- return type of existing function" if the old signature ever differs).
DROP FUNCTION IF EXISTS public.enforce_billing_visibility();
CREATE OR REPLACE FUNCTION public.enforce_billing_visibility()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER := 0;
  _tmp INTEGER := 0;
BEGIN
  -- Recurring-billing jobs that passed their grace window → hide.
  UPDATE public.jobs
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND billing_mode = 'recurring'
    AND grace_ends_at IS NOT NULL
    AND grace_ends_at <= NOW();
  GET DIAGNOSTICS _tmp = ROW_COUNT;
  _count := _count + _tmp;

  -- Provider profiles whose visibility window closed → clear the feed gate
  -- and deactivate (defense-in-depth for both get-providers paths).
  UPDATE public.profiles
  SET visibility_until = NULL,
      is_active = false,
      updated_at = NOW()
  WHERE visibility_until IS NOT NULL
    AND visibility_until <= NOW();
  GET DIAGNOSTICS _tmp = ROW_COUNT;
  _count := _count + _tmp;

  -- Mirror the hidden state onto dedicated service_providers listings so the
  -- `is_active` feed filter in api/get-providers.ts also blocks them.
  UPDATE public.service_providers sp
  SET is_active = false, updated_at = NOW()
  FROM public.profiles p
  WHERE sp.profile_id = p.id
    AND sp.is_active = true
    AND (p.visibility_until IS NULL OR p.visibility_until <= NOW());
  GET DIAGNOSTICS _tmp = ROW_COUNT;
  _count := _count + _tmp;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) list_due_subscriptions(): expose plan duration + grace for the worker
-- ─────────────────────────────────────────────────────────────────────────
-- Signature changed (RETURNS TABLE now includes duration_days + grace_days),
-- so PostgreSQL requires DROP before CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.list_due_subscriptions();
CREATE OR REPLACE FUNCTION public.list_due_subscriptions()
RETURNS TABLE (
  id UUID, user_id UUID, plan_key TEXT, product_line TEXT, status TEXT,
  current_period_end TIMESTAMPTZ, paystack_token_key TEXT, kora_card_token_key TEXT,
  auto_renew BOOLEAN, launch_free_period BOOLEAN, failed_retries INTEGER,
  next_attempt_at TIMESTAMPTZ, grace_ends_at TIMESTAMPTZ, base_price_ngn INTEGER,
  duration_days INTEGER, grace_days INTEGER,
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
    s.grace_ends_at, p.base_price_ngn,
    p.duration_days,
    COALESCE((p.product_config->>'grace_days')::INTEGER, 3) AS grace_days,
    'NGN'::TEXT AS currency
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE (
        (s.status = 'active' AND s.auto_renew = true AND s.current_period_end <= NOW())
     OR (s.status = 'past_due' AND s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.list_due_subscriptions() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Jobs RLS: query-time billing gates (paid + not expired + within grace)
--    Legacy rows (post_plan IS NULL) stay visible. Owners can read own jobs.
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
CREATE POLICY "Anyone can read active jobs"
  ON public.jobs FOR SELECT
  USING (
    is_active = true
    AND (post_paid = true OR post_plan IS NULL)
    AND (post_expires_at IS NULL OR post_expires_at > NOW())
    AND (grace_ends_at IS NULL OR grace_ends_at > NOW())
  );

DROP POLICY IF EXISTS "Anon can read active jobs" ON public.jobs;
CREATE POLICY "Anon can read active jobs"
  ON public.jobs FOR SELECT
  USING (
    is_active = true
    AND (post_paid = true OR post_plan IS NULL)
    AND (post_expires_at IS NULL OR post_expires_at > NOW())
    AND (grace_ends_at IS NULL OR grace_ends_at > NOW())
  );

-- Recruiters must be able to see their OWN posts regardless of billing state
-- (drafts, expired, or in grace) on the Recruiter dashboard.
DROP POLICY IF EXISTS "Recruiters can read own jobs" ON public.jobs;
CREATE POLICY "Recruiters can read own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = recruiter_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Guard the legacy payment→profile activator against renewal ledger rows.
--    The billing worker writes a `payments` row (billing_phase renewal|retry)
--    for every auto-debit attempt, and kora-webhook flips it to 'verified'.
--    Without this guard the AFTER-INSERT/UPDATE trigger would re-grant job
--    credits and overwrite the subscription tier on every single renewal.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_plan_on_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tier TEXT;
  _duration_days INTEGER;
  _credits INTEGER;
  _expires_at TIMESTAMPTZ;
BEGIN
  -- Recurring auto-debits are reconciled by the subscription engine, not the
  -- legacy one-time checkout activator. Never grant credits / re-tier here.
  IF NEW.billing_phase IN ('renewal', 'retry') THEN
    RETURN NEW;
  END IF;

  -- Act only when status becomes 'verified' (on INSERT or UPDATE)
  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified') THEN

    -- Map plan key -> tier name
    _tier := CASE
      WHEN NEW.plan IN ('basic')              THEN 'basic'
      WHEN NEW.plan IN ('standard')            THEN 'standard'
      WHEN NEW.plan IN ('premium')             THEN 'premium'
      WHEN NEW.plan IN ('ai_monthly','ai_annual') THEN 'ai_tools'
      WHEN NEW.plan IN ('service_monthly')     THEN 'service_monthly'
      WHEN NEW.plan IN ('service_verified')    THEN 'service_verified'
      WHEN NEW.plan IN ('service_featured')    THEN 'service_featured'
      WHEN NEW.plan IN ('business_weekly')     THEN 'business_weekly'
      WHEN NEW.plan IN ('business_monthly')    THEN 'business_monthly'
      WHEN NEW.plan IN ('business_featured')   THEN 'business_featured'
      ELSE 'basic'
    END;

    _duration_days := CASE
      WHEN NEW.plan = 'basic'              THEN 7
      WHEN NEW.plan = 'standard'           THEN 14
      WHEN NEW.plan = 'premium'            THEN 30
      WHEN NEW.plan = 'ai_monthly'         THEN 30
      WHEN NEW.plan = 'ai_annual'          THEN 365
      WHEN NEW.plan = 'service_verified'   THEN 30
      WHEN NEW.plan = 'service_featured'   THEN 30
      WHEN NEW.plan = 'business_weekly'    THEN 7
      WHEN NEW.plan = 'business_monthly'   THEN 30
      WHEN NEW.plan = 'business_featured'  THEN 30
      ELSE 7
    END;

    _credits := CASE
      WHEN NEW.plan IN ('basic','standard') THEN 1
      WHEN NEW.plan = 'premium'             THEN 3
      WHEN NEW.plan IN ('business_weekly','business_monthly','business_featured') THEN 1
      ELSE 0
    END;

    _expires_at := NOW() + (_duration_days || ' days')::INTERVAL;

    -- Update the user's profile with credits & subscription
    UPDATE public.profiles
    SET
      is_premium              = true,
      subscription_tier       = _tier,
      subscription_expires_at = _expires_at,
      credits                 = COALESCE(credits, 0) + _credits,
      updated_at              = NOW()
    WHERE id = NEW.user_id;

    -- For service plans, also set verified/featured status
    IF NEW.plan = 'service_verified' THEN
      UPDATE public.profiles
      SET is_verified = true, is_featured = false
      WHERE id = NEW.user_id;
    ELSIF NEW.plan = 'service_featured' THEN
      UPDATE public.profiles
      SET is_verified = true, is_featured = true
      WHERE id = NEW.user_id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Immediate idempotent sweep (hides anything already past its window)
-- ─────────────────────────────────────────────────────────────────────────
SELECT public.enforce_billing_visibility();
