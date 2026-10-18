import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, setSameOriginHeaders, supabaseRequest } from './broadcast.js';

type AIToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
type AIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
};
type AIRequestBody = {
  type?: unknown;
  messages?: unknown;
  text?: unknown;
  resumeText?: unknown;
  jobTitle?: unknown;
  jobDescription?: unknown;
  companyName?: unknown;
  enableTools?: boolean;
};

const JOBBRIDGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search verified JobBridge product information and FAQs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Specific topic or question to search.' },
          intent: { type: 'string', description: 'Optional topic category.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_current_page_context',
      description: 'Inspect the current page summary and visible controls provided in the conversation.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: 'Navigate the user to an existing JobBridge page.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'A supported JobBridge route.' },
          reason: { type: 'string', description: 'Why navigation is useful.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_and_navigate',
      description: 'Resolve a user request to a JobBridge page and navigate there.',
      parameters: {
        type: 'object',
        properties: { userRequest: { type: 'string', description: 'What the user is looking for.' } },
        required: ['userRequest'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'autofill_form_field',
      description: 'Fill a visible form field only when the user explicitly asks you to enter a value.',
      parameters: {
        type: 'object',
        properties: {
          fieldSelector: { type: 'string', description: 'Field label, name, or placeholder.' },
          value: { type: 'string', description: 'Value requested by the user.' },
        },
        required: ['fieldSelector', 'value'],
      },
    },
  },
];

class AIRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 12_000;
const MAX_TOTAL_MESSAGE_LENGTH = 24_000;
const MAX_INPUT_LENGTH = 24_000;

function textField(body: AIRequestBody, key: 'text' | 'resumeText' | 'jobTitle' | 'jobDescription' | 'companyName', max: number, required = true): string {
  const value = body[key];
  if (typeof value !== 'string') {
    if (!required) return '';
    throw new AIRequestError(400, `${key} is required.`);
  }
  const text = value.trim();
  if ((!text && required) || text.length > max) {
    throw new AIRequestError(400, `${key} is empty or exceeds the supported length.`);
  }
  return text;
}

function parseMessages(value: unknown): AIMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) {
    throw new AIRequestError(400, `Chat must include 1-${MAX_MESSAGES} messages.`);
  }
  let totalLength = 0;
  const messages = value.map((item): AIMessage => {
    if (!item || typeof item !== 'object') throw new AIRequestError(400, 'Chat contains an invalid message.');
    const message = item as Record<string, unknown>;
    const role = String(message.role);
    const hasToolCalls = role === 'assistant'
      && Array.isArray(message.tool_calls)
      && message.tool_calls.length > 0;
    const isToolResult = role === 'tool'
      && typeof message.tool_call_id === 'string'
      && typeof message.name === 'string';
    const toolCallsAreValid = !hasToolCalls || (message.tool_calls as unknown[]).every((call) => {
      if (!call || typeof call !== 'object') return false;
      const toolCall = call as Record<string, unknown>;
      const fn = toolCall.function;
      return typeof toolCall.id === 'string'
        && toolCall.type === 'function'
        && !!fn
        && typeof fn === 'object'
        && typeof (fn as Record<string, unknown>).name === 'string'
        && typeof (fn as Record<string, unknown>).arguments === 'string'
        && ((fn as Record<string, unknown>).arguments as string).length <= MAX_MESSAGE_LENGTH;
    });
    if (!['system', 'user', 'assistant', 'tool'].includes(role)
      || (typeof message.content !== 'string' && !hasToolCalls)
      || (typeof message.content === 'string' && message.content.length > MAX_MESSAGE_LENGTH)
      || !toolCallsAreValid
      || (role === 'assistant' && typeof message.content === 'string' && !message.content.trim() && !hasToolCalls)
      || (role !== 'assistant' && !isToolResult && (typeof message.content !== 'string' || !message.content.trim()))) {
      throw new AIRequestError(400, 'Chat contains an invalid or oversized message.');
    }
    const content = typeof message.content === 'string' ? message.content : '';
    totalLength += content.length;
    if (hasToolCalls) {
      totalLength += (message.tool_calls as Array<{ function: { arguments: string } }>)
        .reduce((length, call) => length + call.function.arguments.length, 0);
    }
    return {
      role: role as AIMessage['role'],
      content,
      ...(typeof message.name === 'string' ? { name: message.name } : {}),
      ...(typeof message.tool_call_id === 'string' ? { tool_call_id: message.tool_call_id } : {}),
      ...(hasToolCalls ? { tool_calls: message.tool_calls as AIToolCall[] } : {}),
    };
  });
  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    throw new AIRequestError(400, 'Chat exceeds the maximum supported length.');
  }
  return messages;
}

async function deepseek(messages: AIMessage[], enableTools = false): Promise<{ content: string; toolCalls: AIToolCall[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AIRequestError(503, 'Joba is not configured. Contact JobBridge support.');
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 4000,
      temperature: 0.7,
      ...(enableTools ? { tools: JOBBRIDGE_TOOLS, tool_choice: 'auto' } : {}),
    }),
  });
  if (!response.ok) {
    console.error('[ai-operations] DeepSeek request failed:', response.status);
    throw new AIRequestError(response.status === 429 ? 429 : 502, response.status === 429
      ? 'Joba is busy right now. Please try again shortly.'
      : 'Joba could not complete the request. Please try again.');
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: unknown; tool_calls?: AIToolCall[] } }>;
  };
  const message = data.choices?.[0]?.message;
  const result = message?.content;
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  if ((typeof result !== 'string' || !result.trim()) && toolCalls.length === 0) {
    throw new AIRequestError(502, 'Joba returned an empty response. Please try again.');
  }
  return { content: typeof result === 'string' ? result.trim() : '', toolCalls };
}

