REVOKE ALL ON public.subscriptions FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  plan_key,
  product_line,
  status,
  current_period_start,
  current_period_end,
  auto_renew,
  launch_free_period,
  grace_ends_at,
  failed_retries,
  next_attempt_at,
  canceled_at,
  cancel_reason,
  created_at,
  updated_at
) ON public.subscriptions TO authenticated;

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
    AND auto_renew = true
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active service subscription is available to cancel';
  END IF;

  UPDATE public.subscriptions
  SET status = 'canceled',
      auto_renew = false,
      canceled_at = _now,
      cancel_reason = 'user_requested',
      updated_at = _now
  WHERE id = _subscription.id;

  UPDATE public.profiles
  SET is_premium = false,
      is_active = false,
      visibility_until = _now,
      subscription_expires_at = _now,
      updated_at = _now
  WHERE id = _user_id;

  UPDATE public.service_providers
  SET is_active = false,
      updated_at = _now
  WHERE profile_id = _user_id;

  RETURN jsonb_build_object(
    'subscription_id', _subscription.id,
    'status', 'canceled',
    'canceled_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_service_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_service_subscription() TO authenticated;
