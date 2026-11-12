-- JobBridge — Fix recruiter payment unlock (paid but "View Plans" stuck)
-- Backfills verified recruiter payments that never granted credits/premium,
-- and re-asserts activate_plan_on_verify() with canonical grants
-- (basic/standard=1, premium=3) + double-grant guard.
-- Additive + idempotent. Run via SQL Editor or supabase db push.

DO $$
DECLARE
  r RECORD;
  grant_credits INTEGER;
  tier_name TEXT;
  expiry TIMESTAMPTZ;
  dur_days INTEGER;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (p.user_id) p.user_id, p.plan, p.created_at
      FROM public.payments p
     WHERE p.status = 'verified' AND p.plan IN ('basic','standard','premium')
     ORDER BY p.user_id, p.created_at DESC
  LOOP
    grant_credits := CASE r.plan WHEN 'premium' THEN 3 ELSE 1 END;
    tier_name := r.plan;
    dur_days := CASE r.plan WHEN 'basic' THEN 7 WHEN 'standard' THEN 14 ELSE 30 END;
    expiry := NOW() + (dur_days || ' days')::INTERVAL;
    UPDATE public.profiles
       SET is_premium = true,
           subscription_tier = COALESCE(NULLIF(subscription_tier,''), tier_name),
           subscription_expires_at = CASE
             WHEN subscription_expires_at IS NULL OR subscription_expires_at < NOW()
             THEN expiry ELSE subscription_expires_at END,
           credits = GREATEST(COALESCE(credits,0), grant_credits),
           updated_at = NOW()
     WHERE id = r.user_id
       AND (COALESCE(credits,0) < grant_credits
         OR is_premium IS DISTINCT FROM true
         OR subscription_expires_at IS NULL
         OR subscription_expires_at < NOW());
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.activate_plan_on_verify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tier TEXT; _duration_days INTEGER; _credits INTEGER; _expires_at TIMESTAMPTZ; _cur INTEGER;
BEGIN
  IF NEW.billing_phase IN ('renewal','retry') THEN RETURN NEW; END IF;
  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified') THEN
    _tier := CASE WHEN NEW.plan IN ('basic') THEN 'basic' WHEN NEW.plan IN ('standard') THEN 'standard'
      WHEN NEW.plan IN ('premium') THEN 'premium' WHEN NEW.plan IN ('ai_monthly','ai_annual') THEN 'ai_tools'
      WHEN NEW.plan IN ('service_monthly') THEN 'service_monthly' WHEN NEW.plan IN ('service_verified') THEN 'service_verified'
      WHEN NEW.plan IN ('service_featured') THEN 'service_featured' WHEN NEW.plan IN ('business_weekly') THEN 'business_weekly'
      WHEN NEW.plan IN ('business_monthly') THEN 'business_monthly' WHEN NEW.plan IN ('business_featured') THEN 'business_featured' ELSE 'basic' END;
    _duration_days := CASE WHEN NEW.plan='basic' THEN 7 WHEN NEW.plan='standard' THEN 14 WHEN NEW.plan='premium' THEN 30
      WHEN NEW.plan='ai_monthly' THEN 30 WHEN NEW.plan='ai_annual' THEN 365 WHEN NEW.plan='service_verified' THEN 30
      WHEN NEW.plan='service_featured' THEN 30 WHEN NEW.plan='business_weekly' THEN 7 WHEN NEW.plan='business_monthly' THEN 30
      WHEN NEW.plan='business_featured' THEN 30 ELSE 7 END;
    _credits := CASE WHEN NEW.plan IN ('basic','standard') THEN 1 WHEN NEW.plan='premium' THEN 3 ELSE 0 END;
    _expires_at := NOW() + (_duration_days || ' days')::INTERVAL;
    SELECT COALESCE(credits,0) INTO _cur FROM public.profiles WHERE id = NEW.user_id;
    UPDATE public.profiles SET is_premium=true, subscription_tier=_tier, subscription_expires_at=_expires_at,
      credits = CASE WHEN _credits>0 AND COALESCE(_cur,0)>=_credits THEN _cur ELSE COALESCE(_cur,0)+_credits END,
      updated_at=NOW() WHERE id = NEW.user_id;
    IF NEW.plan='service_verified' THEN UPDATE public.profiles SET is_verified=true, is_featured=false WHERE id=NEW.user_id;
    ELSIF NEW.plan='service_featured' THEN UPDATE public.profiles SET is_verified=true, is_featured=true WHERE id=NEW.user_id; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_payment_verified ON public.payments;
CREATE TRIGGER on_payment_verified AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.activate_plan_on_verify();
