import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API = 'https://api.resend.com/emails';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.RESEND_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Server not configured: missing RESEND_API_KEY' });

  try {
    const body = req.body || {};
    const { email, name, type, from } = body;
    if (!email || !type) return res.status(400).json({ error: 'Missing email or type' });

    // Minimal fallback: send a simple welcome or profile reminder using Resend
    const subject = type === 'welcome' ? 'Welcome to JobBridge! 🚀' : type === 'profile_reminder' ? 'Finish your JobBridge profile' : 'JobBridge Notification';
    const html = `<p>Hi ${name || 'there'},</p><p>This is a message from JobBridge regarding: ${subject}</p>`;

    const r = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'JobBridge <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('[api/send-email] resend error:', text);
      return res.status(502).json({ error: 'Resend API failure', details: text });
    }

    const data = await r.json();
    return res.status(200).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('[api/send-email] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
