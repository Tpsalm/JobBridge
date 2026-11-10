ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS application_url TEXT;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_type_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_type_check
  CHECK (type IN ('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Entry level', 'NYSC'));
