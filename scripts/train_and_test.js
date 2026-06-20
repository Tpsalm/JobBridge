import fs from 'fs';
import path from 'path';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY in environment. Set it and re-run.');
  process.exit(1);
}

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

function chunkText(text, maxLen = 2000) {
  if (!text) return [''];
  if (text.length <= maxLen) return [text];
  const parts = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts;
}

function cleanText(raw) {
  if (!raw) return '';
  let t = raw.replace(/<[^>]+>/g, ' ');
  t = t.replace(/\{[^}]*\}/g, ' ');
  t = t.replace(/\b(const|let|var|interface|export|import|from|return|=>|function|React|useState|props|className|map)\b/gi, ' ');
  t = t.replace(/\b[a-zA-Z0-9_]+\.[a-zA-Z0-9_\.]+\b/g, ' ');
  t = t.replace(/[=;:\/\\|<>\[\]*~`@#$%^&*()+]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

(async () => {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'site_knowledge.json');
    const outPath = path.join(process.cwd(), 'data', 'vector_store.json');
    if (!fs.existsSync(dataPath)) {
      console.error('Missing site_knowledge.json. Run the extractor first.');
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const items = raw.items || [];
    const vectors = [];
    console.log(`Indexing ${items.length} pages...`);
    for (const it of items) {
      const text = (it.title || '') + '\n\n' + (it.text || '');
      const cleaned = cleanText(text);
      const chunks = chunkText(cleaned, 1800);
      for (const c of chunks) {
        console.log('Embedding', it.file, c.slice(0, 60).replace(/\s+/g, ' '));
        const v = await embed(c);
        vectors.push({ id: `${it.file}::${vectors.length}`, file: it.file, title: it.title, text: c, vector: v });
      }
    }
    fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), model: EMBED_MODEL, items: vectors }, null, 2));
    console.log('Wrote vector store to', outPath);

    // quick QA run
    const system = `You are JobBridge AI — a friendly, helpful career assistant for JobBridge users. Speak in a warm, conversational tone, keep answers concise and practical, and avoid showing raw code, file paths, or JSX fragments. When you use information from the provided context, summarize it in plain English and cite the source page title.`;

    const queries = [
      'Hello',
      'Tell me about Signup',
      'How do I become a service provider?'
    ];

    const results = [];
    for (const q of queries) {
      console.log('\n=== Query:', q);
      // embed query
      const qvec = await embed(q);
      const scored = vectors.map((it) => ({ it, score: cosine(qvec, it.vector) }));
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 4);
      const contextText = top.map((t) => `Source (${t.it.file}): ${t.it.title} - ${t.it.text.slice(0, 400)}`).join('\n\n');
      const prompt = `Context:\n${contextText}\n\nUser question:\n${q}\n\nAnswer using only the context above when possible.`;
      const answer = await chatAnswer(system, prompt);
      console.log('Answer:\n', answer);
      results.push({ query: q, answer, sources: top.map(t => ({ file: t.it.file, title: t.it.title, score: t.score })) });
    }

    fs.writeFileSync(path.join(process.cwd(), 'data', 'ai_test_results.json'), JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));
    console.log('\nWrote ai_test_results.json');
  } catch (err) {
    console.error('Training error', err);
    process.exit(1);
  }
})();
