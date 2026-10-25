UPDATE public.plans
SET is_launch_free = false,
    product_config = CASE key
      WHEN 'svc_basic' THEN '{"visibility_days":30,"verified":false,"featured":false,"grace_days":0,"retry_delay_days":[1,2],"benefits":["Public provider profile","Service listing","Client inquiries"]}'::jsonb
      WHEN 'svc_verified' THEN '{"visibility_days":30,"verified":false,"verification_required":true,"featured":false,"grace_days":0,"retry_delay_days":[1,2],"benefits":["Public provider profile","Service listing","Verification review (badge only after approval)","Client inquiries"]}'::jsonb
      WHEN 'svc_featured' THEN '{"visibility_days":30,"verified":false,"featured":true,"grace_days":0,"retry_delay_days":[1,2],"benefits":["Public provider profile","Featured placement","Client inquiries"]}'::jsonb
      ELSE product_config
    END,
    updated_at = now()
WHERE key IN ('svc_basic', 'svc_verified', 'svc_featured');

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kora_authorization_code TEXT,
  ADD COLUMN IF NOT EXISTS kora_authorization_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_kora_authorization_code TEXT,
  ADD COLUMN IF NOT EXISTS pending_kora_authorization_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan_key TEXT REFERENCES public.plans(key),
  ADD COLUMN IF NOT EXISTS pending_payment_method_bank TEXT,
  ADD COLUMN IF NOT EXISTS pending_payment_method_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_bank TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS renewal_reminder_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_kora_authorization
  ON public.subscriptions(kora_authorization_code)
  WHERE kora_authorization_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_pending_kora_authorization
  ON public.subscriptions(pending_kora_authorization_code)
  WHERE pending_kora_authorization_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_provider_trial_claims (
  identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'phone')),
  identity_hash TEXT NOT NULL,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_type, identity_hash)
);

