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

  try {
    // Fetch up to 25 queued items with attempts < 5
    const qres = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?attempts=lt.5&order=created_at.asc&limit=25`, {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' },
    });
    if (!qres.ok) return new Response(JSON.stringify({ error: 'Failed to fetch queue' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const items = await qres.json();
    const results: any[] = [];

    for (const item of items) {
      try {
        const payload = item.payload || {};
        const body = { from: payload.from || 'JobBridge <onboarding@resend.dev>', to: item.email, subject: payload.subject || 'JobBridge', html: payload.html || '<p></p>' };
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (r.ok) {
          const d = await r.json();
          // update email_logs if exists
          if (item.meta && item.meta.log_id) {
            await fetch(`${SUPABASE_URL}/rest/v1/email_logs?id=eq.${item.meta.log_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({ resend_id: d.id, status: 'sent' }),
            });
          }
          // remove from queue
          await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
          results.push({ id: item.id, status: 'sent' });
        } else {
          const txt = await r.text();
          await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ attempts: item.attempts + 1, last_error: txt }) });
          results.push({ id: item.id, status: 'retry', error: txt });
        }
      } catch (e) {
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ attempts: item.attempts + 1, last_error: String(e) }) });
        results.push({ id: item.id, status: 'error', error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('process-email-queue error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
