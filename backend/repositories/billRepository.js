import { query, transaction } from '../db/index.js';
import { parseQueryableDateBound } from '../utils/parseDateRangeBounds.js';

// Cached check for items table (used by query(), not connection) - so we don't JOIN when table doesn't exist
let itemsTableExistsForMrpCache = null;
const checkItemsTableExistsForMrp = async () => {
  if (itemsTableExistsForMrpCache !== null) return itemsTableExistsForMrpCache;
  try {
    await query('SELECT 1 FROM items LIMIT 1');
    itemsTableExistsForMrpCache = true;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') itemsTableExistsForMrpCache = false;
    else throw e;
  }
  return itemsTableExistsForMrpCache;
};

// Helper function to check if items table exists
const checkItemsTableExists = async (connection) => {
  try {
    await connection.query('SELECT 1 FROM items LIMIT 1');
    return true;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw error;
  }
};

// Helper function to check if appliance table exists
const checkApplianceTableExists = async (connection) => {
  try {
    await connection.query('SELECT 1 FROM appliance LIMIT 1');
    return true;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw error;
  }
};

// Helper function to find item identifier (item_id, product_code, or appliance_id) by itemId or sku
// Returns: { itemId: number | null, productCode: string | null, applianceId: number | null, source: 'items' | 'products' | 'appliance' | null }
const findItemIdentifier = async (connection, itemId, sku) => {
  const itemsTableExists = await checkItemsTableExists(connection);

  // First, try items table if it exists
  if (itemsTableExists) {
    if (itemId) {
      const numericId = Number(itemId);
      if (!isNaN(numericId) && numericId > 0) {
        try {
          const [itemRows] = await connection.query(
            `SELECT id FROM items WHERE id = ? LIMIT 1`,
            [numericId]
          );
          if (itemRows && Array.isArray(itemRows) && itemRows.length > 0) {
            return { itemId: numericId, productCode: null, applianceId: null, source: 'items' };
          }
        } catch (error) {
          if (error.code !== 'ER_NO_SUCH_TABLE') {
            console.warn('Error querying items table:', error.message);
          }
        }
      }
    }

    if (sku) {
      try {
        const [skuRows] = await connection.query(
          `SELECT id, item_code FROM items WHERE item_code = ? OR barcode = ? LIMIT 1`,
          [sku, sku]
        );
        if (skuRows && Array.isArray(skuRows) && skuRows.length > 0) {
          return { itemId: Number(skuRows[0].id), productCode: null, applianceId: null, source: 'items' };
        }
      } catch (error) {
        if (error.code !== 'ER_NO_SUCH_TABLE') {
          console.warn('Error querying items table:', error.message);
        }
      }
    }
  }

  // Try appliance table
  const applianceTableExists = await checkApplianceTableExists(connection);
  if (applianceTableExists) {
    if (itemId) {
      const numericId = Number(itemId);
      if (!isNaN(numericId) && numericId > 0) {
        try {
          const [applianceRows] = await connection.query(
            `SELECT appliance_id FROM appliance WHERE appliance_id = ? LIMIT 1`,
            [numericId]
          );
          if (applianceRows && Array.isArray(applianceRows) && applianceRows.length > 0) {
            return { itemId: null, productCode: null, applianceId: numericId, source: 'appliance' };
          }
        } catch (error) {
          if (error.code !== 'ER_NO_SUCH_TABLE') {
            console.warn('Error querying appliance table:', error.message);
          }
        }
      }
    }

    if (sku) {
      try {
        const [applianceRows] = await connection.query(
          `SELECT appliance_id FROM appliance WHERE appliance_id = ? OR barcode = ? LIMIT 1`,
          [sku, sku]
        );
        if (applianceRows && Array.isArray(applianceRows) && applianceRows.length > 0) {
          return { itemId: null, productCode: null, applianceId: Number(applianceRows[0].appliance_id), source: 'appliance' };
        }
      } catch (error) {
        if (error.code !== 'ER_NO_SUCH_TABLE') {
          console.warn('Error querying appliance table:', error.message);
        }
      }
    }
  }

  // If items/appliance tables don't exist or item not found, try Products table
  let searchValue = null;
  if (itemId) {
    searchValue = String(itemId);
  } else if (sku) {
    searchValue = sku;
  }

  if (searchValue) {
    try {
      const [productRows] = await connection.query(
        `SELECT ProductCode FROM Products 
         WHERE ProductCode = ? OR UniversalProductCode = ? OR BarCodeDescription = ? 
         LIMIT 1`,
        [searchValue, searchValue, searchValue]
      );
      if (productRows && Array.isArray(productRows) && productRows.length > 0) {
        const productCode = String(productRows[0].ProductCode);
        return { itemId: null, productCode: productCode, applianceId: null, source: 'products' };
      }
    } catch (error) {
      console.warn('Error querying Products table:', error.message);
    }
  }

  return { itemId: null, productCode: null, applianceId: null, source: null };
};

// Cache to track if column has been altered (to avoid repeated checks)
let applianceColumnAltered = false;

