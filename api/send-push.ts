import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:jobbridgesupport@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: 'VAPID keys not configured' });

  try {
    const { subscription, payload } = req.body || {};
    if (!subscription && !Array.isArray(subscription)) return res.status(400).json({ error: 'Missing subscription' });

    const p = typeof payload === 'string' ? payload : JSON.stringify(payload || { title: 'JobBridge', body: 'You have a notification' });

    const result = await webpush.sendNotification(subscription, p).catch((e) => { throw e; });
    return res.status(200).json({ success: true, result });
  } catch (err: any) {
    console.error('[api/send-push] error:', err);
    return res.status(500).json({ error: 'Failed to send push', details: String(err) });
  }
}
