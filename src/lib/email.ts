const functionsBaseUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ||
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const FUNC_URL = `${functionsBaseUrl.replace(/\/+$/, '')}/send-email`;

interface EmailPayload {
  type: 'welcome' | 'subscription' | 'application' | 'recruiter_notification' | 'payment' | 'payment_initiated' | 'application_status' | 'new_recruiter' | 'job_posted' | 'daily_digest';
  email: string;
  name?: string;
  jobTitle?: string;
  company?: string;
  plan?: string;
  amount?: string;
  applicantName?: string;
  summary?: string;
  /** For application_status: the new status value (shortlisted, rejected, hired) */
  status?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[Email] sendEmail error: missing VITE_SUPABASE_ANON_KEY');
    return false;
  }

  try {
    const response = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[Email] sendEmail failed:', response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] sendEmail error:', error);
    return false;
  }
}
