import type { VercelRequest, VercelResponse } from '@vercel/node';

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
