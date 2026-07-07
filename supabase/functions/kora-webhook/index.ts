import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const KORA_SECRET_KEY = Deno.env.get('VITE_KORA_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Allowed service role key ensures only our backend can call this
const ALLOWED_EVENTS = ['charge.success', 'charge.failed'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-korapay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface KoraWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: string;
    fee?: string;
    status: string;
    currency?: string;
    payment_reference?: string;
    transaction_status?: string;
    [key: string]: unknown;
  };
}

/**
 * Verify the HMAC SHA256 signature sent by KoraPay
 * The signature is computed over the `data` object in the payload
 */
async function verifySignature(payload: KoraWebhookPayload, signature: string | null): Promise<boolean> {
  if (!signature || !KORA_SECRET_KEY) return false;

  try {
    const dataStr = JSON.stringify(payload.data);
    const keyBytes = new TextEncoder().encode(KORA_SECRET_KEY);
    const dataBytes = new TextEncoder().encode(dataStr);

    // Use Web Crypto API for HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex === signature;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const signature = req.headers.get('x-korapay-signature');
    const payload: KoraWebhookPayload = await req.json();

    console.log('[Kora Webhook] Received event:', payload.event, 'ref:', payload.data?.reference);

    // Verify the webhook signature
    const isValid = await verifySignature(payload, signature);
    if (!isValid) {
      console.error('[Kora Webhook] Invalid signature — ignoring request');
      // Always return 200 so Kora doesn't keep retrying
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Only process charge.success events
    if (payload.event !== 'charge.success') {
      console.log(`[Kora Webhook] Ignoring event type: ${payload.event}`);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const reference = payload.data.reference || payload.data.payment_reference || '';
    if (!reference) {
      console.error('[Kora Webhook] No reference in payload');
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the payment record by reference
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('id, status, user_id')
      .eq('reference', reference)
      .maybeSingle();

    if (findError) {
      console.error('[Kora Webhook] Error finding payment:', findError.message);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (!payment) {
      console.warn(`[Kora Webhook] No payment found for reference: ${reference}`);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Skip if already verified
    if (payment.status === 'verified' || payment.status === 'completed') {
      console.log(`[Kora Webhook] Payment ${reference} already ${payment.status}`);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Update payment status to 'verified'
    // The SQL trigger `activate_plan_on_verify` auto-activates the plan
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'verified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('[Kora Webhook] Error updating payment:', updateError.message);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    console.log(`[Kora Webhook] Payment ${reference} verified successfully — plan will auto-activate`);

    // Always acknowledge with 200
    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[Kora Webhook] Error:', err);
    // Always return 200 to prevent retries on our errors
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});