function resumePrompt(resumeText: string, jobTitle: string, jobDescription: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: 'You are a senior ATS resume writer. Return only clean Markdown, with one column and no tables. Preserve factual integrity: do not invent names, dates, credentials, metrics, tools, or achievements. Use reverse chronological order and tailor keywords to the target role. Include contact summary, executive summary, core competencies, experience, projects, education, certifications, and leadership/awards only when supported by the source.',
    },
    {
      role: 'user',
      content: `Rewrite this career history for the ${jobTitle} role. Use only supported facts and metrics.\n\nCareer history:\n${resumeText}\n\nTarget job description:\n${jobDescription || 'Not provided. Tailor the resume to the target job title without inventing role requirements.'}`,
    },
  ];
}

function coverLetterPrompt(resumeText: string, jobTitle: string, jobDescription: string, companyName: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: 'Write a truthful, personalized professional cover letter in no more than four paragraphs. Do not invent experience or credentials. Return only the letter.',
    },
    {
      role: 'user',
      content: `Write a cover letter for ${jobTitle} at ${companyName}.\n\nResume:\n${resumeText}\n\nJob description:\n${jobDescription || 'Not provided. Focus on the target title and verified experience in the resume.'}`,
    },
  ];
}

async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIRequestError(503, 'Embedding service is not configured.');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!response.ok) {
    console.error('[ai-operations] Embedding request failed:', response.status);
    throw new AIRequestError(response.status === 429 ? 429 : 502, 'Embedding service is temporarily unavailable.');
  }
  const data = await response.json() as { data?: Array<{ embedding?: unknown }> };
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new AIRequestError(502, 'Embedding service returned an invalid response.');
  }
  return embedding;
}

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSameOriginHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as AIRequestBody;
    if (!body || typeof body !== 'object' || typeof body.type !== 'string') {
      throw new AIRequestError(400, 'Invalid AI request.');
    }

    switch (body.type) {
      case 'status':
        if (!process.env.DEEPSEEK_API_KEY) throw new AIRequestError(503, 'Joba is not configured. Contact JobBridge support.');
        return res.status(200).json({ ok: true, result: 'Joba is ready.' });
      case 'chat': {
        const completion = await deepseek(parseMessages(body.messages), body.enableTools !== false);
        return res.status(200).json({
          ok: true,
          result: completion.content,
          ...(completion.toolCalls.length ? { tool_calls: completion.toolCalls } : {}),
        });
      }
      case 'resume': {
        const user = await requireUser(req);
        const profiles = await supabaseRequest<Array<{ subscription_tier: string | null; subscription_expires_at: string | null }>>(
          `profiles?select=subscription_tier,subscription_expires_at&id=eq.${encodeURIComponent(user.id)}&limit=1`,
        );
        const profile = profiles[0];
        if (
          profile?.subscription_tier !== 'ai_tools'
          || !profile.subscription_expires_at
          || new Date(profile.subscription_expires_at).getTime() <= Date.now()
        ) {
          throw new AIRequestError(403, 'An active AI Career Tools subscription is required to tailor a resume.');
        }
        const resume = textField(body, 'resumeText', MAX_INPUT_LENGTH);
        const title = textField(body, 'jobTitle', 500);
        const description = textField(body, 'jobDescription', MAX_INPUT_LENGTH, false);
        return res.status(200).json({ ok: true, result: (await deepseek(resumePrompt(resume, title, description))).content });
      }
      case 'cover-letter': {
        const user = await requireUser(req);
        const profiles = await supabaseRequest<Array<{ subscription_tier: string | null; subscription_expires_at: string | null }>>(
          `profiles?select=subscription_tier,subscription_expires_at&id=eq.${encodeURIComponent(user.id)}&limit=1`,
        );
        const profile = profiles[0];
        if (
          profile?.subscription_tier !== 'ai_tools'
          || !profile.subscription_expires_at
          || new Date(profile.subscription_expires_at).getTime() <= Date.now()
        ) {
          throw new AIRequestError(403, 'An active AI Career Tools subscription is required to generate a cover letter.');
        }
        const resume = textField(body, 'resumeText', MAX_INPUT_LENGTH);
        const title = textField(body, 'jobTitle', 500);
        const description = textField(body, 'jobDescription', MAX_INPUT_LENGTH, false);
        const company = textField(body, 'companyName', 500, false) || 'the company';
        return res.status(200).json({ ok: true, result: (await deepseek(coverLetterPrompt(resume, title, description, company))).content });
      }
      case 'embed':
        return res.status(200).json({ ok: true, embedding: await createEmbedding(textField(body, 'text', MAX_INPUT_LENGTH)) });
      default:
        throw new AIRequestError(400, 'Unknown AI request type.');
    }
  } catch (error) {
    const status = error instanceof AIRequestError
      ? error.status
      : error instanceof Error && error.message === 'Authentication required.'
        ? 401
        : 400;
    const message = error instanceof AIRequestError
      ? error.message
      : error instanceof SyntaxError
        ? 'Invalid JSON request.'
        : error instanceof Error && error.message === 'Authentication required.'
          ? 'Sign in to use AI Career Tools.'
          : 'Joba could not process the request.';
    if (!(error instanceof AIRequestError) && !(error instanceof SyntaxError)) {
      console.error('[ai-operations] Request failed:', error);
    }
    return res.status(status).json({ ok: false, error: message });
  }
}
