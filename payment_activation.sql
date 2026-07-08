-- =========================================================================
-- Payment Activation Migration
-- Run this in Supabase SQL Editor after the main supabase_migration.sql
-- Enables: bank transfer → pending payment → admin verifies → auto-activate
-- =========================================================================

-- =========================
-- 1) Harden payments table for webhook-authoritative reconciliation
-- =========================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'korapay',
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'completed', 'verified', 'failed', 'refunded'));

-- =========================
-- 2) Function: auto-activate plan when a payment is verified
-- =========================
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
  -- Act only when status becomes 'verified' (on INSERT or UPDATE)
  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified') THEN

    -- Map plan key → tier name
    _tier := CASE
      WHEN NEW.plan IN ('basic')              THEN 'basic'
      WHEN NEW.plan IN ('standard')            THEN 'standard'
      WHEN NEW.plan IN ('premium')             THEN 'premium'
      WHEN NEW.plan IN ('ai_monthly','ai_annual') THEN 'ai_tools'
      WHEN NEW.plan IN ('service_verified')    THEN 'service_verified'
      WHEN NEW.plan IN ('service_featured')    THEN 'service_featured'
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
      ELSE 7
    END;

    _credits := CASE
      WHEN NEW.plan IN ('basic','standard') THEN 1
      WHEN NEW.plan = 'premium'             THEN 3
      ELSE 0
    END;

    _expires_at := NOW() + (_duration_days || ' days')::INTERVAL;

    -- Update the user's profile with credits & subscription
    UPDATE public.profiles
    SET
      is_premium             = true,
      subscription_tier      = _tier,
      subscription_expires_at = _expires_at,
      credits                = COALESCE(credits, 0) + _credits,
      updated_at             = NOW()
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

-- Trigger fires on both INSERT and UPDATE of status
DROP TRIGGER IF EXISTS on_payment_verified ON public.payments;
CREATE TRIGGER on_payment_verified
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_plan_on_verify();

-- =========================
-- 4) Function: decrement credits when a job posting is consumed
-- =========================
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = GREATEST(COALESCE(credits, 0) - 1, 0),
      updated_at = NOW()
  WHERE id = user_id AND COALESCE(credits, 0) > 0;
END;
$$;
