import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (local dev). In Docker, env is set by Compose; .env path may not exist.
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env')
];
for (const p of envPaths) {
  const r = dotenv.config({ path: p });
  if (r.parsed && process.env.MYSQL_URL) break;
}

const mysqlUrl = process.env.MYSQL_URL;

if (!mysqlUrl) {
  const hint = process.env.DOCKER ? 'Pass MYSQL_URL via docker-compose environment or env_file.' : 'Set MYSQL_URL in .env in the project root.';
  throw new Error(`MYSQL_URL is not defined in environment variables. ${hint}`);
}

const url = new URL(mysqlUrl);
const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined;
const baseConnectionConfig = {
  host: url.hostname,
  port: url.port ? Number(url.port) : undefined,
  user: url.username ? decodeURIComponent(url.username) : undefined,
  password: url.password ? decodeURIComponent(url.password) : undefined
};

let hasUsersStoreIdColumn = true;
let hasUsersEditRightsColumn = false;

const sslParam = url.searchParams.get('ssl');
if (sslParam && !['0', 'false', 'no'].includes(sslParam.toLowerCase())) {
  baseConnectionConfig.ssl = { rejectUnauthorized: false };
}

const ensureDatabaseExists = async () => {
  if (!databaseName) {
    return;
  }

  try {
    const connection = await mysql.createConnection(baseConnectionConfig);
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    } finally {
      await connection.end();
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const errorType = error.code === 'ECONNREFUSED' ? 'Connection Refused' : 'Connection Timeout';
      console.error(`\n❌ MySQL ${errorType} Error`);
      console.error(`   Attempted to connect to: ${baseConnectionConfig.host}:${baseConnectionConfig.port || 3306}`);
      console.error('\n📋 Troubleshooting Steps:');
      console.error('   1. Verify MySQL server is running');
      if (baseConnectionConfig.host !== 'localhost' && baseConnectionConfig.host !== '127.0.0.1') {
        console.error('   2. If MySQL is on the same machine, use: localhost or 127.0.0.1');
        console.error('      - Current host:', baseConnectionConfig.host);
      }
      console.error('   3. Check if the IP address/hostname is correct');
      console.error('   4. Verify MySQL is configured to accept connections');
      console.error('   5. Check firewall settings (port 3306)');
      console.error('   6. Test connection manually: mysql -h ' + baseConnectionConfig.host + ' -P ' + (baseConnectionConfig.port || 3306) + ' -u ' + baseConnectionConfig.user);
      console.error('\n💡 Quick Fix (if MySQL is on same machine):');
      console.error(`   Update MYSQL_URL in .env file to use localhost:`);
      console.error(`   MYSQL_URL=mysql://root:StrongRoot@123@localhost:3306/Super_Market`);
      console.error('   or');
      console.error(`   MYSQL_URL=mysql://root:StrongRoot@123@127.0.0.1:3306/Super_Market\n`);
    }
    throw error;
  }
};

const ensureUsersTableSchema = async () => {
  if (!databaseName) {
    hasUsersStoreIdColumn = true;
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' LIMIT 1`,
      [databaseName]
    );

    if (tableRows.length === 0) {
      return;
    }

    const [columnRows] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME IN ('screen_id', 'store_id', 'edit_rights')`,
      [databaseName]
    );

    const columnSet = new Set(columnRows.map((row) => row.COLUMN_NAME.toLowerCase()));
    const hasScreenIdColumn = columnSet.has('screen_id');
    const hasStoreIdColumn = columnSet.has('store_id');
    const hasEditRightsColumn = columnSet.has('edit_rights');
    hasUsersStoreIdColumn = hasStoreIdColumn;
    hasUsersEditRightsColumn = hasEditRightsColumn;

    if (!hasScreenIdColumn) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN screen_id VARCHAR(255) NULL AFTER preferences`
      );
      console.info('✅ Added missing column users.screen_id');
    }

    if (!hasEditRightsColumn) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN edit_rights JSON NULL AFTER screen_id`
      );
      console.info('✅ Added missing column users.edit_rights');
      hasUsersEditRightsColumn = true;
    }

    if (hasStoreIdColumn) {
      const [indexRows] = await connection.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'users'
            AND INDEX_NAME = 'idx_users_store_id'
          LIMIT 1`,
        [databaseName]
      );

      if (indexRows.length === 0) {
        try {
          await connection.query(`CREATE INDEX idx_users_store_id ON users (store_id)`);
          console.info('✅ Created index idx_users_store_id on users.store_id');
        } catch (error) {
          if (error.code === 'ER_TOO_MANY_KEYS') {
            console.warn('⚠️ Unable to create idx_users_store_id: table already reached max index count. Continuing without it.');
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to ensure users table schema:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

try {
  await ensureDatabaseExists();
  await ensureUsersTableSchema();
} catch (error) {
  console.error('Failed to prepare database:', error.message);
  throw error;
}

const sequelizeOptions = {
  dialect: 'mysql',
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
  dialectOptions: baseConnectionConfig.ssl ? { ssl: baseConnectionConfig.ssl } : undefined,
  define: {
    underscored: true
  },
  pool: {
    max: parseInt(process.env.SEQUELIZE_POOL_MAX || process.env.MYSQL_POOL_LIMIT || '10', 10),
    min: parseInt(process.env.SEQUELIZE_POOL_MIN || '0', 10),
    idle: parseInt(process.env.SEQUELIZE_POOL_IDLE || process.env.MYSQL_POOL_IDLE_TIMEOUT || '10000', 10),
    acquire: parseInt(process.env.SEQUELIZE_POOL_ACQUIRE || '30000', 10)
  }
};

const sequelize = new Sequelize(mysqlUrl, sequelizeOptions);

try {
  await sequelize.authenticate();
} catch (error) {
  const errorCode = error.original?.code || error.code;
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || error.name === 'SequelizeConnectionRefusedError') {
    const errorType = errorCode === 'ETIMEDOUT' ? 'Connection Timeout' : 'Connection Refused';
    console.error(`\n❌ Sequelize MySQL ${errorType}`);
    console.error(`   Host: ${baseConnectionConfig.host}:${baseConnectionConfig.port || 3306}`);
    console.error('\n💡 Solution: Update MYSQL_URL in .env to use localhost if MySQL is on the same machine\n');
  }
  throw error;
}

const pool = mysql.createPool({
  ...baseConnectionConfig,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '10', 10),
  maxIdle: parseInt(process.env.MYSQL_POOL_MAX_IDLE || '5', 10),
  idleTimeout: parseInt(process.env.MYSQL_POOL_IDLE_TIMEOUT || '60000', 10),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export const isLocalDbConfigured = () => Boolean(pool);

export const getConnection = async () => {
  return pool.getConnection();
};

export const query = async (sql, params) => {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const errorType = error.code === 'ETIMEDOUT' ? 'Connection Timeout' : 'Connection Refused';
      console.error(`\n❌ MySQL ${errorType} in query`);
      console.error(`   Host: ${baseConnectionConfig.host}:${baseConnectionConfig.port || 3306}`);
      console.error('   Please check your MySQL server is running and MYSQL_URL is correct in .env\n');
    }
    throw error;
  }
};

export const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export default pool;
export { sequelize, hasUsersStoreIdColumn, hasUsersEditRightsColumn };
