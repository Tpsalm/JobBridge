import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseConfig, isSmsGatewayConfigured, isValidPushEndpoint, normalizedPhone, supabaseRequest } from './_lib/broadcast';

type ClaimedDelivery = {
  delivery_id: string;
  campaign_id: string;
  user_id: string;
  channel: 'in_app' | 'push' | 'sms';
  attempt_number: number;
};
type Campaign = {
  id: string;
  title: string;
  content: string;
  action_url: string | null;
  action_label: string | null;
  broadcast_type: string;
};
type PushSubscription = { endpoint: string; subscription: webpush.PushSubscription };
type Profile = {
  id: string;
  phone: string | null;
  phone_verified: boolean | null;
  sms_broadcast_opt_in: boolean | null;
};

const MAX_BATCH = 100;
const RETRY_LIMIT = 4;

export const config = { maxDuration: 60 };

function responseError(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ error });
}

async function updateDelivery(
  delivery: ClaimedDelivery,
  status: string,
  errorCode?: string,
  providerMessageId?: string,
  retryDelayMs?: number,
) {
  const defaultRetryDelay = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, delivery.attempt_number - 1));
  const retryAt = new Date(Date.now() + Math.max(0, Math.min(24 * 60 * 60_000, retryDelayMs ?? defaultRetryDelay))).toISOString();
  const finalStatus = status === 'failed' && delivery.attempt_number >= RETRY_LIMIT ? 'failed' : status;
  const safeErrorCode = errorCode?.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80) || null;
  const safeProviderMessageId = providerMessageId?.trim().slice(0, 200) || null;
  await supabaseRequest<unknown>(`broadcast_deliveries?id=eq.${delivery.delivery_id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: finalStatus,
      error_code: safeErrorCode,
      provider_message_id: safeProviderMessageId,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      next_attempt_at: finalStatus === 'failed' ? retryAt : new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function sendInAppBatch(deliveries: ClaimedDelivery[], campaign: Campaign) {
  await supabaseRequest<unknown>('notifications', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(deliveries.map((delivery) => ({
        user_id: delivery.user_id,
        type: 'system',
        title: campaign.title,
        content: campaign.content,
        data: {
          source: 'admin_broadcast',
          campaign_id: campaign.id,
          broadcast_type: campaign.broadcast_type,
          action_url: campaign.action_url,
          action_label: campaign.action_label,
        },
        broadcast_delivery_id: delivery.delivery_id,
      }))),
  });
  for (let offset = 0; offset < deliveries.length; offset += 20) {
      await Promise.all(deliveries.slice(offset, offset + 20).map((delivery) => updateDelivery(delivery, 'sent')));
  }
}

async function sendPush(delivery: ClaimedDelivery, campaign: Campaign) {
  const subscriptions = await supabaseRequest<PushSubscription[]>(
    `push_subscriptions?${new URLSearchParams({ select: 'endpoint,subscription', user_id: `eq.${delivery.user_id}`, limit: '100' })}`,
  );
  const validSubscriptions = subscriptions.filter((item) => isValidPushEndpoint(item.endpoint));
  const invalidSubscriptions = subscriptions.filter((item) => !isValidPushEndpoint(item.endpoint));
  await Promise.all(invalidSubscriptions.map((item) => supabaseRequest<unknown>(
    `push_subscriptions?${new URLSearchParams({ endpoint: `eq.${item.endpoint}`, user_id: `eq.${delivery.user_id}` })}`,
    { method: 'DELETE' },
  )));
  if (!validSubscriptions.length) return updateDelivery(delivery, 'skipped', subscriptions.length ? 'invalid_push_subscription' : 'no_push_subscription');
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return updateDelivery(delivery, 'failed', 'push_not_configured');
  webpush.setVapidDetails('mailto:jobbridgesupport@gmail.com', publicKey, privateKey);

  const outcomes = await Promise.allSettled(validSubscriptions.map(async (item) => {
    try {
      await webpush.sendNotification(item.subscription, JSON.stringify({
        title: campaign.title,
        body: campaign.content,
        tag: `jobbridge-broadcast-${campaign.id}`,
        data: { url: campaign.action_url || '/notifications' },
      }));
      return true;
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseRequest<unknown>(
          `push_subscriptions?${new URLSearchParams({ endpoint: `eq.${item.endpoint}`, user_id: `eq.${delivery.user_id}` })}`,
          { method: 'DELETE' },
        );
      }
      throw error;
    }
  }));
  const accepted = outcomes.some((result) => result.status === 'fulfilled' && result.value);
  if (accepted) return updateDelivery(delivery, 'sent');
  const firstFailure = outcomes.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  const error = firstFailure?.reason;
  const code = typeof error === 'object' && error !== null && 'statusCode' in error
    ? `push_${String((error as { statusCode: unknown }).statusCode)}`
    : 'push_provider_error';
  await updateDelivery(delivery, 'failed', code);
}

async function sendSmsBatch(deliveries: ClaimedDelivery[], campaign: Campaign) {
  const endpoint = process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_GATEWAY_API_KEY;
  const sender = process.env.SMS_GATEWAY_SENDER_ID;
  const batchSize = Number(process.env.SMS_GATEWAY_BATCH_SIZE || '50');
  const requestsPerSecond = Number(process.env.SMS_GATEWAY_REQUESTS_PER_SECOND || '1');
  if (!endpoint || !apiKey || !sender || !isSmsGatewayConfigured()) {
    await Promise.all(deliveries.map((delivery) => updateDelivery(delivery, 'failed', 'sms_not_configured')));
    return;
  }
  const ids = [...new Set(deliveries.map((delivery) => delivery.user_id))];
  const params = new URLSearchParams({
    select: 'id,phone,phone_verified,sms_broadcast_opt_in',
    id: `in.(${ids.join(',')})`,
  });
  const profiles = await supabaseRequest<Profile[]>(`profiles?${params.toString()}`);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const eligible: Array<{ delivery: ClaimedDelivery; phone: string }> = [];
  for (const delivery of deliveries) {
    const profile = byId.get(delivery.user_id);
    const phone = normalizedPhone(profile?.phone);
    if (!profile?.sms_broadcast_opt_in || !profile.phone_verified || !phone) {
      await updateDelivery(delivery, 'skipped', 'no_verified_consent');
      continue;
    }
    eligible.push({ delivery, phone });
  }
  for (let offset = 0; offset < eligible.length; offset += batchSize) {
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, Math.ceil(1000 / requestsPerSecond)));
    const batch = eligible.slice(offset, offset + batchSize);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender,
          messages: batch.map(({ delivery, phone }) => ({
            to: phone,
            message: campaign.content,
            client_reference: delivery.delivery_id,
          })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        const retryAfterDate = retryAfter && Number.isNaN(Number(retryAfter)) ? Date.parse(retryAfter) : NaN;
        const retryDelay = retryAfter
          ? Number.isNaN(retryAfterDate)
            ? Number.isFinite(Number(retryAfter))
              ? Number(retryAfter) * 1000
              : undefined
            : Math.max(0, retryAfterDate - Date.now())
          : undefined;
        await Promise.all(batch.map(({ delivery }) => updateDelivery(
          delivery,
          'failed',
          `sms_http_${response.status}`,
          undefined,
          retryDelay,
        )));
        continue;
      }
      const result = await response.json() as {
        messages?: Array<{ client_reference?: string; accepted?: boolean; message_id?: string; error_code?: string }>;
      };
      if (!Array.isArray(result.messages)) {
        await Promise.all(batch.map(({ delivery }) => updateDelivery(delivery, 'failed', 'invalid_sms_provider_response')));
        continue;
      }
      const responses = new Map(result.messages.map((item) => [item.client_reference, item]));
      await Promise.all(batch.map(async ({ delivery }) => {
        const receipt = responses.get(delivery.delivery_id);
        if (!receipt?.accepted || typeof receipt.message_id !== 'string' || !receipt.message_id.trim()) {
          await updateDelivery(delivery, 'failed', receipt?.error_code || 'sms_not_accepted');
          return;
        }
        await updateDelivery(delivery, 'sent', undefined, receipt.message_id);
      }));
    } catch (error) {
      console.error('[broadcast-worker] SMS gateway request failed:', error);
      await Promise.all(batch.map(({ delivery }) => updateDelivery(delivery, 'failed', 'sms_gateway_error')));
    }
  }
}

async function finalizeCampaigns(campaignIds: string[]) {
  for (const id of new Set(campaignIds)) {
    const [progress] = await supabaseRequest<Array<{ pending: boolean; retryable: boolean; sent_count: number; failed_count: number }>>(
      'rpc/get_broadcast_campaign_progress',
      { method: 'POST', body: JSON.stringify({ p_campaign_id: id }) },
    );
    if (!progress || progress.pending || progress.retryable) continue;
    const status = progress.failed_count === 0 ? 'completed' : progress.sent_count > 0 ? 'partial' : 'failed';
    await supabaseRequest<unknown>(`broadcast_campaigns?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
  }
}

