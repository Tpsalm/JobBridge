-- =========================================================================
-- JobBridge — Make active business advertisements and recruitment job posts
-- publicly visible to ALL users (both new and existing accounts).
--
-- WHY: Previously the advertisements/jobs RLS only allowed the OWNER (or
-- admin) to SELECT content. That meant subscribed business users and
-- recruiters could create posts that only they could see, while other users
-- (including brand new accounts) could not see them at all.
--
-- This migration adds public SELECT policies for ACTIVE content so every
-- user (authenticated or anonymous visitor) can see the posts that
-- subscribed business users and recruiters have created. Owners keep their
-- existing read access.
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'advertisements'
  ) THEN
    ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can read active advertisements" ON public.advertisements;
    CREATE POLICY "Anyone can read active advertisements"
      ON public.advertisements FOR SELECT
      USING (status = 'active');

    DROP POLICY IF EXISTS "Anon can read active advertisements" ON public.advertisements;
    CREATE POLICY "Anon can read active advertisements"
      ON public.advertisements FOR SELECT
      USING (status = 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
    CREATE POLICY "Anyone can read active jobs"
      ON public.jobs FOR SELECT
      USING (is_active = true);

    DROP POLICY IF EXISTS "Anon can read active jobs" ON public.jobs;
    CREATE POLICY "Anon can read active jobs"
      ON public.jobs FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

-- Sanity check helpers:
--   SELECT * FROM pg_policies WHERE tablename IN ('advertisements', 'jobs');
-- =========================================================================
