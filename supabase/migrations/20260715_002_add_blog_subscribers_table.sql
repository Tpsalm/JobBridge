-- Add blog subscriber table and row-level security policies

CREATE TABLE IF NOT EXISTS public.blog_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE IF EXISTS public.blog_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe to blog" ON public.blog_subscribers;
CREATE POLICY "Anyone can subscribe to blog"
  ON public.blog_subscribers FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view subscribers" ON public.blog_subscribers;
CREATE POLICY "Admins can view subscribers"
  ON public.blog_subscribers FOR SELECT
  USING (public.is_admin());
