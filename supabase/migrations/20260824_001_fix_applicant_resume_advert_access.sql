-- Fix recruiter applicant visibility, private resume downloads, and advert replacement.

-- Recruiters may read only profiles attached to applications for their own jobs.
DROP POLICY IF EXISTS "Recruiters can read applicant profiles" ON public.profiles;
CREATE POLICY "Recruiters can read applicant profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications
      JOIN public.jobs ON public.jobs.id = public.applications.job_id
      WHERE public.applications.applicant_id = public.profiles.id
        AND public.jobs.recruiter_id = auth.uid()
    )
  );

-- Owners must be able to remove their own adverts, including expired adverts.
DROP POLICY IF EXISTS "Users can delete own advertisements" ON public.advertisements;
CREATE POLICY "Users can delete own advertisements"
  ON public.advertisements FOR DELETE
  USING (auth.uid() = owner_id OR public.is_admin());

-- Private resume bucket access: applicants and the recruiter owning the job may read.
DROP POLICY IF EXISTS "Authorized users can read resumes" ON storage.objects;
CREATE POLICY "Authorized users can read resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.applications
        JOIN public.jobs ON public.jobs.id = public.applications.job_id
        WHERE public.applications.resume_url LIKE '%' || name
          AND public.jobs.recruiter_id = auth.uid()
      )
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;
CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND split_part(name, '/', 1) = auth.uid()::text);

-- Keep application and recruiter lookups fast as traffic grows.
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON public.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON public.jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);