-- Preserve the information supplied for each job application.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS is_disabled TEXT,
  ADD COLUMN IF NOT EXISTS is_displaced TEXT,
  ADD COLUMN IF NOT EXISTS professional_headline TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience TEXT,
  ADD COLUMN IF NOT EXISTS function TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS salary_expectation TEXT;

-- Keep historical applications useful when the applicant profile already has
-- the answers that were previously collected but not stored on the application.
UPDATE public.applications a
SET date_of_birth = COALESCE(a.date_of_birth, p.date_of_birth),
    gender = COALESCE(a.gender, p.gender),
    is_disabled = COALESCE(a.is_disabled, p.is_disabled),
    is_displaced = COALESCE(a.is_displaced, p.is_displaced),
    professional_headline = COALESCE(a.professional_headline, p.professional_headline),
    years_of_experience = COALESCE(a.years_of_experience, p.years_of_experience),
    function = COALESCE(a.function, p.function),
    work_type = COALESCE(a.work_type, p.work_type),
    highest_qualification = COALESCE(a.highest_qualification, p.highest_qualification),
    location = COALESCE(a.location, p.location),
    availability = COALESCE(a.availability, p.availability),
    salary_expectation = COALESCE(a.salary_expectation, p.salary_expectation)
FROM public.profiles p
WHERE p.id = a.applicant_id;

CREATE INDEX IF NOT EXISTS idx_applications_location ON public.applications(location);
CREATE INDEX IF NOT EXISTS idx_applications_work_type ON public.applications(work_type);

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
    'date_of_birth', a.date_of_birth,
    'gender', a.gender,
    'is_disabled', a.is_disabled,
    'is_displaced', a.is_displaced,
    'professional_headline', a.professional_headline,
    'years_of_experience', a.years_of_experience,
    'function', a.function,
    'work_type', a.work_type,
    'highest_qualification', a.highest_qualification,
    'location', a.location,
    'availability', a.availability,
    'salary_expectation', a.salary_expectation,
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