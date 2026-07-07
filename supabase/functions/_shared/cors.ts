export const ALLOWED_ORIGINS = [
  'https://jobbridge.com.ng',
  'http://jobbridge.com.ng',
  'https://tpsalm.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const corsOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}
