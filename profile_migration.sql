ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS is_disabled TEXT,
  ADD COLUMN IF NOT EXISTS is_displaced TEXT,
  ADD COLUMN IF NOT EXISTS professional_headline TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience TEXT,
  ADD COLUMN IF NOT EXISTS function TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS salary_expectation TEXT;
