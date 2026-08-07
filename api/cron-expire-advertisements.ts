import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Cron job (see vercel.json crons) + manual trigger.
// Flips any advertisement whose paid duration (expires_at) has elapsed to
// status='expired' and is_active=false, so the database self-cleans
// automatically after the 7th / 30th day.
//
// Uses the service-role key with a PostgREST UPDATE (which bypasses RLS) so
// this works immediately after deploy WITHOUT needing the optional
// expire_advertisements() DB function from
// supabase/migrations/20260731_004_advertisements_auto_expire.sql.
//
// NOTE: Query-time filtering (api/get-advertisements.ts and
// fetchPublicAdvertisements) guarantees expired adverts are hidden from the
// marketplace the exact second their paid period ends — this sweep only keeps
// the stored `status` column accurate.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // If CRON_SECRET is configured, require it (Vercel Cron sends it as a
  // Bearer token when the project has a cron secret set).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const nowIso = new Date().toISOString();
    const url = new URL(`${baseUrl}/rest/v1/advertisements`);
    url.searchParams.set('status', 'in.(active,pending,paused)');
    url.searchParams.set('expires_at', `lt.${nowIso}`);

    const resp = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'expired',
        is_active: false,
        updated_at: nowIso,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('[api/cron-expire-advertisements] sweep error:', resp.status, text);
      return res.status(502).json({ error: 'Advertisement expiry sweep failed', details: text });
    }

    let expired = 0;
    try {
      const json = await resp.json();
      expired = Array.isArray(json) ? json.length : 0;
    } catch {
      // 204 no content — nothing to parse, sweep ran fine.
    }

    return res.status(200).json({ ok: true, expired });
  } catch (err: any) {
    console.error('[api/cron-expire-advertisements] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
