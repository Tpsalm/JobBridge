-- =========================================================================
-- JobBridge Super Admin Complete Auth & Schema Repair Migration
-- Run this ENTIRE script in the Supabase SQL Editor (SQL Editor > New Query)
-- 
-- Fixes:
-- 1) Cures GoTrue 500 "Database error querying schema" by normalizing NULL tokens in auth.users
-- 2) Drops broken custom triggers on auth.users
-- 3) Provisions the dedicated Super Admin user (auth.users + auth.identities + public.profiles)
-- 4) Re-grants all required schema permissions to supabase_auth_admin
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Drop any legacy or broken triggers on auth.users that interrupt GoTrue
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 2) Fix NULL scan errors in auth.users across existing rows (Primary cause of 500 error)
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
  is_super_admin = COALESCE(is_super_admin, false),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false)
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL
   OR is_super_admin IS NULL
   OR is_sso_user IS NULL
   OR is_anonymous IS NULL;

-- 3) Cleanly provision the Super Admin user
DO $$
DECLARE
  _admin_id UUID := gen_random_uuid();
  _admin_email TEXT := 'superadmin@jobbridge.com.ng';
  _admin_password TEXT := 'JobBridgeSuperAdmin@2026!';
  _encrypted_pw TEXT;
BEGIN
  _encrypted_pw := crypt(_admin_password, gen_salt('bf', 10));

  -- Remove any existing stale records for superadmin
  DELETE FROM auth.identities WHERE identity_data->>'email' = _admin_email OR user_id IN (SELECT id FROM auth.users WHERE email = _admin_email);
  DELETE FROM public.profiles WHERE email = _admin_email;
  DELETE FROM auth.users WHERE email = _admin_email;

  -- Insert into auth.users with ALL required GoTrue struct fields populated (no NULL strings)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    _admin_id,
    'authenticated',
    'authenticated',
    _admin_email,
    _encrypted_pw,
    now(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"JobBridge Super Admin","role":"admin"}'::jsonb,
    false,
    now(),
    now(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL,
    false
  );

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    _admin_id,
    _admin_id,
    json_build_object('sub', _admin_id::text, 'email', _admin_email)::jsonb,
    'email',
    _admin_id::text,
    now(),
    now(),
    now()
  );

  -- Insert into public.profiles with role = 'admin'
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    is_premium,
    created_at,
    updated_at
  ) VALUES (
    _admin_id,
    _admin_email,
    'JobBridge Super Admin',
    'admin',
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = _admin_email,
      full_name = 'JobBridge Super Admin',
      role = 'admin',
      is_active = true,
      is_premium = true,
      updated_at = now();

  -- Demote previous admin email if present
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'tobiopeyemi057@gmail.com') THEN
    UPDATE public.profiles SET role = 'job_seeker', updated_at = now() WHERE email = 'tobiopeyemi057@gmail.com';
  END IF;

  RAISE NOTICE 'Super Admin successfully provisioned! Email: %, ID: %', _admin_email, _admin_id;
END;
$$;

-- 4) Ensure permissions for supabase_auth_admin and authenticated
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres, supabase_auth_admin;
