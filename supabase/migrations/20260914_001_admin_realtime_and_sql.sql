-- JobBridge admin/public integration: durable broadcasts and truthful SQL results.

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'broadcast',
  broadcast_type TEXT NOT NULL DEFAULT 'announcement',
  display_format TEXT NOT NULL DEFAULT 'banner',
  action_url TEXT,
  action_label TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Public can read active broadcasts" ON public.broadcasts;
CREATE POLICY "Public can read active broadcasts"
  ON public.broadcasts FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.broadcasts;
CREATE POLICY "Admins can manage broadcasts"
  ON public.broadcasts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_broadcasts_active_created_at
  ON public.broadcasts(is_active, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'broadcasts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
  affected_rows BIGINT := 0;
  normalized_query TEXT := btrim(query);
  command_name TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access denied: Super Admin privileges required to execute SQL';
  END IF;

  IF normalized_query = '' THEN
    RETURN jsonb_build_object('success', true, 'command', 'EMPTY', 'rows', '[]'::jsonb, 'rowCount', 0);
  END IF;

  command_name := upper(regexp_replace(split_part(normalized_query, ' ', 1), '[^A-Za-z]', '', 'g'));
  IF upper(normalized_query) ~ '^(SELECT|WITH|SHOW|EXPLAIN)' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || normalized_query || ') t' INTO result;
    affected_rows := jsonb_array_length(COALESCE(result, '[]'::jsonb));
    command_name := 'SELECT';
  ELSE
    EXECUTE normalized_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    result := '[]'::jsonb;
  END IF;

  INSERT INTO public.admin_events(admin_id, action_type, target_type, details)
  VALUES (auth.uid(), 'sql_' || lower(command_name), 'database',
    jsonb_build_object('command', command_name, 'rowCount', affected_rows,
      'query', left(normalized_query, 2000)));

  RETURN jsonb_build_object('success', true, 'command', command_name,
    'rows', COALESCE(result, '[]'::jsonb), 'rowCount', affected_rows);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'command', COALESCE(command_name, 'UNKNOWN'),
    'error', SQLERRM, 'state', SQLSTATE, 'rows', '[]'::jsonb, 'rowCount', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;