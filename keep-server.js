const { spawn } = require('child_process');
const fs = require('fs');
const log = fs.openSync('/home/z/my-project/dev.log', 'a');

function startServer() {
  const child = spawn('node', ['.next/standalone/server.js', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', log, log],
    detached: true,
  });
  child.unref();
  child.on('exit', (code) => {
    fs.writeSync(log, `[keep-server] Server exited (code=${code}), restarting in 3s...\n`);
    setTimeout(startServer, 3000);
  });
  console.log('Server PID:', child.pid);
}

startServer();
