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

function wrapHtml(body: string, title = 'JobBridge'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>${title}</title></head><body style="margin:0;padding:0;background:#f5f8ff;font-family:Inter,Segoe UI,system-ui,Arial,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8ff;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.08);"><tr><td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:32px 32px 24px;text-align:center;color:#ffffff;"><h1 style="margin:0;font-size:28px;line-height:1.1;font-weight:800;">${title}</h1><p style="margin:12px auto 0;max-width:520px;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.88);">Welcome to JobBridge — your professional career and hiring network for Africa.</p></td></tr><tr><td style="padding:32px 32px 24px;">${body}</td></tr><tr><td style="padding:0 32px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:18px;border:1px solid #e2e8f0;padding:24px;"><tr><td style="font-size:14px;line-height:1.8;color:#475569;">Need help? Contact our support team at <a href="mailto:support@jobbridge.com.ng" style="color:#2563eb;text-decoration:none;">support@jobbridge.com.ng</a> or visit <a href="https://www.jobbridge.com.ng" style="color:#2563eb;text-decoration:none;">JobBridge</a>.</td></tr></table></td></tr><tr><td style="background:#f8fafc;padding:24px 32px;text-align:center;color:#64748b;font-size:13px;line-height:1.7;">JobBridge Connect Africa<br>Democratizing opportunity across Africa.</td></tr></table></td></tr></table></body></html>`;
}

function welcomeTemplate(name: string): string {
  const guest = (name || 'there').trim();
  return `<p style="margin:0 0 24px;font-size:17px;line-height:1.8;color:#0f172a;">Hi <strong>${guest}</strong>,</p><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#334155;">Welcome to <strong>JobBridge</strong> — your gateway to meaningful work, trusted service connections, and smarter hiring across Nigeria and Africa.</p><ul style="margin:0 0 24px;padding-left:20px;color:#334155;line-height:1.9;"><li style="margin-bottom:12px;">Create a standout profile so recruiters and service buyers can discover you.</li><li style="margin-bottom:12px;">Browse jobs, apply with AI-powered tools, and track your progress.</li><li style="margin-bottom:12px;">For providers and recruiters, manage leads, publish services, and connect with clients.</li></ul><p style="margin:0 0 28px;font-size:16px;line-height:1.8;color:#334155;">To get started, complete your profile and explore the opportunities waiting for you.</p><div style="text-align:center;margin-bottom:28px;"><a href="https://www.jobbridge.com.ng/profile" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;font-weight:700;">Complete Your Profile</a></div><p style="margin:0;font-size:15px;line-height:1.8;color:#475569;">If you need assistance, our team is ready to help. Welcome aboard.</p>`;
}

function profileReminderTemplate(name: string): string {
  const guest = (name || 'there').trim();
  return `<p style="margin:0 0 24px;font-size:17px;line-height:1.8;color:#0f172a;">Hi <strong>${guest}</strong>,</p><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#334155;">You’re nearly ready to unlock the full power of JobBridge. Completing your profile helps you get discovered by recruiters, service clients, and opportunity seekers.</p><ol style="margin:0 0 24px;padding-left:20px;color:#334155;line-height:1.9;"><li style="margin-bottom:12px;">Add your skills, experience, and preferred work types.</li><li style="margin-bottom:12px;">Upload a professional profile picture and cover letter.</li><li style="margin-bottom:12px;">Choose the categories or industries where you want to be visible.</li></ol><div style="text-align:center;margin-bottom:28px;"><a href="https://www.jobbridge.com.ng/profile" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;font-weight:700;">Finish Your Profile</a></div><p style="margin:0;font-size:15px;line-height:1.8;color:#475569;">Completing your profile now increases your chances of being matched quickly with the right opportunities.</p>`;
}

function genericTemplate(name: string, type: string): string {
  const guest = (name || 'there').trim();
  return `<p style="margin:0 0 24px;font-size:17px;line-height:1.8;color:#0f172a;">Hi <strong>${guest}</strong>,</p><p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#334155;">This is a notification from JobBridge regarding <strong>${type}</strong>. Please visit your dashboard to review the latest updates and take action.</p><div style="text-align:center;margin-bottom:28px;"><a href="https://www.jobbridge.com.ng" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;font-weight:700;">View JobBridge</a></div><p style="margin:0;font-size:15px;line-height:1.8;color:#475569;">If you have any questions, reply to this email or contact support at support@jobbridge.com.ng.</p>`;
}

function buildEmailHtml(type: string, name: string): { subject: string; html: string } {
  const subject = type === 'welcome'
    ? 'Welcome to JobBridge! 🚀'
    : type === 'profile_reminder'
    ? 'Complete your JobBridge profile to get discovered'
    : 'Message from JobBridge';

  const body = type === 'welcome'
    ? welcomeTemplate(name)
    : type === 'profile_reminder'
    ? profileReminderTemplate(name)
    : genericTemplate(name, type);

  return { subject, html: wrapHtml(body, subject) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Server not configured: missing Resend API key' });

  try {
    const body = req.body || {};
    const { email, name, type, from } = body;
    if (!email || !type) return res.status(400).json({ error: 'Missing email or type' });

    const sender = (from && from.trim()) || RESEND_FROM;
    const { subject, html } = buildEmailHtml(type, name || 'there');

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
