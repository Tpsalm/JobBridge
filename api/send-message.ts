import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseConfig, requireUser, setSameOriginHeaders, supabaseRequest } from './_lib/broadcast';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const authenticatedUser = await requireUser(req);
    const payload = req.body as {
      senderId?: unknown;
      recipientId?: unknown;
      message?: unknown;
    } | undefined;
    const senderId = typeof payload?.senderId === 'string' ? payload.senderId : '';
    const recipientId = typeof payload?.recipientId === 'string' ? payload.recipientId : '';
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';

    if (!senderId || !recipientId || !message || message.length > 10000
      || !/^[0-9a-f-]{36}$/i.test(senderId) || !/^[0-9a-f-]{36}$/i.test(recipientId)) {
      return res.status(400).json({ error: 'Missing required fields: senderId, recipientId, message' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    if (senderId !== authenticatedUser.id) {
      return res.status(403).json({ error: 'You can only send messages as the signed-in account.' });
    }

    const { url: baseUrl, serviceKey } = getSupabaseConfig();
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    const profiles = await supabaseRequest<Array<{ id: string; full_name: string | null }>>(
      `profiles?${new URLSearchParams({ select: 'id,full_name', id: `in.(${senderId},${recipientId})` })}`,
    );
    const senderProfile = profiles.find((profile) => profile.id === senderId);
    const recipientProfile = profiles.find((profile) => profile.id === recipientId);
    if (!senderProfile || !recipientProfile) return res.status(404).json({ error: 'Message recipient was not found.' });
    const senderName = senderProfile.full_name || 'JobBridge user';
    const recipientName = recipientProfile.full_name || 'JobBridge user';

    // ── 1) Find or create conversation ──────────────────────────────────────
    // The DB has a UNIQUE index on LEAST/GREATEST(participant1_id,
    // participant2_id), so a pair can never have two threads. If a concurrent
    // request already created the thread between our find and insert, the
    // insert will fail with a unique violation (23505) and we simply re-fetch
    // the existing conversation instead of erroring out.
    const ordered = [senderId, recipientId].sort();
    const participantsFilter = `or(and(participant1_id.eq.${ordered[0]},participant2_id.eq.${ordered[1]}),and(participant1_id.eq.${ordered[1]},participant2_id.eq.${ordered[0]}))`;

    const findConversation = async (): Promise<string | null> => {
      const findUrl = new URL(`${baseUrl}/rest/v1/conversations`);
      findUrl.searchParams.set('select', 'id');
      findUrl.searchParams.set('or', participantsFilter);
      const findResp = await fetch(findUrl.toString(), { method: 'GET', headers });
      const findJson = await findResp.json().catch(() => []);
      const existing = Array.isArray(findJson) && findJson.length > 0 ? findJson[0] : null;
      return existing ? existing.id : null;
    };

    const createConversation = async (): Promise<string> => {
      const createResp = await fetch(`${baseUrl}/rest/v1/conversations`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{
          participant1_id: senderId,
          participant2_id: recipientId,
          last_message: null,
          last_message_at: null,
        }]),
      });

      if (!createResp.ok) {
        const text = await createResp.text().catch(() => '');
        // Unique violation for the pair → someone else created it concurrently.
        if (text.includes('23505')) {
          const raced = await findConversation();
          if (raced) return raced;
        }
        console.warn('[api/send-message] create conversation failed:', createResp.status, text);
        throw new Error('Failed to create conversation');
      }

      const createJson = await createResp.json();
      return Array.isArray(createJson) ? createJson[0].id : createJson.id;
    };

    let conversationId = await findConversation();
    if (!conversationId) {
      conversationId = await createConversation();
    }

    // ── 2) Insert the message ──────────────────────────────────────────────
    const msgResp = await fetch(`${baseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify([{
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        recipient_id: recipientId,
        recipient_name: recipientName,
        content: message,
        is_read: false,
      }]),
    });

    if (!msgResp.ok) {
      const text = await msgResp.text().catch(() => '');
      console.warn('[api/send-message] insert message failed:', msgResp.status, text);
      return res.status(502).json({ error: 'Failed to insert message', details: text });
    }

    // ── 3) Create notifications ────────────────────────────────────────────
    // The UNIFIED CHAT SPACE rule says message content lives ONLY inside the
    // dedicated conversation thread. Notifications are deliberately kept as a
    // lightweight "you have a new message" signal — they NEVER embed the
    // message text, so no preview can leak outside the chat view.
    const recipientNotification = {
      user_id: recipientId,
      type: 'message',
      title: `New message from ${senderName}`,
      content: `${senderName} sent you a message on JobBridge. Open Messages to read and reply.`,
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        direction: 'incoming',
        related_id: senderId,
        sender_name: senderName,
        recipient_name: recipientName,
      },
    };

    const senderNotification = {
      user_id: senderId,
      type: 'message',
      title: `Message sent to ${recipientName}`,
      content: `Your message to ${recipientName} was sent successfully. Open Messages to continue the conversation.`,
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        direction: 'outgoing',
        related_id: recipientId,
        sender_name: senderName,
        recipient_name: recipientName,
      },
    };

    // Fire-and-forget notifications (non-blocking)
    Promise.allSettled([
      fetch(`${baseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify([recipientNotification]),
      }),
      fetch(`${baseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify([senderNotification]),
      }),
    ]).catch(e => console.warn('[api/send-message] notification creation failed:', e));

    return res.status(200).json({
      success: true,
      conversationId,
    });
  } catch (err: unknown) {
    console.error('[api/send-message] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}