import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseConfig, isSmsGatewayConfigured, requireAdmin, setSameOriginHeaders } from './broadcast.js';

type HealthState = 'ready' | 'not_configured' | 'disabled';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    await requireAdmin(req);
    const supabaseConfigured = (() => {
      try {
        getSupabaseConfig();
        return true;
      } catch {
        return false;
      }
    })();
    const checks = [
      {
        name: 'Supabase API and database',
        status: supabaseConfigured ? 'ready' as HealthState : 'not_configured' as HealthState,
        detail: supabaseConfigured ? 'Administrator session and server credentials verified.' : 'Server-side Supabase credentials are missing.',
      },
      {
        name: 'Joba AI (Google Gemini)',
        status: process.env.GEMINI_API_KEY ? 'ready' as HealthState : 'not_configured' as HealthState,
        detail: process.env.GEMINI_API_KEY ? 'Server-side AI key is configured.' : 'Set GEMINI_API_KEY in the server environment.',
      },
      {
        name: 'Notification email (Resend)',
        status: process.env.RESEND_API_KEY ? 'ready' as HealthState : 'not_configured' as HealthState,
        detail: process.env.RESEND_API_KEY ? 'Server-side email key is configured; delivery is not tested by this check.' : 'Set RESEND_API_KEY in the server environment.',
      },
      {
        name: 'Web push',
        status: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'ready' as HealthState : 'not_configured' as HealthState,
        detail: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'VAPID keys are configured.' : 'Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
      },
      {
        name: 'SMS gateway',
        status: isSmsGatewayConfigured() ? 'ready' as HealthState : 'disabled' as HealthState,
        detail: isSmsGatewayConfigured() ? 'Gateway configuration passed validation.' : 'SMS is disabled until a provider passes configuration validation.',
      },
    ];
    return res.status(200).json({ checks, checkedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'Authentication required.' ? 401
      : message === 'Administrator access required.' ? 403
        : 500;
    if (status === 500) console.error('[admin-health] Health check failed:', error);
    return res.status(status).json({
      error: status === 401 || status === 403 ? message : 'Could not verify backend configuration.',
    });
  }
}
