import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow cross-origin requests so your frontend can communicate with this API endpoint safely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    // 1. Clean the base Supabase URL strip trailing slashes 
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const url = new URL(`${baseUrl}/rest/v1/profiles`);
    
    // 2. Set structural URL query parameters properly without duplication
    url.searchParams.set('select', '*');
    url.searchParams.set('role', 'eq.provider');

    // 3. Perform the fetch request to your database
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const data = await response.json();
    
    // 4. Safely parse and process the array data
    const providers = Array.isArray(data) ? data : [];

    // 5. Clean client fallback sorting based strictly on columns present in your DB schema (full_name)
    providers.sort((a: any, b: any) => {
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return res.status(200).json(providers);
  } catch (err: any) {
    console.error('[api/get-providers] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
