const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');
const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function extractVisibleText(content) {
  // Remove import/export lines
  content = content.replace(/^\s*(import|export).*$/gm, ' ');
  // Remove JS/TS single-line comments
  content = content.replace(/\/\/.*$/gm, ' ');
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, ' ');

  const pieces = [];

  // 1) Extract headings explicitly
  const headingRe = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gsi;
  let m;
  while ((m = headingRe.exec(content))) {
    pieces.push(m[1].replace(/<[^>]+>/g, ' ').trim());
  }

  // 2) Extract visible JSX text nodes: > some text <
  const textNodeRe = />\s*([^<>\n]{10,}?)\s*</gsi;
  while ((m = textNodeRe.exec(content))) {
    const txt = m[1].replace(/<[^>]+>/g, ' ').trim();
    // ignore tags that look like code
    if (txt && /[a-zA-Z]/.test(txt)) pieces.push(txt);
  }

  // 3) Extract string literals ("...") that look like UI copy
  const stringRe = /"([^"\\]{20,}?)"/gs;
  while ((m = stringRe.exec(content))) {
    const txt = m[1].trim();
    if (txt && /[a-zA-Z]/.test(txt)) pieces.push(txt);
  }

  // 4) Fallback: strip tags and keep remaining text
  let fallback = content.replace(/<[^>]+>/g, ' ').replace(/[{}]/g, ' ');
  fallback = fallback.replace(/\s+/g, ' ').trim();
  if (fallback.length > 200) pieces.push(fallback.slice(0, 2000));

  // Join and normalize
  const joined = pieces.join(' \n ').replace(/\s+/g, ' ').trim();
  return joined;
}

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));
const knowledge = [];

for (const file of files) {
  try {
    const filePath = path.join(pagesDir, file);
    const src = fs.readFileSync(filePath, 'utf8');
    // Try to pick out title / headings by simple heuristics
    const titleMatch = src.match(/<h1[^>]*>(.*?)<\/?h1>/i) || src.match(/export default function\s+([A-Za-z0-9_]+)/);
    const title = titleMatch ? (titleMatch[1] || titleMatch[0]) : file.replace('.tsx', '');
    const text = extractVisibleText(src);
    knowledge.push({
      file,
      path: path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/'),
      title,
      text,
    });
  } catch (err) {
    console.error('err', file, err.message);
  }
}

const outPath = path.join(outDir, 'site_knowledge.json');
fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), items: knowledge }, null, 2));
console.log('Wrote', outPath);
