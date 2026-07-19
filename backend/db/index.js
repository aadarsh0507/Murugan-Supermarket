import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

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

// Start SSH tunnel before any DB connection if USE_SSH_TUNNEL=true
if (process.env.USE_SSH_TUNNEL === 'true') {
  const tunnelPort = 3306;
  const alreadyOpen = await new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(300);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(tunnelPort, '127.0.0.1');
  });

  if (!alreadyOpen) {
    const args = [
      '-p', '2222', '-N',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ConnectTimeout=10',
      '-L', `${tunnelPort}:${process.env.SSH_TUNNEL_REMOTE_HOST || '172.16.7.209'}:3306`,
      `${process.env.SSH_USER || 'ggh'}@${process.env.SSH_HOST || '103.156.208.117'}`,
    ];

    console.log('🔐 Starting SSH tunnel...');
    const tunnel = spawn('ssh', args, { stdio: 'ignore' });
    tunnel.on('error', (err) => console.warn('SSH tunnel error:', err.message));
    tunnel.on('exit', (code) => { if (code) console.warn(`SSH tunnel exited: ${code}`); });

    // Wait until port is open (up to 15s)
    await new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const sock = new net.Socket();
        sock.setTimeout(500);
        sock.on('connect', () => { sock.destroy(); console.log('✅ SSH tunnel ready'); resolve(); });
        sock.on('error', () => { sock.destroy(); Date.now() - start < 15000 ? setTimeout(check, 300) : resolve(); });
        sock.on('timeout', () => { sock.destroy(); Date.now() - start < 15000 ? setTimeout(check, 300) : resolve(); });
        sock.connect(tunnelPort, '127.0.0.1');
      };
      check();
    });
  }
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

