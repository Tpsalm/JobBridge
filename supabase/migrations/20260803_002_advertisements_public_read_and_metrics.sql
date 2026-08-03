-- =========================================================================
-- JobBridge — Public advertisement reads + view/click metrics
--
-- WHY:
--   1) Adverts should be visible to EVERYONE — including brand-new accounts
--      and anonymous visitors. The previous schema only allowed the owner or
--      an admin to SELECT advertisements, so the client-side fallback query
--      in fetchPublicAdvertisements() failed for anyone who wasn't the owner.
--      This adds a public SELECT policy for active advertisements (the
--      service-role /api/get-advertisements endpoint already bypasses RLS).
--
--   2) "Total views" and "total clicks" were always 0 because nothing ever
--      incremented the counters. We add SECURITY DEFINER RPCs so impressions
--      and clicks can be tracked from ANY client (anonymous visitors included)
--      without opening the table to arbitrary updates by non-owners.
--
-- Run in the Supabase SQL Editor (or via supabase db push).
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Public read: anyone can SELECT active advertisements
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view active advertisements" ON public.advertisements;
CREATE POLICY "Anyone can view active advertisements"
  ON public.advertisements FOR SELECT
  USING (status = 'active');

-- ─────────────────────────────────────────────────────────────────────────
-- 2) SECURITY DEFINER counters (views + clicks)
-- ─────────────────────────────────────────────────────────────────────────
-- These run with the privileges of the function owner (the table owner), so
-- they bypass RLS and can bump the counters for any ad — even when the caller
-- is anonymous. The update is limited to the single counter column so no other
-- advertisement data can be altered through them.
CREATE OR REPLACE FUNCTION public.increment_advertisement_views(ad_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.advertisements
  SET views = COALESCE(views, 0) + 1
  WHERE id = ad_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_advertisement_clicks(ad_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.advertisements
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = ad_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_advertisement_views(UUID)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_advertisement_clicks(UUID)
  TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- ─────────────────────────────────────────────────────────────────────────
-- Public read policy:
--   SELECT policyname FROM pg_policies WHERE tablename = 'advertisements';
--
-- Test counters (as any role):
--   SELECT public.increment_advertisement_views('<ad_id>');
--   SELECT public.increment_advertisement_clicks('<ad_id>');
-- =========================================================================
