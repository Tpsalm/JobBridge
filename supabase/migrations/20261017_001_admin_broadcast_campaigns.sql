-- =========================================================================
-- PART A: RECONCILE MISSING SEPTEMBER INFRASTRUCTURE
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_category TEXT;

CREATE TABLE IF NOT EXISTS public.service_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  specialty TEXT,
  hourly_rate INTEGER,
  reviews_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_profile_id
  ON public.service_providers(profile_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  service_category_value TEXT;
  specialty_value TEXT;
BEGIN
  user_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('recruiter', 'provider', 'job_seeker')
      THEN NEW.raw_user_meta_data->>'role'
    ELSE 'job_seeker'
  END;
  service_category_value := NULLIF(NEW.raw_user_meta_data->>'service_category', '');
  specialty_value := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'specialty', ''),
    service_category_value,
    'Service Professional'
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, company, phone, location, service_category
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role,
    NULLIF(NEW.raw_user_meta_data->>'company', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'location', ''),
    service_category_value
  )
  ON CONFLICT (id) DO NOTHING;

  IF user_role = 'provider' THEN
    INSERT INTO public.service_providers (profile_id, specialty)
    SELECT NEW.id, specialty_value
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.service_providers
      WHERE profile_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- PART B: ADMIN BROADCAST & NOTIFICATION SCHEMA
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_broadcast_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_broadcast_opt_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_broadcast_opt_out_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

UPDATE public.push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL
  AND subscription->>'endpoint' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
  ON public.push_subscriptions(user_id, endpoint);

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  channels TEXT[] NOT NULL CHECK (
    cardinality(channels) > 0
    AND channels <@ ARRAY['in_app', 'push', 'sms']::TEXT[]
  ),
  audience JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('scheduled', 'queued', 'processing', 'completed', 'partial', 'failed', 'canceled')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key UUID NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  sms_estimated_segments INTEGER NOT NULL DEFAULT 0 CHECK (sms_estimated_segments >= 0),
  sms_estimated_cost_ngn NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (sms_estimated_cost_ngn >= 0),
  action_url TEXT,
  action_label TEXT,
  broadcast_type TEXT NOT NULL DEFAULT 'announcement',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (created_by, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'sms')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'delivered', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  provider_message_id TEXT,
  error_code TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status_schedule ON public.broadcast_campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created ON public.broadcast_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_claim ON public.broadcast_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign_status ON public.broadcast_deliveries(campaign_id, channel, status);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_provider_message ON public.broadcast_deliveries(provider_message_id) WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;

-- Reuse the application's existing notification schema; do not create a reduced substitute.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS broadcast_delivery_id UUID REFERENCES public.broadcast_deliveries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_broadcast_delivery
  ON public.notifications(broadcast_delivery_id) WHERE broadcast_delivery_id IS NOT NULL;

