// Auto-restart wrapper for Next.js dev server on port 3000
// Runs as a mini-service that auto-restarts the server if it crashes

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = '/home/z/my-project';
const LOG_FILE = path.join(PROJECT_ROOT, 'dev.log');
const NEXT_BIN = path.join(PROJECT_ROOT, 'node_modules/.bin/next');

function log(msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

function startServer(): ChildProcess {
  log('Starting Next.js dev server on port 3000...');

  const child = spawn('node', [NEXT_BIN, 'dev', '-p', '3000'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString();
    process.stdout.write(msg);
    try { fs.appendFileSync(LOG_FILE, msg); } catch {}
  });

  child.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString();
    process.stdout.write(msg);
    try { fs.appendFileSync(LOG_FILE, msg); } catch {}
  });

  child.on('exit', (code, signal) => {
    log(`Server exited (code=${code}, signal=${signal}). Restarting in 2s...`);
    setTimeout(startServer, 2000);
  });

  child.on('error', (err) => {
    log(`Server error: ${err.message}. Restarting in 2s...`);
    setTimeout(startServer, 2000);
  });

  return child;
}

log('Dev server watchdog started');
startServer();
