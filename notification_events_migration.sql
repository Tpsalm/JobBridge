-- =========================================================================
-- Notification Events + Job Alerts Migration
-- Run this in Supabase SQL Editor after notifications_realtime_migration.sql
-- Prerequisites:
--   1) supabase_migration.sql (base schema + is_admin())
--   2) profile_migration.sql (extended profile fields used for milestones)
--   3) notifications_realtime_migration.sql (public.notifications)
-- =========================================================================

-- =====================================
-- 1) Job alerts table
-- =====================================
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  location TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, query, location)
);

ALTER TABLE public.job_alerts REPLICA IDENTITY FULL;

ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own job alerts" ON public.job_alerts;
CREATE POLICY "Users can read own job alerts"
  ON public.job_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own job alerts" ON public.job_alerts;
CREATE POLICY "Users can insert own job alerts"
  ON public.job_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own job alerts" ON public.job_alerts;
CREATE POLICY "Users can update own job alerts"
  ON public.job_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own job alerts" ON public.job_alerts;
CREATE POLICY "Users can delete own job alerts"
  ON public.job_alerts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_alerts_user_id ON public.job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_user_enabled ON public.job_alerts(user_id, enabled);

CREATE OR REPLACE FUNCTION public.set_job_alert_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_job_alert_updated_at ON public.job_alerts;
CREATE TRIGGER set_job_alert_updated_at
  BEFORE UPDATE ON public.job_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_alert_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'job_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_alerts;
  END IF;
END
$$;

-- =====================================
-- 2) Helper to insert notifications safely from triggers/admin functions
-- =====================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, content, data)
  VALUES (p_user_id, p_type, p_title, p_content, COALESCE(p_data, '{}'::jsonb))
  RETURNING id INTO _notification_id;

  RETURN _notification_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- =====================================
-- 3) Application notifications
-- =====================================
CREATE OR REPLACE FUNCTION public.notify_on_application_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _job RECORD;
BEGIN
  SELECT id, title, company, recruiter_id
  INTO _job
  FROM public.jobs
  WHERE id = NEW.job_id;

  IF _job.id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.applicant_id,
    'job_application',
    'Application submitted',
    format('Your application for %s at %s has been submitted successfully.', _job.title, _job.company),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'status', NEW.status,
      'company', _job.company,
      'title', _job.title
    )
  );

  PERFORM public.create_notification(
    _job.recruiter_id,
    'job_application',
    'New application received',
    format('A new candidate applied for %s at %s.', _job.title, _job.company),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'status', NEW.status,
      'applicant_id', NEW.applicant_id,
      'company', _job.company,
      'title', _job.title
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_application_created_notify ON public.applications;
CREATE TRIGGER on_application_created_notify
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_application_created();

CREATE OR REPLACE FUNCTION public.notify_on_application_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _job RECORD;
  _title TEXT;
  _content TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id, title, company
  INTO _job
  FROM public.jobs
  WHERE id = NEW.job_id;

  IF _job.id IS NULL THEN
    RETURN NEW;
  END IF;

  _title := CASE NEW.status
    WHEN 'reviewed' THEN 'Application reviewed'
    WHEN 'shortlisted' THEN 'You were shortlisted'
    WHEN 'rejected' THEN 'Application update'
    WHEN 'hired' THEN 'Congratulations! You were hired'
    WHEN 'withdrawn' THEN 'Application withdrawn'
    ELSE 'Application status changed'
  END;

  _content := CASE NEW.status
    WHEN 'reviewed' THEN format('Your application for %s at %s has been reviewed.', _job.title, _job.company)
    WHEN 'shortlisted' THEN format('Good news! You have been shortlisted for %s at %s.', _job.title, _job.company)
    WHEN 'rejected' THEN format('Your application for %s at %s was not selected this time.', _job.title, _job.company)
    WHEN 'hired' THEN format('Congratulations! You were hired for %s at %s.', _job.title, _job.company)
    WHEN 'withdrawn' THEN format('Your application for %s at %s has been withdrawn.', _job.title, _job.company)
    ELSE format('Your application for %s at %s is now %s.', _job.title, _job.company, NEW.status)
  END;

  PERFORM public.create_notification(
    NEW.applicant_id,
    'job_application',
    _title,
    _content,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'status', NEW.status,
      'previous_status', OLD.status,
      'company', _job.company,
      'title', _job.title
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_application_status_changed_notify ON public.applications;
CREATE TRIGGER on_application_status_changed_notify
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_application_status_changed();

-- =====================================
-- 4) Job alert notifications for newly posted jobs
-- =====================================
CREATE OR REPLACE FUNCTION public.notify_matching_job_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, content, data)
  SELECT
    ja.user_id,
    'system',
    'New job match',
    format('%s at %s matches one of your job alerts.', NEW.title, NEW.company),
    jsonb_build_object(
      'job_id', NEW.id,
      'company', NEW.company,
      'title', NEW.title,
      'location', NEW.location,
      'type', NEW.type,
      'query', ja.query,
      'alert_id', ja.id
    )
  FROM public.job_alerts ja
  WHERE ja.enabled = true
    AND (
      trim(ja.query) = ''
      OR NEW.title ILIKE '%' || ja.query || '%'
      OR NEW.company ILIKE '%' || ja.query || '%'
      OR COALESCE(NEW.description, '') ILIKE '%' || ja.query || '%'
    )
    AND (
      trim(COALESCE(ja.location, '')) = ''
      OR COALESCE(NEW.location, '') ILIKE '%' || ja.location || '%'
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_job_created_notify_alerts ON public.jobs;
DROP TRIGGER IF EXISTS on_job_published_notify_alerts ON public.jobs;

CREATE TRIGGER on_job_created_notify_alerts
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.notify_matching_job_alerts();

CREATE TRIGGER on_job_published_notify_alerts
  AFTER UPDATE OF is_active ON public.jobs
  FOR EACH ROW
  WHEN (NEW.is_active = true AND COALESCE(OLD.is_active, false) = false)
  EXECUTE FUNCTION public.notify_matching_job_alerts();

-- =====================================
-- 5) Profile completion milestone notifications
-- =====================================
CREATE OR REPLACE FUNCTION public.profile_completion_percent(
  p_full_name TEXT,
  p_phone TEXT,
  p_date_of_birth TEXT,
  p_gender TEXT,
  p_location TEXT,
  p_professional_headline TEXT,
  p_years_of_experience TEXT,
  p_function TEXT,
  p_work_type TEXT,
  p_highest_qualification TEXT,
  p_availability TEXT,
  p_salary_expectation TEXT,
  p_bio TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _filled_count INTEGER := 0;
  _total_count INTEGER := 13;
BEGIN
  _filled_count :=
    CASE WHEN COALESCE(trim(p_full_name), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_phone), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_date_of_birth), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_gender), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_location), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_professional_headline), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_years_of_experience), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_function), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_work_type), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_highest_qualification), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_availability), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_salary_expectation), '') <> '' THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(trim(p_bio), '') <> '' THEN 1 ELSE 0 END;

  RETURN FLOOR((_filled_count::NUMERIC / _total_count::NUMERIC) * 100)::INTEGER;
