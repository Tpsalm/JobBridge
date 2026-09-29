ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_category TEXT;

CREATE TABLE IF NOT EXISTS public.service_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  specialty TEXT,
  hourly_rate INTEGER,
  reviews_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_profile_id
  ON public.service_providers(profile_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  service_category_value TEXT;
  specialty_value TEXT;
BEGIN
  user_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('recruiter', 'provider', 'job_seeker')
      THEN NEW.raw_user_meta_data->>'role'
    ELSE 'job_seeker'
  END;
  service_category_value := NULLIF(NEW.raw_user_meta_data->>'service_category', '');
  specialty_value := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'specialty', ''),
    service_category_value,
    'Service Professional'
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, company, phone, location, service_category
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role,
    NULLIF(NEW.raw_user_meta_data->>'company', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'location', ''),
    service_category_value
  )
  ON CONFLICT (id) DO NOTHING;

  IF user_role = 'provider' THEN
    INSERT INTO public.service_providers (profile_id, specialty)
    SELECT NEW.id, specialty_value
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.service_providers
      WHERE profile_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();