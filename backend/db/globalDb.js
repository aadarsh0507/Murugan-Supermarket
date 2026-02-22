/**
 * Global database (MYSQL_GLOBAL_* environment variables).
 * Used ONLY when the Sync button is triggered (sync-to-global flow).
 * All normal API and background jobs MUST use db/index.js (MYSQL_URL) instead.
 * This module initializes a separate connection pool strictly for sync destination writes.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Check for individual environment variables
const globalHost = process.env.MYSQL_GLOBAL_HOST;
const globalPort = process.env.MYSQL_GLOBAL_PORT;
const globalUser = process.env.MYSQL_GLOBAL_USER;
const globalPassword = process.env.MYSQL_GLOBAL_PASSWORD;
const globalDatabase = process.env.MYSQL_GLOBAL_DATABASE;

const hasGlobalDbConfig = globalHost && globalUser && globalPassword && globalDatabase;

if (!hasGlobalDbConfig) {
  console.warn('⚠️ Global database environment variables are not fully configured. Global sync will be disabled.');
  console.warn('   Required: MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, MYSQL_GLOBAL_DATABASE');
  console.warn('   Optional: MYSQL_GLOBAL_PORT (defaults to 3306)');
}

let globalPool = null;

/**
 * Initialize the global database connection pool.
 * Can be called explicitly to ensure initialization.
 * Returns true if pool was successfully initialized, false otherwise.
 */
export const initGlobalDb = () => {
  if (globalPool !== null) {
    // Already initialized
    return globalPool !== null;
  }

  if (!hasGlobalDbConfig) {
    console.warn('⚠️ Global database environment variables are not fully configured. Global sync will be disabled.');
    console.warn('   Required: MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, MYSQL_GLOBAL_DATABASE');
    console.warn('   Optional: MYSQL_GLOBAL_PORT (defaults to 3306)');
    return false;
  }

  try {
    globalPool = mysql.createPool({
      host: globalHost,
      port: Number(globalPort) || 3306,
      user: globalUser,
      password: globalPassword,
      database: globalDatabase,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '10', 10),
      queueLimit: 0,
      connectTimeout: parseInt(process.env.MYSQL_CONNECT_TIMEOUT || '10000', 10), // 10 seconds default
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    console.log(`✅ Global MySQL pool initialized: ${globalUser}@${globalHost}:${globalPort || 3306}/${globalDatabase}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Global MySQL pool:', error.message);
    console.error('   Host:', globalHost);
    console.error('   Port:', globalPort || 3306);
    console.error('   User:', globalUser);
    console.error('   Database:', globalDatabase);
    globalPool = null;
    return false;
  }
};

// Auto-initialize on module load (for backward compatibility)
if (hasGlobalDbConfig) {
  initGlobalDb();
}

/**
 * Verify Global DB connection and log result. Call at startup to show global DB connection status.
 * Does not throw; logs and resolves (so missing/failed global DB does not block server start).
 */
export const verifyGlobalConnection = async () => {
  if (!globalPool) {
    return;
  }
  try {
    const connection = await globalPool.getConnection();
    try {
      await connection.ping();
      const [rows] = await connection.query('SELECT DATABASE() AS db');
      const dbName = rows?.[0]?.db;
      console.log(`✅ Connected to Global MySQL${dbName ? ` (database: ${dbName})` : ''}`);
    } finally {
      connection.release();
    }
  } catch (error) {
    const parsedHost = process.env.MYSQL_GLOBAL_HOST || 'unknown';
    
    console.error('❌ Global MySQL connection error:', error.message);
    console.error('   Please check global database environment variables in .env file');
    console.error('   Current MYSQL_GLOBAL_HOST:', parsedHost);
  }
};

export const getGlobalConnection = async () => {
  if (!globalPool) {
    const error = new Error('Global database connection is not configured. Please set MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, and MYSQL_GLOBAL_DATABASE in .env file.');
    error.code = 'GLOBAL_DB_NOT_CONFIGURED';
    throw error;
  }
  return globalPool.getConnection();
};

/**
 * Execute a query on the GLOBAL DB. Used only by sync flow.
 * For SELECT: returns array of rows. For INSERT/UPDATE: returns ResultSetHeader (affectedRows, insertId).
 */
export const queryGlobalDb = async (sql, params = []) => {
  if (!globalPool) {
    const error = new Error('Global database connection is not configured. Please set MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, and MYSQL_GLOBAL_DATABASE in .env file.');
    error.code = 'GLOBAL_DB_NOT_CONFIGURED';
    throw error;
  }

  try {
    const [rows] = await globalPool.query(sql, params);
    return rows;
  } catch (error) {
    const host = process.env.MYSQL_GLOBAL_HOST || 'unknown';
    const port = process.env.MYSQL_GLOBAL_PORT || '3306';
    const user = process.env.MYSQL_GLOBAL_USER || 'unknown';
    const database = process.env.MYSQL_GLOBAL_DATABASE || 'unknown';
    
    console.error('❌ Global DB Query Error:', error.message);
    console.error('   Connection: ' + user + '@' + host + ':' + port + '/' + database);
    console.error('   SQL:', sql.length > 200 ? sql.substring(0, 200) + '...' : sql);
    if (params.length > 0) {
      console.error('   Params:', params.length, 'parameter(s)');
    }
    if (error.code) {
      console.error('   Error Code:', error.code);
      
      // Provide specific troubleshooting based on error code
      if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
        console.error('   💡 Troubleshooting:');
        console.error('      - Verify username and password are correct');
        console.error('      - Check if user has access from this host/IP');
        console.error('      - Run on MySQL server: GRANT ALL PRIVILEGES ON ' + database + '.* TO \'' + user + '\'@\'%\' IDENTIFIED BY \'password\';');
        console.error('      - Then: FLUSH PRIVILEGES;');
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.error('   💡 Troubleshooting:');
        console.error('      - Database "' + database + '" does not exist');
        console.error('      - Create it: CREATE DATABASE `' + database + '`;');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.error('   💡 Troubleshooting:');
        console.error('      - Check if MySQL server is running on ' + host + ':' + port);
        console.error('      - Verify network connectivity: ping ' + host);
        console.error('      - Check firewall rules');
        console.error('      - Verify MySQL bind-address allows remote connections');
      } else if (error.code === 'ER_PLUGIN_IS_NOT_LOADED') {
        console.error('   💡 Troubleshooting (MySQL 8.4+):');
        console.error('      - Switch user to caching_sha2_password on the global MySQL server:');
        console.error('        ALTER USER \'' + user + '\'@\'%\' IDENTIFIED WITH caching_sha2_password BY \'your_password\';');
        console.error('        FLUSH PRIVILEGES;');
        console.error('      - Or enable plugin in my.cnf: [mysqld] mysql_native_password=ON then restart MySQL.');
      }
    }
    
    const dbError = new Error(error.message || 'Global database query failed');
    dbError.code = error.code;
    dbError.originalError = error;
    throw dbError;
  }
};

/**
 * Run a callback inside a single global DB transaction.
 * Uses one connection: beginTransaction -> callback(connection) -> commit (or rollback on error).
 * Use connection.query(sql, params) inside the callback for all writes so they are atomic.
 */
export const transactionGlobalDb = async (callback) => {
  const connection = await getGlobalConnection();
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

export const isGlobalDbConfigured = () => {
  return globalPool !== null;
};

export { globalPool };

export default globalPool;

