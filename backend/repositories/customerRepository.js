import { query } from '../db/index.js';

const CUSTOMERS_TABLE_CHECK_QUERY = `
  SELECT 1
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
  LIMIT 1
`;

const CREATE_CUSTOMERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    store_id BIGINT UNSIGNED NULL,
    name VARCHAR(100) NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    address VARCHAR(255) NULL,
    gstin VARCHAR(20) NULL,
    last_purchase_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY customers_store_phone_unique (store_id, phone),
    KEY customers_phone_idx (phone),
    KEY customers_store_idx (store_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let ensureCustomersTablePromise;

export const ensureCustomersTableExist = async () => {
  if (ensureCustomersTablePromise) return ensureCustomersTablePromise;
  ensureCustomersTablePromise = (async () => {
    const rows = await query(CUSTOMERS_TABLE_CHECK_QUERY);
    if (!Array.isArray(rows) || rows.length === 0) {
      await query(CREATE_CUSTOMERS_TABLE_SQL);
    }
  })().catch((err) => {
    ensureCustomersTablePromise = undefined;
    throw err;
  });
  return ensureCustomersTablePromise;
};

export const upsertCustomerByPhone = async ({
  storeId = null,
  name = null,
  phone,
  email = null,
  address = null,
  gstin = null,
  lastPurchaseAt = null
}) => {
  if (!phone) return null;
  await ensureCustomersTableExist();
  // Try update first
  const updateResult = await query(
    `UPDATE customers
     SET 
       name = COALESCE(?, name),
       email = COALESCE(?, email),
       address = COALESCE(?, address),
       gstin = COALESCE(?, gstin),
       last_purchase_at = COALESCE(?, last_purchase_at),
       updated_at = NOW()
     WHERE phone = ? AND (store_id <=> ?)`,
    [name, email, address, gstin, lastPurchaseAt, phone, storeId]
  );
  if (updateResult?.affectedRows > 0) {
    const [rows] = await query(
      `SELECT id, store_id, name, phone, email, address, gstin, last_purchase_at, created_at, updated_at
       FROM customers
       WHERE phone = ? AND (store_id <=> ?)
       LIMIT 1`,
      [phone, storeId]
    );
    return rows?.[0] ?? null;
  }
  // Insert if not exists
  const insert = await query(
    `INSERT INTO customers (store_id, name, phone, email, address, gstin, last_purchase_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [storeId, name, phone, email, address, gstin, lastPurchaseAt]
  );
  const [rows] = await query(
    `SELECT id, store_id, name, phone, email, address, gstin, last_purchase_at, created_at, updated_at
     FROM customers
     WHERE id = ?
     LIMIT 1`,
    [insert.insertId]
  );
  return rows?.[0] ?? null;
};

/** Normalized customer DTO for bills / POS (includes numeric DB id as customerId). */
export const customerRowToDto = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    customerId: row.id,
    storeId: row.store_id ?? null,
    customerName: row.name ?? null,
    customerPhone: row.phone,
    customerEmail: row.email ?? null,
    customerAddress: row.address ?? null,
    customerGstin: row.gstin ?? null,
    lastPurchaseOrderDate: row.last_purchase_at ?? null
  };
};

export const getCustomerByPhone = async (phone, storeId = null) => {
  if (!phone) return null;
  await ensureCustomersTableExist();
  const params = [phone];
  let storeFilter = '';
  if (storeId) {
    storeFilter = ' AND store_id = ?';
    params.push(storeId);
  }
  const rows = await query(
    `SELECT id, store_id, name, phone, email, address, gstin, last_purchase_at, created_at, updated_at
     FROM customers
     WHERE phone = ?${storeFilter}
     ORDER BY updated_at DESC
     LIMIT 1`,
    params
  );
  if (rows.length === 0) return null;
  return customerRowToDto(rows[0]);
};


