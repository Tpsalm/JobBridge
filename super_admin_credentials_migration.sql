-- =========================================================================
-- JobBridge Super Admin Dedicated Credentials Migration
-- Run this in the Supabase SQL Editor to provision the new Super Admin
-- =========================================================================

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  _new_admin_id UUID;
  _old_email TEXT := 'tobiopeyemi057@gmail.com';
  _new_email TEXT := 'superadmin@jobbridge.com.ng';
  _new_password TEXT := 'JobBridgeSuperAdmin@2026!';
  _encrypted_pw TEXT;
BEGIN
  -- Generate bcrypt hash for the new password
  _encrypted_pw := crypt(_new_password, gen_salt('bf', 10));

  -- 1) Check if the user already exists in auth.users
  SELECT id INTO _new_admin_id FROM auth.users WHERE email = _new_email;

  IF _new_admin_id IS NULL THEN
    -- Generate fresh UUID
    _new_admin_id := gen_random_uuid();

    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      _new_admin_id,
      'authenticated',
      'authenticated',
      _new_email,
      _encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"JobBridge Super Admin","role":"admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  ELSE
    -- Update password and confirmation
    UPDATE auth.users
    SET encrypted_password = _encrypted_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = '{"full_name":"JobBridge Super Admin","role":"admin"}'::jsonb,
        updated_at = now()
    WHERE id = _new_admin_id;
  END IF;

  -- 2) Upsert into public.profiles with role = 'admin'
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
    _new_admin_id,
    _new_email,
    'JobBridge Super Admin',
    'admin',
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = _new_email,
      full_name = 'JobBridge Super Admin',
      role = 'admin',
      is_active = true,
      is_premium = true,
      updated_at = now();

  -- 3) Eliminate / demote old admin credentials if requested
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _old_email) THEN
    UPDATE public.profiles
    SET role = 'job_seeker',
        updated_at = now()
    WHERE email = _old_email;

    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'role',
        updated_at = now()
    WHERE email = _old_email;
  END IF;

  RAISE NOTICE 'Super Admin created successfully with email: %', _new_email;
END;
$$;
