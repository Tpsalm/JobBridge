-- Add a JSONB column to store dynamic profile sections
-- (experience, education, honors, languages, etc.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_sections JSONB DEFAULT '{}'::jsonb;

-- Grant access for authenticated users to read/write their own profile_sections
-- (RLS policies should already cover this; this ensures the column is accessible)
COMMENT ON COLUMN public.profiles.profile_sections IS
  'Stores dynamic profile section data such as experience entries, education history, honors/awards, and languages as a JSON object.';
