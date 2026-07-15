UPDATE auth.users
SET encrypted_password = '$2b$10$zQ6QYEjTRWGHrX4xJbLEoOOkL.nzy0pezQ3J3IsgiI4eCFQPjTJ4e',
    updated_at = now()
WHERE email = 'ceo@jobbridge.com.ng';

SELECT id, email, confirmed_at, last_sign_in_at, raw_user_meta_data
FROM auth.users
WHERE email = 'ceo@jobbridge.com.ng';
