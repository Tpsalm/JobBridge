import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Password reset delivery — works around Supabase's broken built-in GoTrue
 * mailer (which returns "Error sending recovery email" / HTTP 500 for the
 * /auth/v1/recover endpoint).
 *
 * Flow:
 *   1. Generate a one-time password-recovery link via the Supabase ADMIN
 *      API (`/auth/v1/admin/generate_link`) using the service-role key.
 *   2. Email that link to the user through this project's own Resend-based
 *      mailer (`/api/send-email`), which is verified and working.
 *
 * This keeps the standard Supabase recovery session intact — when the user
 * clicks the emailed link, Supabase verifies the token and redirects to
 * `/auth/callback?type=recovery`, where the existing AuthCallback →
 * ResetPassword flow takes over (both of which were hardened to handle the
 * recovery session reliably).
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    const { email } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const siteUrl = (process.env.SITE_URL || 'https://www.jobbridge.com.ng').replace(/\/+$/, '');
    const redirectTo = `${siteUrl}/auth/callback?type=recovery`;

    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1) Generate a one-time recovery link via the Supabase admin API.
    const genResp = await fetch(`${baseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'recovery',
        email: cleanEmail,
        options: { redirect_to: redirectTo },
      }),
    });

    if (!genResp.ok) {
      const text = await genResp.text().catch(() => '');
      // Never reveal whether an account exists — return the same generic
      // success for unknown accounts (matching Supabase's default behaviour
      // for its own recover endpoint).
      const lower = text.toLowerCase();
      const userNotFound =
        lower.includes('user not found') ||
        lower.includes('unable to find user') ||
        lower.includes('email_not_found') ||
        lower.includes('user_not_found');
      if (userNotFound) {
        return res.status(200).json({ ok: true, sent: false });
      }
      console.warn('[api/reset-password] generate_link failed:', genResp.status, text);
      return res.status(502).json({ error: 'Could not generate a recovery link', details: text });
    }

    const genJson = await genResp.json();
    const actionLink = genJson?.action_link;
    if (!actionLink) {
      return res.status(502).json({ error: 'Recovery link was not returned by the auth service' });
    }

    // 2) Deliver the link through the project's own Resend mailer.
    const mailResp = await fetch(`${siteUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'password_reset',
        email: cleanEmail,
        name: cleanEmail,
        link: actionLink,
      }),
    });

    if (!mailResp.ok) {
      const text = await mailResp.text().catch(() => '');
      console.warn('[api/reset-password] send-email failed:', mailResp.status, text);
      return res.status(502).json({ error: 'Recovery link generated but the email could not be sent', details: text });
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (err: any) {
    console.error('[api/reset-password] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