END;
$$;

DELETE FROM public.notifications a
USING public.notifications b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.type = 'system'
  AND b.type = 'system'
  AND a.data ? 'milestone'
  AND b.data ? 'milestone'
  AND a.data->>'milestone' = b.data->>'milestone';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_profile_milestone_unique
  ON public.notifications (user_id, (data->>'milestone'))
  WHERE type = 'system' AND data ? 'milestone';

CREATE OR REPLACE FUNCTION public.notify_profile_completion_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _old_pct INTEGER := 0;
  _new_pct INTEGER := 0;
BEGIN
  _new_pct := public.profile_completion_percent(
    NEW.full_name,
    NEW.phone,
    NEW.date_of_birth,
    NEW.gender,
    NEW.location,
    NEW.professional_headline,
    NEW.years_of_experience,
    NEW.function,
    NEW.work_type,
    NEW.highest_qualification,
    NEW.availability,
    NEW.salary_expectation,
    NEW.bio
  );

  IF TG_OP = 'UPDATE' THEN
    _old_pct := public.profile_completion_percent(
      OLD.full_name,
      OLD.phone,
      OLD.date_of_birth,
      OLD.gender,
      OLD.location,
      OLD.professional_headline,
      OLD.years_of_experience,
      OLD.function,
      OLD.work_type,
      OLD.highest_qualification,
      OLD.availability,
      OLD.salary_expectation,
      OLD.bio
    );
  END IF;

  IF _new_pct >= 80 AND _old_pct < 80 THEN
    INSERT INTO public.notifications (user_id, type, title, content, data)
    VALUES (
      NEW.id,
      'system',
      'Profile milestone reached',
      'Your profile is now at least 80% complete. Recruiters can discover you more easily.',
      jsonb_build_object('milestone', '80', 'completion_percent', _new_pct)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF _new_pct = 100 AND _old_pct < 100 THEN
    INSERT INTO public.notifications (user_id, type, title, content, data)
    VALUES (
      NEW.id,
      'system',
      'Profile complete',
      'Your profile is now 100% complete. Great job making your profile recruiter-ready.',
      jsonb_build_object('milestone', '100', 'completion_percent', _new_pct)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_completion_notify ON public.profiles;
CREATE TRIGGER on_profile_completion_notify
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_profile_completion_milestones();

-- =====================================
-- 6) Admin broadcast/system notification functions
-- =====================================
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_target_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can send notifications';
  END IF;

  _notification_id := public.create_notification(
    p_target_user_id,
    p_type,
    p_title,
    p_content,
    p_data
  );

  RETURN _notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_type TEXT,
  p_title TEXT,
  p_content TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inserted_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can broadcast notifications';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, data)
  SELECT id, p_type, p_title, p_content, COALESCE(p_data, '{}'::jsonb)
  FROM public.profiles
  WHERE role IS DISTINCT FROM 'suspended';

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  RETURN _inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Usage examples:
-- select public.admin_send_notification(
--   '<user-uuid>',
--   'system',
--   'Account update',
--   'Your profile has been reviewed',
--   '{}'::jsonb
-- );
--
-- select public.admin_broadcast_notification(
--   'system',
--   'Platform maintenance',
--   'JobBridge will undergo maintenance tonight at 11 PM WAT',
--   jsonb_build_object('category', 'maintenance')
-- );
