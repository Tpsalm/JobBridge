import { getSupabaseFunctionsUrl } from './supabaseHelpers';

const functionsBaseUrl = getSupabaseFunctionsUrl();
const FUNC_URL = functionsBaseUrl ? `${functionsBaseUrl}/send-email` : null;
const FALLBACK_FROM_EMAIL = 'JobBridge <onboarding@resend.dev>';

export interface EmailPayload {
  type: 'welcome' | 'subscription' | 'application' | 'recruiter_notification' | 'payment' | 'payment_initiated' | 'application_status' | 'new_recruiter' | 'job_posted' | 'advert_created' | 'daily_digest' | 'sign_in' | 'sign_out' | 'profile_reminder';
  email: string;
  name?: string;
  jobTitle?: string;
  company?: string;
  plan?: string;
  amount?: string;
  applicantName?: string;
  summary?: string;
  advertId?: string | number | null;
  from?: string;
  /** For application_status: the new status value (shortlisted, rejected, hired) */
  status?: string;
}

export function resolveFromEmail(rawFrom?: string | null): string {
  const value = rawFrom?.trim();
  if (!value) {
    return FALLBACK_FROM_EMAIL;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('@jobbridge.com.ng') || normalized.includes('@www.jobbridge.com.ng')) {
    return FALLBACK_FROM_EMAIL;
  }

  return value;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[Email] sendEmail error: missing VITE_SUPABASE_ANON_KEY');
    return false;
  }

  try {
    if (!FUNC_URL) {
      // Fallback: call Vercel serverless endpoint if Supabase Functions URL is not configured
      try {
        const fallbackResp = await fetch(`/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload }),
        });
        if (!fallbackResp.ok) {
          const text = await fallbackResp.text().catch(() => '');
          console.warn('[Email] fallback /api/send-email failed:', fallbackResp.status, text);
          return false;
        }
        return true;
      } catch (e) {
        console.error('[Email] fallback sendEmail error:', e);
        return false;
      }
    }

    const response = await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        ...payload,
        from: resolveFromEmail(payload.from || FALLBACK_FROM_EMAIL),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[Email] sendEmail failed:', response.status, text);
      // Try Vercel fallback if Supabase function rejected the request
      try {
        const fallbackResp = await fetch(`/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload }),
        });
        if (fallbackResp.ok) return true;
      } catch (e) {
        // ignore
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] sendEmail error:', error);
    return false;
  }
}
