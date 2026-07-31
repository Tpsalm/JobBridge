-- =========================================================================
-- JobBridge Fix: Messages never appear in the Messages page
-- =========================================================================
-- Root causes fixed by this migration:
--   1) profiles RLS only allowed reading your OWN profile. fetchConversations
--      and fetchConversationById inner-join the OTHER participant's profile,
--      so PostgREST dropped the conversation rows for BOTH parties. This made
--      the conversation list permanently empty.
--   2) conversations/messages did not have REPLICA IDENTITY FULL, so realtime
--      UPDATE/DELETE filters (participant_id, conversation_id) did not deliver.
--   3) conversations.last_message / last_message_at were only updated from the
--      client (silently swallowing failures). A server-side trigger now keeps
--      them in sync automatically.
--   4) RLS policies + indexes for conversations/messages are now idempotent
--      and self-contained so they can be (re)applied on any environment.
-- =========================================================================

-- NOTE: public.is_admin() is expected to already exist (created by
-- supabase_migration.sql). We intentionally do NOT recreate it here to avoid
-- changing admin semantics.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) FIX THE PRIMARY BUG: allow authenticated users to read profiles
-- ─────────────────────────────────────────────────────────────────────────
-- Without this, any query that joins to another user's profile (e.g. the
-- conversations list) returns zero rows because of RLS on profiles.
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Ensure base tables exist (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RLS + policies for conversations (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

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
-- 4) RLS + policies for messages (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

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
-- 5) Realtime: full row identity so filters on conversation_id / participant
--    ids are delivered reliably for INSERT and UPDATE events.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Indexes for messaging performance
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON public.conversations(participant1_id, participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id
  ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 7) Keep conversations.last_message / last_message_at in sync automatically
--    whenever a message is inserted (server-side, cannot silently fail).
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

-- Grant usage to authenticated users (PostgREST needs this for RLS queries)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
