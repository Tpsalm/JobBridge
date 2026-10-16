import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSameOriginHeaders } from './broadcast.js';

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type AIRequestBody = {
  type?: unknown;
  messages?: unknown;
  text?: unknown;
  resumeText?: unknown;
  jobTitle?: unknown;
  jobDescription?: unknown;
  companyName?: unknown;
};

class AIRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const MAX_MESSAGES = 30;
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
    if (!['system', 'user', 'assistant'].includes(String(message.role))
      || typeof message.content !== 'string'
      || !message.content.trim()
      || message.content.length > MAX_MESSAGE_LENGTH) {
      throw new AIRequestError(400, 'Chat contains an invalid or oversized message.');
    }
    totalLength += message.content.length;
    return { role: message.role as AIMessage['role'], content: message.content };
  });
  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    throw new AIRequestError(400, 'Chat exceeds the maximum supported length.');
  }
  return messages;
}

async function deepseek(messages: AIMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AIRequestError(503, 'Joba is not configured. Contact JobBridge support.');
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 4000, temperature: 0.7 }),
  });
  if (!response.ok) {
    console.error('[ai-operations] DeepSeek request failed:', response.status);
    throw new AIRequestError(response.status === 429 ? 429 : 502, response.status === 429
      ? 'Joba is busy right now. Please try again shortly.'
      : 'Joba could not complete the request. Please try again.');
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const result = data.choices?.[0]?.message?.content;
  if (typeof result !== 'string' || !result.trim()) {
    throw new AIRequestError(502, 'Joba returned an empty response. Please try again.');
  }
  return result.trim();
}

function resumePrompt(resumeText: string, jobTitle: string, jobDescription: string): AIMessage[] {
  return [
    {
      role: 'system',
      content: 'You are a senior ATS resume writer. Return only clean Markdown, with one column and no tables. Preserve factual integrity: do not invent names, dates, credentials, metrics, tools, or achievements. Use reverse chronological order and tailor keywords to the target role. Include contact summary, executive summary, core competencies, experience, projects, education, certifications, and leadership/awards only when supported by the source.',
    },
    {
      role: 'user',
      content: `Rewrite this career history for the ${jobTitle} role. Use only supported facts and metrics.\n\nCareer history:\n${resumeText}\n\nTarget job description:\n${jobDescription}`,
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
      content: `Write a cover letter for ${jobTitle} at ${companyName}.\n\nResume:\n${resumeText}\n\nJob description:\n${jobDescription}`,
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
      case 'chat':
        return res.status(200).json({ ok: true, result: await deepseek(parseMessages(body.messages)) });
      case 'resume': {
        const resume = textField(body, 'resumeText', MAX_INPUT_LENGTH);
        const title = textField(body, 'jobTitle', 500);
        const description = textField(body, 'jobDescription', MAX_INPUT_LENGTH);
        return res.status(200).json({ ok: true, result: await deepseek(resumePrompt(resume, title, description)) });
      }
      case 'cover-letter': {
        const resume = textField(body, 'resumeText', MAX_INPUT_LENGTH);
        const title = textField(body, 'jobTitle', 500);
        const description = textField(body, 'jobDescription', MAX_INPUT_LENGTH);
        const company = textField(body, 'companyName', 500, false) || 'the company';
        return res.status(200).json({ ok: true, result: await deepseek(coverLetterPrompt(resume, title, description, company)) });
      }
      case 'embed':
        return res.status(200).json({ ok: true, embedding: await createEmbedding(textField(body, 'text', MAX_INPUT_LENGTH)) });
      default:
        throw new AIRequestError(400, 'Unknown AI request type.');
    }
  } catch (error) {
    const status = error instanceof AIRequestError ? error.status : 400;
    const message = error instanceof AIRequestError
      ? error.message
      : error instanceof SyntaxError
        ? 'Invalid JSON request.'
        : 'Joba could not process the request.';
    if (!(error instanceof AIRequestError) && !(error instanceof SyntaxError)) {
      console.error('[ai-operations] Request failed:', error);
    }
    return res.status(status).json({ ok: false, error: message });
  }
}
