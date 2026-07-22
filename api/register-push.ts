import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    if (req.method === 'POST') {
      const { subscription, user_id } = req.body || {};
      if (!subscription) return res.status(400).json({ error: 'Missing subscription' });

      const payload = [{
        subscription,
        user_id: user_id || null,
        created_at: new Date().toISOString(),
      }];

      const r = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/push_subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ error: 'Upstream error', details: text });
      }

      const data = await r.json();
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'DELETE') {
      const { subscription } = req.body || {};
      if (!subscription) return res.status(400).json({ error: 'Missing subscription' });

      // Attempt to delete by endpoint
      const endpoint = subscription.endpoint;
      const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;
      const r = await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ error: 'Upstream delete failed', details: text });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[api/register-push] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
