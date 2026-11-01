type GeminiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type GeminiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: GeminiToolCall[];
};

export type GeminiFunction = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export class GeminiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parseFunctionArguments(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Function arguments must be an object.');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new GeminiRequestError(400, 'Chat contains invalid function arguments.');
  }
}

function normalizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === 'type' && typeof entry === 'string' ? entry.toUpperCase() : normalizeSchema(entry),
    ]),
  );
}

export async function geminiChat(
  messages: GeminiMessage[],
  functions: GeminiFunction[] = [],
): Promise<{ content: string; toolCalls: GeminiToolCall[] }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new GeminiRequestError(503, 'AI service is not configured.');

  const model = (Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest').replace(/^models\//, '');
  const systemInstruction = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              name: message.name!,
              response: { result: message.content },
              id: message.tool_call_id,
            },
          }],
        };
      }

      const parts: Array<Record<string, unknown>> = [];
      if (message.content.trim()) parts.push({ text: message.content });
      if (message.role === 'assistant') {
        for (const call of message.tool_calls || []) {
          parts.push({
            functionCall: {
              name: call.function.name,
              args: parseFunctionArguments(call.function.arguments),
              id: call.id,
            },
          });
        }
      }
      return { role: message.role === 'assistant' ? 'model' : 'user', parts };
    });

  const normalizedContents: typeof contents = [];
  for (const item of contents) {
    const previous = normalizedContents[normalizedContents.length - 1];
    if (previous?.role === item.role) previous.parts.push(...item.parts);
    else normalizedContents.push(item);
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(50_000),
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          contents: normalizedContents,
          generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
          ...(functions.length ? {
            tools: [{ functionDeclarations: functions.map((fn) => ({ ...fn, parameters: normalizeSchema(fn.parameters) })) }],
            toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          } : {}),
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new GeminiRequestError(504, 'Joba took too long to respond. Please try again.');
    }
    throw new GeminiRequestError(502, 'Joba could not reach the AI service. Please try again.');
  }

  const data = await response.json().catch(() => null) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown; functionCall?: { name?: unknown; args?: unknown; id?: unknown } }> } }>;
  } | null;
  if (!response.ok) {
    console.error('[ai-operations] Gemini request failed:', response.status, data?.error?.message || '');
    if (response.status === 429) {
      throw new GeminiRequestError(429, 'Joba is busy right now. Please try again shortly.');
    }
    if (response.status === 404) {
      throw new GeminiRequestError(503, 'Joba is temporarily unavailable. Please try again shortly.');
    }
    throw new GeminiRequestError(502, 'Joba could not complete the request. Please try again.');
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const content = parts
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .join('')
    .trim();
  const toolCalls = parts.flatMap((part): GeminiToolCall[] => {
    const call = part.functionCall;
    if (!call || typeof call.name !== 'string') return [];
    return [{
      id: typeof call.id === 'string' && call.id ? call.id : crypto.randomUUID(),
      type: 'function',
      function: {
        name: call.name,
        arguments: JSON.stringify(call.args && typeof call.args === 'object' ? call.args : {}),
      },
    }];
  });
  if (!content && !toolCalls.length) {
    throw new GeminiRequestError(502, 'Joba returned an empty response. Please try again.');
  }
  return { content, toolCalls };
}
