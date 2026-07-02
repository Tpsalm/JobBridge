import KB, { type KnowledgeSection } from './jobbridgeKnowledge';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const LLM_MODEL = 'gpt-4o-mini';
const TOP_K = 5;
const MAX_HISTORY = 20;
const MAX_INPUT_LENGTH = 500;
const MIN_INTERVAL_MS = 1000;
const MAX_CALLS_PER_WINDOW = 25;
const WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_CONTEXT_LENGTH = 4000;
const CACHE_CONV_KEY = 'jb_conv_';

export interface SourceInfo {
  id: string;
  title: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources: (sources: SourceInfo[]) => void;
  onError: (err: string) => void;
  onPhase: (phase: string) => void;
  onDone: (fullText: string, sources: SourceInfo[]) => void;
}

export function hasApiKey(): boolean {
  return !!API_KEY;
}

// ─── Retry helper with exponential backoff ─────────────────────

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt === retries) return res;
    const delay = RETRY_BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));
  }
  throw new Error('Unreachable');
}

// ─── Input sanitization ─────────────────────────────────────────

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT_LENGTH);
}

// ─── Client-side rate limiter ──────────────────────────────────

const rateLimit = (() => {
  let lastCall = 0;
  let callCount = 0;
  let windowStart = Date.now();
  return {
    allow(): boolean {
      const now = Date.now();
      if (now - windowStart > WINDOW_MS) { callCount = 0; windowStart = now; }
      if (now - lastCall < MIN_INTERVAL_MS) return false;
      if (callCount >= MAX_CALLS_PER_WINDOW) return false;
      lastCall = now;
      callCount++;
      return true;
    },
  };
})();

// ─── Conversation memory ────────────────────────────────────────

type HistoryMsg = { role: 'user' | 'assistant'; content: string };

