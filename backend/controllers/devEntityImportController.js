import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { query } from '../db/index.js';
import { ensureCustomersTableExist } from '../repositories/customerRepository.js';

const normalizeHeaderKey = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '');

const buildRowKeyMap = (row) => {
  const map = new Map();
  if (!row || typeof row !== 'object') return map;
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    if (!nk) continue;
    map.set(nk, v);
  }
  return map;
};

const firstDefined = (...values) =>
  values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
};

const normalizeNullStringsDeep = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.toLowerCase() === 'null') return null;
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeNullStringsDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeNullStringsDeep(v);
    return out;
  }
  return value;
};

const resolveBatchSize = (req, fallback = 3000) => {
  const raw = req.query.batchSize ?? req.query.batch ?? process.env.CSV_IMPORT_BATCH_SIZE;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 100), 5000);
};

const ensureSuppliersExtraTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS Suppliers_extra (
      Suppliercode VARCHAR(100) NOT NULL,
      store_id BIGINT UNSIGNED NULL,
      extra_data JSON NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (Suppliercode),
      KEY idx_suppliers_extra_store (store_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
  `);
};

const ensureCustomersExtraTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS customers_extra (
      store_id BIGINT UNSIGNED NULL,
      phone VARCHAR(20) NOT NULL,
      extra_data JSON NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (phone, store_id),
      KEY idx_customers_extra_store (store_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
  `);
};

const ensureCategoryExtraTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS Category_extra (
      CategoryCode VARCHAR(100) NOT NULL,
      store_id BIGINT UNSIGNED NULL,
      extra_data JSON NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (CategoryCode, store_id),
      KEY idx_category_extra_store (store_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
  `);
};

export const importSuppliersCsv = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ status: 'error', message: 'CSV file is required (form-data key: file).' });
    }
    await ensureSuppliersExtraTable();

    const batchSize = resolveBatchSize(req, 3000);
    const stream = Readable.from(req.file.buffer).pipe(csvParser({ mapHeaders: ({ header }) => (header ? String(header).trim() : header) }));

    let processed = 0;
    let upserted = 0;
    const failed = [];

    let batchValues = [];
    let batchCount = 0;

    const flush = async () => {
      if (batchCount === 0) return;
      await query(
        `INSERT INTO Suppliers_extra (Suppliercode, store_id, extra_data)
         VALUES ${Array.from({ length: batchCount }).map(() => '(?, ?, ?)').join(', ')}
         ON DUPLICATE KEY UPDATE store_id = VALUES(store_id), extra_data = VALUES(extra_data), updated_at = CURRENT_TIMESTAMP`,
        batchValues
      );
      upserted += batchCount;
      batchValues = [];
      batchCount = 0;
    };

    for await (const row of stream) {
      processed += 1;
      const line = processed + 1;
      const map = buildRowKeyMap(row);

      const supplierCode = firstDefined(map.get('suppliercode'), map.get('supplier_code'), map.get('supplierid'), map.get('id'));
      const storeId = toNumber(firstDefined(map.get('store_id'), map.get('storeid'), map.get('store')));

      if (!supplierCode) {
        failed.push({ line, reason: 'Missing suppliercode', row });
        continue;
      }

      batchValues.push(String(supplierCode).trim(), storeId ?? null, JSON.stringify(normalizeNullStringsDeep(row)));
      batchCount += 1;
      if (batchCount >= batchSize) {
        await flush();
      }
    }
    await flush();

    return res.json({
      status: 'success',
      message: 'Suppliers CSV import completed.',
      data: { totalRows: processed, createdCount: upserted, failedCount: failed.length, failed: failed.slice(0, 50), batchSize }
    });
  } catch (error) {
    console.error('Suppliers CSV import error:', error);
    return res.status(500).json({ status: 'error', message: error?.message || 'Failed to import suppliers CSV.' });
  }
};

export const importCustomersCsv = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ status: 'error', message: 'CSV file is required (form-data key: file).' });
    }
    await ensureCustomersTableExist();
    await ensureCustomersExtraTable();

    const batchSize = resolveBatchSize(req, 3000);
    const stream = Readable.from(req.file.buffer).pipe(csvParser({ mapHeaders: ({ header }) => (header ? String(header).trim() : header) }));

    let processed = 0;
    let upserted = 0;
    const failed = [];

    let mainValues = [];
    let mainCount = 0;
    let extraValues = [];
    let extraCount = 0;

    const flush = async () => {
      if (mainCount > 0) {
        await query(
          `INSERT INTO customers (store_id, name, phone, email, address, gstin, last_purchase_at, created_at, updated_at)
           VALUES ${Array.from({ length: mainCount }).map(() => '(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ')}
           ON DUPLICATE KEY UPDATE
             name = COALESCE(VALUES(name), name),
             email = COALESCE(VALUES(email), email),
             address = COALESCE(VALUES(address), address),
             gstin = COALESCE(VALUES(gstin), gstin),
             last_purchase_at = COALESCE(VALUES(last_purchase_at), last_purchase_at),
             updated_at = NOW()`,
          mainValues
        );
        upserted += mainCount;
        mainValues = [];
        mainCount = 0;
      }
      if (extraCount > 0) {
        await query(
          `INSERT INTO customers_extra (store_id, phone, extra_data)
           VALUES ${Array.from({ length: extraCount }).map(() => '(?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE extra_data = VALUES(extra_data), updated_at = CURRENT_TIMESTAMP`,
          extraValues
        );
        extraValues = [];
        extraCount = 0;
      }
    };

    for await (const row of stream) {
      processed += 1;
      const line = processed + 1;
      const map = buildRowKeyMap(row);

      const phone = firstDefined(map.get('phone'), map.get('customerphone'), map.get('mobilenumber'), map.get('mobile'));
      if (!phone) {
        failed.push({ line, reason: 'Missing phone', row });
        continue;
      }
      const storeId = toNumber(firstDefined(map.get('store_id'), map.get('storeid'), map.get('store')));
      const name = firstDefined(map.get('name'), map.get('customername'));
      const email = firstDefined(map.get('email'));
      const address = firstDefined(map.get('address'));
      const gstin = firstDefined(map.get('gstin'), map.get('gstnumber'));
      const lastPurchaseAt = firstDefined(map.get('last_purchase_at'), map.get('lastpurchaseat'));

      mainValues.push(storeId ?? null, name ?? null, String(phone).trim(), email ?? null, address ?? null, gstin ?? null, lastPurchaseAt ?? null);
      mainCount += 1;

      extraValues.push(storeId ?? null, String(phone).trim(), JSON.stringify(normalizeNullStringsDeep(row)));
      extraCount += 1;

      if (mainCount >= batchSize) {
        await flush();
      }
    }
    await flush();

    return res.json({
      status: 'success',
      message: 'Customers CSV import completed.',
      data: { totalRows: processed, createdCount: upserted, failedCount: failed.length, failed: failed.slice(0, 50), batchSize }
    });
  } catch (error) {
    console.error('Customers CSV import error:', error);
    return res.status(500).json({ status: 'error', message: error?.message || 'Failed to import customers CSV.' });
  }
};

