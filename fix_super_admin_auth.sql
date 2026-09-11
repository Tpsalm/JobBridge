-- =========================================================================
-- JobBridge Super Admin Complete Auth Fix
-- Run this ENTIRE script in the Supabase SQL Editor
-- This provisions auth.users + auth.identities + public.profiles + cleans triggers
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Drop any legacy or broken triggers on auth.users that cause 500 schema query errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DO $$
DECLARE
  _admin_id UUID;
  _admin_email TEXT := 'superadmin@jobbridge.com.ng';
  _admin_password TEXT := 'JobBridgeSuperAdmin@2026!';
  _encrypted_pw TEXT;
BEGIN
  _encrypted_pw := crypt(_admin_password, gen_salt('bf', 10));

  -- Clean up existing record for superadmin to ensure a clean slate
  DELETE FROM auth.identities WHERE identity_data->>'email' = _admin_email OR user_id IN (SELECT id FROM auth.users WHERE email = _admin_email);
  DELETE FROM public.profiles WHERE email = _admin_email;
  DELETE FROM auth.users WHERE email = _admin_email;

  -- Generate new UUID
  _admin_id := gen_random_uuid();

  -- 1) Insert into auth.users with ALL required GoTrue fields
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    _admin_id,
    'authenticated',
    'authenticated',
    _admin_email,
    _encrypted_pw,
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"JobBridge Super Admin","role":"admin"}'::jsonb,
    false,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 2) Insert into auth.identities (MANDATORY for Supabase GoTrue Auth)
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

  -- 3) Insert into public.profiles with role = 'admin'
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

  -- 4) Revoke previous admin email credentials if present
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'tobiopeyemi057@gmail.com') THEN
    UPDATE public.profiles SET role = 'job_seeker', updated_at = now() WHERE email = 'tobiopeyemi057@gmail.com';
  END IF;

  RAISE NOTICE 'Super Admin successfully provisioned! Email: %, ID: %', _admin_email, _admin_id;
END;
$$;
