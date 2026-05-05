import '../config/loadEnv.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) {
  throw new Error('MYSQL_URL is not set in environment.');
}

const SQL_FILE =
  process.argv[2] ||
  path.resolve(__dirname, '../../backups/2026-04-24/backup_Suppliers_2026-04-24.sql');

const splitSqlStatements = (sqlText) => {
  // This dump is simple: one statement per line / block, no stored procedures.
  // We split on semicolons that end a line.
  const statements = [];
  let current = '';
  for (const line of sqlText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('--')) continue;

    current += `${line}\n`;
    if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements;
};

async function main() {
  const sqlText = await fs.readFile(SQL_FILE, 'utf8');
  const statements = splitSqlStatements(sqlText);

  const connection = await mysql.createConnection({
    uri: MYSQL_URL,
    multipleStatements: true
  });

  try {
    for (const stmt of statements) {
      // Skip MySQL-specific dump locks if permissions don't allow; they are optional for import.
      const normalized = stmt.replace(/\s+/g, ' ').trim().toUpperCase();
      if (normalized.startsWith('LOCK TABLES') || normalized.startsWith('UNLOCK TABLES')) {
        continue;
      }
      await connection.query(stmt);
    }
  } finally {
    await connection.end();
  }

  console.log(`✅ Suppliers loaded from ${SQL_FILE}`);
}

main().catch((err) => {
  console.error('❌ Failed to load suppliers:', err?.message ?? err);
  process.exit(1);
});

