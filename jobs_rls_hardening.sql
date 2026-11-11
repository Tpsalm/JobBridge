-- JobBridge — jobs RLS hardening + view counter fix
-- Run in the Supabase SQL editor. Safe to re-run: every statement is idempotent.
--
-- Context: the client already gates on billing (fetchJobs in src/lib/supabaseQueries.ts),
-- but RLS only checked is_active, so the two layers disagreed.

-- 1) Public read policy must carry the same gates as fetchJobs().
DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
CREATE POLICY "Anyone can read active jobs"
  ON public.jobs FOR SELECT
  USING (
    is_active = true
    AND (post_paid = true OR post_plan IS NULL)
    AND (post_expires_at IS NULL OR post_expires_at > now())
    AND (grace_ends_at IS NULL OR grace_ends_at > now())
  );

-- 2) Owners must be able to read their own rows even when inactive/expired.
--    Without this, fetchJobById() returns null in the edit flow and
--    updateJob(...).select().single() throws PGRST116 right after deactivating a job.
DROP POLICY IF EXISTS "Recruiters can read own jobs" ON public.jobs;
CREATE POLICY "Recruiters can read own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = recruiter_id);

-- 3) Recruiters may delete their own jobs.
--    Without this, deleteJob() removed 0 rows and PostgREST still reported success.
DROP POLICY IF EXISTS "Recruiters can delete own jobs" ON public.jobs;
CREATE POLICY "Recruiters can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = recruiter_id);

-- 4) View counter.
--    incrementJobViews() runs as anon and had no UPDATE policy, so it changed
--    0 rows without error and views never moved. Column-level grants keep anon
--    from touching anything except the views column.
REVOKE UPDATE ON public.jobs FROM anon;
GRANT UPDATE (views) ON public.jobs TO anon;

DROP POLICY IF EXISTS "Anyone can increment job views" ON public.jobs;
CREATE POLICY "Anyone can increment job views"
  ON public.jobs FOR UPDATE
  TO anon
  USING (is_active = true)
  WITH CHECK (is_active = true);

-- Rollback (manual):
--   DROP POLICY IF EXISTS "Anyone can increment job views" ON public.jobs;
--   REVOKE UPDATE (views) ON public.jobs FROM anon;
--   GRANT UPDATE ON public.jobs TO anon;
--   DROP POLICY IF EXISTS "Recruiters can delete own jobs" ON public.jobs;
--   DROP POLICY IF EXISTS "Recruiters can read own jobs" ON public.jobs;
--   DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
--   CREATE POLICY "Anyone can read active jobs" ON public.jobs FOR SELECT USING (is_active = true);
