-- =========================================================================
-- JobBridge — Backfill marketplace visibility for legacy service subscribers
--
-- WHY:
--   The public /providers feed gates on `profiles.visibility_until > now()`.
--   That column was only introduced by the monetization engine, so existing
--   providers who paid BEFORE the monetization engine (legacy rows with
--   subscription_tier IN ('service_monthly','service_verified','service_featured')
--   and a future subscription_expires_at) have visibility_until = NULL and
--   would disappear from the marketplace even though they are still active.
--
--   This one-time, idempotent backfill copies their legacy expiry into
--   visibility_until and activates their service_providers listing. Going
--   forward the monetization engine manages visibility_until automatically.
--
-- ADDITIVE + IDEMPOTENT: safe to re-run in the Supabase SQL editor.
-- =========================================================================

-- 1) Copy legacy service subscription expiry into the new visibility gate.
UPDATE public.profiles
SET visibility_until = subscription_expires_at,
    is_active = true,
    updated_at = NOW()
WHERE role = 'provider'
  AND subscription_tier IN ('service_monthly', 'service_verified', 'service_featured')
  AND subscription_expires_at IS NOT NULL
  AND subscription_expires_at > NOW()
  AND (visibility_until IS NULL OR visibility_until < subscription_expires_at);

-- 2) Mirror the open window onto the dedicated service_providers listings.
UPDATE public.service_providers sp
SET is_active = true, updated_at = NOW()
FROM public.profiles p
WHERE sp.profile_id = p.id
  AND p.visibility_until IS NOT NULL
  AND p.visibility_until > NOW();

-- 3) (Optional) link to an existing monetization subscription when one exists.
UPDATE public.profiles p
SET service_subscription_id = s.id, updated_at = NOW()
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND s.product_line = 'service'
  AND s.status = 'active'
  AND (p.service_subscription_id IS NULL OR p.service_subscription_id <> s.id);

-- Sanity check (should list providers now visible in the marketplace):
--   SELECT full_name, subscription_tier, subscription_expires_at, visibility_until
--   FROM public.profiles
--   WHERE role = 'provider' AND visibility_until > NOW();