// Helper function to ensure appliance qty_on_hand column allows negative values
const ensureApplianceColumnAllowsNegative = async (connection) => {
  // Skip if already altered in this session
  if (applianceColumnAltered) {
    return;
  }

  try {
    const [columns] = await connection.query(`
      SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'appliance'
        AND COLUMN_NAME = 'qty_on_hand'
    `);

    if (columns && columns.length > 0) {
      const columnType = columns[0].COLUMN_TYPE || '';
      const isNullable = columns[0].IS_NULLABLE === 'YES';
      const defaultValue = columns[0].COLUMN_DEFAULT;

      if (columnType.toUpperCase().includes('UNSIGNED')) {
        console.log('🔄 Altering appliance.qty_on_hand from UNSIGNED to SIGNED to allow negative values...');
        console.log(`   Current type: ${columnType}`);

        const nullableClause = isNullable ? 'NULL' : 'NOT NULL';
        const defaultClause = defaultValue !== null ? `DEFAULT ${defaultValue}` : '';

        try {
          await connection.query(`
            ALTER TABLE appliance
            MODIFY COLUMN qty_on_hand INT ${nullableClause} ${defaultClause}
          `);

          // Wait a moment for the change to propagate
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify the change
          const [verifyColumns] = await connection.query(`
            SELECT COLUMN_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'appliance'
              AND COLUMN_NAME = 'qty_on_hand'
          `);

          if (verifyColumns && verifyColumns.length > 0) {
            const newType = verifyColumns[0].COLUMN_TYPE || '';
            if (!newType.toUpperCase().includes('UNSIGNED')) {
              console.log(`✅ Successfully altered appliance.qty_on_hand to allow negative values (new type: ${newType})`);
              applianceColumnAltered = true;
            } else {
              console.error(`❌ Column alteration failed - still UNSIGNED: ${newType}`);
              console.error(`   ⚠️  CRITICAL: You MUST run the SQL script manually to fix this!`);
              console.error(`   📝 Run this SQL in MySQL: ALTER TABLE appliance MODIFY COLUMN qty_on_hand INT NOT NULL DEFAULT 0;`);
              console.error(`   📄 Or use the script: backend/scripts/fixApplianceNegativeStock.sql`);
              // Don't throw - allow update to attempt (it will clamp to 0, but at least bill saves)
            }
          }
        } catch (alterError) {
          console.error('❌ Failed to execute ALTER TABLE:', alterError.message);
          console.error('   Error code:', alterError.code);
          console.error(`   ⚠️  CRITICAL: You MUST run the SQL script manually to fix this!`);
          console.error(`   📝 Run this SQL in MySQL: ALTER TABLE appliance MODIFY COLUMN qty_on_hand INT NOT NULL DEFAULT 0;`);
          console.error(`   📄 Or use the script: backend/scripts/fixApplianceNegativeStock.sql`);
          // Don't throw - allow update to attempt
        }
      } else {
        console.log('✅ appliance.qty_on_hand already allows negative values');
        applianceColumnAltered = true;
      }
    } else {
      console.warn('⚠️ Could not find qty_on_hand column in appliance table');
    }
  } catch (error) {
    console.error('❌ Error checking/altering appliance.qty_on_hand column:', error.message);
    console.error('   Full error:', error);
    // Don't throw - allow the update to proceed with CAST workaround
  }
};

