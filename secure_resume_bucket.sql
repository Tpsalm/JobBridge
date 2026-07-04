-- =========================================================================
-- JobBridge Security Hardening — Secure Resumes Storage Bucket
-- Run this in your Supabase SQL Editor to make resume files private.
-- =========================================================================

-- 1. Update resumes bucket to be private (non-public)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'resumes';

-- 2. Clean up any existing insert policies
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Applicants can upload resumes" ON storage.objects;

-- 3. Create secure upload policy (only own folder)
CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- 4. Create secure read policy (owner, authorized recruiter, or admin)
DROP POLICY IF EXISTS "Authorized users can read resumes" ON storage.objects;
CREATE POLICY "Authorized users can read resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      -- The owner of the resume can view/download it
      (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text)
      OR
      -- The recruiter who owns the job post for this application can view/download it
      EXISTS (
        SELECT 1 FROM public.applications
        JOIN public.jobs ON public.jobs.id = public.applications.job_id
        WHERE public.applications.resume_url LIKE '%' || name
          AND public.jobs.recruiter_id = auth.uid()
      )
      OR
      -- Admins can view/download all resumes
      public.is_admin()
    )
  );
