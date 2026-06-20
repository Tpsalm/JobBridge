const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');
const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function stripJsx(content) {
  // Remove import/export lines
  content = content.replace(/^\s*(import|export).*$/gm, '');
  // Remove JSX tags
  content = content.replace(/<[^>]+>/g, ' ');
  // Remove JS/TS single-line comments
  content = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove curly braces and JS expressions
  content = content.replace(/[{}]/g, ' ');
  // Collapse multiple spaces and newlines
  content = content.replace(/\s+/g, ' ');
  content = content.trim();
  return content;
}

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));
const knowledge = [];

for (const file of files) {
  try {
    const filePath = path.join(pagesDir, file);
    const src = fs.readFileSync(filePath, 'utf8');
    // Try to pick out title / headings by simple heuristics
    const titleMatch = src.match(/<h1[^>]*>(.*?)<\/?h1>/i) || src.match(/export default function\s+([A-Za-z0-9_]+)/);
    const title = titleMatch ? (titleMatch[1] || titleMatch[0]) : file.replace('.tsx','');
    const text = stripJsx(src);
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
