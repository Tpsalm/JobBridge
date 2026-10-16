import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { supabaseRequest } from './_lib/broadcast.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const secret = process.env.SMS_GATEWAY_WEBHOOK_SECRET || '';
  const provided = String(req.headers['x-broadcast-webhook-secret'] || '');
  if (!secret || !provided || Buffer.byteLength(secret) !== Buffer.byteLength(provided)
    || !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const body = req.body as { message_id?: unknown; status?: unknown } | undefined;
  const messageId = typeof body?.message_id === 'string' ? body.message_id.trim() : '';
  const status = body?.status;
  if (!messageId || messageId.length > 200 || !['delivered', 'failed'].includes(String(status))) {
    return res.status(400).json({ error: 'Invalid receipt payload.' });
  }
  try {
    const rows = await supabaseRequest<Array<{ id: string; campaign_id: string }>>(
      `broadcast_deliveries?${new URLSearchParams({
        select: 'id,campaign_id',
        provider_message_id: `eq.${messageId}`,
        channel: 'eq.sms',
        status: 'eq.sent',
        limit: '1',
      })}`,
    );
    if (!rows.length) return res.status(404).json({ error: 'Unknown or already finalized provider receipt.' });
    await supabaseRequest<unknown>(`broadcast_deliveries?id=eq.${rows[0].id}&status=eq.sent`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        delivered_at: status === 'delivered' ? new Date().toISOString() : null,
        error_code: status === 'failed' ? 'sms_delivery_failed' : null,
        updated_at: new Date().toISOString(),
      }),
    });
    const [progress] = await supabaseRequest<Array<{ pending: boolean; retryable: boolean; sent_count: number; failed_count: number }>>(
      'rpc/get_broadcast_campaign_progress',
      { method: 'POST', body: JSON.stringify({ p_campaign_id: rows[0].campaign_id }) },
    );
    if (status === 'failed' && progress?.retryable) {
      await supabaseRequest<unknown>(`broadcast_campaigns?id=eq.${rows[0].campaign_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'processing', completed_at: null, updated_at: new Date().toISOString() }),
      });
    } else if (progress && !progress.pending && !progress.retryable) {
      const campaignStatus = progress.failed_count === 0 ? 'completed' : progress.sent_count > 0 ? 'partial' : 'failed';
      await supabaseRequest<unknown>(`broadcast_campaigns?id=eq.${rows[0].campaign_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: campaignStatus, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[broadcast-sms-receipt] receipt processing failed:', error);
    return res.status(500).json({ error: 'Could not process provider receipt.' });
  }
}
