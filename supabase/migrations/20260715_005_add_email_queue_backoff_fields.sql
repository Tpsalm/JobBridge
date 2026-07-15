-- Add retry scheduling fields for email queue processing
ALTER TABLE IF EXISTS email_queue
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_queue_next_attempt_at ON email_queue (next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue (status);
