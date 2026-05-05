import { query } from '../db/index.js';

async function tableExists(tableName) {
  const rows = await query(
    `
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    `,
    [tableName]
  );
  return rows.length > 0;
}

async function constraintExists(constraintName) {
  const rows = await query(
    `
      SELECT 1 AS ok
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = 'user_stores'
        AND constraint_name = ?
      LIMIT 1
    `,
    [constraintName]
  );
  return rows.length > 0;
}

/**
 * Ensures the `user_stores` join table exists.
 * This prevents runtime errors like:
 * "Table '<db>.user_stores' doesn't exist"
 */
export async function ensureUserStoresTable() {
  if (!(await tableExists('user_stores'))) {
    await query(`
      CREATE TABLE IF NOT EXISTS user_stores (
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        user_id BIGINT UNSIGNED NOT NULL,
        store_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (user_id, store_id),
        KEY store_id (store_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  // Add FK constraints if missing (safe for existing DBs that were created without FKs).
  if (!(await constraintExists('user_stores_ibfk_1'))) {
    await query(`
      ALTER TABLE user_stores
        ADD CONSTRAINT user_stores_ibfk_1
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  if (!(await constraintExists('user_stores_ibfk_2'))) {
    await query(`
      ALTER TABLE user_stores
        ADD CONSTRAINT user_stores_ibfk_2
          FOREIGN KEY (store_id) REFERENCES stores(id)
          ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }
}

// Allow running as a standalone script: `pnpm run ensure-user-stores`
if (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, '/')}`) {
  ensureUserStoresTable()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('✅ user_stores table ensured');
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to ensure user_stores table:', err?.message ?? err);
      process.exit(1);
    });
}

