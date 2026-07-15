-- Create email queue table for retrying failed sends
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  type TEXT,
  payload JSONB,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_email ON email_queue (email);
CREATE INDEX IF NOT EXISTS idx_email_queue_attempts ON email_queue (attempts);
