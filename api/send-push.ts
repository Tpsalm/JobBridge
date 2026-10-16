import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSameOriginHeaders } from './_lib/broadcast';

export default function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(410).json({
    error: 'Direct push sending is retired. Use the authenticated notification campaign worker.',
  });
}
