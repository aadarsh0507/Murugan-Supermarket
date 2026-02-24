import { query as queryLocalDb, isLocalDbConfigured } from '../db/index.js';
import { queryGlobalDb, isGlobalDbConfigured, getGlobalConnection } from '../db/globalDb.js';
import { createSyncBackups } from '../utils/backupService.js';
import { URL } from 'url';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env for getting connection configs
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Get local database connection config from MYSQL_URL
 */
const getLocalDbConfig = () => {
  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) return null;
  
  const url = new URL(mysqlUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || undefined
  };
};

/**
 * Get global database connection config from environment variables
 */
const getGlobalDbConfig = () => {
  const host = process.env.MYSQL_GLOBAL_HOST;
  const port = process.env.MYSQL_GLOBAL_PORT;
  const user = process.env.MYSQL_GLOBAL_USER;
  const password = process.env.MYSQL_GLOBAL_PASSWORD;
  const database = process.env.MYSQL_GLOBAL_DATABASE;
  
  if (!host || !user || !password || !database) return null;
  
  return {
    host,
    port: port ? Number(port) : 3306,
    user,
    password,
    database
  };
};

// Tables to skip when syncing (meta/migration tables).
const SKIP_TABLES = new Set(['SequelizeMeta', 'sequelize_meta']);

/** Sync checkpoint tables in global DB for resumable sync (survives disconnect). */
const SYNC_CHECKPOINT_TABLES = [
  `CREATE TABLE IF NOT EXISTS sync_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_id VARCHAR(100) DEFAULT 'default',
    status ENUM('in_progress','completed','failed') DEFAULT 'in_progress',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sync_session_tables (
    session_id BIGINT NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, table_name),
    INDEX idx_session (session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sync_table_watermarks (
    source_id VARCHAR(100) DEFAULT 'default',
    table_name VARCHAR(255) NOT NULL,
    last_synced_at DATETIME(3) NULL,
    PRIMARY KEY (source_id, table_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

const ensureSyncCheckpointTables = async () => {
  for (const sql of SYNC_CHECKPOINT_TABLES) {
    await queryGlobalDb(sql);
  }
};

const SOURCE_ID = 'default';

/** Returns column name for change detection: updated_at, modified_at, etc. or null. */
const getTimestampColumn = async (tableName) => {
  const rows = await queryLocalDb(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     AND LOWER(COLUMN_NAME) IN ('updated_at', 'modified_at', 'updatedat', 'modifiedat')`,
    [tableName]
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.length > 0 ? String(list[0].name) : null;
};

