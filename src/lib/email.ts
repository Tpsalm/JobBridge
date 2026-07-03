const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

interface EmailPayload {
  type: 'welcome' | 'subscription' | 'application' | 'recruiter_notification' | 'payment';
  email: string;
  name?: string;
  jobTitle?: string;
  company?: string;
  plan?: string;
  amount?: string;
  applicantName?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  try {
    await fetch(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently fail — email is non-critical
  }
}