// Helper function to reduce stock when a bill is created
const reduceStockForBillItem = async (connection, item, storeId) => {
  const quantity = Number(item.quantity ?? 0);
  if (quantity <= 0) {
    console.warn(`⚠️ Skipping stock reduction: quantity is ${quantity} for item ${item.itemName || 'Unknown'}`);
    return;
  }

  console.log(`🔍 Attempting stock reduction for: ${item.itemName || 'Unknown'} (itemId: ${item.itemId}, itemCode: ${item.itemCode}, quantity: ${quantity})`);

  const identifier = await findItemIdentifier(connection, item.itemId, item.itemCode);

  if (!identifier.source) {
    console.warn(`⚠️ Could not find item for stock reduction: ${item.itemName || 'Unknown'} (itemId: ${item.itemId}, sku: ${item.itemCode})`);
    return;
  }

  console.log(`✅ Found item identifier:`, identifier);

  const storeIdNum = Number(storeId);

  try {
    if (identifier.source === 'items' && identifier.itemId) {
      // Reduce inventory for items table
      const [result] = await connection.query(
        `UPDATE inventories 
         SET qty_on_hand = GREATEST(0, qty_on_hand - ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE item_id = ? AND store_id = ?`,
        [quantity, identifier.itemId, storeIdNum]
      );

      if (result.affectedRows > 0) {
        console.log(`✅ Reduced inventory (items): item_id=${identifier.itemId}, store_id=${storeIdNum}, qty_reduced=${quantity}, affected_rows=${result.affectedRows}`);
      } else {
        console.warn(`⚠️ No rows updated in inventories table for item_id=${identifier.itemId}, store_id=${storeIdNum}. Inventory record may not exist.`);
        // Try to insert if it doesn't exist (shouldn't happen, but handle gracefully)
        try {
          await connection.query(
            `INSERT INTO inventories (item_id, store_id, qty_on_hand, updated_at)
             VALUES (?, ?, GREATEST(0, 0 - ?), CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
               qty_on_hand = GREATEST(0, qty_on_hand - ?),
               updated_at = CURRENT_TIMESTAMP`,
            [identifier.itemId, storeIdNum, quantity, quantity]
          );
          console.log(`✅ Created/updated inventory record for item_id=${identifier.itemId}, store_id=${storeIdNum}`);
        } catch (insertError) {
          console.error(`❌ Failed to create inventory record:`, insertError.message);
        }
      }
    } else if (identifier.source === 'products' && identifier.productCode) {
      // Always reduce TotalStock in Products table first (this should always happen)
      const [productResult] = await connection.query(
        `UPDATE Products 
         SET TotalStock = COALESCE(TotalStock, 0) - ?
         WHERE ProductCode = ?`,
        [quantity, identifier.productCode]
      );

      // Reduce inventory for Products table (store-specific)
      const [storeInvResult] = await connection.query(
        `UPDATE store_inventory 
         SET qty_on_hand = GREATEST(0, qty_on_hand - ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE product_code = ? AND store_id = ?`,
        [quantity, identifier.productCode, storeIdNum]
      );

      if (productResult.affectedRows > 0) {
        console.log(`✅ Reduced TotalStock in Products table: product_code=${identifier.productCode}, qty_reduced=${quantity}, affected_rows=${productResult.affectedRows}`);
      } else {
        console.warn(`⚠️ Products table update: No rows found for product_code=${identifier.productCode}`);
      }

      if (storeInvResult.affectedRows > 0) {
        console.log(`✅ Reduced store_inventory: product_code=${identifier.productCode}, store_id=${storeIdNum}, qty_reduced=${quantity}`);
      } else {
        // Try to insert if it doesn't exist
        try {
          await connection.query(
            `INSERT INTO store_inventory (product_code, store_id, qty_on_hand, updated_at)
             VALUES (?, ?, GREATEST(0, 0 - ?), CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
               qty_on_hand = GREATEST(0, qty_on_hand - ?),
               updated_at = CURRENT_TIMESTAMP`,
            [identifier.productCode, storeIdNum, quantity, quantity]
          );
          console.log(`✅ Created/updated store_inventory record for product_code=${identifier.productCode}, store_id=${storeIdNum}`);
        } catch (insertError) {
          console.error(`❌ Failed to create store_inventory record:`, insertError.message);
        }
      }
    } else if (identifier.source === 'appliance' && identifier.applianceId) {
      // Always reduce qty_on_hand in appliance table first (this should always happen)
      // First ensure column allows negative values
      await ensureApplianceColumnAllowsNegative(connection);

      // Use CAST to handle calculation, then update
      // This ensures we can subtract even if column was just altered
      const [applianceResult] = await connection.query(
        `UPDATE appliance 
         SET qty_on_hand = CAST(COALESCE(qty_on_hand, 0) AS SIGNED) - CAST(? AS SIGNED)
         WHERE appliance_id = ?`,
        [quantity, identifier.applianceId]
      );

      // Reduce inventory for appliance table (store-specific)
      const [storeInvResult] = await connection.query(
        `UPDATE appliance_store_inventory 
         SET qty_on_hand = GREATEST(0, qty_on_hand - ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE appliance_id = ? AND store_id = ?`,
        [quantity, identifier.applianceId, storeIdNum]
      );

      if (applianceResult.affectedRows > 0) {
        console.log(`✅ Reduced qty_on_hand in appliance table: appliance_id=${identifier.applianceId}, qty_reduced=${quantity}, affected_rows=${applianceResult.affectedRows}`);
      } else {
        console.warn(`⚠️ Appliance table update: No rows found for appliance_id=${identifier.applianceId}`);
      }

      if (storeInvResult.affectedRows > 0) {
        console.log(`✅ Reduced appliance_store_inventory: appliance_id=${identifier.applianceId}, store_id=${storeIdNum}, qty_reduced=${quantity}`);
      } else {
        // Try to insert if it doesn't exist
        try {
          await connection.query(
            `INSERT INTO appliance_store_inventory (appliance_id, store_id, qty_on_hand, updated_at)
             VALUES (?, ?, GREATEST(0, 0 - ?), CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
               qty_on_hand = GREATEST(0, qty_on_hand - ?),
               updated_at = CURRENT_TIMESTAMP`,
            [identifier.applianceId, storeIdNum, quantity, quantity]
          );
          console.log(`✅ Created/updated appliance_store_inventory record for appliance_id=${identifier.applianceId}, store_id=${storeIdNum}`);
        } catch (insertError) {
          console.error(`❌ Failed to create appliance_store_inventory record:`, insertError.message);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error reducing stock for item ${item.itemName || 'Unknown'}:`, error.message);
    console.error(`❌ Full error:`, error);
    // Don't throw - log error but continue with bill creation
  }
};

/** Add stock back (inverse of reduce) when replacing or removing bill lines. */
const restoreStockForBillItem = async (connection, item, storeId) => {
  const quantity = Number(item.quantity ?? 0);
  if (quantity <= 0) {
    return;
  }

  const identifier = await findItemIdentifier(connection, item.itemId, item.itemCode);
  if (!identifier.source) {
    console.warn(
      `⚠️ Could not find item for stock restore: ${item.itemName || 'Unknown'} (itemId: ${item.itemId}, sku: ${item.itemCode})`
    );
    return;
  }

  const storeIdNum = Number(storeId);

  try {
    if (identifier.source === 'items' && identifier.itemId) {
      await connection.query(
        `UPDATE inventories 
         SET qty_on_hand = COALESCE(qty_on_hand, 0) + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE item_id = ? AND store_id = ?`,
        [quantity, identifier.itemId, storeIdNum]
      );
    } else if (identifier.source === 'products' && identifier.productCode) {
      await connection.query(
        `UPDATE Products 
         SET TotalStock = COALESCE(TotalStock, 0) + ?
         WHERE ProductCode = ?`,
        [quantity, identifier.productCode]
      );
      await connection.query(
        `UPDATE store_inventory 
         SET qty_on_hand = COALESCE(qty_on_hand, 0) + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_code = ? AND store_id = ?`,
        [quantity, identifier.productCode, storeIdNum]
      );
    } else if (identifier.source === 'appliance' && identifier.applianceId) {
      await connection.query(
        `UPDATE appliance 
         SET qty_on_hand = CAST(COALESCE(qty_on_hand, 0) AS SIGNED) + CAST(? AS SIGNED)
         WHERE appliance_id = ?`,
        [quantity, identifier.applianceId]
      );
      await connection.query(
        `UPDATE appliance_store_inventory 
         SET qty_on_hand = COALESCE(qty_on_hand, 0) + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE appliance_id = ? AND store_id = ?`,
        [quantity, identifier.applianceId, storeIdNum]
      );
    }
  } catch (error) {
    console.error(`❌ Error restoring stock for item ${item.itemName || 'Unknown'}:`, error.message);
  }
};

const BILL_NUMBER_PREFIX = 'B202501';
const BILL_SEQUENCE_PAD = 3;
/** Retries when two cashiers save at once and both read the same MAX sequence. */
const BILL_NO_ALLOCATION_RETRIES = 12;

// Get bill number prefix based on store ID
const getBillNumberPrefix = (storeId) => {
  const storeIdNum = Number(storeId);
  if (storeIdNum === 1) {
    return 'B-MS-';
  } else if (storeIdNum === 2) {
    return 'BMSM-';
  }
  // Default fallback prefix
  return 'B202501';
};

const BILLS_TABLE_CHECK_QUERY = `
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bills'
  LIMIT 1
`;

const BILL_ITEMS_TABLE_CHECK_QUERY = `
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bill_items'
  LIMIT 1
`;

const CREATE_BILLS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bills (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bill_no VARCHAR(50) NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    date DATETIME NOT NULL,
    customer_id VARCHAR(50) NULL,
    customer_name VARCHAR(100) NULL,
    customer_phone VARCHAR(20) NULL,
    customer_email VARCHAR(255) NULL,
    customer_address VARCHAR(255) NULL,
    customer_gstin VARCHAR(20) NULL,
    payment_method ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash',
    transaction_id VARCHAR(100) NULL,
    payment_status ENUM('pending','partial','paid','refunded') NOT NULL DEFAULT 'paid',
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY bills_bill_no_unique (bill_no),
    KEY bills_store_idx (store_id),
    KEY bills_user_idx (user_id),
    CONSTRAINT bills_store_fk FOREIGN KEY (store_id) REFERENCES stores(id),
    CONSTRAINT bills_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const CREATE_BILL_ITEMS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bill_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bill_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NULL,
    item_code VARCHAR(50) NULL,
    item_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(14, 4) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    mrp DECIMAL(12, 2) NULL DEFAULT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY bill_items_bill_idx (bill_id),
    KEY bill_items_item_idx (item_id),
    CONSTRAINT bill_items_bill_fk FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let ensureBillingTablesPromise;

const ensureBillingTablesExist = async () => {
  if (ensureBillingTablesPromise) {
    return ensureBillingTablesPromise;
  }

  ensureBillingTablesPromise = (async () => {
    const [billsTable] = await Promise.all([
      query(BILLS_TABLE_CHECK_QUERY)
    ]);
    if (!Array.isArray(billsTable) || billsTable.length === 0) {
      await query(CREATE_BILLS_TABLE_SQL);
    } else {
      // Check if transaction_id column exists, if not add it
      try {
        // customer_address
        const addrCol = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'bills' 
             AND COLUMN_NAME = 'customer_address'`
        );
        if (!Array.isArray(addrCol) || addrCol.length === 0) {
          await query(
            `ALTER TABLE bills 
             ADD COLUMN customer_address VARCHAR(255) NULL AFTER customer_email`
          );
        }
        // customer_gstin
        const gstCol = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'bills' 
             AND COLUMN_NAME = 'customer_gstin'`
        );
        if (!Array.isArray(gstCol) || gstCol.length === 0) {
          await query(
            `ALTER TABLE bills 
             ADD COLUMN customer_gstin VARCHAR(20) NULL AFTER customer_address`
          );
        }
        const columns = await query(
          `SELECT COLUMN_NAME 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'bills' 
             AND COLUMN_NAME = 'transaction_id'`
        );
        if (!Array.isArray(columns) || columns.length === 0) {
          await query(
            `ALTER TABLE bills 
             ADD COLUMN transaction_id VARCHAR(100) NULL AFTER payment_method`
          );
        }
        // Check if 'online' is in the ENUM values
        const enumValues = await query(
          `SELECT COLUMN_TYPE 
           FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'bills' 
             AND COLUMN_NAME = 'payment_method'`
        );
        if (enumValues && enumValues.length > 0) {
          const columnType = enumValues[0].COLUMN_TYPE || '';
          if (!columnType.includes("'online'")) {
            await query(
              `ALTER TABLE bills 
               MODIFY COLUMN payment_method ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash'`
            );
          }
        }
      } catch (error) {
        console.warn('Failed to migrate bills table:', error);
        // Continue execution even if migration fails
      }
    }

    const billItemsTable = await query(BILL_ITEMS_TABLE_CHECK_QUERY);
    if (!Array.isArray(billItemsTable) || billItemsTable.length === 0) {
      await query(CREATE_BILL_ITEMS_TABLE_SQL);
    } else {
      try {
        const mrpCol = await query(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'mrp'`
        );
        if (!Array.isArray(mrpCol) || mrpCol.length === 0) {
          await query(
            `ALTER TABLE bill_items ADD COLUMN mrp DECIMAL(12, 2) NULL DEFAULT NULL AFTER unit_price`
          );
        }
        const qtyType = await query(
          `SELECT DATA_TYPE
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'quantity'`
        );
        if (Array.isArray(qtyType) && qtyType.length > 0) {
          const dataType = String(qtyType[0].DATA_TYPE || '').toLowerCase();
          if (dataType === 'int' || dataType === 'tinyint' || dataType === 'smallint' || dataType === 'mediumint' || dataType === 'bigint') {
            await query(
              `ALTER TABLE bill_items MODIFY COLUMN quantity DECIMAL(14, 4) NOT NULL`
            );
          }
        }
      } catch (err) {
        console.warn('Failed to migrate bill_items table (mrp / quantity):', err);
      }
    }
  })().catch((error) => {
    ensureBillingTablesPromise = undefined;
    throw error;
  });

  return ensureBillingTablesPromise;
};

/**
 * Next bill number for a store: one running series for all users (prefix is per store only).
 * Uses MAX(numeric suffix), not "latest row by id", so sequence stays correct after imports/reordering.
 */
const getNextBillNumber = async (connection, storeId) => {
  const prefix = getBillNumberPrefix(storeId);
  const prefixLen = prefix.length;
  const likePattern = `${prefix}%`;
  const storeNum = Number(storeId);

  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(bill_no, ?) AS UNSIGNED)), 0) AS max_seq
     FROM bills
     WHERE store_id = ?
       AND bill_no LIKE ?
       AND SUBSTRING(bill_no, ?) REGEXP '^[0-9]+$'`,
    [prefixLen + 1, storeNum, likePattern, prefixLen + 1]
  );

  const maxSeq = Number(rows[0]?.max_seq ?? 0);
  const sequence = (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
  const counter = String(sequence).padStart(BILL_SEQUENCE_PAD, '0');
  return `${prefix}${counter}`;
};

const mapBillItem = (row) => {
  if (!row) return null;
  // Get MRP from various possible field names; return only actual MRP (no substitution with selling price)
  const mrp = Number(row.mrp ?? row.MRP ?? row.max_retail_price ?? 0);
  const sellingPrice = Number(row.selling_price ?? row.unit_price ?? 0);

  return {
    id: row.id,
    billId: row.bill_id,
    itemId: row.item_id,
    itemCode: row.item_code,
    itemName: row.item_name,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    price: Number(row.unit_price ?? 0),
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : Number(row.unit_price ?? 0),
    mrp: Number.isFinite(mrp) ? mrp : 0,
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    taxRate: Number(row.tax_rate ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.created_at
  };
};

const getUserDisplayName = (row) => {
  const firstName = row.user_first_name ? String(row.user_first_name).trim() : '';
  const lastName = row.user_last_name ? String(row.user_last_name).trim() : '';
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }
  if (row.user_email) {
    return row.user_email;
  }
  return null;
};

const ymdFromMysqlDateValue = (value) => {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

const mapBill = (row, items = []) => {
  if (!row) return null;
  const dateCalendarYmd =
    row.bill_date_ymd != null && String(row.bill_date_ymd).trim() !== ''
      ? String(row.bill_date_ymd).trim().slice(0, 10)
      : ymdFromMysqlDateValue(row.date);
  return {
    id: row.id,
    billNo: row.bill_no,
    storeId: row.store_id,
    userId: row.user_id,
    userName: getUserDisplayName(row),
    userEmail: row.user_email ?? null,
    date: row.date,
    /** Same calendar day MySQL uses for DATE(b.date); avoids ISO-UTC JSON shifting labels vs filters. */
    dateCalendarYmd: dateCalendarYmd,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerAddress: row.customer_address ?? null,
    customerGstin: row.customer_gstin ?? null,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    transactionId: row.transaction_id ?? null,
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    discount: Number(row.discount ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: Array.isArray(items) ? items : []
  };
};

export const getBillById = async (billId, { includeItems = true } = {}) => {
  await ensureBillingTablesExist();

  const rows = await query(
    `SELECT b.id,
            b.bill_no,
            b.store_id,
            b.user_id,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.email AS user_email,
            b.date,
            DATE_FORMAT(b.date, '%Y-%m-%d') AS bill_date_ymd,
            b.customer_id,
            b.customer_name,
            b.customer_phone,
            b.customer_email,
            b.customer_address,
            b.customer_gstin,
            b.payment_method,
            b.payment_status,
            b.transaction_id,
            b.subtotal,
            b.tax,
            b.discount,
            b.total,
            b.created_at,
            b.updated_at
     FROM bills b
     LEFT JOIN users u ON b.user_id = u.id
     WHERE b.id = ?
     LIMIT 1`,
    [billId]
  );
  if (rows.length === 0) return null;
  if (!includeItems) {
    return mapBill(rows[0], []);
  }

  const useItemsJoin = await checkItemsTableExistsForMrp();
  const itemRows = await query(
    useItemsJoin
      ? `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
            COALESCE(NULLIF(bi.mrp, 0), i.mrp, P.MRP, 0) AS mrp,
            bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at,
            bi.unit_price as selling_price
         FROM bill_items bi
         LEFT JOIN items i ON (i.id = bi.item_id OR (bi.item_id IS NULL AND i.item_code = bi.item_code))
         LEFT JOIN Products P ON P.ProductCode = bi.item_code
         WHERE bi.bill_id = ?
         ORDER BY bi.id ASC`
      : `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
            COALESCE(NULLIF(bi.mrp, 0), P.MRP, 0) AS mrp,
            bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at,
            bi.unit_price as selling_price
         FROM bill_items bi
         LEFT JOIN Products P ON P.ProductCode = bi.item_code
         WHERE bi.bill_id = ?
         ORDER BY bi.id ASC`,
    [billId]
  );

  const items = itemRows.map(mapBillItem).filter(Boolean);
  return mapBill(rows[0], items);
};

const normalizeBillItemsFromRequestItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      const quantity = Number.parseFloat(item.quantity);
      const unitPrice = Number.parseFloat(item.unitPrice ?? item.price);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return null;
      }

      const discountValue = Number.isFinite(Number.parseFloat(item.discount))
        ? Number.parseFloat(item.discount)
        : 0;
      const taxRateValue = Number.isFinite(Number.parseFloat(item.taxRate))
        ? Number.parseFloat(item.taxRate)
        : 0;
      const bogoLabel = String(item.bogoOffer ?? item.bogo_offer ?? '').trim();
      const billableQty = bogoLabel ? quantity / 2 : quantity;
      const subtotalValue = Number((billableQty * unitPrice).toFixed(2));
      const discountApplied = Number(Math.max(discountValue, 0).toFixed(2));
      const totalValue = Number(Math.max(subtotalValue - discountApplied, 0).toFixed(2));

      const parsedItemId = (() => {
        const possibleId = item.itemId ?? item.item_id ?? item.sourceId;
        const numberId = Number.parseInt(possibleId, 10);
        return Number.isFinite(numberId) && numberId > 0 ? numberId : null;
      })();

      const mrpValue =
        Number.isFinite(Number(item.mrp)) && Number(item.mrp) >= 0
          ? Number(Number(item.mrp).toFixed(2))
          : null;
      return {
        itemId: parsedItemId,
        itemCode: item.itemCode ?? item.item_code ?? item.sku ?? null,
        itemName: item.itemName ?? item.name ?? 'Unnamed Item',
        quantity,
        unitPrice: Number(unitPrice.toFixed(2)),
        mrp: mrpValue,
        subtotal: subtotalValue,
        discount: discountApplied,
        taxRate: Number(taxRateValue.toFixed(2)),
        total: totalValue
      };
    })
    .filter(Boolean);
};

