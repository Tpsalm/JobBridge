-- =========================================================================
-- JobBridge — 30-day service-provider free trial billing support
--
-- Service providers who sign up and add a card are placed on a 30-day free
-- trial: a `subscriptions` row is created with status = 'trialing' and
-- current_period_end = trial end. The daily billing worker must pick those
-- rows up once the trial elapses and charge the saved card (KoraPay token)
-- before rolling the subscription to 'active'.
--
-- The subscriptions.status CHECK constraint already permits 'trialing' (see
-- 20260807_002_monetization_engine.sql). This migration only extends the
-- due-subscription scan used by billing-daily.
--
-- NOTE: `list_due_subscriptions` was hardened in 20260808_001 to also return
-- `duration_days` + `grace_days` from the plans catalogue. We preserve that
-- exact signature and simply add the `trialing` due condition.
-- =========================================================================

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
     OR (s.status = 'trialing' AND s.auto_renew = true AND s.current_period_end <= NOW())
     OR (s.status = 'past_due' AND s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.list_due_subscriptions() TO service_role;

-- Immediate sweep so any trial that already elapsed is picked up on deploy.
SELECT public.enforce_billing_visibility();