function getConversation(convId: string): HistoryMsg[] {
  try {
    const raw = localStorage.getItem(CACHE_CONV_KEY + convId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversation(convId: string, msgs: HistoryMsg[]) {
  try {
    localStorage.setItem(CACHE_CONV_KEY + convId, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {}
}

export function clearConversation(convId: string) {
  try { localStorage.removeItem(CACHE_CONV_KEY + convId); } catch {}
}

// ─── Page context map ──────────────────────────────────────────

const pageContextMap: Record<string, string> = {
  '/': 'the home page',
  '/jobs': 'the Jobs listing page',
  '/my-jobs': 'the My Jobs page',
  '/recruiter': 'the Recruiter Dashboard',
  '/pricing': 'the Pricing page',
  '/ai-resume': 'the AI Resume Studio page',
  '/providers': 'the Service Provider Marketplace',
  '/business': 'the Business Advertisements page',
  '/profile': 'the Profile page',
  '/settings': 'the Settings page',
  '/admin': 'the Admin Dashboard',
  '/support': 'the Support page',
  '/contact': 'the Contact page',
  '/blog': 'the Blog page',
  '/signup': 'the Sign Up page',
  '/login': 'the Login page',
  '/about': 'the About page',
  '/ceo': 'the CEO Vision page',
  '/games': 'the Games page',
  '/analytics': 'the Analytics page',
  '/career': 'the Career page',
  '/privacy': 'the Privacy Center page',
  '/messages': 'the Messages / Inbox page',
  '/notifications': 'the Notifications & Alerts page',
};

function currentPageContext(): string {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return pageContextMap[path] || `the ${path} page`;
}

// ─── Instant keyword/tag retrieval (no embedding API needed) ───

function scoreSection(section: KnowledgeSection, query: string, pagePath: string): number {
  const lower = query.toLowerCase();
  const queryWords = lower.split(/\s+/).filter(Boolean);

  let score = 0;

  // Keyword matching (highest weight)
  const keywordMatches = section.keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
  if (keywordMatches > 0) {
    score += keywordMatches * 3;
  }

  // Tag matching
  const tagMatches = section.tags.filter(t => lower.includes(t)).length;
  if (tagMatches > 0) {
    score += tagMatches * 2;
  }

  // Page context boost
  if (section.pages.includes(pagePath)) {
    score += 4;
  }

  // Word overlap scoring — how many query words appear in the content/title/keywords
  const allText = (section.title + ' ' + section.content + ' ' + section.keywords.join(' ')).toLowerCase();
  const wordMatches = queryWords.filter(w => w.length > 2 && allText.includes(w)).length;
  score += wordMatches * 0.5;

  return score;
}

function retrieveRelevant(question: string, pagePath: string): KnowledgeSection[] {
  const trimmed = question.trim();
  if (!trimmed) return [];

  const scored = KB.map(section => ({
    section,
    score: scoreSection(section, trimmed, pagePath),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const top = scored.filter(s => s.score > 0).slice(0, TOP_K);

  // Fallback: if no keyword/tag matches at all, return top 3 by word overlap only
  if (top.length === 0) {
    const fallback = scored
      .filter(s => s.score > 0)
      .slice(0, 3);
    if (fallback.length > 0) return fallback.map(s => s.section);
  }

  return top.map(s => s.section);
}

// ─── Context trimming — keep within token budget ──────────────

function trimContext(sections: KnowledgeSection[]): string {
  let combined = '';
  const included: KnowledgeSection[] = [];
  for (const s of sections) {
    const block = `[${s.title}]\n${s.content}\n\n---\n\n`;
    if ((combined + block).length > MAX_CONTEXT_LENGTH) break;
    combined += block;
    included.push(s);
  }
  return combined || `[${sections[0].title}]\n${sections[0].content}`;
}

// ─── Streaming LLM call ─────────────────────────────────────────

async function streamLLM(
  messages: { role: string; content: string }[],
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${res.status} — ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content || '';
        if (token) {
          full += token;
          onToken(token);
        }
      } catch {}
    }
  }

  return full;
}

// ─── System prompt builder ──────────────────────────────────────

function buildSystemPrompt(
  context: string,
  pageContext: string,
  history: HistoryMsg[],
): string {
  return `You are the JobBridge AI Assistant — a helpful, accurate support agent for the JobBridge platform (Nigeria's #1 professional network).

## Core Rules
- Answer ONLY based on the knowledge context below. Do not make up information, features, or pricing.
- If the context doesn't contain the answer, say: "I don't have that information. Please contact jobbridgesupport@gmail.com for help."
- Be concise (2-5 sentences) but thorough when needed. Use bullet points for lists of 2+ items.
- Do not mention "context", "internal notes", "knowledge base", or "retrieved" in your response.
- Include relevant page paths like /signup, /pricing, /recruiter, /profile when helpful.
- Format naturally with simple markdown for readability. Use **bold** for emphasis.
- If the user asks about something outside JobBridge, politely redirect to platform topics.
- When giving instructions, use clear step-by-step format (1. 2. 3.).

## Current Page
The user is currently on: ${pageContext}

## Conversation History (last ${MAX_HISTORY} messages)
${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

## Knowledge Context (use this to answer)
${context}`;
}

// ─── Public API ─────────────────────────────────────────────────

export async function streamAnswer(
  question: string,
  conversationId: string,
  cb: StreamCallbacks,
): Promise<void> {
  const { onToken, onSources, onError, onPhase, onDone } = cb;

  const noApiKey = !API_KEY;
  if (noApiKey) {
    onPhase('Searching knowledge base...');
  }

  const questionClean = sanitize(question);

  if (!questionClean) {
    onError('Please enter a valid question.');
    return;
  }

  if (!rateLimit.allow()) {
    onError('Please wait a moment between questions.');
    return;
  }

  const pagePath = window.location.pathname.replace(/\/$/, '') || '/';

  try {
    onPhase('Analyzing your question...');

    const history = getConversation(conversationId);

    onPhase('Searching knowledge base...');
    const sections = retrieveRelevant(questionClean, pagePath);

    if (sections.length === 0) {
      onError("I couldn't find relevant information in the knowledge base. Try rephrasing your question or contact jobbridgesupport@gmail.com for help.");
      return;
    }

    const sourceList = sections.map(s => ({ id: s.id, title: s.title }));
    onSources(sourceList);

    const contextStr = trimContext(sections);
    const pageCtx = currentPageContext();

    if (noApiKey) {
      const q = questionClean.toLowerCase();
      // Score all sections using the same logic as retrieveRelevant but more granular
      const scored = KB.map(s => ({
        section: s,
        score: scoreSection(s, questionClean, pagePath),
      }));
      scored.sort((a, b) => b.score - a.score);
      const topSections = scored.filter(s => s.score > 0).slice(0, TOP_K);

      if (topSections.length === 0) {
        onError("I couldn't find relevant information. Try rephrasing your question or contact jobbridgesupport@gmail.com for help.");
        return;
      }

      // Build answer: intro + best section key points + related info + next steps
      const best = topSections[0];
      const showSources = topSections.map(s => ({ id: s.section.id, title: s.section.title }));

      // Detect question type
      const isAbout = /^(tell me about|what is|what are|explain|describe|about)/i.test(questionClean);
      const isHow = /^(how (to|do|can|does)|how do (i|you)|steps? to|guide)/i.test(questionClean);
      const isYesNo = /^(can|is|are|does|do|will|should|has)/i.test(questionClean);
      const isList = /^(list|what are the|name|types? of|categories? of)/i.test(questionClean);

      // Build structured answer
      const parts: string[] = [];

      // Introduction based on question type
      if (isAbout) {
        parts.push(`**${best.section.title}**`);
      } else if (isHow) {
        parts.push(`Here's how to do that on JobBridge:`);
      } else if (isYesNo) {
        parts.push(`Here's what I found:`);
      } else if (isList) {
        parts.push(`Here are the details:`);
      } else {
        parts.push(`**${best.section.title}**`);
      }

      // Extract key sentences from the best section
      const sentences = best.section.content.match(/[^.!?]+[.!?]+/g) || [best.section.content];
      // Take the first 3-4 most relevant sentences (avoid listing chunks)
      const relevantSentences = sentences.filter(s => {
        const sl = s.toLowerCase();
        return q.split(/\s+/).some(w => w.length > 3 && sl.includes(w)) || sl.includes(best.section.keywords[0]);
      });
      const contentToUse = relevantSentences.length >= 2 ? relevantSentences.slice(0, 4) : sentences.slice(0, 4);
      parts.push(contentToUse.join(' '));

      // Add related info from other top sections (brief)
      if (topSections.length > 1) {
        const related = topSections.slice(1, 3).map(s => {
          const firstSent = (s.section.content.match(/[^.!?]+[.!?]+/) || [s.section.content])[0].trim();
          return `• **${s.section.title}**: ${firstSent}`;
        }).join('\n');
        parts.push(`\n**Related:**\n${related}`);
      }

      // Add relevant page links
      const allPages = [...new Set(topSections.flatMap(s => s.section.pages))].filter(p => p !== pagePath).slice(0, 3);
      if (allPages.length > 0) {
        parts.push(`\nFind this on JobBridge: ${allPages.map(p => `${p}`).join(', ')}`);
      }

      // Closing
      parts.push(`\nFor more help, email jobbridgesupport@gmail.com`);

      const fullText = parts.join('\n\n');

      const updatedHistory: HistoryMsg[] = [
        ...history,
        { role: 'user', content: questionClean },
        { role: 'assistant', content: fullText },
      ];
      saveConversation(conversationId, updatedHistory);
      onDone(fullText, showSources);
      return;
    }

    onPhase('Generating response...');

    const systemPrompt = buildSystemPrompt(contextStr, pageCtx, history);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: questionClean },
    ];

    let fullText = '';
    await streamLLM(messages, (token) => {
      fullText += token;
      onToken(token);
    });

    const updatedHistory: HistoryMsg[] = [
      ...history,
      { role: 'user', content: questionClean },
      { role: 'assistant', content: fullText },
    ];
    saveConversation(conversationId, updatedHistory);

    onDone(fullText, sourceList);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('401')) {
      onError('OpenAI API key is invalid. Please check your VITE_OPENAI_API_KEY.');
    } else if (msg.includes('429') || msg.includes('rate')) {
      onError('The AI service is temporarily busy. Please try again in a few seconds.');
    } else if (msg.includes('fetch') || msg.includes('network')) {
      onError('Network error. Check your internet connection and try again.');
    } else {
      onError(`Something went wrong: ${msg || 'unexpected error'}. Please try again.`);
    }
  }
}

// ─── No-op prewarm (embeddings no longer needed) ────────────────

export function prewarmEmbeddings(): void {
  // Embeddings removed — retrieval is instant via keyword/tag matching
}