import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'JobBridge <onboarding@resend.dev>';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;
const NOTIFICATION_WS_URL = process.env.NOTIFICATION_WS_URL || process.env.VITE_WS_URL || 'http://localhost:3001';
const JOBBRIDGE_WS_ADMIN_KEY = process.env.JOBBRIDGE_WS_ADMIN_KEY || 'jobbridge-local-dev';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:jobbridgesupport@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

type Recipient = { id: string; email?: string | null; phone?: string | null; full_name?: string | null };

type BroadcastTarget = {
  audience?: string;
  userId?: string;
  role?: string;
};

function normalizeChannels(value: unknown): Set<string> {
  if (!Array.isArray(value) || value.length === 0) return new Set(['in_app', 'email', 'push']);
  return new Set(value.filter((channel): channel is string => typeof channel === 'string'));
}

async function notifySocketClients(target: BroadcastTarget, payload: Record<string, unknown>) {
  if (!NOTIFICATION_WS_URL) return { delivered: 0, configured: false };

  try {
    const response = await fetch(`${NOTIFICATION_WS_URL.replace(/\/+$/, '')}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': JOBBRIDGE_WS_ADMIN_KEY,
      },
      body: JSON.stringify({
        target,
        payload: {
          ...payload,
          priority: payload.priority || 'normal',
          sentAt: payload.sentAt || new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('[api/create-notification] websocket broadcast failed:', response.status, errorText);
      return { delivered: 0, configured: true, error: errorText };
    }

    const json = await response.json().catch(() => ({}));
    return { delivered: Number(json.delivered || 0), configured: true, status: json };
  } catch (error) {
    console.warn('[api/create-notification] websocket broadcast error:', error);
    return { delivered: 0, configured: false, error: String(error) };
  }
}

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

      const targetAudience = payload.audience || 'broadcast';
      const role = payload.audience === 'recruiters' ? 'recruiter' : payload.audience === 'job_seekers' ? 'job_seeker' : payload.audience === 'providers' ? 'provider' : null;
      const userId = String(payload.audience || '').startsWith('user:') ? String(payload.audience).slice(5) : null;
      const filter = userId ? `&id=eq.${encodeURIComponent(userId)}` : role ? `&role=eq.${role}` : '';
      const recipientsResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles?select=id,email,phone,full_name${filter}`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!recipientsResponse.ok) return res.status(502).json({ error: 'Could not load broadcast recipients' });
      const recipients = await recipientsResponse.json() as Recipient[];
      const channels = normalizeChannels(payload.channels);
      const notificationRows = channels.has('in_app') ? recipients.map((recipient) => ({
        user_id: recipient.id,
        type: 'system',
        title: payload.title,
        content: payload.content,
        data: { source: 'admin_broadcast', audience: targetAudience, broadcast_type: payload.broadcast_type },
      })) : [];

      if (notificationRows.length) {
        const notificationResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/notifications`, {
          method: 'POST',
          headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(notificationRows),
        });
        if (!notificationResponse.ok) return res.status(502).json({ error: 'Could not create broadcast notifications' });
      }

      const socketResult = await notifySocketClients(
        { audience: targetAudience, userId: userId || undefined, role: role || undefined },
        {
          id: payload.id || `ws-${Date.now()}`,
          title: payload.title,
          content: payload.content,
          audience: targetAudience,
          type: payload.broadcast_type || 'announcement',
          actionUrl: payload.action_url || null,
          actionLabel: payload.action_label || null,
          priority: 'high',
          payload: {
            source: 'admin_broadcast',
            broadcast: true,
          },
        },
      );

      const emailResults = channels.has('email') && RESEND_API_KEY ? await Promise.all(recipients.filter((recipient) => recipient.email).map(async (recipient) => {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: RESEND_FROM, to: recipient.email, subject: payload.title, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${payload.title}</h2><p>${String(payload.content).replace(/\n/g, '<br />')}</p><p>JobBridge</p></div>` }),
        });
        return response.ok;
      })) : [];

      let pushesSent = 0;
      if (channels.has('push') && VAPID_PUBLIC && VAPID_PRIVATE && recipients.length) {
        const ids = recipients.map((recipient) => recipient.id).join(',');
        const subscriptionsResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/push_subscriptions?select=user_id,subscription&user_id=in.(${ids})`, {
          headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        });
        const subscriptions = subscriptionsResponse.ok ? await subscriptionsResponse.json() as Array<{ subscription: webpush.PushSubscription }> : [];
        const results = await Promise.allSettled(subscriptions.map(({ subscription }) => webpush.sendNotification(subscription, JSON.stringify({ title: payload.title, body: payload.content, data: { url: '/' } }))));
        pushesSent = results.filter((result) => result.status === 'fulfilled').length;
      }

      return res.status(200).json({
        success: true,
        recipients: recipients.length,
        notificationsSent: notificationRows.length,
        emailsSent: emailResults.filter(Boolean).length,
        pushesSent,
        websocketDelivered: socketResult.delivered,
        websocketConfigured: socketResult.configured,
      });
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
    await notifySocketClients(
      { audience: 'user', userId: payload.user_id },
      {
        id: payload.id || `ws-user-${Date.now()}`,
        title: payload.title || 'New notification',
        content: payload.content || '',
        audience: 'user',
        userId: payload.user_id,
        type: payload.type || 'message',
        priority: 'normal',
        payload: payload.data || {},
      },
    );

    return res.status(200).json(json[0] || json);
  } catch (err: any) {
    console.error('[api/create-notification] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
