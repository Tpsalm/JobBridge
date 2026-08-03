import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing Supabase URL or service-role key' });
  }

  try {
    const { senderId, senderName, recipientId, recipientName, recipientEmail, message } = req.body;

    if (!senderId || !recipientId || !message) {
      return res.status(400).json({ error: 'Missing required fields: senderId, recipientId, message' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

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
        sender_name: senderName || 'Unknown',
        recipient_id: recipientId,
        recipient_name: recipientName || 'Unknown',
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
      title: `New message from ${senderName || 'Someone'}`,
      content: 'You have a new message. Open Messages to read and reply.',
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
      title: `Message sent to ${recipientName || 'Someone'}`,
      content: 'Your message was sent. Open Messages to continue the chat.',
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
  } catch (err: any) {
    console.error('[api/send-message] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}