async function runBatch() {
  const claimed = await supabaseRequest<ClaimedDelivery[]>('rpc/claim_broadcast_deliveries', {
    method: 'POST',
    body: JSON.stringify({ p_limit: MAX_BATCH }),
  });
  const campaigns = await supabaseRequest<Campaign[]>(
    `broadcast_campaigns?${new URLSearchParams({ select: 'id,title,content,action_url,action_label,broadcast_type', id: `in.(${[...new Set(claimed.map((item) => item.campaign_id))].join(',') || '00000000-0000-0000-0000-000000000000'})` })}`,
  );
  const byCampaign = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const smsDeliveries = new Map<string, ClaimedDelivery[]>();
  const inAppByCampaign = new Map<string, ClaimedDelivery[]>();
  const pushDeliveries: ClaimedDelivery[] = [];
  for (const delivery of claimed) {
    if (delivery.channel === 'sms') {
      const group = smsDeliveries.get(delivery.campaign_id) || [];
      group.push(delivery);
      smsDeliveries.set(delivery.campaign_id, group);
    } else if (delivery.channel === 'push') {
      pushDeliveries.push(delivery);
    } else {
      const group = inAppByCampaign.get(delivery.campaign_id) || [];
      group.push(delivery);
      inAppByCampaign.set(delivery.campaign_id, group);
    }
  }
  for (const [campaignId, deliveries] of inAppByCampaign) {
    const campaign = byCampaign.get(campaignId);
    try {
      if (!campaign) throw new Error('Campaign not found.');
      await sendInAppBatch(deliveries, campaign);
    } catch {
      console.error('[broadcast-worker] in-app batch failed:', campaignId);
      await Promise.all(deliveries.map((delivery) => updateDelivery(delivery, 'failed', 'in_app_error').catch(() => undefined)));
    }
  }
  for (let offset = 0; offset < pushDeliveries.length; offset += 20) {
    await Promise.all(pushDeliveries.slice(offset, offset + 20).map(async (delivery) => {
      try {
        const campaign = byCampaign.get(delivery.campaign_id);
        if (!campaign) throw new Error('Campaign not found.');
        await sendPush(delivery, campaign);
      } catch {
        console.error('[broadcast-worker] push delivery failed:', delivery.delivery_id);
        await updateDelivery(delivery, 'failed', 'push_delivery_error').catch(() => undefined);
      }
    }));
  }
  for (const [campaignId, deliveries] of smsDeliveries) {
    const campaign = byCampaign.get(campaignId);
    if (!campaign) {
      await Promise.all(deliveries.map((delivery) => updateDelivery(delivery, 'failed', 'campaign_not_found')));
      continue;
    }
    await sendSmsBatch(deliveries, campaign);
  }
  await finalizeCampaigns(claimed.map((delivery) => delivery.campaign_id));
  return { claimed: claimed.length, campaignCount: new Set(claimed.map((delivery) => delivery.campaign_id)).size };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return responseError(res, 405, 'Method not allowed.');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!cronSecret || !providedSecret || Buffer.byteLength(providedSecret) !== Buffer.byteLength(cronSecret)
    || !timingSafeEqual(Buffer.from(providedSecret), Buffer.from(cronSecret))) {
    return responseError(res, 401, 'Unauthorized.');
  }
  try {
    getSupabaseConfig();
    const result = await runBatch();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[broadcast-worker] batch failed:', error);
    return responseError(res, 500, 'Broadcast batch failed.');
  }
}
