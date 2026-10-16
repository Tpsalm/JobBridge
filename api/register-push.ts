import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseConfig, isValidPushEndpoint, supabaseRequest } from './_lib/broadcast';

type PushSubscriptionInput = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};
type StoredSubscription = { user_id: string | null };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  if (['https://jobbridge.com.ng', 'https://www.jobbridge.com.ng', 'http://localhost:5173'].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to manage browser notifications.' });
    const { url, anonKey } = getSupabaseConfig();
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!auth.ok) return res.status(401).json({ error: 'Your session has expired.' });
    const user = await auth.json() as { id?: string };
    if (!user.id) return res.status(401).json({ error: 'Could not identify the signed-in user.' });

    const subscription = (req.body as { subscription?: PushSubscriptionInput } | undefined)?.subscription;
    const endpoint = subscription?.endpoint;
    if (!isValidPushEndpoint(endpoint)) return res.status(400).json({ error: 'Invalid browser push endpoint.' });

    if (req.method === 'POST') {
      const keys = subscription?.keys;
      if (typeof keys?.p256dh !== 'string' || keys.p256dh.length > 200 || typeof keys.auth !== 'string' || keys.auth.length > 100) {
        return res.status(400).json({ error: 'Invalid browser push encryption keys.' });
      }
      const query = new URLSearchParams({ select: 'user_id', endpoint: `eq.${endpoint}`, limit: '2' });
      const existing = await supabaseRequest<StoredSubscription[]>(`push_subscriptions?${query.toString()}`);
      if (existing.some((row) => row.user_id && row.user_id !== user.id)) {
        return res.status(409).json({ error: 'This browser subscription belongs to another account. Unsubscribe first.' });
      }
      if (existing.length) {
        const updateQuery = new URLSearchParams({ endpoint: `eq.${endpoint}` });
        await supabaseRequest<unknown>(`push_subscriptions?${updateQuery.toString()}`, {
          method: 'PATCH',
          body: JSON.stringify({ user_id: user.id, subscription }),
        });
      } else {
        await supabaseRequest<unknown>('push_subscriptions', {
          method: 'POST',
          body: JSON.stringify([{ user_id: user.id, endpoint, subscription }]),
        });
      }
      return res.status(200).json({ success: true });
    }

    const query = new URLSearchParams({ user_id: `eq.${user.id}`, endpoint: `eq.${endpoint}` });
    await supabaseRequest<unknown>(`push_subscriptions?${query.toString()}`, { method: 'DELETE' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[api/register-push] request failed:', error);
    return res.status(500).json({ error: 'Could not update browser notification subscription.' });
  }
}
