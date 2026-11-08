import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import broadcastHandler from '../broadcast.js';
import handler from '../_lib/admin-broadcast-handler.js';
import processBroadcasts from '../_lib/process-broadcasts-handler.js';
import { estimateSmsSegments, isSmsGatewayConfigured, isValidPushEndpoint, normalizedPhone } from '../_lib/broadcast.js';
import {
  BROADCAST_TEMPLATES,
  BROADCAST_TYPES,
  buildInboxNotification,
  buildPushOptions,
  buildPushPayload,
  normalizeBroadcastType,
  renderMessage,
  safeActionUrl,
} from '../_lib/broadcast-templates.js';

function createResponse() {
  const result: { status: number; body: unknown } = { status: 0, body: null };
  const response = {
    setHeader: () => undefined,
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
    end: () => undefined,
  };
  return { result, response: response as unknown as VercelResponse };
}

function createRequest(headers: Record<string, string> = {}) {
  return {
    method: 'GET',
    headers,
    query: { action: 'campaigns' },
  } as unknown as VercelRequest;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('broadcast API security', () => {
  it('rejects unauthenticated campaign history requests', async () => {
    const { result, response } = createResponse();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await handler(createRequest(), response);

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Authentication required.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let unauthenticated callers invoke the delivery worker', async () => {
    vi.stubEnv('CRON_SECRET', 'a-long-server-only-cron-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    } as unknown as VercelRequest;

    await processBroadcasts(request, response);

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects authenticated users without the admin profile role', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only-test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-id' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ role: 'job_seeker' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result, response } = createResponse();

    await handler(createRequest({ authorization: 'Bearer valid-user-token' }), response);

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: 'Administrator access required.' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('routes the retired direct-push API to a 410 response', () => {
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: {},
      query: { endpoint: 'send-push' },
    } as unknown as VercelRequest;

    broadcastHandler(request, response);

    expect(result.status).toBe(410);
    expect(result.body).toEqual({
      error: 'Direct push sending is retired. Use the authenticated notification campaign worker.',
    });
  });
});

describe('broadcast validation helpers', () => {
  it('accepts only normalized international phone numbers', () => {
    expect(normalizedPhone('+234 801-234-5678')).toBe('+2348012345678');
    expect(normalizedPhone('08012345678')).toBeNull();
    expect(normalizedPhone('+123')).toBeNull();
  });

  it('accepts browser push services but rejects arbitrary endpoints', () => {
    expect(isValidPushEndpoint('https://fcm.googleapis.com/fcm/send/example')).toBe(true);
    expect(isValidPushEndpoint('https://attacker.example.test/push')).toBe(false);
    expect(isValidPushEndpoint('http://fcm.googleapis.com/fcm/send/example')).toBe(false);
  });

  it('estimates SMS segments for GSM and Unicode messages', () => {
    expect(estimateSmsSegments('a'.repeat(160))).toBe(1);
    expect(estimateSmsSegments('a'.repeat(161))).toBe(2);
    expect(estimateSmsSegments('🚀'.repeat(36))).toBe(2);
  });

  it('keeps SMS unconfigured until all server-side gateway settings are valid', () => {
    expect(isSmsGatewayConfigured()).toBe(false);
    vi.stubEnv('SMS_GATEWAY_URL', 'https://sms.example.test/send');
    vi.stubEnv('SMS_GATEWAY_HEALTHCHECK_URL', 'https://sms.example.test/health');
    vi.stubEnv('SMS_GATEWAY_SENDER_ID', 'Jobbridge');
    vi.stubEnv('SMS_GATEWAY_API_KEY', 'a'.repeat(32));
    vi.stubEnv('SMS_GATEWAY_WEBHOOK_SECRET', 'b'.repeat(32));
    expect(isSmsGatewayConfigured()).toBe(true);
    vi.stubEnv('SMS_GATEWAY_BATCH_SIZE', '2');
    expect(isSmsGatewayConfigured()).toBe(false);
  });
});

describe('broadcast template catalogue', () => {
  it('exposes a stable, unique catalogue for every broadcast type', () => {
    const typeIds = BROADCAST_TYPES.map((type) => type.id);
    expect(new Set(typeIds).size).toBe(typeIds.length);
    expect(typeIds).toContain('announcement');

    const templateIds = BROADCAST_TEMPLATES.map((template) => template.id);
    expect(new Set(templateIds).size).toBe(templateIds.length);
    expect(BROADCAST_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    BROADCAST_TEMPLATES.forEach((template) => {
      expect(template.title.trim().length).toBeGreaterThan(0);
      expect(template.content.trim().length).toBeGreaterThan(0);
      expect(typeIds).toContain(template.type);
      expect(template.channels.length).toBeGreaterThan(0);
      expect(safeActionUrl(template.actionUrl)).toBe(template.actionUrl);
    });
  });

  it('normalizes unknown or hostile broadcast types to the safe default', () => {
    expect(normalizeBroadcastType('job_alert')).toBe('job_alert');
    expect(normalizeBroadcastType('  MAINTENANCE ')).toBe('maintenance');
    expect(normalizeBroadcastType('test')).toBe('test');
    expect(normalizeBroadcastType('drop table users')).toBe('announcement');
    expect(normalizeBroadcastType(undefined)).toBe('announcement');
  });

  it('renders personalization placeholders without leaking raw tokens', () => {
    expect(renderMessage('Hi {{first_name}}, welcome to {{app_name}}', 'Ada')).toBe('Hi Ada, welcome to JobBridge');
    expect(renderMessage('Hi {{ first_name }}', '')).toBe('Hi there');
    expect(renderMessage('Visit {{site_url}}')).toBe('Visit jobbridge.com.ng');
    expect(renderMessage('Hi {{first_name}}', '<script>')).not.toContain('<');
  });

  it('only allows same-origin deep links for notifications', () => {
    expect(safeActionUrl('/jobs')).toBe('/jobs');
    expect(safeActionUrl('  /pricing  ')).toBe('/pricing');
    expect(safeActionUrl('//evil.example.test')).toBeNull();
    expect(safeActionUrl('https://evil.example.test')).toBeNull();
    expect(safeActionUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('broadcast payload builders', () => {
  const campaign = {
    id: 'campaign-1',
    title: 'Scheduled maintenance tonight',
    content: 'Hi {{first_name}}, JobBridge is down for 30 minutes tonight.',
    action_url: '/notifications',
    action_label: 'Details',
    broadcast_type: 'maintenance',
  };

  it('builds a sticky, high-urgency push payload for maintenance notices', () => {
    const payload = buildPushPayload(campaign, 'Ada');
    expect(payload.title).toBe('🛠️ Scheduled maintenance tonight');
    expect(payload.body).toBe('Hi Ada, JobBridge is down for 30 minutes tonight.');
    expect(payload.tag).toBe('jobbridge-maintenance-campaign-1');
    expect(payload.requireInteraction).toBe(true);
    expect(payload.renotify).toBe(true);
    expect(payload.actions).toEqual([{ action: 'open', title: 'Details' }]);
    expect(payload.data).toMatchObject({ url: '/notifications', campaignId: 'campaign-1', broadcastType: 'maintenance' });
    expect(buildPushOptions(campaign)).toMatchObject({ urgency: 'high' });
  });

  it('falls back to the notifications screen for unsafe action URLs', () => {
    const payload = buildPushPayload({ ...campaign, action_url: 'https://evil.example.test', broadcast_type: 'promo' });
    expect(payload.data.url).toBe('/notifications');
    expect(payload.requireInteraction).toBe(false);
    expect(payload.renotify).toBe(false);
    expect(buildPushOptions({ ...campaign, broadcast_type: 'promo' })).toMatchObject({ urgency: 'normal' });
  });

  it('builds a personalized inbox notification row for each recipient', () => {
    const row = buildInboxNotification(campaign, 'delivery-1', 'user-1', 'Ada');
    expect(row).toMatchObject({
      user_id: 'user-1',
      type: 'system',
      title: 'Scheduled maintenance tonight',
      content: 'Hi Ada, JobBridge is down for 30 minutes tonight.',
      is_read: false,
      broadcast_delivery_id: 'delivery-1',
    });
    expect(row.data).toMatchObject({
      source: 'admin_broadcast',
      campaign_id: 'campaign-1',
      broadcast_type: 'maintenance',
      action_url: '/notifications',
      action_label: 'Details',
    });
  });
});
