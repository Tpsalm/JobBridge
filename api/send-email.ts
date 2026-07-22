import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'JobBridge <onboarding@resend.dev>';
const FALLBACK_FROM_EMAIL = 'JobBridge <onboarding@resend.dev>';

function isUnverifiedSenderError(message: unknown): boolean {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('validate a domain') ||
    text.includes('testing emails') ||
    text.includes('sender address') ||
    text.includes('unverified sender') ||
    text.includes('unverified domain')
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Server not configured: missing Resend API key' });

  try {
    const body = req.body || {};
    const { email, name, type, from } = body;
    if (!email || !type) return res.status(400).json({ error: 'Missing email or type' });

    const sender = (from && from.trim()) || RESEND_FROM;
    const subject = type === 'welcome' ? 'Welcome to JobBridge! 🚀' : type === 'profile_reminder' ? 'Finish your JobBridge profile' : 'JobBridge Notification';
    const html = `<p>Hi ${name || 'there'},</p><p>This is a message from JobBridge regarding: ${subject}</p>`;

    async function postEmail(fromAddress: string) {
      return fetch(RESEND_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: email,
          subject,
          html,
        }),
      });
    }

    let response = await postEmail(sender);
    if (!response.ok) {
      const text = await response.text();
      if (isUnverifiedSenderError(text) && sender !== FALLBACK_FROM_EMAIL) {
        response = await postEmail(FALLBACK_FROM_EMAIL);
      }
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('[api/send-email] resend error:', text);
      return res.status(502).json({ error: 'Resend API failure', details: text });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('[api/send-email] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