/** Get last_synced_at for a table from global DB. */
const getWatermark = async (tableName) => {
  const rows = await queryGlobalDb(
    'SELECT last_synced_at FROM sync_table_watermarks WHERE source_id = ? AND table_name = ?',
    [SOURCE_ID, tableName]
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.length > 0 ? list[0].last_synced_at : null;
};

/** Set watermark after syncing (global DB). */
const setWatermark = async (tableName, lastSyncedAt) => {
  await queryGlobalDb(
    `INSERT INTO sync_table_watermarks (source_id, table_name, last_synced_at)
     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at)`,
    [SOURCE_ID, tableName, lastSyncedAt]
  );
};

/** Deterministic row signature for comparison (ignore column order). */
const rowSignature = (row) => {
  if (row == null || typeof row !== 'object') return String(row);
  const keys = Object.keys(row).sort();
  const parts = keys.map((k) => {
    const v = row[k];
    if (v === null) return `${k}:null`;
    if (v instanceof Date) return `${k}:${v.toISOString()}`;
    if (Buffer.isBuffer(v)) return `${k}:${v.toString('base64')}`;
    if (typeof v === 'object') return `${k}:${JSON.stringify(v)}`;
    return `${k}:${String(v)}`;
  });
  return parts.join('|');
};

/** Fetch rows from global DB by primary key (single PK only for IN clause). */
const getGlobalRowsByPk = async (connection, tableName, pkCol, pkValues) => {
  if (pkValues.length === 0) return [];
  const placeholders = pkValues.map(() => '?').join(',');
  const sql = `SELECT * FROM \`${tableName}\` WHERE \`${pkCol}\` IN (${placeholders})`;
  const [rows] = await connection.query(sql, pkValues);
  return Array.isArray(rows) ? rows : [];
};

/** Fetch rows from global DB by composite match key: WHERE (col1, col2) IN ((v1,v2),(v3,v4),...). */
const getGlobalRowsByMatchKey = async (connection, tableName, matchKeyColumns, valueTuples) => {
  if (!valueTuples.length || !matchKeyColumns.length) return [];
  const placeholders = valueTuples.map(() => `(${matchKeyColumns.map(() => '?').join(', ')})`).join(', ');
  const flat = valueTuples.flat();
  const cols = matchKeyColumns.map((c) => `\`${c}\``).join(', ');
  const sql = `SELECT * FROM \`${tableName}\` WHERE (${cols}) IN (${placeholders})`;
  const [rows] = await connection.query(sql, flat);
  return Array.isArray(rows) ? rows : [];
};

/**
 * Get all base table names from the local database (for sync source).
 * Excludes SKIP_TABLES. Order is alphabetical for consistent runs.
 */
const getLocalTableNames = async () => {
  const rows = await queryLocalDb(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    []
  );
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((r) => (r && r.name != null ? String(r.name) : null))
    .filter((name) => name && !SKIP_TABLES.has(name));
};

/**
 * Get primary key column names for a table from the local DB schema.
 * Returns empty array if the table has no primary key (such tables are skipped for row sync).
 */
const getPrimaryKeyColumns = async (tableName) => {
  const rows = await queryLocalDb(
    `SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.map((r) => (r && r.name != null ? String(r.name) : null)).filter(Boolean);
};

/**
 * Return table names in dependency order: parent tables before child tables.
 * Uses REFERENTIAL_CONSTRAINTS so that e.g. bills is before bill_items.
 * Tables with no FKs or whose refs are outside the set come first.
 */
const getTablesInDependencyOrder = async (tableNames) => {
  const set = new Set(tableNames);
  const rows = await queryLocalDb(
    `SELECT TABLE_NAME AS tbl, REFERENCED_TABLE_NAME AS ref
     FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
    []
  );
  const list = Array.isArray(rows) ? rows : [];
  const inDegree = {};
  const edges = [];
  for (const t of tableNames) {
    inDegree[t] = 0;
  }
  for (const r of list) {
    const tbl = r?.tbl != null ? String(r.tbl) : null;
    const ref = r?.ref != null ? String(r.ref) : null;
    if (!tbl || !ref || !set.has(tbl) || !set.has(ref)) continue;
    if (tbl === ref) continue;
    inDegree[tbl] = (inDegree[tbl] ?? 0) + 1;
    edges.push({ ref, tbl });
  }
  const queue = tableNames.filter((t) => inDegree[t] === 0);
  const order = [];
  const seen = new Set();
  while (queue.length) {
    const t = queue.shift();
    if (seen.has(t)) continue;
    seen.add(t);
    order.push(t);
    for (const { ref, tbl } of edges) {
      if (ref !== t) continue;
      inDegree[tbl] -= 1;
      if (inDegree[tbl] === 0) queue.push(tbl);
    }
  }
  for (const t of tableNames) {
    if (!seen.has(t)) order.push(t);
  }
  return order;
};

/**
 * Ensure that a given table exists in the GLOBAL database.
 * If it does not exist, it is created using the schema from the LOCAL database.
 * Uses CREATE TABLE IF NOT EXISTS so creation is always attempted (no reliance on
 * information_schema). Never modifies LOCAL.
 *
 * 1. Runs SHOW CREATE TABLE on the LOCAL DB.
 * 2. Normalizes the DDL (strip DB qualifiers, strip FOREIGN KEYs).
 * 3. Runs CREATE TABLE IF NOT EXISTS on the GLOBAL DB.
 */
const ensureGlobalTableFromLocalSchema = async (tableName) => {
  const showCreateRows = await queryLocalDb(`SHOW CREATE TABLE \`${tableName}\``);
  if (!Array.isArray(showCreateRows) || showCreateRows.length === 0) {
    const err = new Error(`Unable to read schema for local table "${tableName}".`);
    err.code = 'LOCAL_TABLE_SCHEMA_NOT_FOUND';
    throw err;
  }

  const createStatement =
    showCreateRows[0].CreateTable ||
    showCreateRows[0]['Create Table'] ||
    null;

  if (!createStatement || typeof createStatement !== 'string') {
    const err = new Error(`SHOW CREATE TABLE did not return a valid statement for "${tableName}".`);
    err.code = 'LOCAL_TABLE_SCHEMA_INVALID';
    throw err;
  }

  // Strip explicit database qualifiers: `dbName`.`tableName` -> `tableName`
  let ddl = createStatement.replace(
    /CREATE\s+TABLE\s+`[^`]+`\.`([^`]+)`/i,
    'CREATE TABLE `$1`'
  );

  // Strip FOREIGN KEY constraints so GLOBAL can exist without referenced tables
  ddl = ddl.replace(
    /,?\s*CONSTRAINT\s+[^\s]+\s+FOREIGN\s+KEY\s+\([^)]+\)\s+REFERENCES\s+[^\s,)]+(\s+\([^)]+\))?(\s+ON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION|\S+))*/gi,
    ''
  );
  // Remove orphaned FK fragments left after strip (e.g. " NULL ON UPDATE CASCADE", " ON DELETE SET NULL")
  ddl = ddl.replace(/\s+NULL\s+ON\s+UPDATE\s+CASCADE/gi, '');
  ddl = ddl.replace(/\s+ON\s+DELETE\s+SET\s+NULL/gi, '');
  ddl = ddl.replace(/\s+ON\s+UPDATE\s+CASCADE/gi, '');
  ddl = ddl.replace(/\s+ON\s+DELETE\s+CASCADE/gi, '');
  ddl = ddl.replace(/\s+ON\s+DELETE\s+RESTRICT/gi, '');
  ddl = ddl.replace(/\s+ON\s+UPDATE\s+RESTRICT/gi, '');
  // Collapse repeated commas and trailing comma before closing paren
  ddl = ddl.replace(/,(\s*,)+/g, ',').replace(/,\s*\)/g, ')');

  // Use IF NOT EXISTS so we always ensure table exists; no-op if already present
  if (!/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(ddl)) {
    ddl = ddl.replace(/CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
  }

  // Log DDL for debugging (truncate if too long)
  const ddlPreview = ddl.length > 500 ? ddl.substring(0, 500) + '...' : ddl;
  console.log(`[Sync] Creating table "${tableName}" in global DB with DDL:`, ddlPreview);

  try {
    await queryGlobalDb(ddl);
    console.log(`[Sync] ✅ Successfully created/verified table "${tableName}" in global DB`);
  } catch (err) {
    console.error(`[Sync] ❌ Failed to create table "${tableName}" in global DB`);
    console.error(`[Sync] Error code: ${err?.code || 'UNKNOWN'}`);
    console.error(`[Sync] Error message: ${err?.message || 'No error message'}`);
    console.error(`[Sync] Full DDL that failed:`, ddl);
    
    const prep = new Error(
      `Failed to create table "${tableName}" in GLOBAL DB. ${err?.message || ''}`
    );
    prep.code = err?.code;
    prep.originalError = err;
    throw prep;
  }

  // Drop any existing foreign keys on this table in GLOBAL so inserts never fail on ref integrity.
  // (Table may have been created earlier with FKs, or CREATE was a no-op and table already had FKs.)
  try {
    const fkRows = await queryGlobalDb(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
      [tableName]
    );
    const fkList = Array.isArray(fkRows) ? fkRows : [];
    for (const row of fkList) {
      const fkName = row?.name != null ? String(row.name) : null;
      if (!fkName) continue;
      await queryGlobalDb(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fkName}\``);
    }
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') throw err;
    console.warn(`[Sync] Could not drop FKs on global table "${tableName}":`, err?.message);
  }
};

/**
 * Get all column names that are part of any PRIMARY KEY or UNIQUE index (local schema).
 */
const getUniqueKeyColumns = async (tableName) => {
  const rows = await queryLocalDb(
    `SELECT k.COLUMN_NAME AS name
     FROM information_schema.KEY_COLUMN_USAGE k
     INNER JOIN information_schema.TABLE_CONSTRAINTS t
       ON k.TABLE_SCHEMA = t.TABLE_SCHEMA AND k.TABLE_NAME = t.TABLE_NAME AND k.CONSTRAINT_NAME = t.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ?
       AND t.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')`,
    [tableName]
  );
  const list = Array.isArray(rows) ? rows : [];
  return new Set(list.map((r) => String(r.name).toLowerCase()).filter(Boolean));
};

/**
 * Tables that have no PRIMARY/UNIQUE key in schema: use this fallback match key for sync (UPDATE/INSERT by these columns).
 * Ensures tables like Products (ProductCode + store_id) are synced when the schema has no formal key.
 */
const TABLE_MATCH_KEY_FALLBACK = {
  Products: ['ProductCode', 'store_id']
};

/**
 * Tables that must always be compared with global (not watermark). Ensures every sync pushes new/changed rows
 * even if updated_at is missing or watermark would skip them. Use for critical tables like bills.
 */
const ALWAYS_COMPARE_TABLES = new Set(['bills', 'bill_items']);

/**
 * Get the preferred match key for a table: use UNIQUE key(s) so client and global match by same business key.
 * Returns { whereColumns } - columns to use in WHERE when matching a row (e.g. ['product_code','store_id'] or ['id']).
 * Prefers a non-PRIMARY UNIQUE key so both DBs are compared and updated by the same unique codes.
 */
