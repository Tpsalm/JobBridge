-- =========================================================================
-- JobBridge Super Admin Database Studio & Realtime Migration
-- Run this in the Supabase SQL Editor (or via Admin Console SQL Studio)
-- =========================================================================

-- 1) Admin Events Audit Table
CREATE TABLE IF NOT EXISTS public.admin_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_name TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON public.admin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_action_type ON public.admin_events(action_type);

ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read admin events" ON public.admin_events;
CREATE POLICY "Admins can read admin events"
  ON public.admin_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert admin events" ON public.admin_events;
CREATE POLICY "Admins can insert admin events"
  ON public.admin_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 2) Super Admin SQL Execution RPC (exec_sql)
-- Allows authorized Super Admins to execute DDL, DML, DCL, and ENUM queries from the Admin Console
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
BEGIN
  -- Verify caller is an admin
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL OR caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: Super Admin privileges required to execute SQL';
  END IF;

  -- Trim and inspect query
  query := btrim(query);
  IF query = '' THEN
    RETURN jsonb_build_object('success', true, 'rows', '[]'::jsonb, 'rowCount', 0);
  END IF;

  -- Handle SELECT queries with json_agg
  IF upper(query) ~ '^(SELECT|WITH|SHOW|EXPLAIN)' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;
    RETURN jsonb_build_object(
      'success', true,
      'command', 'SELECT',
      'rows', COALESCE(result, '[]'::jsonb),
      'rowCount', jsonb_array_length(COALESCE(result, '[]'::jsonb))
    );
  ELSE
    -- Execute DDL, DML, DCL, ENUM statements (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE)
    EXECUTE query;
    RETURN jsonb_build_object(
      'success', true,
      'command', 'EXECUTE',
      'message', 'Query executed successfully',
      'rows', '[]'::jsonb,
      'rowCount', 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'state', SQLSTATE
  );
END;
$$;

-- 3) Schema Inspector RPC (get_schema_tables)
CREATE OR REPLACE FUNCTION public.get_schema_tables()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, information_schema
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'table_name', t.table_name,
    'table_type', t.table_type,
    'column_count', (
      SELECT count(*) FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.table_name
    )
  ))
  INTO result
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  ORDER BY t.table_name;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 4) ENUM Inspector RPC (get_enum_types)
CREATE OR REPLACE FUNCTION public.get_enum_types()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller_role TEXT;
  result JSONB;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'enum_name', t.typname,
    'enum_values', (
      SELECT array_to_json(array_agg(e.enumlabel ORDER BY e.enumsortorder))
      FROM pg_enum e
      WHERE e.enumtypid = t.oid
    )
  ))
  INTO result
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e'
  ORDER BY t.typname;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 5) Add Realtime Publication for Core Tables
DO $$
BEGIN
  -- Enable realtime publication for all tables if not already present
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_providers;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.advertisements;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_events;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
