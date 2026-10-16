import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setSameOriginHeaders, supabaseRequest } from './_lib/broadcast.js';

const isProduction = process.env.NODE_ENV === 'production';
const NOTIFICATION_WS_URL = process.env.NOTIFICATION_WS_URL || (isProduction ? '' : 'http://localhost:3001');
const JOBBRIDGE_WS_ADMIN_KEY = process.env.JOBBRIDGE_WS_ADMIN_KEY || (isProduction ? '' : 'jobbridge-local-dev');

type BroadcastTarget = { audience?: string; userId?: string };

async function notifySocketClients(target: BroadcastTarget, payload: Record<string, unknown>) {
  if (!NOTIFICATION_WS_URL || !JOBBRIDGE_WS_ADMIN_KEY) {
    return { delivered: 0, configured: false, error: 'Notification socket URL or admin key is not configured' };
  }

  try {
    const response = await fetch(`${NOTIFICATION_WS_URL.replace(/\/+$/, '')}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': JOBBRIDGE_WS_ADMIN_KEY,
      },
      body: JSON.stringify({
        target,
        payload: {
          ...payload,
          priority: payload.priority || 'normal',
          sentAt: payload.sentAt || new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('[api/create-notification] websocket broadcast failed:', response.status, errorText);
      return { delivered: 0, configured: true, error: errorText };
    }

    const json = await response.json().catch(() => ({}));
    const delivered = Number(json.delivered);
    return { delivered: Number.isFinite(delivered) && delivered > 0 ? delivered : 0, configured: true, status: json };
  } catch (error) {
    console.warn('[api/create-notification] websocket broadcast error:', error);
    return { delivered: 0, configured: false, error: String(error) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const payload = req.body as {
      broadcast?: boolean;
      user_id?: unknown;
      type?: unknown;
      title?: unknown;
      content?: unknown;
      data?: Record<string, unknown>;
    } | undefined;
    if (payload?.broadcast) {
      return res.status(410).json({ error: 'The legacy broadcast endpoint is retired. Use the authenticated campaign dashboard.' });
    }
    const user = await requireUser(req);
    if (!payload || typeof payload.user_id !== 'string' || payload.type !== 'message') {
      return res.status(400).json({ error: 'Only message notifications are supported.' });
    }

    const conversationId = typeof payload.data?.conversation_id === 'string' ? payload.data.conversation_id : '';
    const senderId = typeof payload.data?.sender_id === 'string' ? payload.data.sender_id : '';
    const recipientId = typeof payload.data?.recipient_id === 'string' ? payload.data.recipient_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(conversationId) || senderId !== user.id
      || !/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === senderId
      || ![senderId, recipientId].includes(payload.user_id)) {
      return res.status(403).json({ error: 'You can only create a notification for a message you sent.' });
    }

    const messages = await supabaseRequest<Array<{ id: string }>>(
      `messages?${new URLSearchParams({
        select: 'id',
        conversation_id: `eq.${conversationId}`,
        sender_id: `eq.${senderId}`,
        recipient_id: `eq.${recipientId}`,
        limit: '1',
      })}`,
    );
    if (!messages.length) return res.status(403).json({ error: 'No matching sent message was found.' });

    const direction = payload.user_id === senderId ? 'outgoing' : 'incoming';
    const safeData = {
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      direction,
      related_id: direction === 'incoming' ? senderId : recipientId,
    };
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
    const content = typeof payload.content === 'string' ? payload.content.trim().slice(0, 500) : '';
    if (!title || !content) return res.status(400).json({ error: 'A message notification title and content are required.' });

    const rows = await supabaseRequest<Array<{ id: string }>>('notifications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{
        user_id: payload.user_id,
        type: 'message',
        title,
        content,
        data: safeData,
        is_read: false,
      }]),
    });
    await notifySocketClients(
      { audience: 'user', userId: payload.user_id },
      { id: rows[0]?.id, title, content, audience: 'user', userId: payload.user_id, type: 'message', payload: safeData },
    );
    return res.status(200).json(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    const status = message === 'Authentication required.' ? 401 : 500;
    if (status === 500) console.error('[api/create-notification] request failed:', error);
    return res.status(status).json({ error: status === 401 ? message : 'Could not create notification.' });
  }
}
