/**
 * Backup Service
 * Creates database backups and stores them on both client and server
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query as queryLocalDb } from '../db/index.js';
import { queryGlobalDb } from '../db/globalDb.js';
import mysql from 'mysql2/promise';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create individual table backups (one file per table)
 * Returns array of backup file paths
 */
export const createTableBackups = async (config, backupType = 'local') => {
  const { host, port, user, password, database } = config;
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupDir = path.resolve(__dirname, '../../backups', dateStr);
  
  // Create backup directory if it doesn't exist
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create backup directory:', error);
  }

  const backups = [];

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password,
      database
    });

    // Get all tables
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' 
       ORDER BY TABLE_NAME`,
      [database]
    );

    console.log(`[Backup] Creating backups for ${tables.length} table(s) in ${database}...`);

    // Create backup for each table
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const backupFileName = `backup_${tableName}_${dateStr}.sql`;
      const backupFilePath = path.join(backupDir, backupFileName);

      try {
        // Get CREATE TABLE statement
        const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createStatement = createTable[0]['Create Table'] || createTable[0].CreateTable;

        let backupContent = `-- Table Backup: ${tableName}\n`;
        backupContent += `-- Database: ${database}\n`;
        backupContent += `-- Date: ${dateStr}\n`;
        backupContent += `-- Generated: ${new Date().toISOString()}\n\n`;
        backupContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`;
        backupContent += `-- Table structure for table \`${tableName}\`\n`;
        backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        backupContent += `${createStatement};\n\n`;

        // Get table data
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

        if (rows.length > 0) {
          backupContent += `-- Dumping data for table \`${tableName}\` (${rows.length} rows)\n`;
          backupContent += `LOCK TABLES \`${tableName}\` WRITE;\n`;

          for (const row of rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return connection.escape(val);
              if (val instanceof Date) return connection.escape(val.toISOString().slice(0, 19).replace('T', ' '));
              if (typeof val === 'object') return connection.escape(JSON.stringify(val));
              return connection.escape(val);
            });

            backupContent += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          }

          backupContent += `UNLOCK TABLES;\n\n`;
        } else {
          backupContent += `-- Table \`${tableName}\` is empty\n\n`;
        }

        backupContent += `SET FOREIGN_KEY_CHECKS=1;\n`;

        // Write backup file
        await fs.writeFile(backupFilePath, backupContent, 'utf8');
        const stats = await fs.stat(backupFilePath);

        backups.push({
          tableName,
          fileName: backupFileName,
          filePath: backupFilePath,
          size: stats.size,
          rowCount: rows.length
        });

        console.log(`  ✅ ${tableName}: ${backupFileName} (${rows.length} rows, ${(stats.size / 1024).toFixed(2)} KB)`);
      } catch (tableError) {
        console.error(`  ❌ Failed to backup table ${tableName}:`, tableError.message);
      }
    }

    await connection.end();

    console.log(`✅ Created ${backups.length} table backup(s) in ${backupDir}`);
    return {
      success: true,
      backups,
      backupDir,
      date: dateStr,
      totalTables: backups.length
    };
  } catch (error) {
    console.error(`[Backup] Failed to create table backups:`, error);
    if (connection) await connection.end();
    return { success: false, error: error.message, backups: [] };
  }
};

/**
 * Create backup by exporting all tables via SQL queries
 */
