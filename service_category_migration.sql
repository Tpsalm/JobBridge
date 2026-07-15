-- =========================================================================
-- Add service_category column to profiles for provider category tracking
-- Run this in Supabase SQL Editor after the main migration
-- =========================================================================

-- Add the column (safe to re-run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_category TEXT;

-- Update the auto-profile trigger to also store service_category
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, service_category)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'job_seeker'),
    NEW.raw_user_meta_data->>'service_category'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: % (state: %)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;
