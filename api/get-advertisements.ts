import type { VercelRequest, VercelResponse } from '@vercel/node';

// Public endpoint: returns ACTIVE advertisements created by business users
// who subscribed to the Business Advertisement package. Uses the service-role
// key (bypasses RLS) so ALL users — including brand-new accounts and anonymous
// visitors — can see every successfully created advert, matching how
// get-providers.ts exposes public marketplace content.
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

  try {
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const nowIso = new Date().toISOString();

    // Auto-expiry sweep (best-effort, fire-and-forget): flips any advert whose
    // paid duration (expires_at) has elapsed to status='expired' / is_active=
    // false. Runs on every marketplace read AND on the daily Vercel cron
    // (vercel.json points the cron at this endpoint) so the stored status
    // column self-cleans automatically — a 7-day advert expires after day 7
    // and a 30-day advert after day 30. Failures never block the response.
    const sweepUrl = new URL(`${baseUrl}/rest/v1/advertisements`);
    sweepUrl.searchParams.set('status', 'in.(active,pending,paused)');
    sweepUrl.searchParams.set('expires_at', `lt.${nowIso}`);
    fetch(sweepUrl.toString(), {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'expired', is_active: false, updated_at: nowIso }),
    }).catch((e) => console.warn('[api/get-advertisements] expiry sweep failed:', e));

    const url = new URL(`${baseUrl}/rest/v1/advertisements`);
    url.searchParams.set('select', '*');
    url.searchParams.set('status', 'eq.active');
    // Auto-expiry: never serve an advert whose paid duration (expires_at) has
    // elapsed — even if the sweep hasn't flipped `status` yet. Adverts without
    // an expiry (legacy rows) remain visible.
    url.searchParams.set('or', `(expires_at.is.null,expires_at.gte.${nowIso})`);
    // Fetch most recent first; featured-priority sorting happens below so the
    // "spotlight" placement is always accurate regardless of DB ordering.
    url.searchParams.set('order', 'created_at.desc');

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
      console.warn('[api/get-advertisements] upstream error:', resp.status, text);
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const json = await resp.json();
    const rows = Array.isArray(json) ? json : [];

    // Strategic priority: adverts from the premium business plan (Featured
    // Business / package='featured' / is_featured=true) rank first so they land
    // in the homepage spotlight. Then monthly, then weekly, then oldest.
    // Featured priority is driven by the `is_featured` flag (the authoritative
    // "Featured Business" indicator) OR the `featured` package, then monthly,
    // then weekly — this mirrors the homepage spotlight so featured ads always
    // surface first regardless of which package the owner originally chose.
    const packageRank = (ad: any) =>
      ad.is_featured || ad.package === 'featured' ? 0 : ad.package === 'monthly' ? 1 : 2;
    rows.sort((a: any, b: any) => {
      const rankDiff = packageRank(a) - packageRank(b);
      if (rankDiff !== 0) return rankDiff;
      // Within the same package, featured-flagged ads float to the top.
      const featuredDiff = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
      if (featuredDiff !== 0) return featuredDiff;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return res.status(200).json(rows);
  } catch (err: any) {
    console.error('[api/get-advertisements] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
