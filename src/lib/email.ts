import { getSupabaseFunctionsUrl } from './supabaseHelpers';

const functionsBaseUrl = getSupabaseFunctionsUrl();
const FUNC_URL = functionsBaseUrl ? `${functionsBaseUrl}/send-email` : null;
const FALLBACK_FROM_EMAIL = 'JobBridge <onboarding@resend.dev>';

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
    if (!FUNC_URL) {
      console.error('[Email] sendEmail error: invalid Supabase functions URL');
      return false;
    }

    const response = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        ...payload,
        from: payload.from || FALLBACK_FROM_EMAIL,
      }),
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