DROP POLICY IF EXISTS "Admins manage broadcast campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Admins manage broadcast campaigns" ON public.broadcast_campaigns FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins read broadcast deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Admins read broadcast deliveries" ON public.broadcast_deliveries FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users manage own SMS broadcast consent" ON public.profiles;
CREATE POLICY "Users manage own SMS broadcast consent" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.claim_broadcast_deliveries(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (delivery_id UUID, campaign_id UUID, user_id UUID, channel TEXT, attempt_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN RAISE EXCEPTION 'Batch limit must be between 1 and 500'; END IF;
  UPDATE public.broadcast_campaigns AS c SET status = 'queued', started_at = COALESCE(c.started_at, now()), updated_at = now() WHERE c.status = 'scheduled' AND c.scheduled_at <= now();
  RETURN QUERY
  WITH claimable AS (
    SELECT d.id FROM public.broadcast_deliveries AS d JOIN public.broadcast_campaigns AS c ON c.id = d.campaign_id WHERE c.status IN ('queued', 'processing') AND c.scheduled_at <= now() AND ((d.status = 'queued' AND d.next_attempt_at <= now()) OR (d.status = 'failed' AND d.attempts < 4 AND d.next_attempt_at <= now()) OR (d.status = 'processing' AND d.locked_at < now() - INTERVAL '15 minutes' AND d.attempts < 4)) ORDER BY d.created_at FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.broadcast_deliveries AS d SET status = 'processing', attempts = d.attempts + 1, locked_at = now(), updated_at = now() FROM claimable WHERE d.id = claimable.id RETURNING d.id, d.campaign_id, d.user_id, d.channel, d.attempts
  ), active_campaigns AS (
    UPDATE public.broadcast_campaigns AS c SET status = 'processing', updated_at = now() FROM (SELECT DISTINCT claimed.campaign_id FROM claimed) AS batch WHERE c.id = batch.campaign_id AND c.status = 'queued' RETURNING c.id
  )
  SELECT claimed.id, claimed.campaign_id, claimed.user_id, claimed.channel, claimed.attempts FROM claimed LEFT JOIN active_campaigns ON active_campaigns.id = claimed.campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_broadcast_campaign_stats(p_campaign_ids UUID[])
RETURNS TABLE (campaign_id UUID, channel TEXT, status TEXT, delivery_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT d.campaign_id, d.channel, d.status, COUNT(*)::BIGINT FROM public.broadcast_deliveries AS d WHERE d.campaign_id = ANY(p_campaign_ids) GROUP BY d.campaign_id, d.channel, d.status;
$$;

CREATE OR REPLACE FUNCTION public.get_broadcast_campaign_failures(p_campaign_ids UUID[])
RETURNS TABLE (campaign_id UUID, channel TEXT, error_code TEXT, failure_count BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT d.campaign_id, d.channel, COALESCE(d.error_code, 'unknown'), COUNT(*)::BIGINT
  FROM public.broadcast_deliveries AS d
  WHERE d.campaign_id = ANY(p_campaign_ids)
    AND d.status = 'failed'
  GROUP BY d.campaign_id, d.channel, COALESCE(d.error_code, 'unknown');
$$;

CREATE OR REPLACE FUNCTION public.get_broadcast_campaign_progress(p_campaign_id UUID)
RETURNS TABLE (pending BOOLEAN, retryable BOOLEAN, sent_count BIGINT, failed_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(BOOL_OR(d.status IN ('queued', 'processing')), false),
    COALESCE(BOOL_OR(d.status = 'failed' AND d.attempts < 4), false),
    COUNT(*) FILTER (WHERE d.status IN ('sent', 'delivered'))::BIGINT,
    COUNT(*) FILTER (WHERE d.status = 'failed')::BIGINT
  FROM public.broadcast_deliveries AS d
  WHERE d.campaign_id = p_campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.get_push_recipient_user_ids(p_user_ids UUID[])
RETURNS TABLE (user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id
  FROM public.push_subscriptions AS p
  WHERE p.user_id = ANY(p_user_ids)
    AND p.user_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.retry_broadcast_failures(p_campaign_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retried_count INTEGER;
BEGIN
  UPDATE public.broadcast_deliveries
  SET status = 'queued',
      attempts = 0,
      locked_at = NULL,
      next_attempt_at = now(),
      error_code = NULL,
      updated_at = now()
  WHERE campaign_id = p_campaign_id
    AND status = 'failed';
  GET DIAGNOSTICS retried_count = ROW_COUNT;

  IF retried_count > 0 THEN
    UPDATE public.broadcast_campaigns
    SET status = 'queued',
        completed_at = NULL,
        updated_at = now()
    WHERE id = p_campaign_id;
  END IF;
  RETURN retried_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_broadcast_campaign(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canceled_id UUID;
BEGIN
  UPDATE public.broadcast_campaigns
  SET status = 'canceled',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_campaign_id
    AND status IN ('scheduled', 'queued')
  RETURNING id INTO canceled_id;

  IF canceled_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.broadcast_deliveries
  SET status = 'skipped',
      error_code = 'campaign_canceled',
      locked_at = NULL,
      updated_at = now()
  WHERE campaign_id = p_campaign_id
    AND status = 'queued';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_broadcast_profile_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin') AND NEW.phone_verified THEN
      RAISE EXCEPTION 'Phone verification can only be changed by a trusted server process';
    END IF;
    IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin')
      AND (NEW.sms_broadcast_opt_in_at IS NOT NULL OR NEW.sms_broadcast_opt_out_at IS NOT NULL) THEN
      RAISE EXCEPTION 'SMS consent timestamps are maintained by the database';
    END IF;
    IF NEW.sms_broadcast_opt_in THEN
      NEW.sms_broadcast_opt_in_at := now();
    END IF;
  ELSIF OLD.phone IS DISTINCT FROM NEW.phone
    AND COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin') THEN
    IF OLD.sms_broadcast_opt_in_at IS DISTINCT FROM NEW.sms_broadcast_opt_in_at
      OR OLD.sms_broadcast_opt_out_at IS DISTINCT FROM NEW.sms_broadcast_opt_out_at THEN
      RAISE EXCEPTION 'SMS consent timestamps are maintained by the database';
    END IF;
    NEW.phone_verified := false;
    IF OLD.sms_broadcast_opt_in OR NEW.sms_broadcast_opt_in THEN
      NEW.sms_broadcast_opt_in := false;
      NEW.sms_broadcast_opt_out_at := now();
    END IF;
  ELSIF OLD.phone_verified AND NOT NEW.phone_verified THEN
    IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin')
      AND (
        OLD.sms_broadcast_opt_in_at IS DISTINCT FROM NEW.sms_broadcast_opt_in_at
        OR OLD.sms_broadcast_opt_out_at IS DISTINCT FROM NEW.sms_broadcast_opt_out_at
      ) THEN
      RAISE EXCEPTION 'SMS consent timestamps are maintained by the database';
    END IF;
    IF OLD.sms_broadcast_opt_in OR NEW.sms_broadcast_opt_in THEN
      NEW.sms_broadcast_opt_in := false;
      NEW.sms_broadcast_opt_out_at := now();
    END IF;
  ELSIF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin')
    AND OLD.phone_verified IS DISTINCT FROM NEW.phone_verified
    AND NEW.phone_verified THEN
    RAISE EXCEPTION 'Phone verification can only be changed by a trusted server process';
  ELSIF OLD.sms_broadcast_opt_in IS DISTINCT FROM NEW.sms_broadcast_opt_in THEN
    IF NEW.sms_broadcast_opt_in THEN
      NEW.sms_broadcast_opt_in_at := now();
      NEW.sms_broadcast_opt_out_at := NULL;
    ELSE
      NEW.sms_broadcast_opt_out_at := now();
    END IF;
  ELSIF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin')
    AND (
      OLD.sms_broadcast_opt_in_at IS DISTINCT FROM NEW.sms_broadcast_opt_in_at
      OR OLD.sms_broadcast_opt_out_at IS DISTINCT FROM NEW.sms_broadcast_opt_out_at
    ) THEN
    RAISE EXCEPTION 'SMS consent timestamps are maintained by the database';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_broadcast_preferences_guard ON public.profiles;
CREATE TRIGGER profiles_broadcast_preferences_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_broadcast_profile_preferences();

REVOKE ALL ON FUNCTION public.claim_broadcast_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_broadcast_deliveries(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.get_broadcast_campaign_stats(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_stats(UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.get_broadcast_campaign_failures(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_failures(UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.get_broadcast_campaign_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_campaign_progress(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.get_push_recipient_user_ids(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_recipient_user_ids(UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.retry_broadcast_failures(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_broadcast_failures(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_broadcast_campaign(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_broadcast_campaign(UUID) TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.broadcast_campaigns TO authenticated;
GRANT SELECT ON public.broadcast_deliveries TO authenticated;
GRANT ALL ON public.broadcast_campaigns, public.broadcast_deliveries TO service_role;
GRANT SELECT (sms_broadcast_opt_in, phone_verified) ON public.profiles TO authenticated;
GRANT UPDATE (sms_broadcast_opt_in) ON public.profiles TO authenticated;
