-- =========================================================================
-- JobBridge — Reviews & Star Ratings
--
-- WHY:
--   The Reviews page (/reviews) was static sample data and provider star
--   ratings were hardcoded. This migration creates a real `reviews` table so
--   signed-in users can leave a rating + comment, the reviews show up on the
--   Reviews page, and each provider's average rating + review count is kept
--   in sync automatically (so the star ratings on the Providers directory
--   become real, dynamic numbers).
--
-- Run in the Supabase SQL Editor (or via supabase db push).
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) service_providers: ensure a `rating` column exists for the aggregate
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Reviews table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL DEFAULT '',
  -- The profile the review is about (provider/business/profile).
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The service_providers row when reviewing a provider (kept in sync below).
  provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL DEFAULT 'provider'
    CHECK (target_type IN ('provider', 'business', 'profile')),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A user can rate a target only once (they can edit/delete their review).
  CONSTRAINT reviews_reviewer_reviewee_unique UNIQUE (reviewer_id, reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON public.reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Keep provider rating + review count in sync
-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the trigger can write service_providers even though RLS
-- only allows admin reads there.
CREATE OR REPLACE FUNCTION public.recalc_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id UUID;
  v_avg NUMERIC;
  v_cnt BIGINT;
BEGIN
  -- Prefer an explicit provider_id, otherwise resolve the service_providers
  -- row from the reviewed profile so client-side code only needs a profile id.
  v_provider_id := COALESCE(NEW.provider_id, OLD.provider_id);
  IF v_provider_id IS NULL THEN
    SELECT id INTO v_provider_id
      FROM public.service_providers
     WHERE profile_id = COALESCE(NEW.reviewee_id, OLD.reviewee_id)
     LIMIT 1;
  END IF;

  IF v_provider_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO v_avg, v_cnt
    FROM public.reviews
   WHERE provider_id = v_provider_id
      OR reviewee_id = (
        SELECT profile_id FROM public.service_providers WHERE id = v_provider_id
      );

  UPDATE public.service_providers
     SET rating = COALESCE(v_avg, 0),
         reviews_count = COALESCE(v_cnt, 0)::int,
         updated_at = now()
   WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_provider_rating ON public.reviews;
CREATE TRIGGER trg_recalc_provider_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_provider_rating();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) can read reviews.
DROP POLICY IF EXISTS "Public can read reviews" ON public.reviews;
CREATE POLICY "Public can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Signed-in users can leave a review (must be themselves + a valid rating).
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND rating BETWEEN 1 AND 5
  );

-- Reviewers can update their own review.
DROP POLICY IF EXISTS "Reviewers can update their own reviews" ON public.reviews;
CREATE POLICY "Reviewers can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id AND rating BETWEEN 1 AND 5);

-- Reviewers can delete their own review.
DROP POLICY IF EXISTS "Reviewers can delete their own reviews" ON public.reviews;
CREATE POLICY "Reviewers can delete their own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- Admins can moderate any review.
DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.reviews;
CREATE POLICY "Admins can moderate reviews"
  ON public.reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
