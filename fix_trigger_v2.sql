-- =========================================================================
-- JobBridge Fix: Drop broken auth.users trigger via CASCADE
-- Run this ENTIRE script in Supabase SQL Editor
-- =========================================================================

-- Drop the trigger function CASCADE — this removes both the function
-- AND any triggers referencing it, even on auth.users
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Verify: check that no trigger remains
SELECT tgname FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname = 'auth' AND relname = 'users' AND tgname = 'on_auth_user_created';

-- Recreate function (without trigger on auth.users)
-- Profile creation is handled client-side by AuthContext.createProfileRecord
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'job_seeker')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: % (state: %)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Recreate is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