const ensureSubcategoryTableExists = async () => {
  if (!databaseName) {
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Subcategory' LIMIT 1`,
      [databaseName]
    );

    if (tableRows.length > 0) {
      return;
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`Subcategory\` (
        \`SubCategoryCode\` int NOT NULL,
        \`Description\` text,
        \`ParentId\` int DEFAULT NULL,
        \`CreationDate\` text,
        \`CreatedbyUser\` text,
        \`ModifiedbyUser\` text,
        \`ModifiedDate\` text,
        \`IsActive\` int DEFAULT NULL,
        \`store_id\` int unsigned DEFAULT NULL,
        \`IsImported\` int DEFAULT NULL,
        \`FileName\` text,
        \`ImportedDate\` text,
        \`OldCode\` text,
        \`MasterId\` int DEFAULT NULL,
        \`SyncId\` text,
        PRIMARY KEY (\`SubCategoryCode\`),
        KEY \`idx_store_id\` (\`store_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
    );
    console.info('✅ Created missing table Subcategory');
  } catch (error) {
    console.error('Failed to ensure Subcategory table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

const ensureTaxTableExists = async () => {
  if (!databaseName) {
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Tax' LIMIT 1`,
      [databaseName]
    );

    if (tableRows.length > 0) {
      return;
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`Tax\` (
        \`Taxcode\` int NOT NULL AUTO_INCREMENT,
        \`Description\` text,
        \`Centralsalestax\` int DEFAULT NULL,
        \`Localsalestax\` int DEFAULT NULL,
        \`Surcharge\` int DEFAULT NULL,
        \`Taxonmrp\` int DEFAULT NULL,
        \`InActive\` int DEFAULT NULL,
        \`store_id\` int DEFAULT NULL,
        \`Mrpinclusive\` int DEFAULT NULL,
        \`CreationDate\` text,
        \`ModifiedDate\` text,
        \`CreatedbyUser\` text,
        \`ModifiedbyUser\` text,
        \`Taxmode\` int DEFAULT NULL,
        \`OldCode\` text,
        \`TaxApplicable\` int DEFAULT NULL,
        \`CommodityCode\` text,
        \`CESS\` int DEFAULT NULL,
        \`FAValueAt\` int DEFAULT NULL,
        \`SurchargeOnTCS\` text,
        \`ServiceTax\` text,
        \`EffectiveTaxPercentage\` text,
        \`CessBasedOn\` text,
        \`STAddlTaxBasedOn\` text,
        \`TaxComputationBasedOn\` text,
        \`STCess\` text,
        \`STEducess\` text,
        \`IsGST\` int DEFAULT NULL,
        \`GSTCESSBasedOn\` text,
        \`B2CTaxCode\` text,
        PRIMARY KEY (\`Taxcode\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
    );
    console.info('✅ Created missing table Tax');
  } catch (error) {
    console.error('Failed to ensure Tax table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

const ensureBrandTableExists = async () => {
  if (!databaseName) {
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Brand' LIMIT 1`,
      [databaseName]
    );

    if (tableRows.length > 0) {
      return;
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`Brand\` (
        \`BrandCode\` varchar(50) NOT NULL,
        \`Description\` varchar(200) DEFAULT NULL,
        \`IsActive\` tinyint(1) DEFAULT '1',
        \`store_id\` int unsigned DEFAULT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`BrandCode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
    );
    console.info('✅ Created missing table Brand');
  } catch (error) {
    console.error('Failed to ensure Brand table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

const ensureCategoryTableExists = async () => {
  if (!databaseName) {
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Category' LIMIT 1`,
      [databaseName]
    );

    if (tableRows.length === 0) {
      await connection.query(
        `CREATE TABLE IF NOT EXISTS \`Category\` (
          \`CategoryCode\` int NOT NULL,
          \`Description\` text,
          \`CreationDate\` text,
          \`CreatedbyUser\` text,
          \`ModifiedbyUser\` text,
          \`ModifiedDate\` text,
          \`IsActive\` int DEFAULT NULL,
          \`store_id\` int unsigned DEFAULT NULL,
          \`IsImported\` text,
          \`FileName\` text,
          \`ImportedDate\` text,
          \`OldCode\` text,
          \`MasterId\` int DEFAULT NULL,
          \`CommissionPercentage\` int DEFAULT NULL,
          \`Classification\` int DEFAULT NULL,
          \`AllowBilling\` int DEFAULT NULL,
          \`MaintainSingleQty\` int DEFAULT NULL,
          \`DefaultPurchaseTax\` text,
          \`DefaultSalesTax\` text,
          \`AllowAdjustment\` int DEFAULT NULL,
          \`SyncId\` text,
          \`ProductHandlingMethod\` text,
          \`ReferenceProductCode\` text,
          \`SeriesName\` text,
          PRIMARY KEY (\`CategoryCode\`),
          KEY \`idx_store_id\` (\`store_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
      );
      console.info('✅ Created missing table Category');
    }

    // Seed Category codes if table is empty (so UI isn't blank after removing hardcoded map)
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM \`Category\``);
    const total = Number(countRows?.[0]?.total || 0);
    if (total > 0) {
      return;
    }

    const seedCodes = new Set();

    // Prefer Subcategory.ParentId as source of category codes
    try {
      const [subcats] = await connection.query(
        `SELECT DISTINCT ParentId AS code FROM \`Subcategory\` WHERE ParentId IS NOT NULL`
      );
      for (const row of subcats) {
        const n = Number(row.code);
        if (Number.isInteger(n) && n > 0) seedCodes.add(n);
      }
    } catch {
      // ignore if Subcategory missing
    }

    // Also try Products.CategoryCode if available
    try {
      const [products] = await connection.query(
        `SELECT DISTINCT CategoryCode AS code FROM \`Products\` WHERE CategoryCode IS NOT NULL`
      );
      for (const row of products) {
        const n = Number(row.code);
        if (Number.isInteger(n) && n > 0) seedCodes.add(n);
      }
    } catch {
      // ignore if Products missing
    }

    const codes = Array.from(seedCodes).sort((a, b) => a - b);
    if (codes.length === 0) {
      return;
    }

    // Insert with generic names; user can edit names later in DB/UI.
    const valuesSql = codes.map(() => '(?, ?, 1)').join(', ');
    const params = codes.flatMap((code) => [code, `Category ${code}`]);
    await connection.query(
      `INSERT INTO \`Category\` (\`CategoryCode\`, \`Description\`, \`IsActive\`) VALUES ${valuesSql}`,
      params
    );
    console.info(`✅ Seeded Category table with ${codes.length} rows`);
  } catch (error) {
    console.error('Failed to ensure Category table:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

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

/** Ensures Brand.subcategory_id exists so brands can link to subcategories (composite id: categoryCode:subCode). */
const ensureBrandSubcategoryColumn = async () => {
  if (!databaseName) {
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      ...baseConnectionConfig,
      database: databaseName
    });

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Brand' LIMIT 1`,
      [databaseName]
    );
    if (tableRows.length === 0) {
      return;
    }

    const [colRows] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Brand' AND COLUMN_NAME = 'subcategory_id'`,
      [databaseName]
    );
    if (colRows.length === 0) {
      const [storeRows] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Brand' AND COLUMN_NAME = 'store_id'`,
        [databaseName]
      );
      const afterStore = storeRows.length > 0 ? ' AFTER `store_id`' : '';

      await connection.query(
        `ALTER TABLE \`Brand\` ADD COLUMN \`subcategory_id\` VARCHAR(150) NULL${afterStore}`
      );
      console.info('✅ Added missing column Brand.subcategory_id');
    }

    const [indexRows] = await connection.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Brand' AND INDEX_NAME = 'idx_brand_subcategory' LIMIT 1`,
      [databaseName]
    );
    if (indexRows.length === 0) {
      try {
        await connection.query(`CREATE INDEX idx_brand_subcategory ON \`Brand\` (\`subcategory_id\`)`);
        console.info('✅ Created index idx_brand_subcategory on Brand.subcategory_id');
      } catch (idxErr) {
        if (idxErr.code !== 'ER_DUP_KEYNAME') {
          throw idxErr;
        }
      }
    }
  } catch (error) {
    console.error('Failed to ensure Brand.subcategory_id column:', error.message);
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
  await ensureSubcategoryTableExists();
  await ensureTaxTableExists();
  await ensureBrandTableExists();
  await ensureCategoryTableExists();
  await ensureBrandSubcategoryColumn();
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
