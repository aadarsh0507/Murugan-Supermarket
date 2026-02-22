/**
 * Daily backup job: backs up the CLIENT DB only (from MYSQL_URL). Never uses MYSQL_GLOBAL_*.
 * - If BACKUP_VOLUME_PATH is set (e.g. /backups): writes inside the client MySQL container to that path (Docker volume).
 * - Otherwise: writes to BACKUP_DIR on host (docker cp from container /tmp).
 * Scheduled for 1 PM every day via node-cron in server.js.
 */
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { URL } from 'url';

const MYSQL_CONTAINER = process.env.MYSQL_BACKUP_CONTAINER || 'mysql8';

/**
 * Get DB config from MYSQL_URL (client/local DB) for mysqldump. Never uses global DB.
 */
function getDbConfig() {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) return null;
  const url = new URL(mysqlUrl);
  return {
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'Super_Market',
  };
}

/**
 * Run a command and return a promise that resolves when the process exits (code 0) or rejects on error.
 */
function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env: { ...process.env, ...env } });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Ensure directory exists inside container (docker exec mkdir -p).
 */
async function ensureContainerDir(containerPath) {
  await runCommand('docker', ['exec', MYSQL_CONTAINER, 'mkdir', '-p', containerPath]);
}

/**
 * Create a full DB backup and save to Docker volume or BACKUP_DIR.
 * - BACKUP_VOLUME_PATH set (e.g. /backups): write inside MySQL container to that path (Docker volume).
 * - Otherwise: write to host BACKUP_DIR via docker cp.
 * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
 */
export async function runDailyBackup() {
  const config = getDbConfig();
  if (!config?.user || !config?.password) {
    console.error('[DailyBackup] MYSQL_URL not set or missing user/password. Skipping backup.');
    return { success: false, error: 'MYSQL_URL not configured' };
  }

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `backup-${dateStr}.sql`;
  const backupVolumePath = process.env.BACKUP_VOLUME_PATH || ''; // e.g. /backups

  try {
    if (backupVolumePath) {
      // Save inside the CLIENT MySQL container (MYSQL_URL) to a path that is a Docker volume mount
      const containerBackupPath = path.posix.join(backupVolumePath.replace(/\\/g, '/'), filename);
      await ensureContainerDir(backupVolumePath);
      console.log(`[DailyBackup] Client DB backup (MYSQL_URL) → ${MYSQL_CONTAINER}:${containerBackupPath}`);

      await runCommand('docker', [
        'exec',
        '-e',
        `MYSQL_PWD=${config.password}`,
        MYSQL_CONTAINER,
        'mysqldump',
        '--single-transaction',
        '--no-tablespaces',
        '-u',
        config.user,
        config.database,
        '-r',
        containerBackupPath,
      ]);

      // Get size via docker exec stat (optional log)
      const sizeOut = await new Promise((resolve, reject) => {
        const proc = spawn('docker', ['exec', MYSQL_CONTAINER, 'stat', '-c', '%s', containerBackupPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.stderr.on('data', (d) => { err += d.toString(); });
        proc.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
      }).catch(() => null);
      const sizeMb = sizeOut ? (Number(sizeOut) / 1024 / 1024).toFixed(2) : '?';
      console.log(`[DailyBackup] ✅ Backup saved in Docker volume: ${containerBackupPath} (${sizeMb} MB)`);
      return { success: true, path: containerBackupPath };
    }

    // Fallback: save to host BACKUP_DIR via docker cp
    const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    const hostBackupPath = path.join(backupDir, filename);
    const containerTmp = `/tmp/daily-backup-${dateStr}.sql`;

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`[DailyBackup] Created backup directory: ${backupDir}`);
    }
    console.log(`[DailyBackup] Starting backup → ${hostBackupPath}`);

    await runCommand('docker', [
      'exec',
      '-e',
      `MYSQL_PWD=${config.password}`,
      MYSQL_CONTAINER,
      'mysqldump',
      '--single-transaction',
      '--no-tablespaces',
      '-u',
      config.user,
      config.database,
      '-r',
      containerTmp,
    ]);

    await runCommand('docker', [
      'cp',
      `${MYSQL_CONTAINER}:${containerTmp}`,
      hostBackupPath,
    ]);
    runCommand('docker', ['exec', MYSQL_CONTAINER, 'rm', '-f', containerTmp]).catch(() => {});

    const stats = fs.statSync(hostBackupPath);
    console.log(`[DailyBackup] ✅ Backup saved: ${hostBackupPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return { success: true, path: hostBackupPath };
  } catch (err) {
    console.error('[DailyBackup] ❌ Backup failed:', err.message);
    return { success: false, error: err.message };
  }
}
