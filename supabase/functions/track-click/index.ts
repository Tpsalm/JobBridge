import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('u');
    const email = url.searchParams.get('e');
    const id = url.searchParams.get('id');

    if (!target) return new Response('Missing target', { status: 400, headers: { ...corsHeaders } });

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const body = [{ resend_id: id || null, email: email || null, type: 'click', subject: null, status: 'clicked', meta: { target } }];
        await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(body),
        });
      } catch (e) {
        console.warn('track-click: failed to persist', e);
      }
    }

    // Redirect to target
    return Response.redirect(target, 302);
  } catch (err) {
    console.error('track-click error:', err);
    return new Response('Redirecting', { status: 302, headers: { Location: url.searchParams.get('u') || '/' } });
  }
});
