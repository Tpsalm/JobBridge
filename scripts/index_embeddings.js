import fs from 'fs';
import path from 'path';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY in environment. Set it and re-run.');
  process.exit(1);
}

const dataPath = path.join(process.cwd(), 'data', 'site_knowledge.json');
const outPath = path.join(process.cwd(), 'data', 'vector_store.json');

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data[0].embedding;
}

function chunkText(text, maxLen = 2000) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts;
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const items = raw.items || [];
  const vectors = [];
  for (const it of items) {
    const text = (it.title || '') + '\n\n' + (it.text || '');
    const chunks = chunkText(text, 1800);
    for (const c of chunks) {
      console.log('Embedding', it.file, 'chunk', c.slice(0, 60).replace(/\s+/g, ' '));
      const v = await embed(c);
      vectors.push({ id: `${it.file}::${vectors.length}`, file: it.file, title: it.title, text: c, vector: v });
    }
  }
  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), model: MODEL, items: vectors }, null, 2));
  console.log('Wrote vector store to', outPath);
})();
