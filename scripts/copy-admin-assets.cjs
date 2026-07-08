const fs = require('fs');
const path = require('path');

const root = process.cwd();
const distDir = path.join(root, 'dist');

if (!fs.existsSync(distDir)) {
  throw new Error('dist directory does not exist. Run vite build first.');
}

const filesToCopy = ['admin.html', 'admin-config.js'];

for (const fileName of filesToCopy) {
  const source = path.join(root, fileName);
  const destination = path.join(distDir, fileName);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing required file: ${fileName}`);
  }

  fs.copyFileSync(source, destination);
  console.log(`Copied ${fileName} -> dist/${fileName}`);
}
