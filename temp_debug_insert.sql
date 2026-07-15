BEGIN;
INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'temp-ceo@jobbridge.com.ng',
  '$2b$10$wKQcDok0sRXkRF/Lj4rLq.4deUXNKF3luhLR62AdYf4M09VMk2S2S',
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"email":"temp-ceo@jobbridge.com.ng","email_verified":true,"full_name":"Victor Eniola","phone_verified":false,"role":"admin","sub":"temp"}'::jsonb,
  false,
  false,
  NOW(),
  NOW()
);
COMMIT;
