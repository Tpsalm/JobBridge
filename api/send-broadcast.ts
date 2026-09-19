import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'JobBridge <onboarding@resend.dev>';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:jobbridgesupport@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

type Recipient = { id: string; email?: string | null; full_name?: string | null };

function supabaseHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY || '',
    Authorization: `Bearer ${SERVICE_ROLE_KEY || ''}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseGet(path: string) {
  const response = await fetch(`${SUPABASE_URL?.replace(/\/+$/, '')}/rest/v1/${path}`, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  return response.json();
}

async function supabasePost(path: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL?.replace(/\/+$/, '')}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
}

async function isAdmin(accessToken: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !accessToken) return false;
  const userResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  const profiles = await supabaseGet(`profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  return profiles[0]?.role === 'admin';
}

async function sendEmail(recipient: Recipient, title: string, content: string) {
  if (!RESEND_API_KEY || !recipient.email) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: recipient.email,
      subject: title,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${title}</h2><p>${content.replace(/\n/g, '<br />')}</p><p>JobBridge</p></div>`,
    }),
  });
  return response.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.jobbridge.com.ng');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await isAdmin(accessToken))) return res.status(403).json({ error: 'Admin access required' });
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Server not configured' });

    const { title, content, audience } = req.body || {};
    if (!title || !content || !audience) return res.status(400).json({ error: 'Missing title, content, or audience' });

    const role = audience === 'recruiters' ? 'recruiter' : audience === 'job_seekers' ? 'job_seeker' : audience === 'providers' ? 'provider' : null;
    const userId = String(audience).startsWith('user:') ? String(audience).slice(5) : null;
    const filter = userId ? `id=eq.${encodeURIComponent(userId)}` : role ? `role=eq.${role}` : '';
    const recipients = await supabaseGet(`profiles?select=id,email,full_name${filter ? `&${filter}` : ''}`) as Recipient[];

    await supabasePost('notifications', recipients.map((recipient) => ({
      user_id: recipient.id,
      type: 'system',
      title,
      content,
      data: { source: 'admin_broadcast', audience },
    })));

    let emailsSent = 0;
    if (RESEND_API_KEY) {
      const emailResults = await Promise.all(recipients.map((recipient) => sendEmail(recipient, title, content)));
      emailsSent = emailResults.filter(Boolean).length;
    }

    let pushesSent = 0;
    if (VAPID_PUBLIC && VAPID_PRIVATE && recipients.length) {
      const ids = recipients.map((recipient) => recipient.id).join(',');
      const subscriptions = await supabaseGet(`push_subscriptions?select=user_id,subscription&user_id=in.(${ids})`) as Array<{ user_id: string; subscription: webpush.PushSubscription }>;
      const results = await Promise.allSettled(subscriptions.map(async ({ subscription }) => {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body: content, data: { url: '/' } }));
      }));
      pushesSent = results.filter((result) => result.status === 'fulfilled').length;
    }

    return res.status(200).json({ success: true, recipients: recipients.length, emailsSent, pushesSent });
  } catch (error: unknown) {
    console.error('[api/send-broadcast] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send broadcast';
    return res.status(500).json({ error: message });
  }
}