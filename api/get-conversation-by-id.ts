import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  const conversationId = req.query.conversationId as string;
  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversationId query parameter' });
  }

  try {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const url = new URL(`${baseUrl}/rest/v1/conversations`);
    url.searchParams.set('select', '*,participant1:profiles!participant1_id(id,full_name,email),participant2:profiles!participant2_id(id,full_name,email)');
    url.searchParams.set('id', `eq.${conversationId}`);

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('[api/get-conversation-by-id] upstream error:', resp.status, text);
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const json = await resp.json();
    const data = Array.isArray(json) ? json[0] || null : json;
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/get-conversation-by-id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}