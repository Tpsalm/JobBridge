import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  estimateSmsSegments,
  getSupabaseConfig,
  isSmsGatewayConfigured,
  normalizedPhone,
  requireAdmin,
  setSameOriginHeaders,
  supabaseRequest,
} from './_lib/broadcast';

type Audience = { type: 'all' } | { type: 'role'; role: string } | { type: 'selected'; userIds: string[] };
type ProfileRecipient = {
  id: string;
  role: string | null;
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  sms_broadcast_opt_in: boolean | null;
};
type Campaign = {
  id: string;
  title: string;
  content: string;
  channels: string[];
  audience: Audience;
  status: string;
  scheduled_at: string;
  created_at: string;
  recipient_count: number;
  sms_estimated_segments: number;
  sms_estimated_cost_ngn: number;
  is_test: boolean;
  action_url: string | null;
  action_label: string | null;
  broadcast_type: string;
  idempotency_key: string;
};
type SmsGatewayCheck = { enabled: boolean; reason?: string; costPerSegment?: number };

class BroadcastRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BroadcastRequestError';
  }
}

const MAX_RECIPIENTS = 5000;
const PAGE_SIZE = 1000;
const ALLOWED_ROLES = new Set(['job_seeker', 'recruiter', 'provider']);
const ALLOWED_CHANNELS = new Set(['in_app', 'push', 'sms']);

export const config = { maxDuration: 60 };

function fail(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\p{Cc}]/gu, (character) => ['\n', '\r', '\t'].includes(character) ? character : '').trim().slice(0, max)
    : '';
}

function validateActionUrl(value: unknown): string | null {
  const actionUrl = cleanText(value, 300);
  if (actionUrl) {
    try {
      const parsed = new URL(actionUrl, 'https://jobbridge.com.ng');
      if (!actionUrl.startsWith('/') || actionUrl.startsWith('//') || /[\\\r\n]/.test(actionUrl)
        || parsed.origin !== 'https://jobbridge.com.ng') throw new Error();
    } catch {
      throw new BroadcastRequestError(400, 'Action links must be safe, relative Jobbridge paths.');
    }
  }
  return actionUrl || null;
}