const getPreferredMatchKey = async (tableName) => {
  const rows = await queryLocalDb(
    `SELECT t.CONSTRAINT_NAME AS constraint_name, t.CONSTRAINT_TYPE AS type, k.COLUMN_NAME AS name, k.ORDINAL_POSITION AS pos
     FROM information_schema.TABLE_CONSTRAINTS t
     INNER JOIN information_schema.KEY_COLUMN_USAGE k
       ON k.TABLE_SCHEMA = t.TABLE_SCHEMA AND k.TABLE_NAME = t.TABLE_NAME AND k.CONSTRAINT_NAME = t.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ?
       AND t.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')
     ORDER BY t.CONSTRAINT_TYPE ASC, t.CONSTRAINT_NAME ASC, k.ORDINAL_POSITION ASC`,
    [tableName]
  );
  const list = Array.isArray(rows) ? rows : [];
  const byConstraint = new Map();
  for (const r of list) {
    const cn = r.constraint_name;
    if (!byConstraint.has(cn)) byConstraint.set(cn, { type: r.type, cols: [] });
    byConstraint.get(cn).cols.push(r.name);
  }
  for (const [, info] of byConstraint) {
    if (info.type === 'UNIQUE' && info.cols.length > 0) {
      return { whereColumns: info.cols };
    }
  }
  for (const [, info] of byConstraint) {
    if (info.type === 'PRIMARY KEY' && info.cols.length > 0) {
      return { whereColumns: info.cols };
    }
  }
  return { whereColumns: [] };
};

/**
 * Match by unique key and replace: UPDATE non-PK columns WHERE matchKey = row values; if no row matched, INSERT.
 * PK is excluded from SET to avoid duplicate primary key when another row already has that id.
 */
const buildUpdateByMatchKeySql = (tableName, columns, whereColumns, pkColumnsSet) => {
  if (whereColumns.length === 0) return null;
  const setColumns = columns.filter((c) => !pkColumnsSet.has(String(c).toLowerCase()));
  if (setColumns.length === 0) return null;
  const setClause = setColumns.map((c) => `\`${c}\` = ?`).join(', ');
  const whereClause = whereColumns.map((c) => `\`${c}\` = ?`).join(' AND ');
  return { sql: `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause}`, setColumns };
};

const buildInsertSql = (tableName, columns) => {
  const columnList = columns.map((c) => `\`${c}\``).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;
};

/**
 * POST /api/backup-and-upload
 *
 * Endpoint to create backup in Docker volume, read the file,
 * and push it to Global DB as BLOB.
 * 
 * Flow:
 * 1. Create .sql backup in Docker volume (/backups/)
 * 2. Copy file from container to host temp
 * 3. Read file and push to Global DB as BLOB
 * 4. Cleanup temp file
 */
