-- =========================================================================
-- JobBridge FORCE FIX: Messages page shows "No message notifications yet"
-- =========================================================================
-- This migration is a FORCE re-apply of the RLS fix for the messaging system.
-- It ensures that authenticated users can read other users' profiles, which
-- is required for the fetchConversations query to work (it joins to profiles
-- to get participant names).
--
-- Run this in Supabase SQL Editor: SQL Editor > New Query > Paste > Run
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) FORCE: Drop and recreate the profiles SELECT policy for authenticated users
-- ─────────────────────────────────────────────────────────────────────────
-- The ORIGINAL policy only allows users to read their OWN profile:
--   "Users can read own profile"  -> USING (auth.uid() = id)
-- This blocks fetchConversations from joining the OTHER participant's profile.
--
-- We add a BROADER policy that allows any authenticated user to read any profile.
-- PostgreSQL combines multiple policies with OR, so both policies coexist.
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────
-- 2) FORCE: Ensure RLS is enabled on all messaging tables
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) FORCE: Recreate conversations RLS policies
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can read own conversations" ON public.conversations;
CREATE POLICY "Users can read own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id)
  WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Admins can read conversations" ON public.conversations;
CREATE POLICY "Admins can read conversations"
  ON public.conversations FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete conversations" ON public.conversations;
CREATE POLICY "Admins can delete conversations"
  ON public.conversations FOR DELETE
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 4) FORCE: Recreate messages RLS policies
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can read messages" ON public.messages;
CREATE POLICY "Users can read messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update messages" ON public.messages;
CREATE POLICY "Users can update messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
CREATE POLICY "Users can delete messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Admins can insert messages" ON public.messages;
CREATE POLICY "Admins can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can read messages" ON public.messages;
CREATE POLICY "Admins can read messages"
  ON public.messages FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
CREATE POLICY "Admins can delete messages"
  ON public.messages FOR DELETE
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 5) FORCE: Grant permissions (PostgREST needs these for RLS queries)
-- ─────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Enable REPLICA IDENTITY FULL for realtime delivery
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 7) Ensure the trigger function exists and is active
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content,
      last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_conversation_on_message ON public.messages;
CREATE TRIGGER trg_touch_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_on_message();

-- =========================================================================
-- VERIFICATION QUERIES (run these separately to verify the fix)
-- =========================================================================
-- Check profiles policies:
--   SELECT * FROM pg_policies WHERE tablename = 'profiles';
--
-- Check conversations policies:
--   SELECT * FROM pg_policies WHERE tablename = 'conversations';
--
-- Check messages policies:
--   SELECT * FROM pg_policies WHERE tablename = 'messages';
--
-- Test the fetchConversations query (replace USER_ID with actual user UUID):
--   SELECT c.*,
--     p1.id AS p1_id, p1.full_name AS p1_name, p1.email AS p1_email,
--     p2.id AS p2_id, p2.full_name AS p2_name, p2.email AS p2_email
--   FROM public.conversations c
--   LEFT JOIN public.profiles p1 ON p1.id = c.participant1_id
--   LEFT JOIN public.profiles p2 ON p2.id = c.participant2_id
--   WHERE c.participant1_id = 'USER_ID' OR c.participant2_id = 'USER_ID'
--   ORDER BY c.last_message_at DESC NULLS LAST;
-- =========================================================================