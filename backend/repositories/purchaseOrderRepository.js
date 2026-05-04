import { query, transaction } from '../db/index.js';
import { parseQueryableDateBound } from '../utils/parseDateRangeBounds.js';

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
            // Table might not exist, continue to other tables
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
      console.error('Full error:', error);
    }
  }
  
  return { itemId: null, productCode: null, applianceId: null, source: null };
};

// Helper function to ensure inventories table exists (for items table)
const ensureInventoriesTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      item_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      qty_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
      qty_reserved INT UNSIGNED NOT NULL DEFAULT 0,
      last_purchase_price DECIMAL(10, 2) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_item_store (item_id, store_id),
      KEY idx_store (store_id),
      KEY idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

// Helper function to ensure store-specific inventory table exists (for Products table)
const ensureStoreInventoryTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS store_inventory (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_code VARCHAR(100) NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      qty_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
      last_purchase_price DECIMAL(10, 2) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_product_store (product_code, store_id),
      KEY idx_store (store_id),
      KEY idx_product (product_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

// Helper function to ensure appliance store inventory table exists
const ensureApplianceStoreInventoryTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS appliance_store_inventory (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      appliance_id INT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      qty_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
      last_purchase_price DECIMAL(10, 2) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_appliance_store (appliance_id, store_id),
      KEY idx_store (store_id),
      KEY idx_appliance (appliance_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

// Update inventory for items in purchase order
const updateInventoryForPO = async (connection, storeId, items) => {
  if (!storeId || !items || items.length === 0) {
    return;
  }
  
  const storeIdNum = Number(storeId);
  if (isNaN(storeIdNum) || storeIdNum <= 0) {
    console.warn('Invalid store_id for inventory update:', storeId);
    return;
  }
  
  const itemsTableExists = await checkItemsTableExists(connection);
  const applianceTableExists = await checkApplianceTableExists(connection);
  
  // Ensure appropriate inventory tables exist
  if (itemsTableExists) {
    await ensureInventoriesTable(connection);
  } else {
    await ensureStoreInventoryTable(connection);
  }
  
  if (applianceTableExists) {
    await ensureApplianceStoreInventoryTable(connection);
  }
  
  for (const item of items) {
    console.log(`🔍 Processing item: ${item.itemName || item.name}, itemId: ${item.itemId}, sku: ${item.sku}, quantity: ${item.quantity}`);
    
    const identifier = await findItemIdentifier(connection, item.itemId, item.sku);
    
    if (!identifier.source) {
      console.warn(`❌ Could not find item for: ${item.itemName || item.name} (SKU: ${item.sku}, itemId: ${item.itemId})`);
      continue;
    }
    
    console.log(`✅ Found item identifier:`, identifier);
    
    const quantity = Number(item.quantity ?? 0);
    if (quantity <= 0) {
      console.warn(`⚠️ Skipping item ${item.itemName || item.name}: quantity is ${quantity}`);
      continue;
    }
    
    const costPrice = Number(item.costPrice ?? item.price ?? 0);
    
    try {
      if (identifier.source === 'items' && identifier.itemId) {
        // Update inventory for items table
        await connection.query(
          `INSERT INTO inventories (item_id, store_id, qty_on_hand, last_purchase_price)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             qty_on_hand = qty_on_hand + ?,
             last_purchase_price = ?,
             updated_at = CURRENT_TIMESTAMP`,
          [identifier.itemId, storeIdNum, quantity, costPrice, quantity, costPrice]
        );
        
        console.log(`✅ Updated inventory (items): item_id=${identifier.itemId}, store_id=${storeIdNum}, qty_added=${quantity}`);
      } else if (identifier.source === 'products' && identifier.productCode) {
        // Update inventory for Products table (store-specific)
        await connection.query(
          `INSERT INTO store_inventory (product_code, store_id, qty_on_hand, last_purchase_price)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             qty_on_hand = qty_on_hand + ?,
             last_purchase_price = ?,
             updated_at = CURRENT_TIMESTAMP`,
          [identifier.productCode, storeIdNum, quantity, costPrice, quantity, costPrice]
        );
        
        // Update TotalStock in Products table (increment by quantity received)
        // This maintains the global total stock across all stores
        const [updateResult] = await connection.query(
          `UPDATE Products 
           SET TotalStock = COALESCE(TotalStock, 0) + ?
           WHERE ProductCode = ?`,
          [quantity, identifier.productCode]
        );
        
        console.log(`✅ Updated inventory (products): product_code=${identifier.productCode}, store_id=${storeIdNum}, qty_added=${quantity}, TotalStock updated in Products table`);
        console.log(`📊 Update result:`, updateResult);
      } else if (identifier.source === 'appliance' && identifier.applianceId) {
        // Ensure qty_on_hand column exists in appliance table
        try {
          const [columns] = await connection.query(
            `SELECT COLUMN_NAME 
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'appliance' 
               AND COLUMN_NAME = 'qty_on_hand'`
          );
          if (!columns || columns.length === 0) {
            // Column doesn't exist, add it
            await connection.query(
              `ALTER TABLE appliance ADD COLUMN qty_on_hand INT UNSIGNED NOT NULL DEFAULT 0 AFTER max_stock`
            );
            console.log('✅ Added qty_on_hand column to appliance table');
          }
        } catch (error) {
          console.warn('Error checking/adding qty_on_hand column:', error.message);
        }
        
        // Update inventory for appliance table (store-specific)
        await connection.query(
          `INSERT INTO appliance_store_inventory (appliance_id, store_id, qty_on_hand, last_purchase_price)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             qty_on_hand = qty_on_hand + ?,
             last_purchase_price = ?,
             updated_at = CURRENT_TIMESTAMP`,
          [identifier.applianceId, storeIdNum, quantity, costPrice, quantity, costPrice]
        );
        
        // Update qty_on_hand in appliance table (increment by quantity received)
        // This maintains the global total stock across all stores
        // IMPORTANT: Update qty_on_hand, NOT gst_rate or any other field
        const [updateResult] = await connection.query(
          `UPDATE appliance 
           SET qty_on_hand = COALESCE(qty_on_hand, 0) + ?
           WHERE appliance_id = ?`,
          [quantity, identifier.applianceId]
        );
        
        // Verify the update worked by checking affected rows
        if (updateResult.affectedRows > 0) {
          console.log(`✅ Updated inventory (appliance): appliance_id=${identifier.applianceId}, store_id=${storeIdNum}, qty_added=${quantity}, qty_on_hand updated in appliance table`);
        } else {
          console.warn(`⚠️ No rows updated for appliance_id=${identifier.applianceId}. Check if appliance exists.`);
        }
        console.log(`📊 Update result:`, updateResult);
      }
    } catch (error) {
      console.error(`❌ Error updating inventory for item: ${item.itemName || item.name}`, error.message);
      console.error(`Full error:`, error);
      // Continue with next item instead of failing entire PO
    }
  }
};

let ensureTablesPromise;

const PURCHASE_ORDER_PREFIX = 'PO';

const computeChecksum = (digits12) => {
  const digits = String(digits12).padStart(12, '0').split('').map((d) => Number(d));
  const sum = digits.reduce((acc, val, idx) => {
    const weight = idx % 2 === 0 ? 1 : 3;
    return acc + val * weight;
  }, 0);
  const mod = sum % 10;
  return (10 - mod) % 10;
};

const buildBarcodeValue = (purchaseOrderId, itemIndex, sequence) => {
  const part1 = Number(purchaseOrderId) % 1_000_000;
  const part2 = itemIndex % 1_000;
  const part3 = sequence % 1_000;

  const base = `${String(part1).padStart(6, '0')}${String(part2).padStart(3, '0')}${String(part3).padStart(3, '0')}`;
  const checksum = computeChecksum(base);
  return `${base}${checksum}`;
};

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        po_number VARCHAR(50) NOT NULL UNIQUE,
        supplier_id VARCHAR(100) NULL,
        supplier_name VARCHAR(255) NULL,
        store_id VARCHAR(100) NULL,
        order_date DATETIME NOT NULL,
        expected_delivery_date DATETIME NULL,
        invoice_number VARCHAR(100) NULL,
        total_items INT UNSIGNED NOT NULL DEFAULT 0,
        total_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
        discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
        shipping DECIMAL(12, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        partial_payment DECIMAL(12, 2) NOT NULL DEFAULT 0,
        is_credit BOOLEAN NOT NULL DEFAULT FALSE,
        status ENUM('created','ordered','received','cancelled') NOT NULL DEFAULT 'created',
        notes TEXT NULL,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_by_display_name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure invoice number is unique per store (prevents duplicate invoice entries in PO entry screen)
    try {
      const idx = await query(
        `
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'purchase_orders'
          AND INDEX_NAME = 'uq_po_store_invoice'
        LIMIT 1
        `
      );
      if (!idx || idx.length === 0) {
        // MySQL allows multiple NULLs in UNIQUE indexes, but store_id + invoice_number will be set in our flow.
        await query(
          `CREATE UNIQUE INDEX uq_po_store_invoice ON purchase_orders (store_id, invoice_number)`
        );
        console.log('✅ Created unique index uq_po_store_invoice (store_id, invoice_number)');
      }
    } catch (error) {
      // If the index already exists (race / old migrations), ignore.
      if (error?.code !== 'ER_DUP_KEYNAME') {
        console.warn('Could not create uq_po_store_invoice index:', error.message);
      }
    }

    await query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        line_index INT UNSIGNED NOT NULL DEFAULT 0,
        item_id BIGINT UNSIGNED NULL,
        item_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) NULL,
        unit VARCHAR(50) NULL,
        category_name VARCHAR(255) NULL,
        subcategory_name VARCHAR(255) NULL,
        batch_number VARCHAR(100) NULL,
        hsn_number VARCHAR(100) NULL,
        expiry_date DATE NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 0,
        cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        total DECIMAL(12, 2) NOT NULL DEFAULT 0,
        discount_type VARCHAR(10) NULL DEFAULT '%',
        discount_percent DECIMAL(5, 2) NULL DEFAULT 0,
        discount_amount DECIMAL(12, 2) NULL DEFAULT 0,
        tax_percent DECIMAL(5, 2) NULL DEFAULT 0,
        mrp DECIMAL(12, 2) NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_po_items_po (purchase_order_id),
        KEY idx_po_items_item (item_id),
        CONSTRAINT fk_po_items_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add new columns to existing table if they don't exist
    // This migration needs to run every time to ensure columns exist
    const addColumnIfNotExists = async (columnName, columnDef) => {
      try {
        // Check if column exists
        const [columns] = await query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'purchase_order_items'
          AND COLUMN_NAME = ?
        `, [columnName]);

        if (!columns || columns.length === 0) {
          // Column doesn't exist, add it
          await query(`ALTER TABLE purchase_order_items ADD COLUMN ${columnDef}`);
          console.log(`✅ Added ${columnName} column to purchase_order_items`);
          return true;
        }
        return false;
      } catch (err) {
        // If it's a duplicate column error, that's fine
        if (err.message && err.message.includes('Duplicate column name')) {
          return false;
        }
        // Try without AFTER clause as fallback
        try {
          const simpleDef = columnDef.replace(/AFTER\s+\w+/i, '').trim();
          await query(`ALTER TABLE purchase_order_items ADD COLUMN ${simpleDef}`);
          console.log(`✅ Added ${columnName} column to purchase_order_items (without AFTER clause)`);
          return true;
        } catch (err2) {
          if (!err2.message || !err2.message.includes('Duplicate column name')) {
            console.warn(`Error adding ${columnName} column:`, err2.message);
          }
          return false;
        }
      }
    };

    // Add columns one by one
    await addColumnIfNotExists('item_id', 'item_id BIGINT UNSIGNED NULL AFTER line_index');
    await addColumnIfNotExists('discount_type', 'discount_type VARCHAR(10) NULL DEFAULT \'%\' AFTER total');
    await addColumnIfNotExists('discount_percent', 'discount_percent DECIMAL(5, 2) NULL DEFAULT 0 AFTER discount_type');
    await addColumnIfNotExists('discount_amount', 'discount_amount DECIMAL(12, 2) NULL DEFAULT 0 AFTER discount_percent');
    await addColumnIfNotExists('tax_percent', 'tax_percent DECIMAL(5, 2) NULL DEFAULT 0 AFTER discount_amount');
    await addColumnIfNotExists('mrp', 'mrp DECIMAL(12, 2) NULL DEFAULT 0 AFTER tax_percent');
    await addColumnIfNotExists(
      'purchase_price',
      'purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER cost_price'
    );

    await query(`
      CREATE TABLE IF NOT EXISTS purchase_order_barcodes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        item_index INT UNSIGNED NOT NULL DEFAULT 0,
        item_name VARCHAR(255) NOT NULL,
        item_sku VARCHAR(100) NULL,
        batch_number VARCHAR(100) NULL,
        expiry_date DATE NULL,
        amount DECIMAL(12, 2) NULL,
        barcode VARCHAR(50) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_po_barcodes_po (purchase_order_id),
        CONSTRAINT fk_po_barcodes_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add is_credit column to existing purchase_orders table if it doesn't exist
    try {
      const columns = await query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'purchase_orders' 
        AND COLUMN_NAME = 'is_credit'
      `);

      if (!columns || columns.length === 0) {
        await query(`
          ALTER TABLE purchase_orders 
          ADD COLUMN is_credit BOOLEAN NOT NULL DEFAULT FALSE
        `);
        console.log('✅ Added is_credit column to purchase_orders table');
      }
    } catch (error) {
      // Column might already exist or table doesn't exist yet, ignore error
      if (!error.message.includes('Duplicate column name')) {
        console.warn('Could not add is_credit column:', error.message);
      }
    }

    try {
      const invoiceCols = await query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'purchase_orders' 
        AND COLUMN_NAME = 'invoice_number'
      `);

      if (!invoiceCols || invoiceCols.length === 0) {
        await query(`
          ALTER TABLE purchase_orders 
          ADD COLUMN invoice_number VARCHAR(100) NULL
        `);
        console.log('✅ Added invoice_number column to purchase_orders table');
      }
    } catch (error) {
      if (!error.message.includes('Duplicate column name')) {
        console.warn('Could not add invoice_number column:', error.message);
      }
    }

    for (const meta of [
      { name: 'created_by_user_id', def: 'BIGINT UNSIGNED NULL' },
      { name: 'created_by_display_name', def: 'VARCHAR(255) NULL' },
    ]) {
      try {
        const cols = await query(
          `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'purchase_orders'
            AND COLUMN_NAME = ?
        `,
          [meta.name]
        );
        if (!cols || cols.length === 0) {
          await query(`ALTER TABLE purchase_orders ADD COLUMN ${meta.name} ${meta.def}`);
          console.log(`✅ Added ${meta.name} to purchase_orders`);
        }
      } catch (error) {
        if (!error.message?.includes('Duplicate column name')) {
          console.warn(`Could not add ${meta.name}:`, error.message);
        }
      }
    }
  })().catch((error) => {
    ensureTablesPromise = undefined;
    throw error;
  });

  return ensureTablesPromise;
};

const mapPurchaseOrderRow = (row) => {
  if (!row) return null;
  const supplierLabel =
    row.supplier_name != null && String(row.supplier_name).trim() !== ''
      ? String(row.supplier_name).trim()
      : null;
  const createdByDisplay =
    row.created_by_display_name != null && String(row.created_by_display_name).trim() !== ''
      ? String(row.created_by_display_name).trim()
      : null;
  const totalAmt = Number(row.total_amount ?? 0);
  return {
    _id: String(row.id),
    poNumber: row.po_number,
    supplierId: row.supplier_id,
    supplierName: supplierLabel,
    supplier: (() => {
      const hasId = row.supplier_id != null && String(row.supplier_id).trim() !== "";
      if (!hasId && !supplierLabel) return null;
      return {
        _id: row.supplier_id != null ? String(row.supplier_id) : "",
        companyName: supplierLabel,
      };
    })(),
    storeId: row.store_id,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    invoiceNumber: row.invoice_number != null ? String(row.invoice_number) : '',
    totalItems: Number(row.total_items ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 0),
    shipping: Number(row.shipping ?? 0),
    totalAmount: totalAmt,
    total: totalAmt,
    partialPayment: Number(row.partial_payment ?? 0),
    isCredit: Boolean(row.is_credit ?? false),
    status: row.status,
    notes: row.notes,
    createdBy: createdByDisplay
      ? { firstName: createdByDisplay, lastName: '', email: null }
      : null,
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    createdByDisplayName: createdByDisplay,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const normalizeInvoiceNumberForDb = (value) => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, 100) : null;
};

/** Resolve supplier display name from legacy Suppliers / suppliers table by SUPPLIERCODE. */
const fetchSupplierNameByCode = async (connection, supplierCode) => {
  if (supplierCode === undefined || supplierCode === null) return null;
  const code = String(supplierCode).trim();
  if (!code) return null;
  const runSelect = async (sql, params) => {
    if (connection?.query) {
      const [rows] = await connection.query(sql, params);
      return rows;
    }
    return query(sql, params);
  };
  for (const table of ['Suppliers', 'suppliers']) {
    try {
      const list = await runSelect(
        `SELECT NAME AS n FROM \`${table}\` WHERE SUPPLIERCODE = ? LIMIT 1`,
        [code]
      );
      if (list?.length && list[0].n != null && String(list[0].n).trim() !== '') {
        return String(list[0].n).trim();
      }
    } catch {
      /* table or column mismatch */
    }
  }
  return null;
};

const resolveSupplierNameForDb = async (connection, supplier) => {
  if (supplier && typeof supplier === 'object') {
    const n = supplier.name ?? supplier.companyName;
    if (n != null && String(n).trim() !== '') return String(n).trim();
  }
  const id = supplier?.id ?? supplier?._id ?? supplier;
  return fetchSupplierNameByCode(connection, id);
};

/** Fill supplier_name on in-memory rows when missing (for reports / older POs). */
const enrichRowsWithSupplierNames = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const needIds = [
    ...new Set(
      rows
        .filter((r) => r?.supplier_id != null && String(r.supplier_id).trim() !== '')
        .filter((r) => r.supplier_name == null || String(r.supplier_name).trim() === '')
        .map((r) => String(r.supplier_id).trim())
    ),
  ];
  if (needIds.length === 0) return rows;
  const placeholders = needIds.map(() => '?').join(',');
  const nameById = new Map();
  for (const table of ['Suppliers', 'suppliers']) {
    try {
      const found = await query(
        `SELECT SUPPLIERCODE AS id, NAME AS n FROM \`${table}\` WHERE SUPPLIERCODE IN (${placeholders})`,
        needIds
      );
      if (Array.isArray(found)) {
        for (const row of found) {
          if (row.id != null && row.n != null) {
            nameById.set(String(row.id).trim(), String(row.n).trim());
          }
        }
      }
      if (nameById.size > 0) break;
    } catch {
      /* try next table name */
    }
  }
  if (nameById.size === 0) return rows;
  return rows.map((r) => {
    const sid = r?.supplier_id != null ? String(r.supplier_id).trim() : '';
    if (!sid) return r;
    const hasName = r.supplier_name != null && String(r.supplier_name).trim() !== '';
    if (hasName) return r;
    const nm = nameById.get(sid);
    return nm ? { ...r, supplier_name: nm } : r;
  });
};

const fetchPurchaseOrderItems = async (purchaseOrderId) => {
  const rows = await query(
    `SELECT id, purchase_order_id, line_index, item_id, item_name, sku, unit, category_name,
            subcategory_name, batch_number, hsn_number, expiry_date, quantity,
            cost_price, purchase_price, total, discount_type, discount_percent, discount_amount,
            tax_percent, mrp, created_at
     FROM purchase_order_items
     WHERE purchase_order_id = ?
     ORDER BY line_index ASC, id ASC`,
    [purchaseOrderId]
  );

  return rows.map((row) => ({
    _id: String(row.id),
    purchaseOrderId: String(row.purchase_order_id),
    lineIndex: Number(row.line_index ?? 0),
    itemId: row.item_id ? String(row.item_id) : null,
    itemName: row.item_name,
    sku: row.sku,
    unit: row.unit,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    batchNumber: row.batch_number,
    hsnNumber: row.hsn_number,
    expiryDate: row.expiry_date,
    quantity: Number(row.quantity ?? 0),
    costPrice: Number(row.cost_price ?? 0),
    purchasePrice: Number(row.purchase_price ?? row.cost_price ?? 0),
    total: Number(row.total ?? 0),
    discountType: row.discount_type || '%',
    discountPercent: Number(row.discount_percent ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    taxPercent: Number(row.tax_percent ?? 0),
    mrp: Number(row.mrp ?? 0),
    createdAt: row.created_at,
  }));
};

const fetchPurchaseOrderBarcodes = async (purchaseOrderId) => {
  const rows = await query(
    `SELECT item_index, item_name, item_sku, batch_number, expiry_date, amount, barcode
     FROM purchase_order_barcodes
     WHERE purchase_order_id = ?
     ORDER BY item_index ASC, id ASC`,
    [purchaseOrderId]
  );

  return rows;
};

const generatePurchaseOrderNumber = async (connection, storeId = null) => {
  let storeCode = '';
  
  // Fetch store code if storeId is provided
  if (storeId) {
    // Normalize storeId to number for consistent comparison
    const normalizedStoreId = typeof storeId === 'string' 
      ? Number.parseInt(storeId, 10) 
      : Number(storeId);
    
    if (!Number.isNaN(normalizedStoreId)) {
      try {
        const [storeRows] = await connection.query(
          `SELECT store_code FROM stores WHERE id = ? LIMIT 1`,
          [normalizedStoreId]
        );
        
        if (Array.isArray(storeRows) && storeRows.length > 0) {
          const retrievedStoreCode = storeRows[0].store_code;
          if (retrievedStoreCode && typeof retrievedStoreCode === 'string' && retrievedStoreCode.trim() !== '') {
            storeCode = retrievedStoreCode.trim();
            console.log(`[PO Number Generation] Store ID ${normalizedStoreId} has store_code: "${storeCode}"`);
          } else {
            console.warn(`[PO Number Generation] Store ID ${normalizedStoreId} has empty or invalid store_code. Retrieved:`, retrievedStoreCode);
          }
        } else {
          console.warn(`[PO Number Generation] Store ID ${normalizedStoreId} not found in database`);
        }
      } catch (error) {
        console.error('[PO Number Generation] Error fetching store code:', error.message);
        // Continue without store code if fetch fails
      }
    }
  }

  // Build query to get all PO numbers for the specific store to find max sequence
  let query = `SELECT po_number
     FROM purchase_orders`;
  
  const params = [];
  if (storeId && storeCode) {
    // Filter by store_id and also match PO numbers with the store code pattern
    query += ` WHERE store_id = ? AND po_number LIKE ?`;
    const normalizedStoreId = typeof storeId === 'string' 
      ? Number.parseInt(storeId, 10) 
      : Number(storeId);
    params.push(normalizedStoreId, `PO-${storeCode}-%`);
  } else if (storeId) {
    // If store code not found, just filter by store_id
    const normalizedStoreId = typeof storeId === 'string' 
      ? Number.parseInt(storeId, 10) 
      : Number(storeId);
    if (!Number.isNaN(normalizedStoreId)) {
      query += ` WHERE store_id = ?`;
      params.push(normalizedStoreId);
    }
  }
  
  query += ` ORDER BY id DESC`;

  const [rows] = await connection.query(query, params);

  let sequence = 1;
  if (Array.isArray(rows) && rows.length > 0) {
    // Find the maximum sequence number from all matching PO numbers
    let maxSequence = 0;
    
    if (storeCode) {
      // Escape special regex characters in store code
      const escapedStoreCode = storeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`PO-${escapedStoreCode}-(\\d+)$`);
      
      for (const row of rows) {
        const poNumber = row.po_number || '';
        const match = poNumber.match(pattern);
        if (match) {
          const seq = Number.parseInt(match[1], 10);
          if (seq > maxSequence) {
            maxSequence = seq;
          }
        }
      }
    } else {
      // Fallback pattern if no store code
      const pattern = /PO-[^-]+-(\\d+)$/;
      
      for (const row of rows) {
        const poNumber = row.po_number || '';
        const match = poNumber.match(pattern);
        if (match) {
          const seq = Number.parseInt(match[1], 10);
          if (seq > maxSequence) {
            maxSequence = seq;
          }
        } else {
          // Fallback: try to extract any number at the end
          const fallbackMatch = poNumber.match(/(\d+)$/);
          if (fallbackMatch) {
            const seq = Number.parseInt(fallbackMatch[1], 10);
            if (seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      }
    }
    
    if (maxSequence > 0) {
      sequence = maxSequence + 1;
    }
  }

  // Generate PO number with format: PO-{STORE_CODE}-{SEQUENCE}
  if (storeCode) {
    return `PO-${storeCode}-${String(sequence).padStart(3, '0')}`;
  } else {
    // Fallback format if store code not found
    const year = new Date().getFullYear();
    return `${PURCHASE_ORDER_PREFIX}-${year}-${String(sequence).padStart(4, '0')}`;
  }
};

// Separate function to ensure columns exist (always runs, not cached)
// This function attempts to add columns and ignores errors if they already exist
const ensurePurchaseOrderItemsColumns = async () => {
  console.log('🔧 Running migration: ensurePurchaseOrderItemsColumns');
  try {
    // Try to add each column - MySQL will error if it exists, which we ignore
    const columnsToAdd = [
      { name: 'item_id', def: 'item_id BIGINT UNSIGNED NULL' },
      { name: 'discount_type', def: 'discount_type VARCHAR(10) NULL DEFAULT \'%\'' },
      { name: 'discount_percent', def: 'discount_percent DECIMAL(5, 2) NULL DEFAULT 0' },
      { name: 'discount_amount', def: 'discount_amount DECIMAL(12, 2) NULL DEFAULT 0' },
      { name: 'tax_percent', def: 'tax_percent DECIMAL(5, 2) NULL DEFAULT 0' },
      { name: 'mrp', def: 'mrp DECIMAL(12, 2) NULL DEFAULT 0' },
    ];

    for (const col of columnsToAdd) {
      try {
        await query(`ALTER TABLE purchase_order_items ADD COLUMN ${col.def}`);
        console.log(`✅ Added ${col.name} column to purchase_order_items`);
      } catch (err) {
        // Ignore duplicate column errors (column already exists)
        if (err.message && (err.message.includes('Duplicate column name') || err.message.includes('already exists'))) {
          // Column exists, that's fine
          console.log(`ℹ️ Column ${col.name} already exists`);
          continue;
        }
        // Log other errors but don't throw
        console.error(`❌ Error adding ${col.name} column:`, err.message);
        console.error(`   SQL Error Code:`, err.code);
        console.error(`   SQL Error Number:`, err.errno);
        // Don't throw - continue with other columns
      }
    }
    console.log('✅ Migration complete: ensurePurchaseOrderItemsColumns');
  } catch (error) {
    console.error('❌ Error ensuring purchase_order_items columns:', error.message);
    console.error('   Full error:', error);
    // Don't throw - we'll try the insert anyway, but log the error
  }
};

const insertPurchaseOrderItems = async (connection, purchaseOrderId, items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];

  items.forEach((item, index) => {
    const purchaseUnit = Number(
      item.purchasePrice ?? item.price ?? item.costPrice ?? 0
    );
    const costUnit = Number(item.costPrice ?? item.price ?? purchaseUnit ?? 0);
    // 20 columns incl. purchase_price
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    
    // Convert itemId to number if it exists
    const itemId = item.itemId ? Number(item.itemId) : null;
    
    values.push(
      purchaseOrderId,
      index,
      itemId,
      item.itemName || item.name || '',
      item.sku || null,
      item.unit || null,
      item.categoryName || null,
      item.subcategoryName || null,
      item.batchNumber || null,
      item.hsnNumber || null,
      item.expiryDate ? new Date(item.expiryDate) : null,
      Number(item.quantity ?? 0),
      costUnit,
      purchaseUnit,
      Number(item.total ?? 0),
      item.discountType || '%',
      Number(item.discountPercent ?? item.disPercent ?? 0),
      Number(item.discountAmount ?? item.dis ?? 0),
      Number(item.taxPercent ?? 0),
      Number(item.mrp ?? 0)
    );
  });

  await connection.query(
    `INSERT INTO purchase_order_items (
      purchase_order_id,
      line_index,
      item_id,
      item_name,
      sku,
      unit,
      category_name,
      subcategory_name,
      batch_number,
      hsn_number,
      expiry_date,
      quantity,
      cost_price,
      purchase_price,
      total,
      discount_type,
      discount_percent,
      discount_amount,
      tax_percent,
      mrp
    ) VALUES ${placeholders.join(', ')}`,
    values
  );
};

const insertBarcodes = async (connection, purchaseOrderId) => {
  const items = await fetchPurchaseOrderItems(purchaseOrderId);
  if (items.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];

  items.forEach((item, itemIdx) => {
    const quantity = Math.max(Number(item.quantity ?? 0), 1);
    for (let seq = 0; seq < quantity; seq += 1) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      const labelAmount =
        Number(item.mrp ?? 0) || Number(item.costPrice ?? 0);
      values.push(
        purchaseOrderId,
        itemIdx,
        item.itemName,
        item.sku || null,
        item.batchNumber || null,
        item.expiryDate ? new Date(item.expiryDate) : null,
        labelAmount,
        buildBarcodeValue(purchaseOrderId, itemIdx + 1, seq + 1)
      );
    }
  });

  await connection.query(
    `INSERT INTO purchase_order_barcodes (
      purchase_order_id,
      item_index,
      item_name,
      item_sku,
      batch_number,
      expiry_date,
      amount,
      barcode
    ) VALUES ${placeholders.join(', ')}`,
    values
  );

  return fetchPurchaseOrderBarcodes(purchaseOrderId);
};

const clearPurchaseOrderItems = async (connection, purchaseOrderId) => {
  await connection.query(
    `DELETE FROM purchase_order_items WHERE purchase_order_id = ?`,
    [purchaseOrderId]
  );
  await connection.query(
    `DELETE FROM purchase_order_barcodes WHERE purchase_order_id = ?`,
    [purchaseOrderId]
  );
};

export const createPurchaseOrder = async ({
  supplier,
  store,
  orderDate,
  expectedDeliveryDate,
  invoiceNumber,
  items = [],
  tax = 0,
  discount = 0,
  shipping = 0,
  partialPayment = 0,
  isCredit = false,
  notes = '',
  createdByUserId = null,
  createdByDisplayName = null,
}) => {
  await ensureTables();

  // Ensure purchase_order_items columns exist (migration) - runs before transaction
  await ensurePurchaseOrderItemsColumns();

  // Ensure is_credit column exists (migration)
  try {
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'purchase_orders' 
      AND COLUMN_NAME = 'is_credit'
    `);

    if (!columns || columns.length === 0) {
      await query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN is_credit BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log('✅ Added is_credit column to purchase_orders table');
    }
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.warn('Could not add is_credit column:', error.message);
    }
  }

  return transaction(async (connection) => {
    // Resolve store ID (can be number, string, or object with id/_id)
    let resolvedStoreId = null;
    if (store) {
      if (typeof store === 'object') {
        resolvedStoreId = store.id || store._id || null;
      } else {
        resolvedStoreId = store;
      }
      // Normalize to number if possible
      if (resolvedStoreId) {
        const numId = typeof resolvedStoreId === 'string' 
          ? Number.parseInt(resolvedStoreId, 10) 
          : Number(resolvedStoreId);
        resolvedStoreId = !Number.isNaN(numId) ? numId : resolvedStoreId;
      }
    }
    
    const poNumber = await generatePurchaseOrderNumber(connection, resolvedStoreId);
    const totalItems = Array.isArray(items) ? items.length : 0;
    const totalQuantity = Array.isArray(items)
      ? items.reduce((acc, item) => acc + Number(item.quantity ?? 0), 0)
      : 0;
    const subtotal = Array.isArray(items)
      ? items.reduce((acc, item) => acc + Number(item.total ?? 0), 0)
      : 0;
    const taxAmount = Number(tax ?? 0);
    const discountAmount = Number(discount ?? 0);
    const shippingAmount = Number(shipping ?? 0);
    const partialPaymentAmount = Number(partialPayment ?? 0);
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;
    const invoiceNum = normalizeInvoiceNumberForDb(invoiceNumber);
    const supplierNameForDb = (await resolveSupplierNameForDb(connection, supplier)) ?? null;

    // Enforce unique invoice number per store
    if (invoiceNum) {
      const [dupRows] = await connection.query(
        `SELECT id FROM purchase_orders WHERE store_id = ? AND invoice_number = ? LIMIT 1`,
        [store ?? null, invoiceNum]
      );
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        const err = new Error(`Invoice number "${invoiceNum}" already exists for this store.`);
        err.code = 'DUPLICATE_INVOICE_NUMBER';
        throw err;
      }
    }

    let createdByUid = null;
    if (createdByUserId != null && String(createdByUserId).trim() !== "") {
      const n = Number.parseInt(String(createdByUserId), 10);
      if (!Number.isNaN(n)) createdByUid = n;
    }
    const createdByDisp =
      createdByDisplayName != null && String(createdByDisplayName).trim() !== ""
        ? String(createdByDisplayName).trim().slice(0, 255)
        : null;

    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (
        po_number,
        supplier_id,
        supplier_name,
        store_id,
        order_date,
        expected_delivery_date,
        invoice_number,
        total_items,
        total_quantity,
        subtotal,
        discount,
        tax,
        shipping,
        total_amount,
        partial_payment,
        is_credit,
        status,
        created_by_user_id,
        created_by_display_name,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        supplier?.id ?? supplier?._id ?? supplier ?? null,
        supplierNameForDb,
        store ?? null,
        orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        invoiceNum,
        totalItems,
        totalQuantity,
        subtotal,
        discountAmount,
        taxAmount,
        shippingAmount,
        totalAmount,
        partialPaymentAmount,
        Boolean(isCredit),
        "created",
        createdByUid,
        createdByDisp,
        notes || null,
      ]
    );

    const purchaseOrderId = result.insertId;

    await insertPurchaseOrderItems(connection, purchaseOrderId, items);
    await insertBarcodes(connection, purchaseOrderId);

    // Update inventory for all items in the purchase order
    await updateInventoryForPO(connection, store, items);

    const [rows] = await connection.query(
      `SELECT *
       FROM purchase_orders
       WHERE id = ?`,
      [purchaseOrderId]
    );

    const purchaseOrder = mapPurchaseOrderRow(rows[0]);
    purchaseOrder.items = await fetchPurchaseOrderItems(purchaseOrderId);

    return purchaseOrder;
  });
};

export const updatePurchaseOrder = async (
  purchaseOrderId,
  {
    supplier,
    store,
    orderDate,
    expectedDeliveryDate,
    invoiceNumber,
    items = [],
    tax = 0,
    discount = 0,
    shipping = 0,
    partialPayment = 0,
    isCredit = false,
    notes = '',
    status,
  }
) => {
  await ensureTables();
  // Ensure columns exist before updating PO (runs every time, not cached)
  await ensurePurchaseOrderItemsColumns();

  // Ensure is_credit column exists (migration)
  try {
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'purchase_orders' 
      AND COLUMN_NAME = 'is_credit'
    `);

    if (!columns || columns.length === 0) {
      await query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN is_credit BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log('✅ Added is_credit column to purchase_orders table');
    }
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.warn('Could not add is_credit column:', error.message);
    }
  }

  return transaction(async (connection) => {
    const totalItems = Array.isArray(items) ? items.length : 0;
    const totalQuantity = Array.isArray(items)
      ? items.reduce((acc, item) => acc + Number(item.quantity ?? 0), 0)
      : 0;
    const subtotal = Array.isArray(items)
      ? items.reduce((acc, item) => acc + Number(item.total ?? 0), 0)
      : 0;
    const taxAmount = Number(tax ?? 0);
    const discountAmount = Number(discount ?? 0);
    const shippingAmount = Number(shipping ?? 0);
    const partialPaymentAmount = Number(partialPayment ?? 0);
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;
    const invoiceNum = normalizeInvoiceNumberForDb(invoiceNumber);
    const supplierNameForDb = (await resolveSupplierNameForDb(connection, supplier)) ?? null;

    // Enforce unique invoice number per store (exclude current PO)
    if (invoiceNum) {
      const [dupRows] = await connection.query(
        `SELECT id
         FROM purchase_orders
         WHERE store_id = ?
           AND invoice_number = ?
           AND id <> ?
         LIMIT 1`,
        [store ?? null, invoiceNum, purchaseOrderId]
      );
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        const err = new Error(`Invoice number "${invoiceNum}" already exists for this store.`);
        err.code = 'DUPLICATE_INVOICE_NUMBER';
        throw err;
      }
    }

    await connection.execute(
      `UPDATE purchase_orders
       SET supplier_id = ?,
           supplier_name = ?,
           store_id = ?,
           order_date = ?,
           expected_delivery_date = ?,
           invoice_number = ?,
           total_items = ?,
           total_quantity = ?,
           subtotal = ?,
           discount = ?,
           tax = ?,
           shipping = ?,
           total_amount = ?,
           partial_payment = ?,
           is_credit = ?,
           notes = ?,
           status = ?
       WHERE id = ?`,
      [
        supplier?.id ?? supplier?._id ?? supplier ?? null,
        supplierNameForDb,
        store ?? null,
        orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        invoiceNum,
        totalItems,
        totalQuantity,
        subtotal,
        discountAmount,
        taxAmount,
        shippingAmount,
        totalAmount,
        partialPaymentAmount,
        Boolean(isCredit),
        notes || null,
        status || 'created',
        purchaseOrderId,
      ]
    );

    await clearPurchaseOrderItems(connection, purchaseOrderId);
    await insertPurchaseOrderItems(connection, purchaseOrderId, items);
    await insertBarcodes(connection, purchaseOrderId);

    const [rows] = await connection.query(
      `SELECT *
       FROM purchase_orders
       WHERE id = ?`,
      [purchaseOrderId]
    );

    const purchaseOrder = mapPurchaseOrderRow(rows[0]);
    purchaseOrder.items = await fetchPurchaseOrderItems(purchaseOrderId);

    return purchaseOrder;
  });
};

