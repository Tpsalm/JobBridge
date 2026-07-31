-- =========================================================================
-- JobBridge — Make advertisements from subscribed business users publicly
-- visible to ALL users (both new and existing accounts).
--
-- WHY: Previously the advertisements RLS only allowed the OWNER (or admin)
-- to SELECT adverts. This meant a business user who subscribed to the
-- Business Advertisement package and successfully created an advert could
-- only see it themselves — other users (including brand new accounts)
-- could not see it at all.
--
-- This migration adds a public SELECT policy for ACTIVE advertisements so
-- every user (authenticated or anonymous visitor) can see the posts that
-- subscribed business users have created. Owners and admins keep their
-- existing read access.
-- =========================================================================

-- Allow anyone to read active advertisements (public marketplace content)
DROP POLICY IF EXISTS "Anyone can read active advertisements" ON public.advertisements;
CREATE POLICY "Anyone can read active advertisements"
  ON public.advertisements FOR SELECT
  USING (status = 'active');

-- Allow anonymous (not-yet-signed-in) visitors to read active advertisements too
DROP POLICY IF EXISTS "Anon can read active advertisements" ON public.advertisements;
CREATE POLICY "Anon can read active advertisements"
  ON public.advertisements FOR SELECT
  USING (status = 'active');

-- Sanity check helpers:
--   SELECT * FROM pg_policies WHERE tablename = 'advertisements';
-- =========================================================================
