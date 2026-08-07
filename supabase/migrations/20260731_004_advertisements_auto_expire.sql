-- =========================================================================
-- JobBridge — Advertisements auto-expiry (paid-duration enforcement)
--
-- WHY: The UAT tester asked: "If I pay for 1 week subscription, will my
-- advert automatically remove after the seventh day? If I pay for 1 month,
-- will my advert stay for one month and remove itself after the 30th day?"
--
-- Adverts already store the correct `expires_at` (7 or 30 days from the
-- payment) in every creation path (Business.tsx, Payment.tsx, verify-payment
-- and kora-webhook) but NOTHING enforced it: the public API and marketplace
-- queries filtered only on status='active', so an advert stayed visible
-- forever once its paid period ended.
--
-- This migration adds:
--   1) public.expire_advertisements() — an idempotent SECURITY DEFINER RPC
--      that flips status -> 'expired' and is_active -> false for any
--      active/pending/paused advert whose expires_at has passed. It is called
--      by a Vercel Cron job so the database self-cleans automatically.
--   2) An immediate sweep of already-overdue adverts.
--   3) Execution grants for the service role and authenticated users.
--
-- NOTE: Query-time filtering (api/get-advertisements.ts +
-- fetchPublicAdvertisements) guarantees expired adverts are hidden the exact
-- second their period ends, independent of when this sweep runs.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.expire_advertisements()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.advertisements
  SET status = 'expired',
      is_active = false,
      updated_at = NOW()
  WHERE status IN ('active', 'pending', 'paused')
    AND expires_at IS NOT NULL
    AND expires_at <= NOW();

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Allow the service role (Vercel Cron / API endpoint) and authenticated app
-- users (dashboard refresh) to run the sweep.
GRANT EXECUTE ON FUNCTION public.expire_advertisements() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_advertisements() TO authenticated;

-- Immediate cleanup of any adverts that are already past their paid period.
SELECT public.expire_advertisements();
