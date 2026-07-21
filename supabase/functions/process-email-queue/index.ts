import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const maxAttempts = 5;
  const requestBody = await req.json().catch(() => ({}));
  const queueItemId = Number(requestBody?.queue_item_id) || null;

  try {
    let qres;

    if (queueItemId) {
      qres = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${queueItemId}`, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' },
      });
    } else {
      qres = await fetch(
        `${SUPABASE_URL}/rest/v1/email_queue?attempts=lt.${maxAttempts}&or=(next_attempt_at.is.null,next_attempt_at.lte.now())&order=created_at.asc&limit=25`,
        {
          headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' },
        },
      );
    }

    if (!qres.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch queue' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const items = await qres.json();
    const results: any[] = [];

    for (const item of items) {
      const attempts = Number(item.attempts || 0);
      const payload = item.payload || {};
      const safeFrom = (payload.from || 'JobBridge <onboarding@resend.dev>').trim();
      const normalizedFrom = safeFrom.toLowerCase();
      const finalFrom = normalizedFrom.includes('@jobbridge.com.ng') || normalizedFrom.includes('@www.jobbridge.com.ng')
        ? 'JobBridge <onboarding@resend.dev>'
        : safeFrom;

      const body = {
        from: finalFrom,
        to: item.email,
        subject: payload.subject || 'JobBridge',
        html: payload.html || '<p></p>',
      };

      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          const d = await r.json();
          if (item.meta && item.meta.log_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${item.meta.log_id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ resend_id: d.id, status: 'sent' }),
            });
          }
          await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          });
          results.push({ id: item.id, status: 'sent' });
        } else {
          const txt = await r.text();
          const nextAttempts = attempts + 1;
          const nextStatus = nextAttempts >= maxAttempts ? 'failed' : 'retry';
          const delaySeconds = Math.min(3600, 30 * Math.pow(2, attempts));
          const jitterSeconds = Math.floor(Math.random() * 20);
          const nextAttemptAt = new Date(Date.now() + (delaySeconds + jitterSeconds) * 1000).toISOString();
          await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              attempts: nextAttempts,
              last_error: txt,
              last_attempted_at: new Date().toISOString(),
              next_attempt_at: nextAttemptAt,
              status: nextStatus,
            }),
          });
          if (nextStatus === 'failed' && item.meta?.log_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${item.meta.log_id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ status: 'failed' }),
            });
          }
          results.push({ id: item.id, status: nextStatus, error: txt });
        }
      } catch (e) {
        const errMsg = String(e);
        const nextAttempts = attempts + 1;
        const nextStatus = nextAttempts >= maxAttempts ? 'failed' : 'retry';
        const delaySeconds = Math.min(3600, 30 * Math.pow(2, attempts));
        const jitterSeconds = Math.floor(Math.random() * 20);
        const nextAttemptAt = new Date(Date.now() + (delaySeconds + jitterSeconds) * 1000).toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            attempts: nextAttempts,
            last_error: errMsg,
            last_attempted_at: new Date().toISOString(),
            next_attempt_at: nextAttemptAt,
            status: nextStatus,
          }),
        });
        if (nextStatus === 'failed' && item.meta?.log_id) {
          await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${item.meta.log_id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ status: 'failed' }),
          });
        }
        results.push({ id: item.id, status: nextStatus, error: errMsg });
      }
    }

    return new Response(JSON.stringify({ processed: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('process-email-queue error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
