-- =========================
-- 1) Profiles
-- =========================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('recruiter', 'provider', 'job_seeker', 'admin', 'suspended')),
  company TEXT,
  phone TEXT,
  avatar_url TEXT,
  location TEXT,
  bio TEXT,
  is_premium BOOLEAN DEFAULT false,
  subscription_tier TEXT,
  subscription_expires_at TIMESTAMPTZ,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set explicit search_path for SECURITY DEFINER safety
  SET search_path = public;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'job_seeker')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- 2) Jobs
-- =========================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship')),
  salary_range TEXT,
  category TEXT,
  requirements TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- If jobs table existed without these columns, add them safely
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =========================
-- 3) Applications
-- =========================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES auth.users(id) NOT NULL,
  cover_letter TEXT,
  resume_url TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected', 'hired', 'withdrawn')),
  recruiter_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 4) Payments
-- =========================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 5) Blog subscribers
-- =========================
CREATE TABLE IF NOT EXISTS public.blog_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 6) Increment applications count
-- =========================
CREATE OR REPLACE FUNCTION public.increment_applications_count(job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SET search_path = public;

  UPDATE public.jobs
  SET applications_count = applications_count + 1
  WHERE id = job_id;
END;
$$;

-- =========================
-- 7) RLS
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_subscribers ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Jobs: anyone can read active jobs
DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
CREATE POLICY "Anyone can read active jobs"
  ON public.jobs
  FOR SELECT
  USING (is_active = true);

-- Recruiters can insert/update their jobs
DROP POLICY IF EXISTS "Recruiters can insert jobs" ON public.jobs;
CREATE POLICY "Recruiters can insert jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can update own jobs" ON public.jobs;
CREATE POLICY "Recruiters can update own jobs"
  ON public.jobs
  FOR UPDATE
  USING (auth.uid() = recruiter_id);

-- Applications: users can read own; insert own
DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;
CREATE POLICY "Users can read own applications"
  ON public.applications
  FOR SELECT
  USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
CREATE POLICY "Users can insert own applications"
  ON public.applications
  FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

-- Recruiter can read applications for their jobs
DROP POLICY IF EXISTS "Recruiters can read applications for their jobs" ON public.applications;
CREATE POLICY "Recruiters can read applications for their jobs"
  ON public.applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs
      WHERE public.jobs.id = public.applications.job_id
        AND public.jobs.recruiter_id = auth.uid()
    )
  );

-- =========================
-- 8) Storage bucket for resumes
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- NOTE: storage.objects policies depend on your Supabase setup.
DROP POLICY IF EXISTS "Anyone can read resumes" ON storage.objects;
CREATE POLICY "Anyone can read resumes"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'resumes');

DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes' AND auth.uid() IS NOT NULL
  );
