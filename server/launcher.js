const { spawn } = require('child_process');
const path = require('path');
const srv = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});
process.on('exit', () => srv.kill());
