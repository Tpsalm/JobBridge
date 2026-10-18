import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it } from 'vitest';
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
