-- =========================================================================
-- JobBridge Supabase Migration — Full Schema + RLS + Storage
-- Run this in Supabase SQL Editor (Project > SQL Editor > New Query)
-- =========================================================================

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
-- 6) Helper: is_admin check
-- =========================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- =========================
-- 7) Function: increment count
-- =========================
CREATE OR REPLACE FUNCTION public.increment_applications_count(job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs
  SET applications_count = applications_count + 1
  WHERE id = job_id;
END;
$$;

-- =========================
-- 8) RLS — Row-Level Security
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_subscribers ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ── Jobs ──

DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
CREATE POLICY "Anyone can read active jobs"
  ON public.jobs FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can read all jobs" ON public.jobs;
CREATE POLICY "Admins can read all jobs"
  ON public.jobs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Recruiters can insert jobs" ON public.jobs;
CREATE POLICY "Recruiters can insert jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can update own jobs" ON public.jobs;
CREATE POLICY "Recruiters can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Admins can update jobs" ON public.jobs;
CREATE POLICY "Admins can update jobs"
  ON public.jobs FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete jobs" ON public.jobs;
CREATE POLICY "Admins can delete jobs"
  ON public.jobs FOR DELETE
  USING (public.is_admin());

-- ── Applications ──

DROP POLICY IF EXISTS "Users can read own applications" ON public.applications;
CREATE POLICY "Users can read own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
CREATE POLICY "Users can insert own applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Recruiters can read applications for their jobs" ON public.applications;
CREATE POLICY "Recruiters can read applications for their jobs"
  ON public.applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE public.jobs.id = public.applications.job_id
        AND public.jobs.recruiter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Recruiters can update applications for their jobs" ON public.applications;
CREATE POLICY "Recruiters can update applications for their jobs"
  ON public.applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE public.jobs.id = public.applications.job_id
        AND public.jobs.recruiter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all applications" ON public.applications;
CREATE POLICY "Admins can read all applications"
  ON public.applications FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update applications" ON public.applications;
CREATE POLICY "Admins can update applications"
  ON public.applications FOR UPDATE
  USING (public.is_admin());

-- ── Payments ──

DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
CREATE POLICY "Admins can read all payments"
  ON public.payments FOR SELECT
  USING (public.is_admin());

-- ── Blog Subscribers ──

DROP POLICY IF EXISTS "Anyone can subscribe to blog" ON public.blog_subscribers;
CREATE POLICY "Anyone can subscribe to blog"
  ON public.blog_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view subscribers" ON public.blog_subscribers;
CREATE POLICY "Admins can view subscribers"
  ON public.blog_subscribers FOR SELECT
  USING (public.is_admin());

-- =========================
-- 9) Storage bucket for resumes
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload only to their own folder
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Applicants can upload resumes" ON storage.objects;

CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Only owner, recruiters of the job, or admins can read resumes
DROP POLICY IF EXISTS "Authorized users can read resumes" ON storage.objects;
CREATE POLICY "Authorized users can read resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text)
      OR
      EXISTS (
        SELECT 1 FROM public.applications
        JOIN public.jobs ON public.jobs.id = public.applications.job_id
        WHERE public.applications.resume_url LIKE '%' || name
          AND public.jobs.recruiter_id = auth.uid()
      )
      OR
      public.is_admin()
    )
  );
