import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Cron endpoint → triggers the Supabase `billing-daily` edge function.
// Registered in vercel.json crons[] (daily at 00:00 UTC).
// Run locally to test:  curl "http://localhost:3000/api/billing-cron?dryRun=1"

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

  const dryRun = req.query.dryRun === '1' || req.query.dry_run === '1';

  try {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const edgeUrl = `${baseUrl}/functions/v1/billing-daily${dryRun ? '?dryRun=1' : ''}`;

    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ cron: true, dry_run: dryRun }),
    });

    const text = await resp.text().catch(() => '');
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    if (!resp.ok) {
      console.warn('[api/billing-cron] billing-daily upstream error:', resp.status, text);
      return res.status(502).json({ error: 'billing-daily upstream error', status: resp.status, details: body });
    }

    console.log('[api/billing-cron] billing-daily completed:', JSON.stringify(body));
    return res.status(200).json(body);
  } catch (err: unknown) {
    console.error('[api/billing-cron] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
