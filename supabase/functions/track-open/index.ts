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
    const id = url.searchParams.get('id') || url.searchParams.get('resend_id') || '';
    const email = url.searchParams.get('email') || '';

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const body = [{ resend_id: id, email, type: 'open', status: 'opened', created_at: new Date().toISOString() }];
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
        console.warn('track-open: failed to persist', e);
      }
    }

    // Return a 1x1 transparent GIF
    const gif = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,1,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
    return new Response(gif, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
  } catch (err) {
    console.error('track-open error:', err);
    return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
});
