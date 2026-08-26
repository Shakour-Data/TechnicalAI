// Signal-aware server wrapper
process.on('SIGTERM', () => { console.log('[SIGTERM] received'); process.exit(1); });
process.on('SIGINT', () => { console.log('[SIGINT] received'); process.exit(1); });
process.on('SIGHUP', () => { console.log('[SIGHUP] received, ignoring'); });
process.on('SIGUSR1', () => { console.log('[SIGUSR1] received'); });
process.on('SIGUSR2', () => { console.log('[SIGUSR2] received'); });

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// Try to load Next.js standalone server
let nextApp = null;
try {
  const standaloneDir = path.join(__dirname, '.next', 'standalone');
  if (fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    // Use the standalone Next.js server
    require(path.join(standaloneDir, 'server.js'));
    console.log('Next.js standalone server loaded');
  } else {
    // Fallback: simple dev server
    console.log('No standalone build found, launching next dev...');
    const { spawn } = require('child_process');
    const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    child.on('exit', (code) => { console.log('Next dev exited:', code); process.exit(code || 1); });
  }
} catch (e) {
  console.error('Failed to start:', e.message);
  process.exit(1);
}
