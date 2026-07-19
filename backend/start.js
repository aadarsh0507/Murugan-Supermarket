import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const waitForPort = (port, timeout = 10000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const check = () => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.on('connect', () => { sock.destroy(); resolve(); });
    sock.on('error', () => {
      sock.destroy();
      if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not open after ${timeout}ms`));
      setTimeout(check, 300);
    });
    sock.on('timeout', () => {
      sock.destroy();
      if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not open after ${timeout}ms`));
      setTimeout(check, 300);
    });
    sock.connect(port, '127.0.0.1');
  };
  check();
});

const startSshTunnel = () => new Promise((resolve) => {
  if (process.env.USE_SSH_TUNNEL !== 'true') return resolve();

  const args = [
    '-p', '2222', '-N',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ConnectTimeout=10',
    '-L', `3306:${process.env.SSH_TUNNEL_REMOTE_HOST || '172.16.7.209'}:3306`,
    `${process.env.SSH_USER || 'ggh'}@${process.env.SSH_HOST || '103.156.208.117'}`,
  ];

  console.log('🔐 Starting SSH tunnel...');
  const tunnel = spawn('ssh', args, { stdio: 'ignore' });

  tunnel.on('error', (err) => {
    console.warn('❌ SSH tunnel error:', err.message);
    resolve();
  });

  tunnel.on('exit', (code) => {
    if (code !== null) console.warn(`⚠️  SSH tunnel exited with code ${code}`);
  });

  // Wait until port 3306 is actually open before continuing
  waitForPort(3306, 15000)
    .then(() => {
      console.log('✅ SSH tunnel ready on 127.0.0.1:3306');
      resolve();
    })
    .catch((err) => {
      console.warn('⚠️  Tunnel port wait timed out:', err.message);
      resolve();
    });
});

await startSshTunnel();
await import('./server.js');
