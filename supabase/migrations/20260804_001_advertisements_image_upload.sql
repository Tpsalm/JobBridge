-- =========================================================================
-- JobBridge — Advertisements image upload bucket + storage policies
--
-- WHY: Business plan subscribers can now attach a business picture to their
-- advert from the Business page (src/pages/Business.tsx). This creates a
-- public 'advertisements' storage bucket and RLS policies that mirror the
-- existing 'profile-images' bucket: authenticated users can upload / update /
-- delete their own images while anyone (including anonymous visitors and
-- brand-new accounts) can view them so the public showcase renders photos.
--
-- Run in the Supabase SQL Editor (or via supabase db push).
-- =========================================================================

-- 1) Create the bucket (no-op if it already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Users can upload to their own folder (folder = user id)
DROP POLICY IF EXISTS "Users can upload own advertisement images" ON storage.objects;
CREATE POLICY "Users can upload own advertisement images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'advertisements'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 3) Users can update their own images
DROP POLICY IF EXISTS "Users can update own advertisement images" ON storage.objects;
CREATE POLICY "Users can update own advertisement images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'advertisements'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 4) Users can delete their own images
DROP POLICY IF EXISTS "Users can delete own advertisement images" ON storage.objects;
CREATE POLICY "Users can delete own advertisement images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'advertisements'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 5) Public can read all advertisement images
DROP POLICY IF EXISTS "Public can read advertisement images" ON storage.objects;
CREATE POLICY "Public can read advertisement images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'advertisements');

-- =========================================================================
-- VERIFICATION:
--   SELECT id, name, public FROM storage.buckets WHERE name = 'advertisements';
--   SELECT policyname, operation FROM pg_policies
--     WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE '%advertisement%';
-- =========================================================================
