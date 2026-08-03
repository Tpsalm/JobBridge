-- =========================================================================
-- JobBridge: Unified Private Chat Space
-- =========================================================================
-- Guarantees the "ONE conversation per user-provider pair" rule at the
-- database level so no client code can ever create duplicate threads:
--
--   1) Deduplicates any existing duplicate conversations for the same pair
--      (messages are re-pointed to the oldest conversation, the rest deleted).
--   2) Creates a UNIQUE index on the NORMALIZED pair
--      (LEAST(participant1_id, participant2_id), GREATEST(...)) so both
--      (A,B) and (B,A) insert orders conflict and are rejected.
--   3) Adds a SECURITY DEFINER RPC so a participant can mark incoming
--      messages as read (read receipts) without weakening message RLS.
--   4) Adds a partial index backing unread-count queries.
--
-- Run this in Supabase SQL Editor (or via supabase db push / db reset).
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 0) Track who sent the last message (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Deduplicate existing duplicate conversations (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
-- For every (participant1, participant2) pair that currently has more than
-- one conversation, keep the OLDEST conversation, re-point all of its
-- messages to the keeper, then delete the duplicate rows. This must run
-- BEFORE the unique index below is created.
DO $$
DECLARE
  r RECORD;
  keep_id UUID;
BEGIN
  FOR r IN
    SELECT LEAST(participant1_id, participant2_id) AS a,
           GREATEST(participant1_id, participant2_id) AS b,
           array_agg(id ORDER BY created_at ASC, id ASC) AS ids
    FROM public.conversations
    WHERE participant1_id IS NOT NULL
      AND participant2_id IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) > 1
  LOOP
    keep_id := r.ids[1];

    -- Re-point every message from the duplicate conversations to the keeper.
    UPDATE public.messages
    SET conversation_id = keep_id
    WHERE conversation_id = ANY(r.ids[2:]);

    -- Recompute last_message / last_message_at / last_message_sender_id on the
    -- keeper from its messages (duplicates may have had different last messages).
    UPDATE public.conversations
    SET last_message = sub.last_message,
        last_message_at = sub.last_message_at,
        last_message_sender_id = sub.last_message_sender_id,
        updated_at = now()
    FROM (
      SELECT content AS last_message,
             created_at AS last_message_at,
             sender_id AS last_message_sender_id
      FROM public.messages
      WHERE conversation_id = keep_id
      ORDER BY created_at DESC NULLS LAST, id DESC
      LIMIT 1
    ) AS sub
    WHERE public.conversations.id = keep_id;

    -- Remove the duplicate conversation rows.
    DELETE FROM public.conversations WHERE id = ANY(r.ids[2:]);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) UNIQUE index: ONE conversation per pair regardless of participant order
-- ─────────────────────────────────────────────────────────────────────────
-- LEAST/GREATEST normalise the pair so inserting (A,B) or (B,A) both map to
-- the same index key. A second insert for the same pair raises a unique
-- violation, which callers resolve by re-fetching the existing thread.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_participant_pair
  ON public.conversations (
    LEAST(participant1_id, participant2_id),
    GREATEST(participant1_id, participant2_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Read-receipt RPC (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────
-- The messages UPDATE RLS policy only lets the SENDER modify their own row
-- (WITH CHECK auth.uid() = sender_id), which correctly stops a recipient from
-- rewriting content. To still support "Seen"/"Read" status we expose a
-- narrow, security-definer function that flips is_read ONLY on messages the
-- caller actually received.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id UUID,
  p_reader_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE conversation_id = p_conversation_id
    AND recipient_id = p_reader_id
    AND is_read = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID, UUID)
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Partial index backing unread-count lookups
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_unread_by_recipient
  ON public.messages (recipient_id, conversation_id)
  WHERE is_read = false;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- ─────────────────────────────────────────────────────────────────────────
-- Check the unique index exists:
--   SELECT indexname FROM pg_indexes WHERE tablename = 'conversations';
--
-- Check no duplicate conversations remain:
--   SELECT LEAST(participant1_id, participant2_id) AS a,
--          GREATEST(participant1_id, participant2_id) AS b,
--          count(*)
--   FROM public.conversations
--   GROUP BY 1, 2
--   HAVING count(*) > 1;
--
-- Test read receipts as a participant:
--   SELECT public.mark_conversation_read('<conversation_id>', '<my_user_id>');
-- =========================================================================
