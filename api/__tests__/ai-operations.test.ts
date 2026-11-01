import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import broadcastHandler from '../broadcast.js';
import handler from '../_lib/ai-operations-handler.js';

function createResponse() {
  const result: { status?: number; body?: unknown } = {};
  const response = {
    setHeader: () => response,
    status: (status: number) => {
      result.status = status;
      return response;
    },
    json: (body: unknown) => {
      result.body = body;
      return response;
    },
    end: () => response,
  } as unknown as VercelResponse;
  return { result, response };
}

describe('Joba API validation', () => {
  it('uses the configured Gemini model for chat and never calls DeepSeek', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-flash-lite-latest');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Joba test reply.' }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: {},
      body: { type: 'chat', messages: [{ role: 'user', content: 'Hello Joba.' }], enableTools: false },
    } as unknown as VercelRequest;

    try {
      await handler(request, response);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ ok: true, result: 'Joba test reply.' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/models/gemini-flash-lite-latest:generateContent');
      expect(options?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
      expect(JSON.parse(String(options?.body)).contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello Joba.' }] },
      ]);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('generates tailored resumes through Gemini after verifying subscription access', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-flash-lite-latest');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return new Response(JSON.stringify([{
          subscription_tier: 'ai_tools',
          subscription_expires_at: new Date(Date.now() + 60_000).toISOString(),
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '# Tailored resume' }] } }],
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer user-token' },
      body: { type: 'resume', resumeText: 'Five years of project management experience.', jobTitle: 'Project Manager' },
    } as unknown as VercelRequest;

    try {
      await handler(request, response);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ ok: true, result: '# Tailored resume' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('rejects malformed chat input before contacting the model provider', async () => {
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: { origin: 'https://www.jobbridge.com.ng' },
      body: { type: 'chat', messages: [] },
    } as unknown as VercelRequest;

    await handler(request, response);

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, error: 'Chat must include 1-100 messages.' });
  });

  it('rejects oversized function-call arguments before contacting the model provider', async () => {
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: {},
      body: {
        type: 'chat',
        messages: [{
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'search_knowledge_base', arguments: 'x'.repeat(12_001) },
          }],
        }],
      },
    } as unknown as VercelRequest;

    await handler(request, response);

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, error: 'Chat contains an invalid or oversized message.' });
  });

  it('rejects non-POST requests', async () => {
    const { result, response } = createResponse();
    const request = {
      method: 'GET',
      headers: {},
      body: {},
    } as unknown as VercelRequest;

    await handler(request, response);

    expect(result.status).toBe(405);
    expect(result.body).toEqual({ ok: false, error: 'Method not allowed.' });
  });

  it('routes the consolidated AI endpoint to the Joba handler', async () => {
    const { result, response } = createResponse();
    const request = {
      method: 'POST',
      headers: {},
      query: { endpoint: 'ai' },
      body: { type: 'chat', messages: [] },
    } as unknown as VercelRequest;

    await broadcastHandler(request, response);

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, error: 'Chat must include 1-100 messages.' });
  });

  it('protects backend health checks from unauthenticated access', async () => {
    const { result, response } = createResponse();
    const request = {
      method: 'GET',
      headers: {},
      query: { endpoint: 'health' },
    } as unknown as VercelRequest;

    await broadcastHandler(request, response);

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'Authentication required.' });
  });
});
