import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import broadcastHandler from '../broadcast.js';
import handler from '../_lib/admin-broadcast-handler.js';
import processBroadcasts from '../_lib/process-broadcasts-handler.js';
import { estimateSmsSegments, isSmsGatewayConfigured, isValidPushEndpoint, normalizedPhone } from '../_lib/broadcast.js';

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
