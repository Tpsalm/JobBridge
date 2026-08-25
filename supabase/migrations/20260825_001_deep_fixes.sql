-- Deep fixes for recruiter applications, provider ratings and advert credits.

-- Keep business advert entitlements separate from job/legacy credits.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS advert_credits INTEGER NOT NULL DEFAULT 0;

-- Existing business subscriptions previously received their entitlement in
-- the shared credits column. Preserve that entitlement during the migration.
UPDATE public.profiles
   SET advert_credits = GREATEST(COALESCE(advert_credits, 0), COALESCE(credits, 0)),
       updated_at = now()
 WHERE subscription_tier IN ('business_weekly', 'business_monthly', 'business_featured')
   AND COALESCE(advert_credits, 0) = 0;

-- Atomic, product-specific consumption. A zero-row update means no credit.
CREATE OR REPLACE FUNCTION public.consume_advert_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  consumed BOOLEAN;
BEGIN
  UPDATE public.profiles
     SET advert_credits = advert_credits - 1,
         updated_at = now()
   WHERE id = p_user_id
     AND COALESCE(advert_credits, 0) > 0;
  consumed := FOUND;
  RETURN consumed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_advert_credit(UUID) TO authenticated;

-- A verified business payment grants exactly one advert entitlement without
-- changing credits reserved for jobs or other products.
CREATE OR REPLACE FUNCTION public.grant_business_advert_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified')
     AND NEW.plan IN ('business_weekly', 'business_monthly', 'business_featured') THEN
    UPDATE public.profiles
       SET advert_credits = COALESCE(advert_credits, 0) + 1,
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_advert_credit ON public.payments;
CREATE TRIGGER on_business_advert_credit
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_business_advert_credit();

-- Return only applications belonging to jobs owned by the signed-in recruiter.
-- SECURITY DEFINER avoids nested RLS joins hiding the applicant profile.
CREATE OR REPLACE FUNCTION public.get_recruiter_applications()
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'job_id', a.job_id,
    'applicant_id', a.applicant_id,
    'cover_letter', a.cover_letter,
    'resume_url', a.resume_url,
    'status', a.status,
    'recruiter_notes', a.recruiter_notes,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'job', to_jsonb(j),
    'applicant', to_jsonb(p)
  )
  FROM public.applications a
  JOIN public.jobs j ON j.id = a.job_id
  JOIN public.profiles p ON p.id = a.applicant_id
  WHERE j.recruiter_id = auth.uid()
  ORDER BY a.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_recruiter_applications() TO authenticated;

-- Aggregate reviews by the exact reviewed profile. Do not combine a provider
-- row and an unrelated reviewee row through an OR predicate.
CREATE OR REPLACE FUNCTION public.recalc_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile_id UUID := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  target_provider_id UUID := COALESCE(NEW.provider_id, OLD.provider_id);
  average_rating NUMERIC;
  review_count BIGINT;
BEGIN
  IF target_provider_id IS NULL THEN
    SELECT id INTO target_provider_id
      FROM public.service_providers
     WHERE profile_id = target_profile_id
     LIMIT 1;
  END IF;

  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO average_rating, review_count
    FROM public.reviews
   WHERE reviewee_id = target_profile_id;

  IF target_provider_id IS NOT NULL THEN
    UPDATE public.service_providers
       SET rating = COALESCE(average_rating, 0),
           reviews_count = COALESCE(review_count, 0)::int,
           updated_at = now()
     WHERE id = target_provider_id;
  END IF;

  UPDATE public.profiles
     SET rating = COALESCE(average_rating, 0),
         reviews_count = COALESCE(review_count, 0)::int,
         updated_at = now()
   WHERE id = target_profile_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;