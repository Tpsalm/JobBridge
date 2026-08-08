-- =========================================================================
-- JobBridge — Restore ALL service providers to the public marketplace
--
-- WHY:
--   1) The billing-hardening migration (20260808_001) set
--      profiles.is_active = false / service_providers.is_active = false for
--      any provider whose visibility window lapsed, and the 002 backfill only
--      re-activated providers with a FUTURE subscription_expires_at. Free /
--      basic / lapsed providers therefore vanished from the /providers page.
--   2) Product decision: the marketplace should show EVERY active service
--      provider. Monetization is delivered through RANKING + BADGING instead
--      of hiding listings — Featured Professional (paid) ranks first, Verified
--      Professional second, everyone else last (see api/get-providers.ts and
--      src/pages/Providers.tsx).
--
-- This migration:
--   A) Re-activates every provider profile + service_providers listing so all
--      of them reappear on the Providers page immediately.
--   B) Rewrites enforce_billing_visibility() so it ONLY hides EXPIRED JOB
--      POSTS and never deactivates provider listings — the daily billing cron
--      therefore cannot re-hide providers.
--
-- ADDITIVE + IDEMPOTENT: safe to run in the Supabase SQL editor or `db push`.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- A) Restore visibility for every service provider (undo billing deactivation)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET is_active = true,
    updated_at = NOW()
WHERE role = 'provider';

UPDATE public.service_providers sp
SET is_active = true,
    updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = sp.profile_id
    AND p.role = 'provider'
);

-- ─────────────────────────────────────────────────────────────────────────
-- B) enforce_billing_visibility(): only manage expired job posts. Provider
--    listings stay public forever; ranking + badging drives monetization.
-- ─────────────────────────────────────────────────────────────────────────
-- DROP first for full idempotency across re-runs.
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

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_billing_visibility() TO authenticated;

-- Sanity check (should count every provider as visible):
--   SELECT COUNT(*) AS visible_providers
--   FROM public.profiles
--   WHERE role = 'provider' AND is_active = true;
