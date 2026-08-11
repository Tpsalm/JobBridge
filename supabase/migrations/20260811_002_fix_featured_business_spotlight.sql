-- =========================================================================
-- JobBridge — Fix Featured Business ads missing from the homepage spotlight
--
-- ROOT CAUSE: A "Featured Business" ad is created with `is_featured = true`,
-- but the `package` column can still read 'weekly' or 'monthly' when the owner
-- toggled "featured" on a base plan (src/pages/Business.tsx sets
-- is_featured = formData.package === 'Featured Business' || formData.featured).
-- The homepage spotlight filters strictly on package = 'featured', so those
-- paid featured ads never appear. `is_featured` is the authoritative flag.
--
-- FIX: Normalize existing rows so any advert flagged `is_featured = true`
-- also carries `package = 'featured'`, making the data consistent for every
-- surface (homepage spotlight, Business page buckets, featured ranking).
-- The client-side code was also updated to treat `is_featured` as the
-- authoritative indicator, so this is a belt-and-suspenders backfill.
-- =========================================================================

UPDATE public.advertisements
SET package = 'featured',
    updated_at = COALESCE(updated_at, now())
WHERE is_featured = true
  AND (package IS NULL OR package <> 'featured');

-- VERIFICATION:
--   SELECT id, title, business_name, package, is_featured, payment_status, status
--   FROM public.advertisements
--   WHERE is_featured = true;
