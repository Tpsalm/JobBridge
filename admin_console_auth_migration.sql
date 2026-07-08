-- =========================================================================
-- Admin Console Auth Migration
-- Adds the missing admin policies needed after removing browser-side service-role access.
-- Run after supabase_migration.sql, security_rls_migration.sql, and notifications_realtime_migration.sql.
-- =========================================================================

-- Admins need to read all notifications in the admin console.
DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;
CREATE POLICY "Admins can read all notifications"
  ON public.notifications FOR SELECT
  USING (public.is_admin());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'service_providers'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read providers" ON public.service_providers';
    EXECUTE 'CREATE POLICY "Admins can read providers" ON public.service_providers FOR SELECT USING (public.is_admin())';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'advertisements'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read ads" ON public.advertisements';
    EXECUTE 'CREATE POLICY "Admins can read ads" ON public.advertisements FOR SELECT USING (public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert ads" ON public.advertisements';
    EXECUTE 'CREATE POLICY "Admins can insert ads" ON public.advertisements FOR INSERT WITH CHECK (public.is_admin())';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read conversations" ON public.conversations';
    EXECUTE 'CREATE POLICY "Admins can read conversations" ON public.conversations FOR SELECT USING (public.is_admin())';
  END IF;
END
$$;
