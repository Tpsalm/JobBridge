-- Allow regular users to insert their own advertisements after payment
DROP POLICY IF EXISTS "Users can insert own advertisements" ON public.advertisements;
CREATE POLICY "Users can insert own advertisements"
  ON public.advertisements FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      -- Allow insert if there's a matching payment record (paid)
      EXISTS (
        SELECT 1 FROM public.payments
        WHERE payments.user_id = auth.uid()
          AND payments.status IN ('verified', 'pending')
          AND (
            payments.plan = 'business_weekly'
            OR payments.plan = 'business_monthly'
            OR payments.plan = 'business_featured'
          )
      )
      -- OR the user is an admin
      OR public.is_admin()
    )
  );

-- Allow users to read their own advertisements
DROP POLICY IF EXISTS "Users can read own advertisements" ON public.advertisements;
CREATE POLICY "Users can read own advertisements"
  ON public.advertisements FOR SELECT
  USING (auth.uid() = owner_id OR public.is_admin());

-- Allow users to update their own advertisements
DROP POLICY IF EXISTS "Users can update own advertisements" ON public.advertisements;
CREATE POLICY "Users can update own advertisements"
  ON public.advertisements FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