export const backupAndUpload = async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  // Use /tmp directory which always exists in containers
  const containerBackup = `/tmp/backup-${timestamp}.sql`;

  try {
    /* ----------------------------------------------------
       1️⃣ CREATE BACKUP IN DOCKER VOLUME
    ---------------------------------------------------- */
    console.log(`[Backup] Creating backup in container: ${containerBackup}`);
    
    // Get MySQL credentials from MYSQL_URL using the same method as the app
    const dbConfig = getLocalDbConfig();
    
    if (!dbConfig || !dbConfig.user || !dbConfig.password) {
      console.error("[Backup] ❌ Failed to get database credentials from MYSQL_URL");
      return res.status(500).json({
        success: false,
        step: "config",
        error: "Database credentials not found. Please check MYSQL_URL in .env file.",
      });
    }
    
    const mysqlUser = dbConfig.user;
    const mysqlPassword = dbConfig.password;
    
    console.log(`[Backup] Using MySQL user: ${mysqlUser}`);
    console.log(`[Backup] Database: ${dbConfig.database || 'Super_Market'}`);
    console.log(`[Backup] Password extracted: ${mysqlPassword ? 'Yes (length: ' + mysqlPassword.length + ')' : 'NO - This will fail!'}`);
    
    if (!mysqlPassword) {
      return res.status(500).json({
        success: false,
        step: "config",
        error: "MySQL password is empty. Please check MYSQL_URL in .env file.",
      });
    }
    
    // Use docker exec with -e flag to pass environment variable
    // This is the most reliable way to pass MYSQL_PWD to the container
    const databaseName = dbConfig.database || "Super_Market";
    
    const dump = spawn(
      "docker",
      [
        "exec",
        "-e",
        `MYSQL_PWD=${mysqlPassword}`,
        "mysql8",
        "mysqldump",
        "--single-transaction",
        "--no-tablespaces",
        "-u",
        mysqlUser,
        databaseName,
        "-r",
        containerBackup,
      ],
      {
        env: process.env,
      }
    );

    let dumpErr = "";
    dump.stderr.on("data", (d) => (dumpErr += d.toString()));

    dump.on("close", async (code) => {
      if (code !== 0) {
        console.error("❌ Backup dump failed with code:", code);
        console.error("❌ Dump stderr:", dumpErr);
        return res.status(500).json({
          success: false,
          step: "backup",
          error: dumpErr || `mysqldump exited with code ${code}`,
        });
      }

      console.log("✅ Backup dump completed successfully");

      /* ----------------------------------------------------
         1b. PUSH BACKUP TO LOCAL DB (restore so local DB exists / is populated)
      ---------------------------------------------------- */
      try {
        const ensureDb = spawn("docker", [
          "exec", "-e", `MYSQL_PWD=${mysqlPassword}`,
          "mysql8", "mysql", "-u", mysqlUser, "-e",
          `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`;`
        ], { env: process.env });
        await new Promise((resolve, reject) => {
          let err = "";
          ensureDb.stderr.on("data", (d) => { err += d.toString(); });
          ensureDb.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err || `Exit ${c}`))));
        });
        console.log("[Backup] Ensuring local DB exists: " + databaseName);

        const restore = spawn("docker", [
          "exec", "-e", `MYSQL_PWD=${mysqlPassword}`,
          "mysql8", "sh", "-c",
          `mysql -u ${mysqlUser} ${databaseName} < ${containerBackup}`
        ], { env: process.env });
        let restoreErr = "";
        restore.stderr.on("data", (d) => { restoreErr += d.toString(); });
        await new Promise((resolve, reject) => {
          restore.on("close", (c) => (c === 0 ? resolve() : reject(new Error(restoreErr || `Exit ${c}`))));
        });
        console.log("[Backup] ✅ Local backup restored to local DB");
      } catch (restoreErr) {
        console.warn("[Backup] Restore to local DB failed (continuing):", restoreErr.message);
      }

      /* ----------------------------------------------------
         2️⃣ COPY FILE FROM CONTAINER TO HOST TEMP
      ---------------------------------------------------- */
      const hostTemp = path.join(
        process.cwd(),
        `backup-${timestamp}.sql`
      );

      try {
        console.log(`[Backup] Copying file from container to host: ${hostTemp}`);
        await new Promise((resolve, reject) => {
          const cp = spawn("docker", [
            "cp",
            `mysql8:${containerBackup}`,
            hostTemp,
          ]);
          let cpErr = "";
          cp.stderr.on("data", (d) => (cpErr += d.toString()));
          cp.on("close", (c) => {
            if (c === 0) {
              console.log("✅ File copied successfully");
              resolve();
            } else {
              console.error("❌ Docker copy failed with code:", c);
              console.error("❌ Copy stderr:", cpErr);
              reject(new Error(`Docker copy failed: ${cpErr || 'Unknown error'}`));
            }
          });
        });
      } catch (copyError) {
        console.error("❌ Copy error:", copyError);
        return res.status(500).json({
          success: false,
          step: "copy",
          error: copyError.message,
        });
      }

      /* ----------------------------------------------------
         3️⃣ PUSH FILE INTO GLOBAL DB
      ---------------------------------------------------- */
      try {
        console.log(`[Backup] Reading backup file: ${hostTemp}`);
        const fileBuffer = fs.readFileSync(hostTemp);
        const fileSize = fileBuffer.length;
        console.log(`[Backup] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Check if global DB is configured
        if (!process.env.MYSQL_GLOBAL_HOST || !process.env.MYSQL_GLOBAL_USER || 
            !process.env.MYSQL_GLOBAL_PASSWORD || !process.env.MYSQL_GLOBAL_DATABASE) {
          // Cleanup temp file before returning
          try { fs.unlinkSync(hostTemp); } catch {}
          console.error("❌ Global DB not configured");
          return res.status(500).json({
            success: false,
            step: "global_db_config",
            error: "Global database is not configured. Please set MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, and MYSQL_GLOBAL_DATABASE in .env file.",
          });
        }

        console.log(`[Backup] Connecting to global DB: ${process.env.MYSQL_GLOBAL_HOST}:${process.env.MYSQL_GLOBAL_PORT || 3306}/${process.env.MYSQL_GLOBAL_DATABASE}`);
        const globalConn = await mysql.createConnection({
          host: process.env.MYSQL_GLOBAL_HOST,
          port: process.env.MYSQL_GLOBAL_PORT || 3306,
          user: process.env.MYSQL_GLOBAL_USER,
          password: process.env.MYSQL_GLOBAL_PASSWORD,
          database: process.env.MYSQL_GLOBAL_DATABASE,
        });

        // Create table if it doesn't exist
        try {
          console.log("[Backup] Creating db_backups table if not exists...");
          await globalConn.execute(`
            CREATE TABLE IF NOT EXISTS db_backups (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              source_db VARCHAR(100) NOT NULL,
              filename VARCHAR(255) NOT NULL,
              file_size BIGINT NOT NULL,
              backup_data LONGBLOB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_source_db (source_db),
              INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log("[Backup] ✅ Table ready");
        } catch (tableError) {
          console.error("❌ Error creating db_backups table:", tableError);
          // Continue - table might already exist
        }

        console.log("[Backup] Inserting backup file into global DB...");
        await globalConn.execute(
          `INSERT INTO db_backups
           (source_db, filename, file_size, backup_data)
           VALUES (?, ?, ?, ?)`,
          ["Super_Market", path.basename(hostTemp), fileSize, fileBuffer]
        );
        console.log("[Backup] ✅ Backup file inserted into global DB");

        await globalConn.end();

        // Cleanup temp file
        try {
          fs.unlinkSync(hostTemp);
        } catch (unlinkErr) {
          console.warn("Failed to cleanup temp file:", unlinkErr);
        }

        /* ----------------------------------------------------
           ✅ SUCCESS
        ---------------------------------------------------- */
        return res.json({
          success: true,
          message: "Backup created, restored to local DB, and pushed to Global DB",
          filename: path.basename(containerBackup),
          size: fileSize,
        });
      } catch (dbError) {
        console.error("❌ Database error:", dbError);
        // Cleanup temp file on error
        try {
          if (fs.existsSync(hostTemp)) {
            fs.unlinkSync(hostTemp);
          }
        } catch (unlinkErr) {
          console.warn("Failed to cleanup temp file:", unlinkErr);
        }
        
        return res.status(500).json({
          success: false,
          step: "database",
          error: dbError.message || "Failed to store backup in global database",
          details: process.env.NODE_ENV === 'development' ? dbError.stack : undefined,
        });
      }
    });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    res.status(500).json({
      success: false,
      message: "Unexpected error during backup upload",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * POST /api/sync-to-global
 *
 * Lightweight endpoint to validate that both local and global databases
 * are available. The actual streaming of progress is handled by the
 * Server-Sent Events (SSE) endpoint below.
 */
export const startSyncToGlobal = async (req, res) => {
  try {
    if (!isLocalDbConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Local application database is not configured. Please set MYSQL_URL in .env file.',
        error: 'LOCAL_DB_NOT_CONFIGURED'
      });
    }

    if (!isGlobalDbConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Global database is not configured. Please set MYSQL_GLOBAL_URL in .env file.',
        error: 'GLOBAL_DB_NOT_CONFIGURED'
      });
    }

    // For now we simply acknowledge that the sync can be started.
    // The frontend should immediately open an SSE connection to
    // /api/sync-to-global/stream to receive real-time progress updates.
    return res.status(202).json({
      success: true,
      message: 'Sync to global has been initiated. Connect to /api/sync-to-global/stream for progress.',
      mode: 'sse'
    });
  } catch (error) {
    console.error('Error starting sync-to-global:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start sync to global database',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/sync-to-global/stream
 *
 * SSE endpoint that:
 * - Reads all data from the LOCAL database (MYSQL_URL via db/index.js)
 * - Ensures GLOBAL tables exist (creates from LOCAL schema if missing; FKs stripped)
 * - Inserts ONLY new rows into GLOBAL (INSERT IGNORE via PK/UNIQUE); skips existing
 * - Never modifies LOCAL. Uses MYSQL_GLOBAL_URL for GLOBAL.
 *
 * Event payload:
 * {
 *   progress: number,          // 0-100 (processed / total)
 *   totalRecords: number,      // total rows processed
 *   syncedRecords: number,     // rows actually inserted (existing skipped)
 *   status: 'running' | 'success' | 'error' | 'cancelled',
 *   message?: string
 * }
 */
export const streamSyncToGlobal = async (req, res) => {
  // Ensure persistent connection for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable response buffering in some proxies (e.g. Nginx)
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers if supported by the runtime
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const closeStream = () => {
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  let lastProgress = 0;
  let syncedRecords = 0;
  let insertedRecords = 0;
  let updatedRecords = 0;
  let totalRecords = 0;
  let processedRecords = 0;
  /** @type {Array<{ tableName: string, total: number, inserted: number, updated: number }>} */
  let tableSummary = [];
  let sessionId = null;

  const log = (msg, data = {}) => {
    console.log(`[Sync] ${msg}`, Object.keys(data).length ? data : '');
  };

  const sendProgress = (overrides = {}) => {
    sendEvent({
      progress: lastProgress,
      totalRecords,
      syncedRecords,
      insertedRecords,
      updatedRecords,
      tableSummary: tableSummary.length ? tableSummary : undefined,
      status: 'running',
      ...(sessionId != null ? { sessionId } : {}),
      ...overrides
    });
  };

  try {
    if (!isLocalDbConfigured()) {
      sendEvent({
        progress: 0,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        status: 'error',
        message: 'Local application database is not configured. Please set MYSQL_URL in .env file.'
      });
      return closeStream();
    }

    if (!isGlobalDbConfigured()) {
      sendEvent({
        progress: 0,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        status: 'error',
        message: 'Global database is not configured. Please set MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, and MYSQL_GLOBAL_DATABASE in .env file.'
      });
      return closeStream();
    }

    // Test global database connection before proceeding
    try {
      log('Testing global database connection...');
      const testResult = await queryGlobalDb('SELECT 1 AS test, DATABASE() AS db, USER() AS user');
      const dbInfo = Array.isArray(testResult) && testResult.length > 0 ? testResult[0] : null;
      if (dbInfo) {
        log(`✅ Global database connection verified (DB: ${dbInfo.db || 'unknown'}, User: ${dbInfo.user || 'unknown'})`);
      } else {
        log('✅ Global database connection verified');
      }
      await ensureSyncCheckpointTables();
    } catch (connError) {
      console.error('[Sync] ❌ Global database connection test failed');
      console.error('[Sync] Error details:', {
        code: connError.code,
        message: connError.message,
        sqlState: connError.sqlState,
        errno: connError.errno
      });
      
      let connErrorMessage = 'Failed to connect to global database. ';
      
      if (connError.code === 'GLOBAL_DB_NOT_CONFIGURED') {
        connErrorMessage = 'Global database is not configured. Please set MYSQL_GLOBAL_HOST, MYSQL_GLOBAL_USER, MYSQL_GLOBAL_PASSWORD, and MYSQL_GLOBAL_DATABASE in .env file.';
      } else if (connError.code === 'ER_PLUGIN_IS_NOT_LOADED') {
        connErrorMessage = "Global MySQL user is using 'mysql_native_password', which is not loaded on MySQL 8.4+. On the global MySQL server run: ALTER USER 'global_user'@'%' IDENTIFIED WITH caching_sha2_password BY 'YourPassword'; FLUSH PRIVILEGES; (use your actual password). Or enable the plugin in my.cnf: [mysqld] mysql_native_password=ON and restart MySQL.";
      } else if (connError.code === 'ECONNREFUSED' || connError.code === 'ETIMEDOUT') {
        connErrorMessage += 'Check network connectivity and ensure the global database server is running. See server logs for details.';
      } else if (connError.code === 'ER_ACCESS_DENIED_ERROR' || connError.code === 'ER_DBACCESS_DENIED_ERROR') {
        connErrorMessage += 'Check database user credentials and permissions. The user may not have access from this host. See server logs for SQL commands to fix.';
      } else if (connError.code === 'ER_BAD_DB_ERROR') {
        connErrorMessage += 'The specified global database does not exist. Please create it first.';
      } else if (connError.message) {
        connErrorMessage += connError.message;
      } else {
        connErrorMessage += 'Unknown connection error. Check server logs for details.';
      }
      
      sendEvent({
        progress: 0,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        status: 'error',
        message: connErrorMessage
      });
      return closeStream();
    }

    // Step 1: Discover all local tables and their primary keys.
    let tableNames;
    try {
      tableNames = await getLocalTableNames();
      tableNames = await getTablesInDependencyOrder(tableNames);
    } catch (err) {
      console.error('Failed to list local tables:', err);
      sendEvent({
        progress: 0,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        status: 'error',
        message: 'Failed to list local database tables. See server logs.'
      });
      return closeStream();
    }

    if (tableNames.length === 0) {
      sendEvent({
        progress: 100,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        status: 'success',
        message: 'No tables found in local database to sync.'
      });
      return closeStream();
    }

    log(`Discovered ${tableNames.length} table(s) in local DB: ${tableNames.join(', ')}`);

    // Step 2: Ensure all tables exist in GLOBAL DB (schema from LOCAL). Skip tables with no PK for row sync.
    const tablesWithPk = [];
    for (const tableName of tableNames) {
      try {
        await ensureGlobalTableFromLocalSchema(tableName);
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          sendEvent({
            progress: 0,
            totalRecords: 0,
            syncedRecords: 0,
            insertedRecords: 0,
            updatedRecords: 0,
            status: 'error',
            message: `Local table "${tableName}" does not exist. Please verify the schema.`
          });
          return closeStream();
        }
        
        // Log detailed error information
        console.error(`[Sync] Failed to ensure global table for "${tableName}":`, error);
        if (error.originalError) {
          console.error(`[Sync] Original error:`, error.originalError);
        }
        if (error.code) {
          console.error(`[Sync] Error code: ${error.code}`);
        }
        
        // Build detailed error message
        let errorMessage = `Unable to prepare global table for "${tableName}".`;
        if (error.message) {
          errorMessage += ` ${error.message}`;
        } else if (error.originalError?.message) {
          errorMessage += ` ${error.originalError.message}`;
        }
        
        // Add specific guidance based on error code
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          errorMessage += ' Check global database connection settings and network connectivity.';
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
          errorMessage += ' Check global database user permissions.';
        } else if (error.code === 'ER_BAD_DB_ERROR') {
          errorMessage += ' Global database does not exist. Please create it first.';
        } else if (error.code === 'ER_PARSE_ERROR' || error.code === 'ER_SYNTAX_ERROR') {
          errorMessage += ' SQL syntax error. Check table schema.';
        }
        
        sendEvent({
          progress: 0,
          totalRecords: 0,
          syncedRecords: 0,
          insertedRecords: 0,
          updatedRecords: 0,
          status: 'error',
          message: errorMessage
        });
        return closeStream();
      }

      const pkCols = await getPrimaryKeyColumns(tableName);
      const matchKeyFallback = TABLE_MATCH_KEY_FALLBACK[tableName] || null;
      if (pkCols.length === 0 && !matchKeyFallback) {
        log(`Skipping table "${tableName}" (no primary key and no match-key fallback).`);
        continue;
      }
      tablesWithPk.push({ tableName, pkColumns: pkCols, matchKeyFallback });
    }

    // Step 3: Build sync plan.
    // Default (incremental): only new/updated data is pushed. Tables with updated_at use watermark; others compare with global and push only new/changed rows.
    // FORCE_FULL_SYNC or ?full=true: compare every table with global and push all new/changed (use for first sync or when global was empty).
    const forceFullSync = process.env.FORCE_FULL_SYNC === 'true' || process.env.FORCE_FULL_SYNC === '1' || (req.query && (req.query.full === 'true' || req.query.full === '1'));
    if (forceFullSync) {
      log('Full sync mode: will compare every table with global and push all new/changed rows (empty global table => push all local data).');
    } else {
      log('Incremental sync: only new or updated rows will be pushed (tables with updated_at use watermark; others compare with global).');
    }
    totalRecords = 0;
    const tableCounts = [];
    for (const { tableName, pkColumns, matchKeyFallback } of tablesWithPk) {
      try {
        const fullCountRows = await queryLocalDb(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``, []);
        const fullCount = Number(Array.isArray(fullCountRows) && fullCountRows[0] ? fullCountRows[0].cnt : 0) || 0;

        const timestampCol = await getTimestampColumn(tableName);
        let countToSync = fullCount;
        let useWatermark = false;
        let lastSyncedAt = null;

        if (!forceFullSync && timestampCol) {
          lastSyncedAt = await getWatermark(tableName);
          const safeTs = lastSyncedAt ? String(lastSyncedAt).replace(/'/g, "''") : '1970-01-01 00:00:00';
          const countRows = await queryLocalDb(
            `SELECT COUNT(*) AS cnt FROM \`${tableName}\` WHERE \`${timestampCol}\` > ?`,
            [lastSyncedAt || '1970-01-01 00:00:00']
          );
          countToSync = Number(Array.isArray(countRows) && countRows[0] ? countRows[0].cnt : 0) || 0;
          useWatermark = true;
          if (countToSync > 0) log(`Local DB: table "${tableName}" has ${countToSync} row(s) changed since last sync (${timestampCol} > ${lastSyncedAt || 'start'})`);
        } else if (fullCount > 0) {
          log(`Local DB: table "${tableName}" has ${fullCount} record(s)${forceFullSync ? ' (full sync – compare with global, push all new/changed)' : ' (no updated_at – will compare with global, push only changed)'}`);
        }

        tableCounts.push({
          tableName,
          count: countToSync,
          fullCount,
          useWatermark,
          lastSyncedAt,
          timestampCol,
          pkColumns,
          matchKeyFallback
        });
        totalRecords += useWatermark ? countToSync : fullCount;
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          sendEvent({
            progress: 0,
            totalRecords: 0,
            syncedRecords: 0,
            insertedRecords: 0,
            updatedRecords: 0,
            status: 'error',
            message: `Local table "${tableName}" not found. Verify schema.`
          });
          return closeStream();
        }
        throw error;
      }
    }

    if (totalRecords === 0) {
      log('No records in local DB. Nothing to sync.');
      sendEvent({
        progress: 100,
        totalRecords: 0,
        syncedRecords: 0,
        insertedRecords: 0,
        updatedRecords: 0,
        tableSummary: [],
        status: 'success',
        message: 'No records found in local database. Nothing to sync.'
      });
      return closeStream();
    }

    // Resumable sync: session_id allows resume after disconnect
    sessionId = req.query.session_id ? String(req.query.session_id).trim() : null;
    let isResume = false;
    if (sessionId) {
      const sessionRows = await queryGlobalDb('SELECT status FROM sync_sessions WHERE id = ?', [sessionId]);
      const session = Array.isArray(sessionRows) && sessionRows.length > 0 ? sessionRows[0] : null;
      if (!session) {
        sendEvent({ progress: 0, totalRecords, syncedRecords: 0, insertedRecords: 0, updatedRecords: 0, status: 'error', message: 'Invalid or expired session. Start a new sync.' });
        return closeStream();
      }
      if (session.status === 'completed') {
        sendEvent({ progress: 100, totalRecords, syncedRecords: totalRecords, insertedRecords: 0, updatedRecords: 0, sessionId, status: 'success', message: 'Sync already completed for this session.' });
        return closeStream();
      }
      const completedRows = await queryGlobalDb('SELECT table_name FROM sync_session_tables WHERE session_id = ?', [sessionId]);
      const completedSet = new Set((Array.isArray(completedRows) ? completedRows : []).map((r) => r.table_name));
      let processedRecordsStart = 0;
      for (const { tableName, count } of tableCounts) {
        if (completedSet.has(tableName)) processedRecordsStart += count;
      }
      tableCounts = tableCounts.filter((t) => !completedSet.has(t.tableName));
      processedRecords = processedRecordsStart;
      lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecordsStart / totalRecords) * 100)) : 0;
      isResume = true;
      log(`Resuming session ${sessionId}; ${completedSet.size} table(s) already done, ${tableCounts.length} remaining.`);
    } else {
      const insertResult = await queryGlobalDb('INSERT INTO sync_sessions (source_id, status) VALUES (?, ?)', ['default', 'in_progress']);
      sessionId = insertResult && insertResult.insertId != null ? String(insertResult.insertId) : null;
      if (!sessionId) {
        sendEvent({ progress: 0, totalRecords, syncedRecords: 0, insertedRecords: 0, updatedRecords: 0, status: 'error', message: 'Failed to create sync session.' });
        return closeStream();
      }
      log(`New sync session ${sessionId}.`);
    }

    sendEvent({
      sessionId,
      progress: lastProgress,
      totalRecords,
      syncedRecords,
      insertedRecords,
      updatedRecords,
      status: 'running',
      message: isResume ? `Resuming sync… ${tableCounts.length} table(s) left.` : `Syncing ${totalRecords} records from ${tableCounts.length} table(s).`
    });

    // Step 4: Per-table transaction so we can checkpoint and resume after disconnect
    const connection = await getGlobalConnection();
    try {
      await connection.query('SET SESSION innodb_lock_wait_timeout = ?', [Number(process.env.SYNC_LOCK_WAIT_TIMEOUT) || 300]);
    } catch (_) { /* ignore if global server rejects */ }
    const pkByTable = new Map(tablesWithPk.map((t) => [t.tableName, new Set(t.pkColumns.map((k) => String(k).toLowerCase()))]));

    const BATCH_SIZE = 500;
    const SYNC_BATCH_COMMIT_ROWS = Number(process.env.SYNC_BATCH_COMMIT_ROWS) || 300;

    try {
      tableLoop: for (const tbl of tableCounts) {
        const { tableName, count: tableCount, useWatermark, lastSyncedAt, timestampCol, pkColumns, fullCount } = tbl;
        if (tableCount === 0) {
          processedRecords += fullCount ?? 0;
          lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
          tableSummary.push({ tableName, total: fullCount ?? 0, inserted: 0, updated: 0 });
          sendProgress();
          continue;
        }

        await connection.beginTransaction();

        let localRows;
        try {
          if (useWatermark && timestampCol) {
            const rows = await queryLocalDb(
              `SELECT * FROM \`${tableName}\` WHERE \`${timestampCol}\` > ? ORDER BY \`${timestampCol}\``,
              [lastSyncedAt || '1970-01-01 00:00:00']
            );
            localRows = Array.isArray(rows) ? rows : [];
          } else {
            const rows = await queryLocalDb(`SELECT * FROM \`${tableName}\``, []);
            localRows = Array.isArray(rows) ? rows : [];
          }
        } catch (error) {
          try { await connection.rollback(); } catch (_) {}
          try { connection.release(); } catch (_) {}
          if (error.code === 'ER_NO_SUCH_TABLE') {
            sendEvent({
              progress: lastProgress,
              totalRecords,
              syncedRecords,
              insertedRecords,
              updatedRecords,
              tableSummary,
              status: 'error',
              message: `Local table "${tableName}" not found during sync.`
            });
            return closeStream();
          }
          throw error;
        }

        const pkSet = pkByTable.get(tableName) || new Set((pkColumns || []).map((k) => String(k).toLowerCase()));
        const matchKey = await getPreferredMatchKey(tableName);
        const whereColumns = (matchKey.whereColumns && matchKey.whereColumns.length > 0)
          ? matchKey.whereColumns
          : (tbl.matchKeyFallback || (pkColumns && pkColumns.length > 0 ? pkColumns : ['id']));
        const singlePk = pkColumns && pkColumns.length === 1 ? pkColumns[0] : null;

        let rowsToPush = localRows;
        if (!useWatermark && singlePk && localRows.length > 0) {
          rowsToPush = [];
          for (let i = 0; i < localRows.length; i += BATCH_SIZE) {
            const batch = localRows.slice(i, i + BATCH_SIZE);
            const pkVals = batch.map((r) => r[singlePk]);
            const globalRows = await getGlobalRowsByPk(connection, tableName, singlePk, pkVals);
            const globalByPk = new Map();
            for (const gr of globalRows) {
              globalByPk.set(gr[singlePk], rowSignature(gr));
            }
            for (const row of batch) {
              const pkVal = row[singlePk];
              const sig = rowSignature(row);
              if (!globalByPk.has(pkVal) || globalByPk.get(pkVal) !== sig) {
                rowsToPush.push(row);
              }
            }
            processedRecords += batch.length;
            lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
            sendProgress();
          }
        } else if (!useWatermark && whereColumns.length > 0 && localRows.length > 0) {
          rowsToPush = [];
          for (let i = 0; i < localRows.length; i += BATCH_SIZE) {
            const batch = localRows.slice(i, i + BATCH_SIZE);
            const valueTuples = batch.map((r) => whereColumns.map((c) => r[c]));
            const globalRows = await getGlobalRowsByMatchKey(connection, tableName, whereColumns, valueTuples);
            const keyCols = whereColumns;
            const globalByKey = new Map();
            for (const gr of globalRows) {
              const k = JSON.stringify(keyCols.map((c) => gr[c]));
              globalByKey.set(k, rowSignature(gr));
            }
            for (const row of batch) {
              const k = JSON.stringify(keyCols.map((c) => row[c]));
              const sig = rowSignature(row);
              if (!globalByKey.has(k) || globalByKey.get(k) !== sig) {
                rowsToPush.push(row);
              }
            }
            processedRecords += batch.length;
            lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
            sendProgress();
          }
          if (rowsToPush.length < localRows.length && localRows.length > 0) {
            log(`Table "${tableName}": pushing ${rowsToPush.length} changed/new row(s) of ${localRows.length} total.`);
          }
        } else if (!useWatermark) {
          rowsToPush = localRows;
          processedRecords += localRows.length;
          lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
          sendProgress();
        }

        let tableInserted = 0;
        let tableUpdated = 0;
        let maxTs = null;
        const PROGRESS_EVERY = 100;
        const LOG_EVERY = 1000;
        let rowIndex = 0;

        for (const row of rowsToPush) {
          rowIndex += 1;
          if (rowIndex % PROGRESS_EVERY === 0) sendProgress();
          if (rowsToPush.length >= LOG_EVERY && rowIndex % LOG_EVERY === 0) {
            log(`[Sync] Table "${tableName}": ${rowIndex}/${rowsToPush.length} rows written.`);
          }
          if (req.aborted) {
            try { await connection.rollback(); } catch (_) {}
            try { connection.release(); } catch (_) {}
            sendEvent({
              progress: lastProgress,
              totalRecords,
              syncedRecords,
              insertedRecords,
              updatedRecords,
              tableSummary,
              status: 'cancelled',
              message: 'Client disconnected. Sync cancelled.'
            });
            return closeStream();
          }

          const columns = Object.keys(row || {}).filter((c) => row[c] !== undefined);
          if (!columns.length) {
            if (useWatermark) processedRecords += 1;
            lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
            sendProgress();
            continue;
          }

          if (timestampCol && row[timestampCol] && (maxTs == null || row[timestampCol] > maxTs)) {
            maxTs = row[timestampCol];
          }

          const toVal = (v) => {
            if (v === null || v === undefined) return v;
            if (typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
            return v;
          };
          const allValues = columns.map((c) => toVal(row[c]));
          const whereValues = whereColumns.map((c) => row[c]);

          let result;
          try {
            const updateResult = buildUpdateByMatchKeySql(tableName, columns, whereColumns, pkSet);
            if (updateResult && updateResult.sql) {
              const setValues = (updateResult.setColumns || columns).map((c) => toVal(row[c]));
              const [upRows] = await connection.query(updateResult.sql, [...setValues, ...whereValues]);
              result = upRows;
              if (result && result.affectedRows > 0) {
                updatedRecords += 1;
                tableUpdated += 1;
                syncedRecords += 1;
              } else {
                let inserted = false;
                try {
                  const insertSql = buildInsertSql(tableName, columns);
                  const [insRows] = await connection.query(insertSql, allValues);
                  result = insRows;
                  if (result && (result.affectedRows > 0 || result.insertId != null)) {
                    insertedRecords += 1;
                    tableInserted += 1;
                    syncedRecords += 1;
                    inserted = true;
                  }
                } catch (insErr) {
                  if (insErr.code === 'ER_DUP_ENTRY' && pkColumns && pkColumns.length > 0) {
                    const updByPk = buildUpdateByMatchKeySql(tableName, columns, pkColumns, pkSet);
                    if (updByPk && updByPk.sql) {
                      const pkSetVals = (updByPk.setColumns || columns).map((c) => toVal(row[c]));
                      const pkWhereVals = pkColumns.map((c) => row[c]);
                      const [upRows] = await connection.query(updByPk.sql, [...pkSetVals, ...pkWhereVals]);
                      result = upRows;
                      if (result && result.affectedRows > 0) {
                        updatedRecords += 1;
                        tableUpdated += 1;
                        syncedRecords += 1;
                      }
                    } else {
                      throw insErr;
                    }
                  } else {
                    throw insErr;
                  }
                }
                if (!inserted && result && result.affectedRows > 0) {
                  updatedRecords += 1;
                  tableUpdated += 1;
                  syncedRecords += 1;
                }
              }
            } else {
              let inserted = false;
              try {
                const insertSql = buildInsertSql(tableName, columns);
                const [insRows] = await connection.query(insertSql, allValues);
                result = insRows;
                if (result && (result.affectedRows > 0 || result.insertId != null)) {
                  insertedRecords += 1;
                  tableInserted += 1;
                  syncedRecords += 1;
                  inserted = true;
                }
              } catch (insErr) {
                if (insErr.code === 'ER_DUP_ENTRY' && pkColumns && pkColumns.length > 0) {
                  const updByPk = buildUpdateByMatchKeySql(tableName, columns, pkColumns, pkSet);
                  if (updByPk && updByPk.sql) {
                    const pkSetVals = (updByPk.setColumns || columns).map((c) => toVal(row[c]));
                    const pkWhereVals = pkColumns.map((c) => row[c]);
                    const [upRows] = await connection.query(updByPk.sql, [...pkSetVals, ...pkWhereVals]);
                    result = upRows;
                    if (result && result.affectedRows > 0) {
                      updatedRecords += 1;
                      tableUpdated += 1;
                      syncedRecords += 1;
                    }
                  } else {
                    throw insErr;
                  }
                } else {
                  throw insErr;
                }
              }
            }
          } catch (err) {
            try { await connection.rollback(); } catch (_) {}
            console.error(`Sync write failed for table "${tableName}":`, err);
            processedRecords += rowsToPush.length;
            lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
            tableSummary.push({
              tableName,
              total: rowsToPush.length,
              inserted: tableInserted,
              updated: tableUpdated,
              error: err.message || String(err)
            });
            log(`Table "${tableName}": skipped due to error (${tableInserted} inserted, ${tableUpdated} updated before error). Continuing with remaining tables.`);
            sendEvent({
              progress: lastProgress,
              totalRecords,
              syncedRecords,
              insertedRecords,
              updatedRecords,
              tableSummary,
              status: 'running',
              message: `Error syncing "${tableName}". Continuing with remaining tables.`
            });
            sendProgress();
            continue tableLoop;
          }

          if (rowIndex > 0 && rowIndex % SYNC_BATCH_COMMIT_ROWS === 0) {
            try {
              await connection.commit();
              await connection.beginTransaction();
            } catch (batchErr) {
              try { await connection.rollback(); } catch (_) {}
              console.error(`Sync batch commit failed for table "${tableName}":`, batchErr);
              processedRecords += rowsToPush.length - rowIndex + 1;
              lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
              tableSummary.push({
                tableName,
                total: rowsToPush.length,
                inserted: tableInserted,
                updated: tableUpdated,
                error: batchErr.message || String(batchErr)
              });
              log(`Table "${tableName}": skipped after batch commit error. Continuing with remaining tables.`);
              sendEvent({
                progress: lastProgress,
                totalRecords,
                syncedRecords,
                insertedRecords,
                updatedRecords,
                tableSummary,
                status: 'running',
                message: `Batch commit failed for "${tableName}". Continuing with remaining tables.`
              });
              sendProgress();
              continue tableLoop;
            }
          }

          if (useWatermark) processedRecords += 1;
          lastProgress = totalRecords > 0 ? Math.min(100, Math.round((processedRecords / totalRecords) * 100)) : 0;
          sendProgress();
        }

        if (useWatermark && maxTs != null) {
          await setWatermark(tableName, maxTs);
        }

        tableSummary.push({
          tableName,
          total: rowsToPush.length,
          inserted: tableInserted,
          updated: tableUpdated
        });
        log(`Table "${tableName}": pushed ${rowsToPush.length} row(s) (inserted ${tableInserted}, updated ${tableUpdated})`);

        await connection.commit();
        await queryGlobalDb('INSERT INTO sync_session_tables (session_id, table_name) VALUES (?, ?)', [sessionId, tableName]);
        sendProgress();
      }

      await queryGlobalDb('UPDATE sync_sessions SET status = ? WHERE id = ?', ['completed', sessionId]);
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        /* connection may already be closed */
      }
      throw error;
    } finally {
      try {
        if (connection) connection.release();
      } catch (releaseErr) {
        /* ignore */
      }
    }

    const summaryMessage = `Incremental sync completed: only changed/new rows were pushed. ${insertedRecords} inserted, ${updatedRecords} updated (${syncedRecords} total rows written to global DB).`;
    log(summaryMessage, { totalRecords, insertedRecords, updatedRecords, tableSummary });
    
    // Create backups for both client and server databases
    try {
      log('Creating backups for client and server databases...');
    sendEvent({
      progress: 95,
      totalRecords,
      syncedRecords,
      insertedRecords,
      updatedRecords,
      tableSummary,
      sessionId,
      status: 'running',
      message: 'Creating backups...'
    });

      const localConfig = getLocalDbConfig();
      const globalConfig = getGlobalDbConfig();
      
      if (localConfig && globalConfig) {
        const backupResults = await createSyncBackups(
          localConfig,
          globalConfig,
          {
            syncId: Date.now(),
            totalRecords,
            insertedRecords,
            updatedRecords,
            tableCount: tableCounts.length,
            tableSummary,
            timestamp: new Date().toISOString()
          }
        );
        
        if (backupResults.local?.success) {
          log(`✅ Created ${backupResults.local.totalTables} table backup(s) for date: ${backupResults.local.date}`);
          if (backupResults.storedOnServer) {
            log(`✅ Stored ${backupResults.copiedCount}/${backupResults.totalCount} backup(s) on server: ${backupResults.serverDir}`);
          } else {
            log(`⚠️  Backups not stored on server (check SERVER_BACKUP_PATH in .env)`);
          }
        } else {
          log(`❌ Table backups failed: ${backupResults.local?.error || 'Unknown error'}`);
        }
      } else {
        log('⚠️ Backup skipped: Database configs not available');
      }
    } catch (backupError) {
      console.error('[Sync] Backup creation failed (sync still successful):', backupError);
      // Don't fail the sync if backup fails
    }
    
    sendEvent({
      progress: 100,
      totalRecords,
      syncedRecords,
      insertedRecords,
      updatedRecords,
      tableSummary,
      sessionId,
      status: 'success',
      message: summaryMessage
    });

    closeStream();
  } catch (error) {
    console.error('Error during sync-to-global stream:', error);

    const safeProgress = typeof lastProgress === 'number' && !Number.isNaN(lastProgress)
      ? lastProgress
      : 0;

    sendEvent({
      progress: safeProgress,
      totalRecords,
      syncedRecords,
      insertedRecords: insertedRecords ?? 0,
      updatedRecords: updatedRecords ?? 0,
      tableSummary: tableSummary.length ? tableSummary : undefined,
      sessionId: sessionId ?? undefined,
      status: 'error',
      message: error?.message || 'Sync failed. See server logs for details.'
    });

    closeStream();
  }
};

