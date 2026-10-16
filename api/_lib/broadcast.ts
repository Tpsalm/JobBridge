import type { VercelRequest } from '@vercel/node';

export type AdminIdentity = { id: string; email?: string };

export async function requireUser(req: VercelRequest): Promise<AdminIdentity> {
  const token = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('Authentication required.');
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Authentication required.');
  return await response.json() as AdminIdentity;
}

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error('Server Supabase credentials are not configured.');
  return { url: url.replace(/\/+$/, ''), anonKey, serviceKey };
}

export async function requireAdmin(req: VercelRequest): Promise<AdminIdentity> {
  const user = await requireUser(req);
  const { url, serviceKey } = getSupabaseConfig();
  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!profileResponse.ok) throw new Error('Could not verify administrator permissions.');
  const profiles = await profileResponse.json() as Array<{ role?: string }>;
  if (profiles[0]?.role !== 'admin') throw new Error('Administrator access required.');
  return user;
}

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('[broadcast] Supabase request failed:', response.status);
    throw new Error('Database operation failed.');
  }
  return (text ? JSON.parse(text) : null) as T;
}

export function setSameOriginHeaders(req: VercelRequest, headers: { setHeader: (name: string, value: string) => void }) {
  const origin = String(req.headers.origin || '');
  const allowedOrigins = new Set([
    'https://jobbridge.com.ng',
    'https://www.jobbridge.com.ng',
    'http://localhost:5173',
  ]);
  if (allowedOrigins.has(origin)) headers.setHeader('Access-Control-Allow-Origin', origin);
  headers.setHeader('Vary', 'Origin');
  headers.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function normalizedPhone(value: unknown): string | null {
  const phone = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : '';
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function isValidPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === 'https:'
      && !endpoint.username
      && !endpoint.password
      && ['fcm.googleapis.com', 'push.services.mozilla.com', 'web.push.apple.com', 'wns.windows.com', 'notify.windows.com'].some(
        (host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`),
      );
  } catch {
    return false;
  }
}

export function isSmsGatewayConfigured(): boolean {
  const endpoint = process.env.SMS_GATEWAY_URL || '';
  const healthcheck = process.env.SMS_GATEWAY_HEALTHCHECK_URL || '';
  const sender = process.env.SMS_GATEWAY_SENDER_ID || '';
  const apiKey = process.env.SMS_GATEWAY_API_KEY || '';
  const webhookSecret = process.env.SMS_GATEWAY_WEBHOOK_SECRET || '';
  const batchSize = Number(process.env.SMS_GATEWAY_BATCH_SIZE || '50');
  const requestsPerSecond = Number(process.env.SMS_GATEWAY_REQUESTS_PER_SECOND || '1');
  try {
    return new URL(endpoint).protocol === 'https:'
      && new URL(healthcheck).protocol === 'https:'
      && /^[A-Za-z0-9 _.-]{1,11}$/.test(sender)
      && apiKey.length >= 16
      && webhookSecret.length >= 32
      && Number.isInteger(batchSize) && batchSize >= 10 && batchSize <= 50
      && Number.isFinite(requestsPerSecond) && requestsPerSecond >= 1 && requestsPerSecond <= 10;
  } catch {
    return false;
  }
}

export function estimateSmsSegments(content: string): number {
  const gsmBasic = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const gsmExtended = "^{}\\[~]|€";
  const characters = Array.from(content);
  const isGsm = characters.every((character) => gsmBasic.includes(character) || gsmExtended.includes(character));
  const units = isGsm
    ? characters.reduce((count, character) => count + (gsmExtended.includes(character) ? 2 : 1), 0)
    : content.length;
  const singleSegmentLimit = isGsm ? 160 : 70;
  const multipartSegmentLimit = isGsm ? 153 : 67;
  return units <= singleSegmentLimit ? 1 : Math.ceil(units / multipartSegmentLimit);
}
