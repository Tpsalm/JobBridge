-- Create a durable table for email send logs
CREATE TABLE IF NOT EXISTS email_logs (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  type TEXT,
  subject TEXT,
  resend_id TEXT,
  status TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs (email);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs (resend_id);
