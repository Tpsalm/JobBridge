import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'JobBridge <onboarding@resend.dev>';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:jobbridgesupport@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

type Recipient = { id: string; email?: string | null; full_name?: string | null };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    const payload = req.body;

    if (payload?.broadcast) {
      const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const userResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` },
      });
      if (!userResponse.ok) return res.status(403).json({ error: 'Admin access required' });
      const user = await userResponse.json();
      const profileResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const profiles = await profileResponse.json();
      if (profiles[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

      const role = payload.audience === 'recruiters' ? 'recruiter' : payload.audience === 'job_seekers' ? 'job_seeker' : payload.audience === 'providers' ? 'provider' : null;
      const userId = String(payload.audience || '').startsWith('user:') ? String(payload.audience).slice(5) : null;
      const filter = userId ? `&id=eq.${encodeURIComponent(userId)}` : role ? `&role=eq.${role}` : '';
      const recipientsResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles?select=id,email,full_name${filter}`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!recipientsResponse.ok) return res.status(502).json({ error: 'Could not load broadcast recipients' });
      const recipients = await recipientsResponse.json() as Recipient[];
      const notificationRows = recipients.map((recipient) => ({
        user_id: recipient.id,
        type: 'system',
        title: payload.title,
        content: payload.content,
        data: { source: 'admin_broadcast', audience: payload.audience },
      }));

      if (notificationRows.length) {
        const notificationResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/notifications`, {
          method: 'POST',
          headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(notificationRows),
        });
        if (!notificationResponse.ok) return res.status(502).json({ error: 'Could not create broadcast notifications' });
      }

      const emailResults = RESEND_API_KEY ? await Promise.all(recipients.filter((recipient) => recipient.email).map(async (recipient) => {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: RESEND_FROM, to: recipient.email, subject: payload.title, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${payload.title}</h2><p>${String(payload.content).replace(/\n/g, '<br />')}</p><p>JobBridge</p></div>` }),
        });
        return response.ok;
      })) : [];

      let pushesSent = 0;
      if (VAPID_PUBLIC && VAPID_PRIVATE && recipients.length) {
        const ids = recipients.map((recipient) => recipient.id).join(',');
        const subscriptionsResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/push_subscriptions?select=user_id,subscription&user_id=in.(${ids})`, {
          headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        });
        const subscriptions = subscriptionsResponse.ok ? await subscriptionsResponse.json() as Array<{ subscription: webpush.PushSubscription }> : [];
        const results = await Promise.allSettled(subscriptions.map(({ subscription }) => webpush.sendNotification(subscription, JSON.stringify({ title: payload.title, body: payload.content, data: { url: '/' } }))));
        pushesSent = results.filter((result) => result.status === 'fulfilled').length;
      }

      return res.status(200).json({ success: true, recipients: recipients.length, emailsSent: emailResults.filter(Boolean).length, pushesSent });
    }

    if (!payload || !payload.user_id) {
      return res.status(400).json({ error: 'Invalid payload: user_id required' });
    }

    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/rest/v1/notifications`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{
        user_id: payload.user_id,
        type: payload.type || 'message',
        title: payload.title || '',
        content: payload.content || '',
        data: payload.data || {},
        is_read: false,
      }]),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('[api/create-notification] upstream error:', resp.status, text);
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const json = await resp.json();
    return res.status(200).json(json[0] || json);
  } catch (err: any) {
    console.error('[api/create-notification] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