const isPlainYmd = (raw) => {
  if (raw === undefined || raw === null) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim());
};

export const listPurchaseOrders = async (filters = {}) => {
  await ensureTables();

  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 10000);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (filters.storeId) {
    conditions.push('p.store_id = ?');
    params.push(filters.storeId);
  }

  if (filters.supplierId) {
    conditions.push('p.supplier_id = ?');
    params.push(filters.supplierId);
  }

  if (filters.status) {
    conditions.push('p.status = ?');
    params.push(filters.status);
  }

  if (filters.isCredit !== undefined) {
    // Filter by is_credit flag if provided
    conditions.push('p.is_credit = ?');
    params.push(filters.isCredit ? 1 : 0);
  }

  const startPlain = filters.startDate && isPlainYmd(filters.startDate) ? String(filters.startDate).trim() : null;
  const endPlain = filters.endDate && isPlainYmd(filters.endDate) ? String(filters.endDate).trim() : null;

  if (startPlain && endPlain) {
    conditions.push('DATE(p.order_date) BETWEEN ? AND ?');
    params.push(startPlain, endPlain);
  } else {
    if (filters.startDate) {
      const startDate = parseQueryableDateBound(filters.startDate, 'start');
      if (startDate) {
        conditions.push('p.order_date >= ?');
        params.push(startDate);
      }
    }

    if (filters.endDate) {
      const endDate = parseQueryableDateBound(filters.endDate, 'end');
      if (endDate) {
        conditions.push('p.order_date <= ?');
        params.push(endDate);
      }
    }
  }

  if (filters.search) {
    const like = `%${filters.search.trim()}%`;
    conditions.push(
      '(p.po_number LIKE ? OR p.supplier_name LIKE ? OR IFNULL(p.invoice_number, \'\') LIKE ?)'
    );
    params.push(like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const baseParams = params;

  const purchaseOrdersRows = await query(
    `SELECT *
     FROM purchase_orders p
     ${whereClause}
     ORDER BY p.order_date DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, limit, offset]
  );

  const enrichedRows = await enrichRowsWithSupplierNames(purchaseOrdersRows);

  const countRows = await query(
    `SELECT COUNT(*) AS totalItems
     FROM purchase_orders p
     ${whereClause}`,
    baseParams
  );

  const totalItems = countRows?.[0]?.totalItems ? Number(countRows[0].totalItems) : 0;

  return {
    purchaseOrders: enrichedRows.map(mapPurchaseOrderRow),
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
    },
  };
};

export const getPurchaseOrderById = async (purchaseOrderId) => {
  await ensureTables();
  const rows = await query(
    `SELECT *
     FROM purchase_orders
     WHERE id = ?
     LIMIT 1`,
    [purchaseOrderId]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const enriched = await enrichRowsWithSupplierNames(rows);
  const purchaseOrder = mapPurchaseOrderRow(enriched[0]);
  purchaseOrder.items = await fetchPurchaseOrderItems(purchaseOrderId);
  return purchaseOrder;
};

export const deletePurchaseOrder = async (purchaseOrderId) => {
  await ensureTables();
  const existing = await getPurchaseOrderById(purchaseOrderId);
  if (!existing) {
    return null;
  }

  await query(`DELETE FROM purchase_orders WHERE id = ?`, [purchaseOrderId]);
  return existing;
};

export const receivePurchaseOrder = async (purchaseOrderId) => {
  await ensureTables();
  await query(
    `UPDATE purchase_orders
     SET status = 'received', updated_at = NOW()
     WHERE id = ?`,
    [purchaseOrderId]
  );

  return getPurchaseOrderById(purchaseOrderId);
};

export const getPurchaseOrderBarcodes = async (purchaseOrderId) => {
  await ensureTables();

  const purchaseOrder = await getPurchaseOrderById(purchaseOrderId);
  if (!purchaseOrder) {
    return null;
  }

  const barcodeRows = await fetchPurchaseOrderBarcodes(purchaseOrderId);
  if (!barcodeRows || barcodeRows.length === 0) {
    await transaction(async (connection) => {
      await insertBarcodes(connection, purchaseOrderId);
    });
  }

  const finalBarcodes = await fetchPurchaseOrderBarcodes(purchaseOrderId);
  const grouped = new Map();

  finalBarcodes.forEach((row) => {
    const key = `${row.item_index}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        itemName: row.item_name,
        itemSku: row.item_sku,
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date,
        amount: Number(row.amount ?? 0),
        barcodes: [],
      });
    }
    grouped.get(key).barcodes.push({
      barcode: row.barcode,
    });
  });

  return {
    purchaseOrderId: purchaseOrder._id,
    purchaseOrderNumber: purchaseOrder.poNumber,
    groupedBarcodes: Array.from(grouped.values()),
  };
};

export const regeneratePurchaseOrderBarcodes = async (purchaseOrderId) => {
  await ensureTables();
  await transaction(async (connection) => {
    await connection.query(
      `DELETE FROM purchase_order_barcodes WHERE purchase_order_id = ?`,
      [purchaseOrderId]
    );
    await insertBarcodes(connection, purchaseOrderId);
  });

  return getPurchaseOrderBarcodes(purchaseOrderId);
};

