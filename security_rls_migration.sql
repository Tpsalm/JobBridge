-- =========================================================================
-- JobBridge Security Hardening — RLS Policies
-- =========================================================================

-- ═════════════════════════════════════════════════════════════════════════
-- 1) admin_events table (missing from original migration)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;

-- Anyone with the anon key can INSERT (needed for admin dashboard which uses anon key)
DROP POLICY IF EXISTS "Public can insert admin events" ON public.admin_events;
CREATE POLICY "Public can insert admin events"
  ON public.admin_events FOR INSERT
  WITH CHECK (true);

-- Anyone with the anon key can SELECT (needed for admin dashboard)
DROP POLICY IF EXISTS "Public can read admin events" ON public.admin_events;
CREATE POLICY "Public can read admin events"
  ON public.admin_events FOR SELECT
  USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON public.admin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_action_type ON public.admin_events(action_type);

-- ═════════════════════════════════════════════════════════════════════════
-- 2) contact_messages table (for Contact.tsx form submissions)
-- ═════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT 'general',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (contact form is public)
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Only admins can read contact messages
DROP POLICY IF EXISTS "Admins can read contact messages" ON public.contact_messages;
CREATE POLICY "Admins can read contact messages"
  ON public.contact_messages FOR SELECT
  USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════
-- 3) Missing ADMIN DELETE policies
-- ═════════════════════════════════════════════════════════════════════════

-- Profiles: Admins can DELETE
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Applications: Admins can DELETE
DROP POLICY IF EXISTS "Admins can delete applications" ON public.applications;
CREATE POLICY "Admins can delete applications"
  ON public.applications FOR DELETE
  USING (public.is_admin());

-- Payments: Admins can UPDATE (verify/fail/refund) and DELETE
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (public.is_admin());

-- Service providers: Admins can UPDATE (verify) and DELETE
DROP POLICY IF EXISTS "Admins can update providers" ON public.service_providers;
CREATE POLICY "Admins can update providers"
  ON public.service_providers FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete providers" ON public.service_providers;
CREATE POLICY "Admins can delete providers"
  ON public.service_providers FOR DELETE
  USING (public.is_admin());

-- Advertisements: Admins can UPDATE and DELETE
DROP POLICY IF EXISTS "Admins can update ads" ON public.advertisements;
CREATE POLICY "Admins can update ads"
  ON public.advertisements FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete ads" ON public.advertisements;
CREATE POLICY "Admins can delete ads"
  ON public.advertisements FOR DELETE
  USING (public.is_admin());

-- Notifications: Admins can INSERT, DELETE
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE
  USING (public.is_admin());

-- Blog subscribers: Admins can DELETE
DROP POLICY IF EXISTS "Admins can delete subscribers" ON public.blog_subscribers;
CREATE POLICY "Admins can delete subscribers"
  ON public.blog_subscribers FOR DELETE
  USING (public.is_admin());

-- Conversations: Admins can DELETE (for moderation)
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversations;
CREATE POLICY "Admins can delete conversations"
  ON public.conversations FOR DELETE
  USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════
-- 4) Rate limiting: Function to check failed login attempts
-- ═════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recent_attempts INT;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO recent_attempts
  FROM public.admin_events
  WHERE action_type = 'login_failed'
    AND details->>'reason' = 'bad_credentials'
    AND created_at > now() - INTERVAL '15 minutes';

  IF recent_attempts >= 5 THEN
    result := jsonb_build_object('allowed', false, 'attempts', recent_attempts, 'message', 'Too many failed attempts. Try again later.');
  ELSE
    result := jsonb_build_object('allowed', true, 'attempts', recent_attempts);
  END IF;

  RETURN result;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- 5) Add indexes for performance
-- ═════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON public.jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON public.jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON public.jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON public.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant1_id, participant2_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 6) Storage bucket for profile images with proper policies
-- ═════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
CREATE POLICY "Users can upload own profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Users can update/delete their own images
DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
CREATE POLICY "Users can update own profile images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own profile images" ON storage.objects;
CREATE POLICY "Users can delete own profile images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Public can read all profile images
DROP POLICY IF EXISTS "Public can read profile images" ON storage.objects;
CREATE POLICY "Public can read profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');
