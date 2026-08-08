import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');

    // Billing gate: only providers whose marketplace visibility window is open
    // (visibility_until > now) may appear in the public feed. This is the
    // monetization source of truth — subscriptions/renewals set it, and the
    // billing cron clears it at lapse/grace end.
    const nowISO = new Date().toISOString();

    // Fetch dedicated service_providers rows joined with profiles so we can
    // return enriched listings plus any profile-only providers that exist.
    const serviceProviderUrl = new URL(`${baseUrl}/rest/v1/service_providers`);
    serviceProviderUrl.searchParams.set('select', '*,profile:profiles(*)');
    serviceProviderUrl.searchParams.set('is_active', 'eq.true');
    serviceProviderUrl.searchParams.set('profile.visibility_until', `gt.${nowISO}`);

    const [spResponse, profileResponse] = await Promise.all([
      fetch(serviceProviderUrl.toString(), {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }),
      (async () => {
        const profileUrl = new URL(`${baseUrl}/rest/v1/profiles`);
        profileUrl.searchParams.set('select', '*');
        profileUrl.searchParams.set('role', 'eq.provider');
        profileUrl.searchParams.set('is_active', 'eq.true');
        profileUrl.searchParams.set('visibility_until', `gt.${nowISO}`);

        return fetch(profileUrl.toString(), {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        });
      })(),
    ]);

    let serviceProviderData: any[] = [];
    if (spResponse.ok) {
      const json = await spResponse.json();
      serviceProviderData = Array.isArray(json) ? json : [];
    } else {
      const text = await spResponse.text().catch(() => '');
      console.warn('[api/get-providers] service_providers upstream error:', spResponse.status, text);
    }

    if (!profileResponse.ok) {
      const text = await profileResponse.text().catch(() => '');
      console.warn('[api/get-providers] profiles upstream error:', profileResponse.status, text);
      return res.status(502).json({ error: 'Upstream Supabase error', details: text });
    }

    const profileJson = await profileResponse.json();
    const profileData = Array.isArray(profileJson) ? profileJson : [];

    const combined = mergeProviders(serviceProviderData, profileData);
    return res.status(200).json(normalizeProviders(combined));
  } catch (err: any) {
    console.error('[api/get-providers] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function mergeProviders(serviceProviders: any[], profileProviders: any[]) {
  const providersById = new Map<string, any>();

  for (const row of serviceProviders) {
    const profile = row.profile || {};
    const id = profile.id || row.profile_id || row.id;
    providersById.set(id, { ...row, profile });
  }

  for (const row of profileProviders) {
    const id = row.id;
    if (!providersById.has(id)) {
      providersById.set(id, row);
    }
  }

  return Array.from(providersById.values());
}

function normalizeProviders(rows: any[]): any[] {
  const normalized = rows.map((row) => {
    const profile = row.profile || row;
    return {
      id: profile.id || row.profile_id || row.id,
      email: profile.email || '',
      full_name: profile.full_name || '',
      role: profile.role || 'provider',
      company: profile.company,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      location: profile.location,
      bio: profile.bio,
      is_premium: profile.is_premium,
      subscription_tier: profile.subscription_tier,
      subscription_expires_at: profile.subscription_expires_at,
      profile_reminder_sent_at: profile.profile_reminder_sent_at,
      credits: profile.credits,
      created_at: profile.created_at || row.created_at,
      updated_at: profile.updated_at || row.updated_at,
      specialty: row.specialty || profile.specialty || profile.service_category,
      hourly_rate: row.hourly_rate ?? profile.hourly_rate,
      reviews_count: row.reviews_count ?? profile.reviews_count ?? 0,
      is_verified: row.is_verified ?? profile.is_verified ?? false,
      is_featured: profile.is_featured ?? false,
      is_active: profile.is_active ?? true,
      service_category: profile.service_category,
      skills: profile.skills || [],
      subscription: profile.subscription,
    };
  });

  normalized.sort((a, b) => {
    if ((b.is_featured ? 1 : 0) !== (a.is_featured ? 1 : 0)) {
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    }
    if ((b.is_verified ? 1 : 0) !== (a.is_verified ? 1 : 0)) {
      return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0);
    }
    return (b.reviews_count || 0) - (a.reviews_count || 0);
  });

  return normalized;
}
