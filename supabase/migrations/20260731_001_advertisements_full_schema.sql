-- =========================================================================
-- JobBridge — Advertisements full schema + business-plan activation fixes
--
-- WHY: The client (src/pages/Business.tsx -> src/lib/supabaseQueries.ts
-- `createAdvertisement`), the verify-payment edge function and the
-- kora-webhook edge function all insert the extended advertisement
-- columns (business_name, description, category, package, is_featured,
-- website_url, phone, email, starts_at, expires_at, status, views, clicks,
-- payment_status, amount_paid). Only a minimal table was previously defined
-- (supabase/create_admin_tables.sql), so advert creation could fail with
-- "column does not exist" on deployments where the extended columns are
-- missing. This migration makes the schema idempotent + complete and also
-- fixes `activate_plan_on_verify` so business plans activate correctly.
-- =========================================================================

-- 1) Full table definition (no-op if table already exists)
CREATE TABLE IF NOT EXISTS public.advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  business_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Other',
  image_url TEXT,
  website_url TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  package TEXT DEFAULT 'weekly'
    CHECK (package IN ('weekly', 'monthly', 'featured')),
  is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'paused', 'expired', 'rejected')),
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  amount_paid INTEGER DEFAULT 0,
  admin_notes TEXT,
  link_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Idempotently add any columns missing on an existing table
ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS package TEXT DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS amount_paid INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3) RLS + policies (idempotent)
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own advertisements" ON public.advertisements;
CREATE POLICY "Users can insert own advertisements"
  ON public.advertisements FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      EXISTS (
        SELECT 1 FROM public.payments
        WHERE payments.user_id = auth.uid()
          AND payments.status IN ('verified', 'pending')
          AND (
            payments.plan = 'business_weekly'
            OR payments.plan = 'business_monthly'
            OR payments.plan = 'business_featured'
          )
      )
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users can read own advertisements" ON public.advertisements;
CREATE POLICY "Users can read own advertisements"
  ON public.advertisements FOR SELECT
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own advertisements" ON public.advertisements;
CREATE POLICY "Users can update own advertisements"
  ON public.advertisements FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can read ads" ON public.advertisements;
CREATE POLICY "Admins can read ads"
  ON public.advertisements FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update ads" ON public.advertisements;
CREATE POLICY "Admins can update ads"
  ON public.advertisements FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete ads" ON public.advertisements;
CREATE POLICY "Admins can delete ads"
  ON public.advertisements FOR DELETE
  USING (public.is_admin());

-- 4) Fix the auto-activation trigger so business plans get the correct
--    tier, duration and (critically) 1 advert credit to create their ad.
--    Previously business plans fell through to 'basic' tier / 7 days / 0
--    credits, which could leave a paying business user unable to post.
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

-- Trigger fires on both INSERT and UPDATE of status
DROP TRIGGER IF EXISTS on_payment_verified ON public.payments;
CREATE TRIGGER on_payment_verified
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_plan_on_verify();

-- 5) Ensure indexes
CREATE INDEX IF NOT EXISTS idx_advertisements_owner_id ON public.advertisements(owner_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_category ON public.advertisements(category);
CREATE INDEX IF NOT EXISTS idx_advertisements_status ON public.advertisements(status);