ALTER TABLE public.service_provider_trial_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_provider_trial_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_service_provider_trial(
  p_user_id UUID,
  p_subscription_id UUID,
  p_email_hash TEXT,
  p_phone_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_subscription_id IS NULL
     OR p_email_hash !~ '^[0-9a-f]{64}$'
     OR p_phone_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid trial identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.service_provider_trial_claims c
    WHERE c.subscription_id <> p_subscription_id
      AND ((c.identity_type = 'email' AND c.identity_hash = p_email_hash)
        OR (c.identity_type = 'phone' AND c.identity_hash = p_phone_hash))
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.service_provider_trial_claims
    (identity_type, identity_hash, user_id, subscription_id)
  VALUES
    ('email', p_email_hash, p_user_id, p_subscription_id),
    ('phone', p_phone_hash, p_user_id, p_subscription_id)
  ON CONFLICT (identity_type, identity_hash) DO NOTHING;

  IF (
    SELECT count(*)
    FROM public.service_provider_trial_claims
    WHERE subscription_id = p_subscription_id
      AND (
        (identity_type = 'email' AND identity_hash = p_email_hash)
        OR (identity_type = 'phone' AND identity_hash = p_phone_hash)
      )
  ) <> 2 THEN
    DELETE FROM public.service_provider_trial_claims
    WHERE user_id = p_user_id AND subscription_id = p_subscription_id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_service_provider_trial(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_service_provider_trial(UUID, UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.release_service_provider_trial_claim(
  p_user_id UUID,
  p_subscription_id UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.service_provider_trial_claims
  WHERE user_id = p_user_id AND subscription_id = p_subscription_id;
$$;

REVOKE ALL ON FUNCTION public.release_service_provider_trial_claim(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_service_provider_trial_claim(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_service_subscription()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'plan_key', s.plan_key,
    'plan_name', p.name,
    'price_ngn', p.base_price_ngn,
    'billing_period_days', p.duration_days,
    'status', s.status,
    'current_period_start', s.current_period_start,
    'current_period_end', s.current_period_end,
    'trial_start_at', s.trial_start_at,
    'trial_end_at', s.trial_end_at,
    'next_billing_at', s.next_billing_at,
    'auto_renew', s.auto_renew,
    'cancel_at_period_end', s.cancel_at_period_end,
    'canceled_at', s.canceled_at,
    'payment_method_type', s.payment_method_type,
    'payment_method_bank', s.payment_method_bank,
    'payment_method_last4', s.payment_method_last4,
    'payment_method_expires_at', s.kora_authorization_expires_at,
    'failed_retries', s.failed_retries,
    'consent_at', s.consent_at,
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pay.id,
        'amount', pay.amount,
        'currency', pay.currency,
        'status', pay.status,
        'reference', pay.reference,
        'provider_reference', pay.provider_reference,
        'failure_code', pay.failure_code,
        'created_at', pay.created_at
      ) ORDER BY pay.created_at DESC)
      FROM public.payments pay
      WHERE pay.subscription_id = s.id
    ), '[]'::jsonb)
  )
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE s.user_id = auth.uid()
    AND s.product_line = 'service'
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_service_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_service_subscription() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_service_subscription_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _summary JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'subscriptions', COUNT(DISTINCT s.id),
    'trialing', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'trialing'),
    'active', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active'),
    'canceled', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'canceled'),
    'expired', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'expired'),
    'past_due', COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'past_due'),
    'revenue_ngn', COALESCE(SUM(pay.amount) FILTER (
      WHERE pay.status IN ('completed', 'verified', 'success', 'successful')
    ), 0)
  )
  INTO _summary
  FROM public.subscriptions s
  LEFT JOIN public.payments pay ON pay.subscription_id = s.id
  WHERE s.product_line = 'service';

  RETURN _summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_service_subscription_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_service_subscription_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_my_service_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _subscription public.subscriptions%ROWTYPE;
  _now TIMESTAMPTZ := NOW();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO _subscription
  FROM public.subscriptions
  WHERE user_id = _user_id
    AND product_line = 'service'
    AND status IN ('active', 'trialing', 'past_due')
    AND (
      auto_renew = true
      OR (
        status = 'trialing'
        AND trial_start_at IS NULL
        AND metadata->>'authorization_status' = 'pending'
      )
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No renewable service subscription is available to cancel';
  END IF;

  UPDATE public.subscriptions
  SET status = 'canceled',
      auto_renew = false,
      cancel_at_period_end = _subscription.trial_start_at IS NOT NULL
        AND _subscription.current_period_end > _now,
      next_attempt_at = NULL,
      pending_kora_authorization_code = NULL,
      pending_kora_authorization_expires_at = NULL,
      pending_plan_key = NULL,
      pending_payment_method_bank = NULL,
      pending_payment_method_last4 = NULL,
      canceled_at = _now,
      cancel_reason = 'user_requested',
      updated_at = _now
  WHERE id = _subscription.id;

  IF _subscription.trial_start_at IS NULL THEN
    DELETE FROM public.service_provider_trial_claims
    WHERE user_id = _user_id AND subscription_id = _subscription.id;
  END IF;

  RETURN jsonb_build_object(
    'subscription_id', _subscription.id,
    'status', 'canceled',
    'access_until', _subscription.current_period_end,
    'canceled_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_service_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_service_subscription() TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_service_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER := 0;
  _changed INTEGER := 0;
BEGIN
  UPDATE public.subscriptions
  SET status = CASE WHEN auto_renew THEN 'past_due' ELSE 'expired' END,
      next_attempt_at = CASE WHEN auto_renew THEN COALESCE(next_attempt_at, NOW()) ELSE NULL END,
      updated_at = NOW()
  WHERE product_line = 'service'
    AND status IN ('active', 'trialing', 'canceled')
    AND current_period_end <= NOW();

  GET DIAGNOSTICS _changed = ROW_COUNT;
  _count := _count + _changed;

  UPDATE public.profiles p
  SET visibility_until = NULL,
      is_active = false,
      is_premium = false,
      updated_at = NOW()
  WHERE p.role = 'provider'
    AND p.visibility_until IS NOT NULL
    AND p.visibility_until <= NOW()
    AND (
      p.service_subscription_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.id = p.service_subscription_id
          AND s.product_line = 'service'
          AND s.status IN ('past_due', 'canceled', 'expired')
      )
    );

  GET DIAGNOSTICS _changed = ROW_COUNT;
  _count := _count + _changed;

  UPDATE public.service_providers sp
  SET is_active = false,
      updated_at = NOW()
  FROM public.profiles p
  WHERE sp.profile_id = p.id
    AND p.role = 'provider'
    AND (p.visibility_until IS NULL OR p.visibility_until <= NOW())
    AND sp.is_active = true;

  GET DIAGNOSTICS _changed = ROW_COUNT;
  RETURN _count + _changed;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_service_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_service_subscriptions() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_service_renewal_reminders()
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  plan_key TEXT,
  amount_ngn INTEGER,
  next_billing_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.subscriptions s
    SET renewal_reminder_for = s.next_billing_at,
        renewal_reminder_sent_at = NOW(),
        updated_at = NOW()
    FROM public.plans p
    WHERE s.plan_key = p.key
      AND s.product_line = 'service'
      AND s.status IN ('trialing', 'active')
      AND s.auto_renew = true
      AND s.next_billing_at > NOW()
      AND s.next_billing_at <= NOW() + INTERVAL '3 days'
      AND s.renewal_reminder_for IS DISTINCT FROM s.next_billing_at
    RETURNING s.id, s.user_id, s.plan_key, s.next_billing_at
  )
  SELECT claimed.id, claimed.user_id, claimed.plan_key, p.base_price_ngn,
         claimed.next_billing_at
  FROM claimed
  JOIN public.plans p ON p.key = claimed.plan_key;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_service_renewal_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_service_renewal_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.create_service_renewal_attempt(
  p_subscription_id UUID,
  p_reference TEXT,
  p_attempt INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription public.subscriptions%ROWTYPE;
  _plan public.plans%ROWTYPE;
BEGIN
  SELECT *
  INTO _subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND product_line = 'service'
  FOR UPDATE;
  IF NOT FOUND OR NOT _subscription.auto_renew
     OR _subscription.status NOT IN ('active', 'trialing', 'past_due')
     OR _subscription.current_period_end > NOW()
     OR COALESCE(_subscription.next_attempt_at, _subscription.current_period_end) > NOW() THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE subscription_id = _subscription.id AND status = 'pending'
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO _plan
  FROM public.plans
  WHERE key = _subscription.plan_key AND product_line = 'service';
  IF NOT FOUND OR _plan.base_price_ngn <= 0 THEN
    RAISE EXCEPTION 'The subscription plan is unavailable';
  END IF;

  INSERT INTO public.payments (
    user_id, subscription_id, plan, amount, currency, reference,
    status, billing_phase, idempotency_key, provider, metadata, updated_at
  )
  VALUES (
    _subscription.user_id, _subscription.id, _subscription.plan_key,
    _plan.base_price_ngn, 'NGN', p_reference, 'pending',
    CASE WHEN p_attempt > 1 THEN 'retry' ELSE 'renewal' END,
    p_reference, 'korapay',
    jsonb_build_object('subscription_id', _subscription.id, 'plan_key', _subscription.plan_key, 'attempt', p_attempt),
    NOW()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_renewal_attempt(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_renewal_attempt(UUID, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.create_service_manual_payment(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subscription public.subscriptions%ROWTYPE;
  _plan public.plans%ROWTYPE;
  _payment public.payments%ROWTYPE;
  _reference TEXT;
BEGIN
  SELECT *
  INTO _subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND product_line = 'service'
    AND status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR _subscription.kora_authorization_code IS NULL
     OR _subscription.kora_authorization_expires_at IS NULL
     OR _subscription.kora_authorization_expires_at <= NOW()
     OR _subscription.current_period_end > NOW() THEN
    RAISE EXCEPTION 'No due subscription with a valid Direct Debit authorization is available';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE subscription_id = _subscription.id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A subscription payment is already being confirmed';
  END IF;

  SELECT *
  INTO _plan
  FROM public.plans
  WHERE key = _subscription.plan_key
    AND product_line = 'service'
    AND is_active = true;
  IF NOT FOUND OR _plan.base_price_ngn <= 0 THEN
    RAISE EXCEPTION 'The subscription plan is unavailable';
  END IF;

  _reference := 'JB-MANUAL-' || _subscription.id::TEXT || '-' ||
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSMS');
  INSERT INTO public.payments (
    user_id, subscription_id, plan, amount, currency, reference,
    status, billing_phase, idempotency_key, provider, metadata, updated_at
  )
  VALUES (
    p_user_id, _subscription.id, _subscription.plan_key, _plan.base_price_ngn,
    'NGN', _reference, 'pending', 'manual', _reference, 'korapay',
    jsonb_build_object('subscription_id', _subscription.id, 'plan_key', _subscription.plan_key, 'attempt', 1),
    NOW()
  )
  RETURNING * INTO _payment;

  RETURN jsonb_build_object(
    'payment_id', _payment.id,
    'subscription_id', _subscription.id,
    'authorization_code', _subscription.kora_authorization_code,
    'plan_key', _subscription.plan_key,
    'plan_name', _plan.name,
    'amount_ngn', _payment.amount,
    'reference', _reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_manual_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_manual_payment(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_service_subscription_payment(
  p_payment_id UUID,
  p_gateway_reference TEXT,
  p_succeeded BOOLEAN,
  p_failure_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment public.payments%ROWTYPE;
  _subscription public.subscriptions%ROWTYPE;
  _now TIMESTAMPTZ := NOW();
  _period_end TIMESTAMPTZ;
  _attempt INTEGER;
  _duration_days INTEGER;
  _retry_delay_days INTEGER;
BEGIN
  SELECT *
  INTO _payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND OR _payment.subscription_id IS NULL
     OR _payment.billing_phase NOT IN ('renewal', 'retry', 'manual') THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  SELECT *
  INTO _subscription
  FROM public.subscriptions
  WHERE id = _payment.subscription_id
    AND product_line = 'service'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  IF _payment.status IN ('verified', 'completed') THEN
    RETURN jsonb_build_object(
      'state', 'already_settled',
      'user_id', _payment.user_id,
      'subscription_id', _subscription.id,
      'plan_key', _subscription.plan_key,
      'amount', _payment.amount
    );
  END IF;
  IF _payment.status <> 'pending' THEN
    RETURN jsonb_build_object('state', 'already_failed');
  END IF;

  _attempt := COALESCE((_payment.metadata->>'attempt')::INTEGER, 1);
  IF p_succeeded THEN
    SELECT duration_days
    INTO _duration_days
    FROM public.plans
    WHERE key = _subscription.plan_key;
    _period_end := GREATEST(_subscription.current_period_end, _now)
      + (INTERVAL '1 day' * COALESCE(_duration_days, 30));

    UPDATE public.payments
    SET status = 'verified',
        provider = 'korapay',
        provider_reference = p_gateway_reference,
        failure_code = NULL,
        updated_at = _now
    WHERE id = _payment.id;

    UPDATE public.subscriptions
    SET status = CASE WHEN auto_renew THEN 'active' ELSE 'canceled' END,
        failed_retries = 0,
        last_attempt_at = _now,
        last_attempt_ref = _payment.reference,
        current_period_start = GREATEST(_subscription.current_period_end, _now),
        current_period_end = _period_end,
        next_billing_at = CASE WHEN auto_renew THEN _period_end ELSE NULL END,
        next_attempt_at = CASE WHEN auto_renew THEN _period_end ELSE NULL END,
        grace_ends_at = NULL,
        updated_at = _now
    WHERE id = _subscription.id;

    UPDATE public.profiles
    SET subscription_expires_at = _period_end,
        visibility_until = _period_end,
        is_premium = true,
        is_active = true,
        updated_at = _now
    WHERE id = _subscription.user_id
      AND role = 'provider';

    UPDATE public.service_providers
    SET is_active = true,
        updated_at = _now
    WHERE profile_id = _subscription.user_id;

    RETURN jsonb_build_object(
      'state', 'succeeded',
      'user_id', _payment.user_id,
      'subscription_id', _subscription.id,
      'plan_key', _subscription.plan_key,
      'amount', _payment.amount,
      'next_billing_at', _period_end
    );
  END IF;

  UPDATE public.payments
  SET status = 'failed',
      provider = 'korapay',
      provider_reference = p_gateway_reference,
      failure_code = LEFT(COALESCE(p_failure_code, 'direct_debit_failed'), 120),
      updated_at = _now
  WHERE id = _payment.id;

  SELECT (policy.value)::INTEGER
  INTO _retry_delay_days
  FROM public.plans p,
       LATERAL jsonb_array_elements_text(
         COALESCE(p.product_config->'retry_delay_days', '[1,2]'::jsonb)
       ) WITH ORDINALITY AS policy(value, ordinal)
  WHERE p.key = _subscription.plan_key
    AND policy.ordinal = _attempt;

  UPDATE public.subscriptions
  SET status = CASE WHEN auto_renew THEN 'past_due' ELSE 'canceled' END,
      failed_retries = _attempt,
      last_attempt_at = _now,
      last_attempt_ref = _payment.reference,
      next_attempt_at = CASE
        WHEN auto_renew AND _retry_delay_days > 0
          THEN _now + (INTERVAL '1 day' * _retry_delay_days)
        ELSE NULL
      END,
      grace_ends_at = NULL,
      updated_at = _now
  WHERE id = _subscription.id;

  RETURN jsonb_build_object(
    'state', 'failed',
    'user_id', _payment.user_id,
    'subscription_id', _subscription.id,
    'plan_key', _subscription.plan_key,
    'amount', _payment.amount,
    'attempt', _attempt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_service_subscription_payment(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_service_subscription_payment(UUID, TEXT, BOOLEAN, TEXT) TO service_role;

DROP FUNCTION IF EXISTS public.list_due_subscriptions();
CREATE OR REPLACE FUNCTION public.list_due_subscriptions()
RETURNS TABLE (
  id UUID, user_id UUID, plan_key TEXT, product_line TEXT, status TEXT,
  current_period_end TIMESTAMPTZ, paystack_token_key TEXT, kora_card_token_key TEXT,
  auto_renew BOOLEAN, launch_free_period BOOLEAN, failed_retries INTEGER,
  next_attempt_at TIMESTAMPTZ, grace_ends_at TIMESTAMPTZ, base_price_ngn INTEGER,
  duration_days INTEGER, grace_days INTEGER, currency TEXT,
  kora_authorization_code TEXT, kora_authorization_expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.user_id, s.plan_key, s.product_line, s.status,
    s.current_period_end, s.paystack_token_key, s.kora_card_token_key,
    s.auto_renew, s.launch_free_period, s.failed_retries, s.next_attempt_at,
    s.grace_ends_at, p.base_price_ngn, p.duration_days,
    COALESCE((p.product_config->>'grace_days')::INTEGER, 0) AS grace_days,
    'NGN'::TEXT AS currency, s.kora_authorization_code,
    s.kora_authorization_expires_at
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE (
       (s.status IN ('active', 'trialing') AND s.auto_renew = true AND s.current_period_end <= NOW())
    OR (s.status = 'past_due' AND s.auto_renew = true AND s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= NOW())
  )
    AND s.payment_method_type IS DISTINCT FROM 'kora_direct_debit'
  UNION ALL
  SELECT
    s.id, s.user_id, s.plan_key, s.product_line, s.status,
    s.current_period_end, s.paystack_token_key, s.kora_card_token_key,
    s.auto_renew, s.launch_free_period, s.failed_retries, s.next_attempt_at,
    s.grace_ends_at, p.base_price_ngn, p.duration_days,
    COALESCE((p.product_config->>'grace_days')::INTEGER, 0) AS grace_days,
    'NGN'::TEXT AS currency, s.kora_authorization_code,
    s.kora_authorization_expires_at
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE s.product_line = 'service'
    AND s.payment_method_type = 'kora_direct_debit'
    AND s.status IN ('active', 'trialing', 'past_due')
    AND s.auto_renew = true
    AND s.next_attempt_at IS NOT NULL
    AND s.next_attempt_at <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.payments pay
      WHERE pay.subscription_id = s.id
        AND pay.status = 'pending'
        AND pay.billing_phase IN ('renewal', 'retry')
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_due_subscriptions() TO service_role;

GRANT SELECT (
  trial_start_at,
  trial_end_at,
  next_billing_at,
  payment_method_type,
  payment_method_bank,
  payment_method_last4,
  consent_at,
  consent_version,
  cancel_at_period_end
) ON public.subscriptions TO authenticated;

SELECT public.enforce_billing_visibility();
