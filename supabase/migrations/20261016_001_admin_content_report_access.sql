GRANT SELECT ON public.content_reports TO authenticated;

DROP POLICY IF EXISTS "Admins can read content reports" ON public.content_reports;
CREATE POLICY "Admins can read content reports"
  ON public.content_reports FOR SELECT
  USING (public.is_admin());