function parseAudience(value: unknown): Audience | null {
  if (!value || typeof value !== 'object') return null;
  const audience = value as Record<string, unknown>;
  if (audience.type === 'all') return { type: 'all' };
  if (audience.type === 'role' && typeof audience.role === 'string' && ALLOWED_ROLES.has(audience.role)) {
    return { type: 'role', role: audience.role };
  }
  if (
    audience.type === 'selected'
    && Array.isArray(audience.userIds)
    && audience.userIds.length > 0
    && audience.userIds.length <= MAX_RECIPIENTS
    && audience.userIds.every((id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  ) {
    return { type: 'selected', userIds: [...new Set(audience.userIds as string[])] };
  }
  return null;
}

async function getRecipients(audience: Audience): Promise<ProfileRecipient[]> {
  const rows: ProfileRecipient[] = [];
  if (audience.type === 'selected') {
    for (let start = 0; start < audience.userIds.length; start += 100) {
      const ids = audience.userIds.slice(start, start + 100);
      const params = new URLSearchParams({
        select: 'id,role,full_name,phone,phone_verified,sms_broadcast_opt_in',
        id: `in.(${ids.join(',')})`,
        limit: String(ids.length),
      });
      rows.push(...await supabaseRequest<ProfileRecipient[]>(`profiles?${params.toString()}`));
    }
    return rows.filter((row) => row.role !== 'admin');
  }
  let lastId = '';
  for (;;) {
    const params = new URLSearchParams({
      select: 'id,role,full_name,phone,phone_verified,sms_broadcast_opt_in',
      order: 'id.asc',
      limit: String(PAGE_SIZE),
    });
    if (audience.type === 'role') params.set('role', `eq.${audience.role}`);
    if (audience.type === 'all') params.set('or', '(role.neq.admin,role.is.null)');
    if (lastId) params.set('id', `gt.${lastId}`);
    const page = await supabaseRequest<ProfileRecipient[]>(`profiles?${params.toString()}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    if (rows.length > MAX_RECIPIENTS) throw new BroadcastRequestError(400, `Audience exceeds the ${MAX_RECIPIENTS.toLocaleString()} recipient campaign limit.`);
    lastId = page[page.length - 1].id;
  }
  return rows.filter((row) => row.role !== 'admin');
}

async function getPushUserIds(userIds: string[]): Promise<Set<string>> {
  const subscriptions = await supabaseRequest<Array<{ user_id: string }>>(
    'rpc/get_push_recipient_user_ids',
    { method: 'POST', body: JSON.stringify({ p_user_ids: userIds }) },
  );
  return new Set(subscriptions.map(({ user_id }) => user_id));
}

async function checkSmsGateway(): Promise<SmsGatewayCheck> {
  if (!isSmsGatewayConfigured()) return { enabled: false, reason: 'SMS gateway credentials, sender ID, HTTPS health-check URL, webhook secret, or segment pricing are incomplete.' };
  const costPerSegment = Number(process.env.SMS_GATEWAY_COST_PER_SEGMENT_NGN);
  if (!Number.isFinite(costPerSegment) || costPerSegment < 0) {
    return { enabled: false, reason: 'SMS_GATEWAY_COST_PER_SEGMENT_NGN must be a valid non-negative amount.' };
  }
  try {
    const response = await fetch(process.env.SMS_GATEWAY_HEALTHCHECK_URL!, {
      headers: { Authorization: `Bearer ${process.env.SMS_GATEWAY_API_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { enabled: false, reason: `Configured SMS gateway health check failed (${response.status}).` };
    return { enabled: true, costPerSegment };
  } catch {
    return { enabled: false, reason: 'Configured SMS gateway is currently unreachable.' };
  }
}

async function preview(input: Record<string, unknown>) {
  const title = cleanText(input.title, 120);
  const content = cleanText(input.content, 4000);
  validateActionUrl(input.actionUrl);
  const audience = parseAudience(input.audience);
  const channels = Array.isArray(input.channels)
    ? [...new Set(input.channels.filter((channel): channel is string => typeof channel === 'string'))]
    : [];
  if (!title || !content || !audience) throw new BroadcastRequestError(400, 'Provide a title, message, and valid audience.');
  if (!channels.length || channels.some((channel) => !ALLOWED_CHANNELS.has(channel))) {
    throw new BroadcastRequestError(400, 'Choose at least one supported channel: in-app, web push, or SMS.');
  }

  const recipients = await getRecipients(audience);
  const testMode = input.testMode === true;
  if (testMode && (audience.type !== 'selected' || recipients.length > 5)) {
    throw new BroadcastRequestError(400, 'A test campaign must target a selected audience of five users or fewer.');
  }
  const ids = recipients.map((recipient) => recipient.id);
  const eligibleSms = recipients.filter((recipient) => recipient.sms_broadcast_opt_in && recipient.phone_verified && normalizedPhone(recipient.phone));
  const smsGateway = channels.includes('sms') ? await checkSmsGateway() : { enabled: false, reason: 'SMS was not selected.' };
  if (channels.includes('sms') && !smsGateway.enabled) {
    throw new BroadcastRequestError(503, smsGateway.reason || 'SMS is not configured.');
  }
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (channels.includes('push') && !pushConfigured) throw new BroadcastRequestError(503, 'Web push is not configured on the server.');
  const pushUserIds = channels.includes('push') ? await getPushUserIds(ids) : new Set<string>();
  const segmentsPerMessage = estimateSmsSegments(content);
  const smsSegments = channels.includes('sms') ? eligibleSms.length * segmentsPerMessage : 0;
  const smsCost = channels.includes('sms') ? smsSegments * (smsGateway.costPerSegment ?? 0) : 0;
  let testCampaignRequired = false;
  if (audience.type === 'all' && !testMode) {
    const testCampaigns = await supabaseRequest<Array<{ id: string; channels: string[] }>>(
      `broadcast_campaigns?${new URLSearchParams({
        select: 'id,channels',
        is_test: 'eq.true',
        status: 'eq.completed',
        recipient_count: 'lte.5',
        created_at: `gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`,
        order: 'created_at.desc',
        limit: '20',
      })}`,
    );
    const matchingTestIds = testCampaigns
      .filter((campaign) => channels.every((channel) => campaign.channels.includes(channel)))
      .map((campaign) => campaign.id);
    let testedChannels = new Set<string>();
    if (matchingTestIds.length) {
      const sentRows = await supabaseRequest<Array<{ campaign_id: string; channel: string }>>(
        `broadcast_deliveries?${new URLSearchParams({
          select: 'campaign_id,channel',
          campaign_id: `in.(${matchingTestIds.join(',')})`,
          channel: `in.(${channels.join(',')})`,
          status: 'in.(sent,delivered)',
          limit: '1000',
        })}`,
      );
      testedChannels = new Set(sentRows.map((row) => row.channel));
    }
    testCampaignRequired = !channels.every((channel) => testedChannels.has(channel));
  }

  return {
    title,
    content,
    audience,
    channels,
    recipientCount: recipients.length,
    channelEstimates: {
      in_app: channels.includes('in_app') ? recipients.length : 0,
      push: channels.includes('push') ? pushUserIds.size : 0,
      pushSkipped: channels.includes('push') ? recipients.length - pushUserIds.size : 0,
      sms: channels.includes('sms') ? eligibleSms.length : 0,
      smsSkipped: channels.includes('sms') ? recipients.length - eligibleSms.length : 0,
      smsSegments,
      smsCostNgn: Number(smsCost.toFixed(2)),
    },
    pushConfigured,
    smsConfigured: channels.includes('sms') ? smsGateway.enabled : isSmsGatewayConfigured(),
    smsUnavailableReason: smsGateway.reason || null,
    testMode,
    testCampaignRequired,
    recipients,
    pushUserIds: [...pushUserIds],
    eligibleSmsUserIds: eligibleSms.map((recipient) => recipient.id),
  };
}

function campaignFingerprint(details: Awaited<ReturnType<typeof preview>>, input: Record<string, unknown>, adminId: string): string {
  const actionUrl = validateActionUrl(input.actionUrl);
  const canonical = JSON.stringify({
    adminId,
    title: details.title,
    content: details.content,
    audience: details.audience,
    channels: details.channels,
    recipients: details.recipients.map((recipient) => recipient.id).sort(),
    pushUsers: [...details.pushUserIds].sort(),
    smsUsers: [...details.eligibleSmsUserIds].sort(),
    scheduledAt: typeof input.scheduledAt === 'string' ? input.scheduledAt : null,
    actionUrl,
    actionLabel: cleanText(input.actionLabel, 50) || null,
    broadcastType: input.testMode === true ? 'test' : cleanText(input.broadcastType, 32) || 'announcement',
    testMode: input.testMode === true,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function signPreview(fingerprint: string, adminId: string): string {
  const { serviceKey } = getSupabaseConfig();
  const payload = Buffer.from(JSON.stringify({
    fingerprint,
    adminId,
    expiresAt: Date.now() + 10 * 60_000,
  })).toString('base64url');
  const signature = createHmac('sha256', serviceKey).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyPreview(token: unknown, fingerprint: string, adminId: string): boolean {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length) return false;
  const { serviceKey } = getSupabaseConfig();
  const expected = createHmac('sha256', serviceKey).update(payload).digest('base64url');
  if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)
    || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      fingerprint?: unknown;
      adminId?: unknown;
      expiresAt?: unknown;
    };
    return claims.fingerprint === fingerprint
      && claims.adminId === adminId
      && typeof claims.expiresAt === 'number'
      && claims.expiresAt >= Date.now();
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method || '')) return fail(res, 405, 'Method not allowed.');

  try {
    const admin = await requireAdmin(req);
    if (req.method === 'GET') {
      const action = String(req.query.action || 'campaigns');
      if (action === 'config') {
        const sms = await checkSmsGateway();
        return res.status(200).json({
          pushConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
          smsConfigured: sms.enabled,
          smsUnavailableReason: sms.reason || null,
        });
      }
      if (action === 'users') {
        const q = cleanText(req.query.q, 80);
        if (q.length < 2) return res.status(200).json({ users: [] });
        const params = new URLSearchParams({
          select: 'id,full_name,role',
          full_name: `ilike.*${q.replace(/[%_*(),]/g, '')}*`,
          role: 'neq.admin',
          order: 'full_name.asc',
          limit: '50',
        });
        const users = await supabaseRequest<Array<{ id: string; full_name: string | null; role: string }>>(`profiles?${params.toString()}`);
        return res.status(200).json({ users });
      }

      const search = cleanText(req.query.search, 100);
      const params = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: '100' });
      if (search) params.set('title', `ilike.*${search.replace(/[%_*(),]/g, '')}*`);
      const campaigns = await supabaseRequest<Campaign[]>(`broadcast_campaigns?${params.toString()}`);
      const ids = campaigns.map((campaign) => campaign.id);
      const totals = new Map<string, Record<string, Record<string, number>>>();
      const failures = new Map<string, Array<{ channel: string; code: string; count: number }>>();
      if (ids.length) {
        const [stats, failureRows] = await Promise.all([
          supabaseRequest<Array<{ campaign_id: string; channel: string; status: string; delivery_count: number }>>(
            'rpc/get_broadcast_campaign_stats',
            { method: 'POST', body: JSON.stringify({ p_campaign_ids: ids }) },
          ),
          supabaseRequest<Array<{ campaign_id: string; channel: string; error_code: string; failure_count: number }>>(
            'rpc/get_broadcast_campaign_failures',
            { method: 'POST', body: JSON.stringify({ p_campaign_ids: ids }) },
          ),
        ]);
        for (const row of stats) {
          const campaignStats = totals.get(row.campaign_id) || {};
          const channelStats = campaignStats[row.channel] || {};
          channelStats[row.status] = Number(row.delivery_count);
          campaignStats[row.channel] = channelStats;
          totals.set(row.campaign_id, campaignStats);
        }
        for (const row of failureRows) {
          const campaignFailures = failures.get(row.campaign_id) || [];
          campaignFailures.push({ channel: row.channel, code: row.error_code, count: Number(row.failure_count) });
          failures.set(row.campaign_id, campaignFailures);
        }
      }
      return res.status(200).json({
        campaigns: campaigns.map((campaign) => ({
          ...campaign,
          stats: totals.get(campaign.id) || {},
          failures: failures.get(campaign.id) || [],
        })),
      });
    }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : null;
    if (!body) return fail(res, 400, 'A campaign request body is required.');
    if (body.action === 'preview') {
      const details = await preview(body);
      const previewToken = signPreview(campaignFingerprint(details, body, admin.id), admin.id);
      const { recipients, pushUserIds, eligibleSmsUserIds, ...publicDetails } = details;
      void recipients;
      void pushUserIds;
      void eligibleSmsUserIds;
      return res.status(200).json({ ...publicDetails, previewToken });
    }
    if (body.action === 'create') {
      const details = await preview(body);
      if (!verifyPreview(body.previewToken, campaignFingerprint(details, body, admin.id), admin.id)) {
        return fail(res, 409, 'The preview expired or the audience changed. Preview the campaign again before sending.');
      }
      if (details.recipientCount < 1) return fail(res, 400, 'This audience has no eligible users.');
      if (details.recipientCount > MAX_RECIPIENTS) return fail(res, 400, 'Audience is too large for one campaign.');
      const hasEligibleChannel = details.channels.some((channel) => {
        if (channel === 'in_app') return details.channelEstimates.in_app > 0;
        if (channel === 'push') return details.channelEstimates.push > 0;
        return details.channelEstimates.sms > 0;
      });
      if (!hasEligibleChannel) return fail(res, 400, 'No recipients are eligible for the selected notification channels.');
      if (details.audience.type === 'all' && body.confirmAll !== true) return fail(res, 400, 'Explicit confirmation is required to message all users.');
      if (details.audience.type === 'all' && details.testCampaignRequired) {
        return fail(res, 400, 'Complete a successful test campaign to five or fewer selected users on every chosen channel before sending to everyone.');
      }
      if (typeof body.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) {
        return fail(res, 400, 'A valid campaign request key is required.');
      }
      const scheduledAt = typeof body.scheduledAt === 'string' ? new Date(body.scheduledAt) : new Date();
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000 || scheduledAt.getTime() > Date.now() + 30 * 86400000) {
        return fail(res, 400, 'Schedule the campaign between now and 30 days from now.');
      }
      const existing = await supabaseRequest<Campaign[]>(
        `broadcast_campaigns?${new URLSearchParams({ select: '*', created_by: `eq.${admin.id}`, idempotency_key: `eq.${body.idempotencyKey}`, limit: '1' })}`,
      );
      if (existing[0]) return res.status(200).json({ campaign: existing[0], duplicate: true });

      const recipients = details.recipients;
      const smsGateway = details.channels.includes('sms') ? await checkSmsGateway() : { enabled: false };
      const eligibleSmsIds = new Set(details.eligibleSmsUserIds);
      const smsSegments = details.channelEstimates.smsSegments;
      const status = scheduledAt.getTime() > Date.now() + 60_000 ? 'scheduled' : 'queued';
      const actionUrl = validateActionUrl(body.actionUrl);
      const broadcastType = body.testMode === true ? 'test' : cleanText(body.broadcastType, 32) || 'announcement';
      let rows: Campaign[];
      try {
        rows = await supabaseRequest<Campaign[]>('broadcast_campaigns', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify([{
            title: details.title,
            content: details.content,
            channels: details.channels,
            audience: details.audience,
            status,
            scheduled_at: scheduledAt.toISOString(),
            created_by: admin.id,
            idempotency_key: body.idempotencyKey,
            is_test: body.testMode === true,
            recipient_count: details.recipientCount,
            sms_estimated_segments: smsSegments,
            sms_estimated_cost_ngn: details.channelEstimates.smsCostNgn,
            action_url: actionUrl,
            action_label: cleanText(body.actionLabel, 50) || null,
            broadcast_type: broadcastType,
          }]),
        });
      } catch (error) {
        const duplicate = await supabaseRequest<Campaign[]>(
          `broadcast_campaigns?${new URLSearchParams({ select: '*', created_by: `eq.${admin.id}`, idempotency_key: `eq.${body.idempotencyKey}`, limit: '1' })}`,
        );
        if (duplicate[0]) return res.status(200).json({ campaign: duplicate[0], duplicate: true });
        throw error;
      }
      const campaign = rows[0];
      if (!campaign) throw new Error('Campaign could not be created.');

      const deliveryRows = recipients.flatMap((recipient) => details.channels.map((channel) => ({
        campaign_id: campaign.id,
        user_id: recipient.id,
        channel,
        status: channel === 'sms' && !eligibleSmsIds.has(recipient.id) ? 'skipped' : 'queued',
        error_code: channel === 'sms' && !eligibleSmsIds.has(recipient.id) ? 'no_verified_consent' : null,
      })));
      try {
        for (let offset = 0; offset < deliveryRows.length; offset += 500) {
          await supabaseRequest<unknown>('broadcast_deliveries', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify(deliveryRows.slice(offset, offset + 500)),
          });
        }
        if (deliveryRows.every((delivery) => delivery.status === 'skipped')) {
          await supabaseRequest<unknown>(`broadcast_campaigns?id=eq.${campaign.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
          });
        }
      } catch (error) {
        await supabaseRequest<unknown>(`broadcast_campaigns?id=eq.${campaign.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
        }).catch((patchError) => console.error('[broadcast] Failed to mark partially-created campaign:', patchError));
        throw error;
      }

      return res.status(201).json({ campaign, duplicate: false, smsConfigured: Boolean(smsGateway.enabled) });
    }

    if (body.action === 'retry') {
      const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
      if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return fail(res, 400, 'Invalid campaign ID.');
      const queuedForRetry = await supabaseRequest<number>(
        'rpc/retry_broadcast_failures',
        { method: 'POST', body: JSON.stringify({ p_campaign_id: campaignId }) },
      );
      if (!queuedForRetry) return fail(res, 400, 'This campaign has no failed deliveries to retry.');
      return res.status(200).json({ queuedForRetry });
    }

    if (body.action === 'cancel') {
      const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
      if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return fail(res, 400, 'Invalid campaign ID.');
      const canceled = await supabaseRequest<boolean>(
        'rpc/cancel_broadcast_campaign',
        { method: 'POST', body: JSON.stringify({ p_campaign_id: campaignId }) },
      );
      if (!canceled) return fail(res, 409, 'Campaign has started or cannot be canceled.');
      return res.status(200).json({ canceled });
    }
    return fail(res, 400, 'Unsupported campaign action.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    const status = error instanceof BroadcastRequestError
      ? error.status
      : message === 'Authentication required.'
        ? 401
        : message === 'Administrator access required.'
          ? 403
          : 500;
    if (status === 500) console.error('[api/admin-broadcast] request failed:', error);
    return fail(res, status, message);
  }
}
