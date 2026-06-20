import http from 'http';
import fs from 'fs';
import path from 'path';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-3.5-turbo';
const PORT = process.env.AI_PORT ? Number(process.env.AI_PORT) : 5178;

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

async function embed(text) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data[0].embedding;
}

async function chatAnswer(systemPrompt, userPrompt) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`Chat API error: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.choices[0].message.content;
}

function readVectorStore() {
  const p = path.join(process.cwd(), 'data', 'vector_store.json');
  if (!fs.existsSync(p)) return { items: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function handleQuery(body) {
  const { query, top_k = 4 } = body;
  const store = readVectorStore();
  if (!store.items || store.items.length === 0) return { ok: false, error: 'Empty vector store' };
  const qvec = await embed(query);
  const scored = store.items.map((it) => ({ it, score: cosine(qvec, it.vector) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, top_k);
  const contextText = top.map((t, i) => `Source (${t.it.file}): ${t.it.text}`).join('\n\n');
  // Warmer, persona-driven system prompt to produce humanized, conversational answers
  const system = `You are JobBridge AI — a friendly, helpful career assistant for JobBridge users. Speak in a warm, conversational tone, keep answers concise and practical, and avoid showing raw code, file paths, or JSX fragments. When you use information from the provided context, summarize it in plain English and cite the source page title (for example: "On the Signup page I see ..."). If the context doesn't fully answer the user's question, ask one clarifying question instead of guessing. Always prioritize clarity and empathy.`;

  const prompt = `Context (use only to answer):\n${contextText}\n\nUser question:\n${query}\n\nInstructions: Use the context above to craft a short, human-friendly response. Start with a one-sentence summary, then add 2–4 practical steps or details if relevant. Cite any pages you used by name. Do NOT include code snippets, JSX, or raw source. If you cannot answer from the context, ask a focused clarifying question.`;
  const answer = await chatAnswer(system, prompt);
  return { ok: true, answer, sources: top.map(t => ({ file: t.it.file, title: t.it.title, score: t.score })) };
}

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/query') {
      const body = await parseJSON(req);
      const out = await handleQuery(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error('Server error', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
});

server.listen(PORT, () => console.log(`AI server listening on http://localhost:${PORT}`));