const createBackupViaSQL = async (config, backupFilePath, backupFileName) => {
  const { host, port, user, password, database } = config;
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password,
      database
    });

    let backupContent = `-- MySQL Backup\n`;
    backupContent += `-- Database: ${database}\n`;
    backupContent += `-- Host: ${host}:${port || 3306}\n`;
    backupContent += `-- Generated: ${new Date().toISOString()}\n\n`;
    backupContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    // Get all tables
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' 
       ORDER BY TABLE_NAME`,
      [database]
    );

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      // Get CREATE TABLE statement
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createStatement = createTable[0]['Create Table'] || createTable[0].CreateTable;
      
      backupContent += `-- Table structure for table \`${tableName}\`\n`;
      backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupContent += `${createStatement};\n\n`;
      
      // Get table data
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        backupContent += `-- Dumping data for table \`${tableName}\`\n`;
        backupContent += `LOCK TABLES \`${tableName}\` WRITE;\n`;
        
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return connection.escape(val);
            if (val instanceof Date) return connection.escape(val.toISOString().slice(0, 19).replace('T', ' '));
            if (typeof val === 'object') return connection.escape(JSON.stringify(val));
            return connection.escape(val);
          });
          
          backupContent += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
        }
        
        backupContent += `UNLOCK TABLES;\n\n`;
      }
    }

    backupContent += `SET FOREIGN_KEY_CHECKS=1;\n`;

    // Write backup file
    await fs.writeFile(backupFilePath, backupContent, 'utf8');
    
    console.log(`✅ Backup created via SQL export: ${backupFileName}`);
    return { success: true, filePath: backupFilePath, fileName: backupFileName };
  } catch (error) {
    console.error('SQL export backup failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

/**
 * Store table backups on server and in global database
 * Copies all table backup files to server and stores metadata
 */
export const storeTableBackupsOnServer = async (backups, backupDir, dateStr, syncInfo = {}) => {
  const serverPath = process.env.SERVER_BACKUP_PATH; // e.g., \\192.168.1.50\backups or /mnt/server/backups
  
  if (!serverPath) {
    console.warn('[Backup] SERVER_BACKUP_PATH not configured. Backups will only be stored locally.');
    return { success: false, error: 'SERVER_BACKUP_PATH not configured' };
  }

  try {
    // Create backups table in global DB if not exists
    await queryGlobalDb(`
      CREATE TABLE IF NOT EXISTS \`database_backups\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`backup_date\` date NOT NULL,
        \`table_name\` varchar(255) NOT NULL,
        \`backup_name\` varchar(255) NOT NULL,
        \`backup_type\` enum('local','global','sync') DEFAULT 'sync',
        \`database_name\` varchar(100) DEFAULT NULL,
        \`file_path\` varchar(500) DEFAULT NULL,
        \`server_file_path\` varchar(500) DEFAULT NULL,
        \`file_size\` bigint unsigned DEFAULT NULL,
        \`row_count\` int unsigned DEFAULT NULL,
        \`sync_info\` JSON DEFAULT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_backup_date\` (\`backup_date\`),
        KEY \`idx_table_name\` (\`table_name\`),
        KEY \`idx_backup_type\` (\`backup_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // Create server backup directory with date
    const serverBackupDir = path.join(serverPath, dateStr);
    let copiedCount = 0;
    const storedBackups = [];

    // Try to create server directory (if it's a local path, not network share)
    if (!serverPath.startsWith('\\\\') && !serverPath.startsWith('//')) {
      try {
        await fs.mkdir(serverBackupDir, { recursive: true });
      } catch (mkdirError) {
        console.warn(`[Backup] Could not create server directory: ${mkdirError.message}`);
      }
    }

    // Copy each table backup to server
    for (const backup of backups) {
      try {
        const serverBackupFile = path.join(serverBackupDir, backup.fileName);
        
        // Copy file to server
        await fs.copyFile(backup.filePath, serverBackupFile);
        copiedCount++;
        
        // Store metadata in global database
        await queryGlobalDb(`
          INSERT INTO \`database_backups\` 
          (\`backup_date\`, \`table_name\`, \`backup_name\`, \`backup_type\`, \`database_name\`, \`file_path\`, \`server_file_path\`, \`file_size\`, \`row_count\`, \`sync_info\`)
          VALUES (?, ?, ?, 'sync', ?, ?, ?, ?, ?, ?)
        `, [
          dateStr,
          backup.tableName,
          backup.fileName,
          syncInfo.database || null,
          backup.filePath,
          serverBackupFile,
          backup.size,
          backup.rowCount,
          JSON.stringify(syncInfo)
        ]);

        storedBackups.push({
          tableName: backup.tableName,
          serverPath: serverBackupFile
        });
      } catch (copyError) {
        console.warn(`[Backup] Failed to copy ${backup.fileName} to server:`, copyError.message);
      }
    }

    console.log(`✅ Copied ${copiedCount}/${backups.length} table backups to server: ${serverBackupDir}`);
    return {
      success: true,
      copiedCount,
      totalCount: backups.length,
      serverDir: serverBackupDir,
      storedBackups
    };
  } catch (error) {
    console.error('[Backup] Failed to store backups on server:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create individual table backups for local database and store on server
 * Creates one backup file per table, organized by date (YYYY-MM-DD)
 * All backups are stored on the server in a date-based folder
 */
export const createSyncBackups = async (localConfig, globalConfig, syncInfo = {}) => {
  const results = {
    local: null,
    storedOnServer: false
  };

  try {
    // Create individual table backups for local (client) database
    console.log('[Backup] Creating individual table backups for local database...');
    results.local = await createTableBackups(localConfig, 'local');
    
    if (results.local.success && results.local.backups.length > 0) {
      // Store all table backups on server
      console.log('[Backup] Storing table backups on server...');
      const storeResult = await storeTableBackupsOnServer(
        results.local.backups,
        results.local.backupDir,
        results.local.date,
        { ...syncInfo, type: 'local', source: 'client', database: localConfig.database }
      );
      
      results.storedOnServer = storeResult.success;
      results.serverDir = storeResult.serverDir;
      results.copiedCount = storeResult.copiedCount;
      results.totalCount = storeResult.totalCount;
    }

    // Summary
    if (results.local?.success) {
      console.log(`[Backup] ✅ Created ${results.local.totalTables} table backup(s) for date: ${results.local.date}`);
      if (results.storedOnServer) {
        console.log(`[Backup] ✅ Stored ${results.copiedCount}/${results.totalCount} backup(s) on server: ${results.serverDir}`);
      } else {
        console.warn(`[Backup] ⚠️  Backups not stored on server (check SERVER_BACKUP_PATH in .env)`);
      }
    }

    return results;
  } catch (error) {
    console.error('[Backup] Error creating sync backups:', error);
    return results;
  }
};