export const createBill = async ({
  billNo,
  storeId,
  userId,
  date,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  customerGstin,
  paymentMethod,
  paymentStatus,
  transactionId,
  subtotal = 0,
  tax = 0,
  discount = 0,
  total = 0,
  items = []
}) => {
  await ensureBillingTablesExist();
  return transaction(async (connection) => {
    const providedBillNo = billNo?.trim() && billNo.trim().length > 0 ? billNo.trim() : null;
    const autoAllocate = !providedBillNo;
    const maxAttempts = autoAllocate ? BILL_NO_ALLOCATION_RETRIES : 1;

    let resolvedBillNo = providedBillNo ?? (await getNextBillNumber(connection, storeId));
    let result;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (autoAllocate && attempt > 0) {
        resolvedBillNo = await getNextBillNumber(connection, storeId);
      }
      try {
        const [insertRows] = await connection.execute(
          `INSERT INTO bills (
        bill_no, store_id, user_id, date,
        customer_id, customer_name, customer_phone, customer_email, customer_address, customer_gstin,
        payment_method, payment_status, transaction_id, subtotal, tax, discount, total,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            resolvedBillNo,
            storeId,
            userId,
            date,
            customerId || null,
            customerName || null,
            customerPhone || null,
            customerEmail || null,
            customerAddress || null,
            customerGstin || null,
            paymentMethod || 'cash',
            paymentStatus || 'paid',
            transactionId || null,
            subtotal,
            tax,
            discount,
            total,
            date,
            date
          ]
        );
        result = insertRows;
        break;
      } catch (err) {
        const dup =
          err?.code === 'ER_DUP_ENTRY' ||
          err?.errno === 1062 ||
          String(err?.sqlMessage || '').toLowerCase().includes('duplicate');
        if (autoAllocate && dup && attempt < maxAttempts - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!result) {
      throw new Error('Unable to allocate a unique bill number after several attempts.');
    }

    const normalizedItems = normalizeBillItemsFromRequestItems(items);

    if (normalizedItems.length > 0) {
      const placeholders = normalizedItems
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .join(', ');
      const values = normalizedItems.flatMap((item) => [
        result.insertId,
        item.itemId,
        item.itemCode,
        item.itemName,
        item.quantity,
        item.unitPrice,
        item.mrp,
        item.subtotal,
        item.discount,
        item.taxRate,
        item.total
      ]);

      await connection.query(
        `INSERT INTO bill_items (
          bill_id,
          item_id,
          item_code,
          item_name,
          quantity,
          unit_price,
          mrp,
          subtotal,
          discount,
          tax_rate,
          total
        ) VALUES ${placeholders}`,
        values
      );

      // Reduce stock for each item in the bill
      console.log(`📦 Starting stock reduction for ${normalizedItems.length} items in bill ${resolvedBillNo}`);
      for (const item of normalizedItems) {
        await reduceStockForBillItem(connection, item, storeId);
      }
      console.log(`✅ Completed stock reduction for all items in bill ${resolvedBillNo}`);
    }

    const [rows] = await connection.query(
      `SELECT b.id,
              b.bill_no,
              b.store_id,
              b.user_id,
              u.first_name AS user_first_name,
              u.last_name AS user_last_name,
              u.email AS user_email,
              b.date,
              DATE_FORMAT(b.date, '%Y-%m-%d') AS bill_date_ymd,
              b.customer_id,
              b.customer_name,
              b.customer_phone,
              b.customer_email,
              b.customer_address,
              b.customer_gstin,
              b.payment_method,
              b.payment_status,
              b.transaction_id,
              b.subtotal,
              b.tax,
              b.discount,
              b.total,
              b.created_at,
              b.updated_at
       FROM bills b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    const itemsTableExists = await checkItemsTableExists(connection);
    const itemsRows = normalizedItems.length
      ? await connection.query(
        itemsTableExists
          ? `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
                  COALESCE(NULLIF(bi.mrp, 0), i.mrp, P.MRP, 0) AS mrp,
                  bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at
             FROM bill_items bi
             LEFT JOIN items i ON (i.id = bi.item_id OR (bi.item_id IS NULL AND i.item_code = bi.item_code))
             LEFT JOIN Products P ON P.ProductCode = bi.item_code
             WHERE bi.bill_id = ?
             ORDER BY bi.id ASC`
          : `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
                  COALESCE(NULLIF(bi.mrp, 0), P.MRP, 0) AS mrp,
                  bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at
             FROM bill_items bi
             LEFT JOIN Products P ON P.ProductCode = bi.item_code
             WHERE bi.bill_id = ?
             ORDER BY bi.id ASC`,
        [result.insertId]
      )
      : [[], []];

    const billItems = (itemsRows?.[0] ?? []).map(mapBillItem);

    return mapBill(rows[0], billItems);
  });
};

export const updateBill = async (
  billId,
  {
    storeId,
    customerId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerGstin,
    paymentMethod,
    paymentStatus,
    transactionId,
    subtotal = 0,
    tax = 0,
    discount = 0,
    total = 0,
    items = []
  }
) => {
  await ensureBillingTablesExist();

  return transaction(async (connection) => {
    const [existingRows] = await connection.query('SELECT id, store_id FROM bills WHERE id = ? LIMIT 1', [
      billId
    ]);
    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      throw new Error('Bill not found');
    }
    if (Number(existingRows[0].store_id) !== Number(storeId)) {
      throw new Error('Bill does not belong to this store');
    }

    const [oldRows] = await connection.query(
      `SELECT item_id, item_code, item_name, quantity FROM bill_items WHERE bill_id = ?`,
      [billId]
    );
    const oldLines = Array.isArray(oldRows) ? oldRows : [];
    for (const row of oldLines) {
      await restoreStockForBillItem(
        connection,
        {
          itemId: row.item_id,
          itemCode: row.item_code,
          itemName: row.item_name,
          quantity: Number(row.quantity ?? 0)
        },
        storeId
      );
    }

    await connection.query('DELETE FROM bill_items WHERE bill_id = ?', [billId]);

    const normalizedItems = normalizeBillItemsFromRequestItems(items);
    if (normalizedItems.length === 0) {
      throw new Error('At least one bill line is required');
    }

    const placeholders = normalizedItems.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = normalizedItems.flatMap((item) => [
      billId,
      item.itemId,
      item.itemCode,
      item.itemName,
      item.quantity,
      item.unitPrice,
      item.mrp,
      item.subtotal,
      item.discount,
      item.taxRate,
      item.total
    ]);

    await connection.query(
      `INSERT INTO bill_items (
          bill_id,
          item_id,
          item_code,
          item_name,
          quantity,
          unit_price,
          mrp,
          subtotal,
          discount,
          tax_rate,
          total
        ) VALUES ${placeholders}`,
      values
    );

    for (const item of normalizedItems) {
      await reduceStockForBillItem(connection, item, storeId);
    }

    await connection.query(
      `UPDATE bills SET
          customer_id = ?,
          customer_name = ?,
          customer_phone = ?,
          customer_email = ?,
          customer_address = ?,
          customer_gstin = ?,
          payment_method = ?,
          payment_status = ?,
          transaction_id = ?,
          subtotal = ?,
          tax = ?,
          discount = ?,
          total = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        customerId || null,
        customerName || null,
        customerPhone || null,
        customerEmail || null,
        customerAddress || null,
        customerGstin || null,
        paymentMethod || 'cash',
        paymentStatus || 'paid',
        transactionId || null,
        subtotal,
        tax,
        discount,
        total,
        billId
      ]
    );

    const [rows] = await connection.query(
      `SELECT b.id,
              b.bill_no,
              b.store_id,
              b.user_id,
              u.first_name AS user_first_name,
              u.last_name AS user_last_name,
              u.email AS user_email,
              b.date,
              DATE_FORMAT(b.date, '%Y-%m-%d') AS bill_date_ymd,
              b.customer_id,
              b.customer_name,
              b.customer_phone,
              b.customer_email,
              b.customer_address,
              b.customer_gstin,
              b.payment_method,
              b.payment_status,
              b.transaction_id,
              b.subtotal,
              b.tax,
              b.discount,
              b.total,
              b.created_at,
              b.updated_at
       FROM bills b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ?
       LIMIT 1`,
      [billId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Bill not found after update');
    }

    const itemsTableExists = await checkItemsTableExists(connection);
    const itemsRows = await connection.query(
      itemsTableExists
        ? `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
                COALESCE(NULLIF(bi.mrp, 0), i.mrp, P.MRP, 0) AS mrp,
                bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at
           FROM bill_items bi
           LEFT JOIN items i ON (i.id = bi.item_id OR (bi.item_id IS NULL AND i.item_code = bi.item_code))
           LEFT JOIN Products P ON P.ProductCode = bi.item_code
           WHERE bi.bill_id = ?
           ORDER BY bi.id ASC`
        : `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
                COALESCE(NULLIF(bi.mrp, 0), P.MRP, 0) AS mrp,
                bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at
           FROM bill_items bi
           LEFT JOIN Products P ON P.ProductCode = bi.item_code
           WHERE bi.bill_id = ?
           ORDER BY bi.id ASC`,
      [billId]
    );

    const billItems = (itemsRows?.[0] ?? []).map(mapBillItem);
    return mapBill(rows[0], billItems);
  });
};

export const deleteBill = async (billId) => {
  await ensureBillingTablesExist();
  const existing = await getBillById(billId);
  if (!existing) {
    return null;
  }

  await query('DELETE FROM bills WHERE id = ?', [billId]);
  return existing;
};

export const getBillByBillNo = async (billNo, { includeItems = true } = {}) => {
  if (!billNo) {
    return null;
  }
  await ensureBillingTablesExist();

  const rows = await query(
    `SELECT b.id,
            b.bill_no,
            b.store_id,
            b.user_id,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.email AS user_email,
            b.date,
            DATE_FORMAT(b.date, '%Y-%m-%d') AS bill_date_ymd,
            b.customer_id,
            b.customer_name,
            b.customer_phone,
            b.customer_email,
            b.customer_address,
            b.customer_gstin,
            b.payment_method,
            b.payment_status,
            b.transaction_id,
            b.subtotal,
            b.tax,
            b.discount,
            b.total,
            b.created_at,
            b.updated_at
     FROM bills b
     LEFT JOIN users u ON b.user_id = u.id
     WHERE b.bill_no = ?
     LIMIT 1`,
    [billNo]
  );

  if (rows.length === 0) {
    return null;
  }

  if (!includeItems) {
    return mapBill(rows[0], []);
  }

  const useItemsJoin = await checkItemsTableExistsForMrp();
  const itemRows = await query(
    useItemsJoin
      ? `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
            COALESCE(NULLIF(bi.mrp, 0), i.mrp, P.MRP, 0) AS mrp,
            bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at,
            bi.unit_price as selling_price
         FROM bill_items bi
         LEFT JOIN items i ON (i.id = bi.item_id OR (bi.item_id IS NULL AND i.item_code = bi.item_code))
         LEFT JOIN Products P ON P.ProductCode = bi.item_code
         WHERE bi.bill_id = ?
         ORDER BY bi.id ASC`
      : `SELECT bi.id, bi.bill_id, bi.item_id, bi.item_code, bi.item_name, bi.quantity, bi.unit_price,
            COALESCE(NULLIF(bi.mrp, 0), P.MRP, 0) AS mrp,
            bi.subtotal, bi.discount, bi.tax_rate, bi.total, bi.created_at,
            bi.unit_price as selling_price
         FROM bill_items bi
         LEFT JOIN Products P ON P.ProductCode = bi.item_code
         WHERE bi.bill_id = ?
         ORDER BY bi.id ASC`,
    [rows[0].id]
  );

  return mapBill(rows[0], itemRows.map(mapBillItem).filter(Boolean));
};

export const findLatestCustomerByPhone = async (phone, storeId) => {
  if (!phone) {
    return null;
  }

  // Ensure table exists and is migrated to latest columns (address, gstin, etc.)
  await ensureBillingTablesExist();

  const params = [phone];
  let storeFilter = '';
  if (storeId) {
    storeFilter = ' AND store_id = ?';
    params.push(storeId);
  }

  const rows = await query(
    `SELECT customer_id, customer_name, customer_phone, customer_email, customer_address, customer_gstin, payment_method, updated_at
     FROM bills
     WHERE customer_phone = ?${storeFilter}
       AND customer_phone IS NOT NULL
     ORDER BY date DESC, id DESC
     LIMIT 1`,
    params
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerAddress: row.customer_address,
    customerGstin: row.customer_gstin,
    paymentMethod: row.payment_method,
    lastPurchaseOrderDate: row.updated_at
  };
};

const isPlainYmd = (raw) => {
  if (raw === undefined || raw === null) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim());
};

export const listBills = async (filters = {}) => {
  await ensureBillingTablesExist();

  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 10000);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (filters.paymentMethod) {
    conditions.push('b.payment_method = ?');
    params.push(filters.paymentMethod);
  }

  if (filters.paymentStatus) {
    conditions.push('b.payment_status = ?');
    params.push(filters.paymentStatus);
  }

  if (filters.storeId) {
    conditions.push('b.store_id = ?');
    params.push(Number(filters.storeId));
  }

  if (filters.userId) {
    conditions.push('b.user_id = ?');
    params.push(Number(filters.userId));
  }

  if (filters.billId) {
    conditions.push('b.id = ?');
    params.push(Number(filters.billId));
  }

  // Plain YYYY-MM-DD: compare calendar dates only (avoids TZ mismatches vs HTML date inputs + bill `date`).
  const startPlain = filters.startDate && isPlainYmd(filters.startDate) ? String(filters.startDate).trim() : null;
  const endPlain = filters.endDate && isPlainYmd(filters.endDate) ? String(filters.endDate).trim() : null;

  // Use bill business `date` only so the range matches the same column the UI groups by
  // (avoid OR on created_at pulling rows that then appear under the wrong calendar day).
  if (startPlain && endPlain) {
    conditions.push('DATE(b.date) BETWEEN ? AND ?');
    params.push(startPlain, endPlain);
  } else if (startPlain && !endPlain) {
    conditions.push('DATE(b.date) = ?');
    params.push(startPlain);
  } else if (!startPlain && endPlain) {
    conditions.push('DATE(b.date) = ?');
    params.push(endPlain);
  } else {
    const startParsed = filters.startDate
      ? parseQueryableDateBound(filters.startDate, 'start')
      : null;
    const endParsed = filters.endDate
      ? parseQueryableDateBound(filters.endDate, 'end')
      : null;

    if (startParsed && endParsed) {
      conditions.push('(b.date >= ? AND b.date <= ?)');
      params.push(startParsed, endParsed);
    } else if (startParsed) {
      // Single-bound ISO: cap to end of that same local calendar day in JS is ambiguous; use start-of-next-day exclusive if needed later.
      conditions.push('b.date >= ?');
      params.push(startParsed);
    } else if (endParsed) {
      conditions.push('b.date <= ?');
      params.push(endParsed);
    }
  }

  if (filters.search) {
    const like = `%${filters.search.trim()}%`;
    conditions.push(
      '(b.bill_no LIKE ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)'
    );
    params.push(like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseParams = Array.isArray(params) ? params : [];
  const queryParams = [...baseParams, limit, offset];

  const rows = await query(
    `SELECT b.id,
            b.bill_no,
            b.store_id,
            b.user_id,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.email AS user_email,
            b.date,
            DATE_FORMAT(b.date, '%Y-%m-%d') AS bill_date_ymd,
            b.customer_id,
            b.customer_name,
            b.customer_phone,
            b.customer_email,
            b.payment_method,
            b.payment_status,
            b.transaction_id,
            b.subtotal,
            b.tax,
            b.discount,
            b.total,
            b.created_at,
            b.updated_at
     FROM bills b
     LEFT JOIN users u ON b.user_id = u.id
     ${whereClause}
     ORDER BY b.date DESC, b.id DESC
     LIMIT ? OFFSET ?`,
    queryParams
  );

  const countRows = await query(
    `SELECT COUNT(*) AS totalItems
     FROM bills b
     ${whereClause}`,
    baseParams
  );

  const totalItems = countRows?.[0]?.totalItems ? Number(countRows[0].totalItems) : 0;

  return {
    bills: rows.map((row) => mapBill(row)),
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
    },
  };
};

