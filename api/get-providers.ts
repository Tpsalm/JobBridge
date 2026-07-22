import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    const url = new URL('/rest/v1/profiles', SUPABASE_URL.replace(/\/+$/, ''));
    // Build query to fetch providers that are not explicitly inactive
    url.searchParams.set('select', '*');
    url.searchParams.set('role', 'eq.provider');
    // supabase REST doesn't support combined neq via querystring easily; filter client-side below if needed

    const r = await fetch(`${url.toString()}?role=eq.provider`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const data = await r.json();
    // Filter out any rows with is_active === false explicitly
    const filtered = Array.isArray(data) ? data.filter((p) => p.is_active !== false) : [];

    // Sort consistent with client expectations: featured, verified, reviews_count desc
    filtered.sort((a: any, b: any) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.is_verified && !b.is_verified) return -1;
      if (!a.is_verified && b.is_verified) return 1;
      return (b.reviews_count || 0) - (a.reviews_count || 0);
    });

    return res.status(200).json(filtered);
  } catch (err: any) {
    console.error('[api/get-providers] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
