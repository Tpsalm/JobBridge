import KB, { type KnowledgeSection } from './jobbridgeKnowledge';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const LLM_MODEL = 'gpt-4o-mini';
const TOP_K = 7;
const SIMILARITY_THRESHOLD = 0.22;
const KEYWORD_BOOST = 0.15;
const TAG_BOOST = 0.10;
const MAX_HISTORY = 20;
const MAX_INPUT_LENGTH = 500;
const MIN_INTERVAL_MS = 2000;
const MAX_CALLS_PER_WINDOW = 15;
const WINDOW_MS = 60000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const MAX_CONTEXT_LENGTH = 3500;
const CACHE_EMBED_KEY = 'jb_embeddings_v4';
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

// ─── Embedding mutex — prevents concurrent embedding calls ────

let embeddingLock = false;
const embedQueue: (() => void)[] = [];

async function acquireEmbedLock(): Promise<void> {
  if (!embeddingLock) { embeddingLock = true; return; }
  return new Promise(resolve => { embedQueue.push(resolve); });
}

function releaseEmbedLock(): void {
  if (embedQueue.length > 0) {
    const next = embedQueue.shift()!;
    next();
  } else {
    embeddingLock = false;
  }
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

// ─── Embedding cache ─────────────────────────────────────────────

interface EmbeddingCache {
  version: number;
  chunks: { id: string; embedding: number[] }[];
}

function loadEmbedCache(): EmbeddingCache | null {
  try {
    const raw = localStorage.getItem(CACHE_EMBED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.version === 4 ? parsed : null;
  } catch { return null; }
}

function saveEmbedCache(chunks: { id: string; embedding: number[] }[]) {
  try {
    localStorage.setItem(CACHE_EMBED_KEY, JSON.stringify({ version: 4, chunks }));
  } catch {}
}

async function embed(text: string | string[]): Promise<number[] | number[][]> {
  await acquireEmbedLock();
  try {
    const input = Array.isArray(text) ? text : [text];
    const res = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${res.status} — ${err}`);
    }
    const data = await res.json();
    const embs = data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
    return Array.isArray(text) ? embs : embs[0];
  } finally {
    releaseEmbedLock();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Query expansion ─────────────────────────────────────────────

function expandQuery(query: string): string[] {
  const expansions: string[] = [query];
  const lower = query.toLowerCase();

  const synonymMap: Record<string, string[]> = {
    signup: ['register', 'create account', 'join', 'sign up', 'registration'],
    login: ['sign in', 'signin', 'log in', 'authenticate'],
    job: ['position', 'role', 'vacancy', 'opening', 'employment', 'career'],
    apply: ['application', 'submit', 'candidate'],
    recruiter: ['employer', 'hiring manager', 'talent acquisition', 'hr'],
    resume: ['cv', 'curriculum vitae', 'cover letter'],
    price: ['cost', 'fee', 'subscription', 'plan', 'pricing', 'payment'],
    ai: ['artificial intelligence', 'chatbot', 'assistant'],
    help: ['support', 'assist', 'faq', 'guide', 'troubleshoot'],
    profile: ['settings', 'account', 'edit profile', 'personal info'],
    save: ['bookmark', 'saved', 'favorite'],
  };

  for (const [word, synonyms] of Object.entries(synonymMap)) {
    if (lower.includes(word)) {
      expansions.push(...synonyms.filter(s => !lower.includes(s)));
    }
  }

  return [...new Set(expansions)];
}

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
};

function currentPageContext(): string {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return pageContextMap[path] || `the ${path} page`;
}

// ─── Retrieval with reranking ──────────────────────────────────

async function retrieveRelevant(question: string, pagePath: string): Promise<KnowledgeSection[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];

  let chunkEmbeddings: { id: string; embedding: number[] }[];

  const cache = loadEmbedCache();
  if (cache && cache.chunks.length === KB.length) {
    chunkEmbeddings = cache.chunks;
  } else {
    const batchSize = 20;
    chunkEmbeddings = [];
    for (let i = 0; i < KB.length; i += batchSize) {
      const batch = KB.slice(i, i + batchSize);
      const texts = batch.map(s => `Title: ${s.title}\nKeywords: ${s.keywords.join(', ')}\n\n${s.content}`);
      const embs = (await embed(texts)) as number[][];
      for (let j = 0; j < batch.length; j++) {
        chunkEmbeddings.push({ id: batch[j].id, embedding: embs[j] });
      }
    }
    saveEmbedCache(chunkEmbeddings);
  }

  // Query expansion — embed primary query for main score
  const questionEmb = (await embed(trimmed)) as number[];

  const lowerQuestion = trimmed.toLowerCase();

  // Score sections using hybrid approach: embedding similarity + keyword overlap + tag match + page boost
  const scored = chunkEmbeddings.map(ce => {
    const section = KB.find(k => k.id === ce.id);
    if (!section) return { id: ce.id, score: 0 };

    let embScore = cosineSimilarity(questionEmb, ce.embedding);

    // Keyword overlap boost
    const matchedKeywords = section.keywords.filter(kw => lowerQuestion.includes(kw.toLowerCase()));
    const keywordScore = matchedKeywords.length > 0
      ? KEYWORD_BOOST * (matchedKeywords.length / Math.max(...section.keywords.length, 1))
      : 0;

    // Tag overlap boost
    const matchedTags = section.tags.filter(t => lowerQuestion.includes(t));
    const tagScore = matchedTags.length > 0 ? TAG_BOOST * matchedTags.length : 0;

    // Page context boost
    const pageBoost = section.pages.includes(pagePath) ? 0.20 : 0;

    let total = embScore + keywordScore + tagScore + pageBoost;

    return { id: ce.id, score: total };
  });

  // Sort by combined score descending
  scored.sort((a, b) => b.score - a.score);

  // Primary: take top sections above threshold
  let results = scored.filter(s => s.score > SIMILARITY_THRESHOLD).slice(0, TOP_K);

  // Fallback 1: if none above threshold, take any with keyword or tag match
  if (results.length === 0) {
    results = scored
      .filter(s => {
        const sec = KB.find(k => k.id === s.id);
        if (!sec) return false;
        return sec.keywords.some(kw => lowerQuestion.includes(kw.toLowerCase()))
          || sec.tags.some(t => lowerQuestion.includes(t));
      })
      .slice(0, TOP_K);
  }

  // Fallback 2: if still none, take page-relevant sections
  if (results.length === 0) {
    results = chunkEmbeddings
      .map(ce => ({ id: ce.id, score: 0 }))
      .filter(ce => {
        const sec = KB.find(k => k.id === ce.id);
        return sec?.pages.includes(pagePath);
      })
      .slice(0, TOP_K);
  }

  // Fallback 3: if still nothing relevant, return top 3 by any measure
  if (results.length === 0) {
    results = scored.slice(0, 3);
  }

  const sections = results
    .map(s => KB.find(k => k.id === s.id))
    .filter(Boolean) as KnowledgeSection[];

  return sections;
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
      temperature: 0.2,
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

  if (!API_KEY) {
    onError(
      'The AI assistant is currently unavailable. ' +
      'Please visit the Support page or email jobbridgesupport@gmail.com for help.',
    );
    return;
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
    const sections = await retrieveRelevant(questionClean, pagePath);

    if (sections.length === 0) {
      onError("I couldn't find relevant information in the knowledge base. Try rephrasing your question or contact jobbridgesupport@gmail.com for help.");
      return;
    }

    const sourceList = sections.map(s => ({ id: s.id, title: s.title }));
    onSources(sourceList);

    const contextStr = trimContext(sections);
    const pageCtx = currentPageContext();

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

// ─── Pre-warm embedding cache (call on idle) ───────────────────

export function prewarmEmbeddings(): void {
  if (!API_KEY) return;
  if (loadEmbedCache()?.chunks?.length === KB.length) return;
  const batchSize = 20;
  (async () => {
    const chunks: { id: string; embedding: number[] }[] = [];
    for (let i = 0; i < KB.length; i += batchSize) {
      const batch = KB.slice(i, i + batchSize);
      const texts = batch.map(s => `Title: ${s.title}\nKeywords: ${s.keywords.join(', ')}\n\n${s.content}`);
      try {
        const embs = (await embed(texts)) as number[][];
        for (let j = 0; j < batch.length; j++) {
          chunks.push({ id: batch[j].id, embedding: embs[j] });
        }
      } catch {}
    }
    if (chunks.length === KB.length) saveEmbedCache(chunks);
  })();
}
