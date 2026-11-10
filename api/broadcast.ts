import type { VercelRequest, VercelResponse } from '@vercel/node';
import adminBroadcastHandler from './_lib/admin-broadcast-handler.js';
import smsReceiptHandler from './_lib/broadcast-sms-receipt-handler.js';
import processBroadcastsHandler from './_lib/process-broadcasts-handler.js';
import aiOperationsHandler from './_lib/ai-operations-handler.js';
import adminHealthHandler from './_lib/admin-health-handler.js';
import { setSameOriginHeaders } from './_lib/broadcast.js';

export const config = { maxDuration: 60 };

export default function handler(req: VercelRequest, res: VercelResponse) {
  switch (req.query.endpoint) {
    case 'ai':
      return aiOperationsHandler(req, res);
    case 'health':
      return adminHealthHandler(req, res);
    case 'admin':
      return adminBroadcastHandler(req, res);
    case 'process':
      return processBroadcastsHandler(req, res);
    case 'sms-receipt':
      return smsReceiptHandler(req, res);
    case 'push-config': {
      // The VAPID public key is not a secret — every browser needs it before it can
      // create a push subscription. Serving it at runtime means Web Push keeps
      // working even when the VITE_VAPID_PUBLIC_KEY build variable is missing.
      setSameOriginHeaders(req, res);
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      if (req.method === 'OPTIONS') return res.status(204).end();
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
      const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
      return res.status(200).json({ publicKey, configured: publicKey.length > 0 });
    }
    case 'send-push':
      setSameOriginHeaders(req, res);
      if (req.method === 'OPTIONS') return res.status(204).end();
      return res.status(410).json({
        error: 'Direct push sending is retired. Use the authenticated notification campaign worker.',
      });
    default:
      return res.status(404).json({ error: 'Unknown broadcast endpoint.' });
  }
}
