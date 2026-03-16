import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (local dev). In Docker, env is set by Compose.
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of envPaths) {
  const r = dotenv.config({ path: p });
  if (r.parsed && process.env.MY_SQL_URI_APP) break;
}

const mysqlAppUrl = process.env.MY_SQL_URI_APP;

if (!mysqlAppUrl) {
  console.warn(
    '⚠️ MY_SQL_URI_APP is not defined. Mobile app orders API will be disabled.'
  );
}

let appPool = null;

if (mysqlAppUrl) {
  const url = new URL(mysqlAppUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined;
  const baseConnectionConfig = {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: databaseName,
  };

  const sslParam = url.searchParams.get('ssl');
  if (sslParam && !['0', 'false', 'no'].includes(sslParam.toLowerCase())) {
    baseConnectionConfig.ssl = { rejectUnauthorized: false };
  }

  appPool = mysql.createPool({
    ...baseConnectionConfig,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_APP_POOL_LIMIT || '5', 10),
    maxIdle: parseInt(process.env.MYSQL_APP_POOL_MAX_IDLE || '3', 10),
    idleTimeout: parseInt(process.env.MYSQL_APP_POOL_IDLE_TIMEOUT || '60000', 10),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

export const isMobileAppDbConfigured = () => Boolean(appPool);

export const queryMobileApp = async (sql, params) => {
  if (!appPool) {
    throw new Error('Mobile app database is not configured (MY_SQL_URI_APP missing).');
  }
  try {
    const [rows] = await appPool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('❌ Mobile app DB query error:', error.message);
    throw error;
  }
};

const ensureMobileOrdersSchema = async () => {
  if (!appPool) return;
  let connection;
  try {
    connection = await appPool.getConnection();
    try {
      await connection.query(
        'ALTER TABLE orders ADD COLUMN delivery_note TEXT NULL'
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    try {
      await connection.query(
        'ALTER TABLE orders ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1'
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    // Return request columns: status, reason, attached image URL
    const returnCols = [
      ['return_status', 'VARCHAR(50) NULL'],
      ['return_reason', 'TEXT NULL'],
      ['return_image_url', 'VARCHAR(500) NULL'],
    ];
    for (const [col, def] of returnCols) {
      try {
        await connection.query(
          `ALTER TABLE orders ADD COLUMN ${col} ${def}`
        );
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
  } catch (error) {
    console.error('⚠️ Failed to ensure mobile orders schema:', error.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const ensureDeliverySettingsTable = async () => {
  if (!appPool) return;
  let connection;
  try {
    connection = await appPool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_settings (
        id INT PRIMARY KEY,
        delivery_note TEXT NULL,
        delivery_cost DECIMAL(10,2) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.query(
      'INSERT IGNORE INTO delivery_settings (id, delivery_note, delivery_cost, is_active) VALUES (1, "", 0, 1)'
    );
  } catch (error) {
    console.error('⚠️ Failed to ensure delivery_settings table:', error.message);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

if (appPool) {
  // Fire-and-forget schema check; errors are logged but not fatal.
  // This keeps mobile orders API resilient even if migration fails.
  // eslint-disable-next-line no-floating-promises
  ensureMobileOrdersSchema();
  // eslint-disable-next-line no-floating-promises
  ensureDeliverySettingsTable();
}

export default appPool;

