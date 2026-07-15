-- Safe production migration: add the new profile reminder timestamp column only
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_reminder_sent_at TIMESTAMPTZ;
