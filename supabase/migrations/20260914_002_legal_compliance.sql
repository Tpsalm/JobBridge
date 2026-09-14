-- JobBridge legal and user safety workflows.
-- Run through the Supabase migration process before publishing the Android app.

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  content_id UUID,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Users can submit deletion requests"
  ON public.data_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can submit content reports" ON public.content_reports;
CREATE POLICY "Users can submit content reports"
  ON public.content_reports FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR reporter_id = auth.uid());
