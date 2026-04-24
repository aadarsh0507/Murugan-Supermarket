import { query } from '../db/index.js';

/**
 * Ensures Purchase Orders tables exist.
 * This prevents runtime errors like:
 * "Table '<db>.purchase_orders' doesn't exist"
 */
export async function ensurePurchaseOrdersTables() {
  // purchase_orders first (referenced by FK constraints)
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
      CONSTRAINT fk_po_items_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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
      CONSTRAINT fk_po_barcodes_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Allow running as a standalone script: `npm run ensure-po-tables`
if (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, '/')}`) {
  ensurePurchaseOrdersTables()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('✅ Purchase Orders tables ensured');
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to ensure Purchase Orders tables:', err?.message ?? err);
      process.exit(1);
    });
}

