// RAG Engine: Retrieval-Augmented Generation for the JobBridge AI Assistant
// Uses OpenAI embeddings for retrieval + GPT-4o-mini for natural answers.

import KB, { type KnowledgeSection } from './jobbridgeKnowledge';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const LLM_MODEL = 'gpt-4o-mini';
const TOP_K = 5;
const CACHE_KEY = 'jobbridge_rag_embeddings';
const CACHE_VERSION = 1;

// ─── Embedding helpers ─────────────────────────────────────────────────

interface EmbeddingCache {
  version: number;
  chunks: { id: string; embedding: number[] }[];
}

function loadCache(): EmbeddingCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(chunks: { id: string; embedding: number[] }[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, chunks }));
  } catch {
    // localStorage may be full — silently ignore
  }
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error: ${res.status} — ${err}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── RAG pipeline ──────────────────────────────────────────────────────

export interface RAGResult {
  answer: string;
  sources: { id: string; title: string }[];
  fromCache: boolean;
}

/**
 * Answer a user question using RAG:
 * 1. Embed the question
 * 2. Find top-k most similar knowledge sections
 * 3. Feed them as context to GPT-4o-mini
 * 4. Return the generated answer + sources
 */
export async function answerWithRAG(question: string): Promise<RAGResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { answer: 'Please ask a question.', sources: [], fromCache: false };
  }

  // ── 1. Get or compute embeddings ──
  const cache = loadCache();
  let chunkEmbeddings: { id: string; embedding: number[] }[];

  if (cache && cache.chunks.length === KB.length) {
    chunkEmbeddings = cache.chunks;
  } else {
    // Embed all knowledge chunks in parallel
    const texts = KB.map(s => `Title: ${s.title}\nKeywords: ${s.keywords.join(', ')}\n\n${s.content}`);
    const batchRes = await embed(texts);
    // The embed function only handles single strings; we need to handle batches
    // Actually let me handle this differently — embed individually or in batch
    // For simplicity, embed in parallel batches
    const batchSize = 10;
    chunkEmbeddings = [];
    for (let i = 0; i < KB.length; i += batchSize) {
      const batch = KB.slice(i, i + batchSize);
      const batchTexts = batch.map(s => `Title: ${s.title}\nKeywords: ${s.keywords.join(', ')}\n\n${s.content}`);
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: batchTexts }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Batch embedding API error: ${res.status} — ${err}`);
      }
      const data = await res.json();
      for (let j = 0; j < data.data.length; j++) {
        chunkEmbeddings.push({ id: batch[j].id, embedding: data.data[j].embedding });
      }
    }
    saveCache(chunkEmbeddings);
  }

  // ── 2. Embed the question ──
  const questionEmb = await embed(trimmed);

  // ── 3. Find top-k similar chunks ──
  const scored = chunkEmbeddings
    .map(ce => ({
      id: ce.id,
      similarity: cosineSimilarity(questionEmb, ce.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);

  const topSections: KnowledgeSection[] = scored
    .map(s => KB.find(k => k.id === s.id))
    .filter(Boolean) as KnowledgeSection[];

  if (topSections.length === 0) {
    return {
      answer: "I'm not sure about that. Try asking differently, or contact jobbridgesupport@gmail.com for help.",
      sources: [],
      fromCache: cache !== null,
    };
  }

  // ── 4. Generate answer with LLM ──
  const context = topSections.map(s =>
    `[${s.title}]\n${s.content}`
  ).join('\n\n---\n\n');

  const systemPrompt = `You are the JobBridge AI Assistant. Answer the user's question based ONLY on the context provided below. If the context doesn't contain the answer, say you're not sure and suggest contacting support at jobbridgesupport@gmail.com. Be concise (2-4 sentences) and helpful. Do not mention that you are using internal notes or context.`;

  const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${trimmed}` },
      ],
      max_tokens: 400,
      temperature: 0.3,
    }),
  });

  if (!llmRes.ok) {
    const err = await llmRes.text();
    throw new Error(`LLM API error: ${llmRes.status} — ${err}`);
  }

  const llmData = await llmRes.json();
  const answer = llmData.choices[0].message.content.trim();

  return {
    answer,
    sources: topSections.map(s => ({ id: s.id, title: s.title })),
    fromCache: cache !== null,
  };
}

export function hasApiKey(): boolean {
  return !!API_KEY;
}