export const importCategoriesCsv = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ status: 'error', message: 'CSV file is required (form-data key: file).' });
    }
    await ensureCategoryExtraTable();

    // Ensure Category table exists (legacy)
    await query(`
      CREATE TABLE IF NOT EXISTS Category (
        CategoryCode VARCHAR(100) NOT NULL,
        Description TEXT NULL,
        store_id BIGINT UNSIGNED NULL,
        IsActive INT NULL,
        PRIMARY KEY (CategoryCode),
        KEY idx_store_id (store_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const batchSize = resolveBatchSize(req, 3000);
    const stream = Readable.from(req.file.buffer).pipe(csvParser({ mapHeaders: ({ header }) => (header ? String(header).trim() : header) }));

    let processed = 0;
    let upserted = 0;
    const failed = [];

    let mainValues = [];
    let mainCount = 0;
    let extraValues = [];
    let extraCount = 0;

    const flush = async () => {
      if (mainCount > 0) {
        await query(
          `INSERT INTO Category (CategoryCode, Description, store_id, IsActive)
           VALUES ${Array.from({ length: mainCount }).map(() => '(?, ?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE
             Description = COALESCE(VALUES(Description), Description),
             store_id = COALESCE(VALUES(store_id), store_id),
             IsActive = COALESCE(VALUES(IsActive), IsActive)`,
          mainValues
        );
        upserted += mainCount;
        mainValues = [];
        mainCount = 0;
      }
      if (extraCount > 0) {
        await query(
          `INSERT INTO Category_extra (CategoryCode, store_id, extra_data)
           VALUES ${Array.from({ length: extraCount }).map(() => '(?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE extra_data = VALUES(extra_data), updated_at = CURRENT_TIMESTAMP`,
          extraValues
        );
        extraValues = [];
        extraCount = 0;
      }
    };

    for await (const row of stream) {
      processed += 1;
      const line = processed + 1;
      const map = buildRowKeyMap(row);

      const categoryCode = firstDefined(map.get('categorycode'), map.get('code'), map.get('id'));
      const description = firstDefined(map.get('description'), map.get('name'));
      const storeId = toNumber(firstDefined(map.get('store_id'), map.get('storeid'), map.get('store')));
      const isActiveRaw = firstDefined(map.get('isactive'), map.get('active'));
      const isActive =
        isActiveRaw === undefined || isActiveRaw === null
          ? 1
          : ['0', 'false', 'no'].includes(String(isActiveRaw).trim().toLowerCase())
            ? 0
            : 1;

      if (!categoryCode) {
        failed.push({ line, reason: 'Missing CategoryCode', row });
        continue;
      }

      mainValues.push(String(categoryCode).trim(), description ?? null, storeId ?? null, isActive);
      mainCount += 1;
      extraValues.push(String(categoryCode).trim(), storeId ?? null, JSON.stringify(normalizeNullStringsDeep(row)));
      extraCount += 1;

      if (mainCount >= batchSize) {
        await flush();
      }
    }
    await flush();

    return res.json({
      status: 'success',
      message: 'Categories CSV import completed.',
      data: { totalRows: processed, createdCount: upserted, failedCount: failed.length, failed: failed.slice(0, 50), batchSize }
    });
  } catch (error) {
    console.error('Categories CSV import error:', error);
    return res.status(500).json({ status: 'error', message: error?.message || 'Failed to import categories CSV.' });
  }
};

