export const ALLOWED_ORIGINS = [
  'https://jobbridge.com.ng',
  'https://www.jobbridge.com.ng',
  'http://jobbridge.com.ng',
  'http://www.jobbridge.com.ng',
  'https://job-bridge-theta.vercel.app',
  'https://job-bridge-ixjhuovn3-tapee2.vercel.app',
  'https://tpsalm.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

function isAllowedOrigin(origin: URL): boolean {
  const hostname = origin.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname === 'jobbridge.com.ng' || hostname === 'www.jobbridge.com.ng') return true;
  if (hostname.endsWith('.jobbridge.com.ng')) return true;
  if (hostname.endsWith('.vercel.app')) return true;
  if (hostname === 'tpsalm.github.io') return true;

  return false;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const canonicalOrigin = 'https://www.jobbridge.com.ng';
  let corsOrigin = canonicalOrigin;

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (isAllowedOrigin(parsedOrigin)) {
        corsOrigin = parsedOrigin.origin;
      }
    } catch {
      // Ignore invalid origin values and fall back to the canonical origin.
    }
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}
