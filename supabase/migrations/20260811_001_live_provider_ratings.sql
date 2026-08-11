-- =========================================================================
-- JobBridge — Live provider ratings everywhere
--
-- WHY:
--   1) The Providers directory showed the SAME hardcoded 4.8 star rating for
--      EVERY provider (featured, verified and standard alike) because the
--      server API never returned the real `rating` aggregate and profiles had
--      no `rating` column to read from.
--   2) The reviews recalc trigger only wrote the aggregate into
--      `service_providers`, so providers that live only in `profiles`
--      (role='provider' without a service_providers row) never got a live
--      rating either.
--
-- This migration:
--   * Adds a `rating` column to profiles (mirroring service_providers).
--   * Rewrites the recalc trigger so a review/update/delete refreshes BOTH
--     the service_providers row AND the linked profiles row.
--   * Backfills existing ratings + review counts for every provider so the
--     numbers are accurate immediately, not just from the next review.
--
-- Idempotent — safe to run via `supabase db push` or the SQL Editor.
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) profiles: ensure rating + reviews_count columns exist
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Rewrite the recalc trigger to sync service_providers AND profiles
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id UUID;
  v_profile_id  UUID;
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

  -- Resolve the profile id for the same target so profiles stay in sync.
  IF v_provider_id IS NOT NULL THEN
    SELECT profile_id INTO v_profile_id
      FROM public.service_providers
     WHERE id = v_provider_id;
  END IF;
  IF v_profile_id IS NULL THEN
    v_profile_id := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  END IF;

  IF v_provider_id IS NULL AND v_profile_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Aggregate all reviews for this provider (by provider_id or reviewee profile).
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO v_avg, v_cnt
    FROM public.reviews
   WHERE provider_id = v_provider_id
      OR reviewee_id = v_profile_id;

  -- Keep service_providers.rating in sync (when a row exists).
  IF v_provider_id IS NOT NULL THEN
    UPDATE public.service_providers
       SET rating = COALESCE(v_avg, 0),
           reviews_count = COALESCE(v_cnt, 0)::int,
           updated_at = now()
     WHERE id = v_provider_id;
  END IF;

  -- Keep profiles.rating in sync so profile-only providers get live ratings.
  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
       SET rating = COALESCE(v_avg, 0),
           reviews_count = COALESCE(v_cnt, 0)::int,
           updated_at = now()
     WHERE id = v_profile_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_provider_rating ON public.reviews;
CREATE TRIGGER trg_recalc_provider_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_provider_rating();

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Backfill: compute live ratings for every provider from existing reviews
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  v_avg NUMERIC;
  v_cnt BIGINT;
BEGIN
  FOR r IN
    SELECT sp.id AS provider_id, sp.profile_id
      FROM public.service_providers sp
    UNION
    SELECT NULL, p.id
      FROM public.profiles p
     WHERE p.role = 'provider'
  LOOP
    SELECT ROUND(AVG(rv.rating)::numeric, 2), COUNT(*)
      INTO v_avg, v_cnt
      FROM public.reviews rv
     WHERE rv.provider_id = r.provider_id
        OR rv.reviewee_id = r.profile_id;

    IF r.provider_id IS NOT NULL THEN
      UPDATE public.service_providers
         SET rating = COALESCE(v_avg, 0),
             reviews_count = COALESCE(v_cnt, 0)::int,
             updated_at = now()
       WHERE id = r.provider_id;
    END IF;

    IF r.profile_id IS NOT NULL THEN
      UPDATE public.profiles
         SET rating = COALESCE(v_avg, 0),
             reviews_count = COALESCE(v_cnt, 0)::int,
             updated_at = now()
       WHERE id = r.profile_id;
    END IF;
  END LOOP;
END $$;
