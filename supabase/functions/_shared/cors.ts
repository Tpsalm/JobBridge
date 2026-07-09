export const ALLOWED_ORIGINS = [
  'https://jobbridge.com.ng',
  'https://www.jobbridge.com.ng',
  'http://jobbridge.com.ng',
  'http://www.jobbridge.com.ng',
  'https://tpsalm.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

const ALLOWED_HOSTNAMES = new Set([
  'jobbridge.com.ng',
  'www.jobbridge.com.ng',
  'tpsalm.github.io',
  'localhost',
]);

export function getCorsHeaders(origin: string | null): Record<string, string> {
  let corsOrigin = ALLOWED_ORIGINS[0];

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (ALLOWED_HOSTNAMES.has(parsedOrigin.hostname.toLowerCase())) {
        corsOrigin = origin;
      }
    } catch {
      // Ignore invalid origin values and fall back to default origin.
    }
  }

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
