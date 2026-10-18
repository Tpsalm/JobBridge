CREATE OR REPLACE FUNCTION public.withdraw_my_application(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.applications
  SET status = 'withdrawn',
      updated_at = now()
  WHERE id = p_application_id
    AND applicant_id = auth.uid()
    AND status NOT IN ('hired', 'rejected', 'withdrawn');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_my_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_my_application(uuid) TO authenticated;
