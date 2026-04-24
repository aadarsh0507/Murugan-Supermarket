import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { createItem as createItemRepo } from '../repositories/itemRepository.js';
import { query } from '../db/index.js';

const firstDefined = (...values) =>
  values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

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

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : undefined;
};

const normalizeSubcategoryId = (raw, fallbackCategory) => {
  const v = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!v) return undefined;
  if (v.includes(':')) return v;
  const cat = fallbackCategory === undefined || fallbackCategory === null ? '' : String(fallbackCategory).trim();
  return cat ? `${cat}:${v}` : v;
};

const mapCsvRowToItemPayload = (row) => {
  // Accept many possible column headers (case-insensitive, space/underscore/hyphen tolerant).
  const map = buildRowKeyMap(row);
  const get = (...keys) =>
    firstDefined(
      ...keys.map((k) => map.get(normalizeHeaderKey(k)))
    );

  const itemCode = get('itemCode', 'ItemCode', 'ProductCode', 'productCode', 'SKU', 'sku', 'code', 'Product Code');
  const name = get('name', 'Name', 'ProductName', 'productName', 'ProductFullName', 'Product Name');
  const barcode = get('barcode', 'Barcode', 'UniversalProductCode', 'universalProductCode', 'BarCodeDescription', 'Bar Code');
  const brand = get('brand', 'Brand', 'ManufacturerCode', 'manufacturerCode', 'BrandCode', 'brandCode');
  const categoryId = get('categoryId', 'CategoryCode', 'categoryCode', 'category', 'Category');
  const subcategoryIdRaw = get('subcategoryId', 'SubCategory', 'subCategory', 'subcategory', 'Sub Category');
  const unit = get('unit', 'UnitOfMeasure', 'uom', 'UOM', 'Unit');
  const description = get('description', 'UnitDescription', 'unitDescription', 'BulkDescription');
  const notes = get('notes', 'Remarks', 'remarks');
  const hsnCode = get('hsnCode', 'CommodityCode', 'commodityCode', 'hsn', 'HSN');
  const storeId = toNumber(get('storeId', 'store_id', 'StoreId', 'StoreID', 'store'));

  const costPrice = toNumber(get('costPrice', 'purchasePrice', 'PurchasePrice', 'CostPrice', 'Purchase Price'));
  const sellingPrice = toNumber(get('sellingPrice', 'salePrice', 'SalePrice', 'Price', 'price', 'Sale Price'));
  const mrp = toNumber(get('mrp', 'MRP'));
  const gstRate = toNumber(get('gstRate', 'GstRate', 'TaxAmount', 'tax', 'taxRate', 'GST'));
  const reorderLevel = toNumber(get('reorderLevel', 'ReorderLevel'));
  const minStock = toNumber(get('minStock', 'MinimumStockLevel', 'minimumStockLevel', 'MinStock'));
  const maxStock = toNumber(get('maxStock', 'MaximumStockLevel', 'maximumStockLevel', 'MaxStock'));
  const bogoOffer = get('bogoOffer', 'BogoOffer', 'bogo');

  const payload = {
    ...(itemCode !== undefined ? { itemCode: String(itemCode).trim() } : {}),
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(barcode !== undefined ? { barcode: String(barcode).trim() } : {}),
    ...(brand !== undefined ? { brand: String(brand).trim() } : {}),
    ...(categoryId !== undefined ? { categoryId: String(categoryId).trim() } : {}),
    ...(normalizeSubcategoryId(subcategoryIdRaw, categoryId) !== undefined
      ? { subcategoryId: normalizeSubcategoryId(subcategoryIdRaw, categoryId) }
      : {}),
    ...(unit !== undefined ? { unit: String(unit).trim() } : {}),
    ...(description !== undefined ? { description: String(description).trim() } : {}),
    ...(notes !== undefined ? { notes: String(notes).trim() } : {}),
    ...(hsnCode !== undefined ? { hsnCode: String(hsnCode).trim() } : {}),
    ...(storeId !== undefined ? { storeId } : {}),
    ...(costPrice !== undefined ? { costPrice } : {}),
    ...(sellingPrice !== undefined ? { sellingPrice } : {}),
    ...(mrp !== undefined ? { mrp } : {}),
    ...(gstRate !== undefined ? { gstRate } : {}),
    ...(reorderLevel !== undefined ? { reorderLevel } : {}),
    ...(minStock !== undefined ? { minStock } : {}),
    ...(maxStock !== undefined ? { maxStock } : {}),
    ...(bogoOffer !== undefined ? { bogoOffer: String(bogoOffer).trim() } : {}),
    isActive: true,
  };

  return payload;
};

const parseCsvBuffer = async (buffer) => {
  const rows = [];
  await new Promise((resolve, reject) => {
    Readable.from(buffer)
      .pipe(csvParser({ mapHeaders: ({ header }) => (header ? String(header).trim() : header) }))
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });
  return rows;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const sanitizeColumnName = (raw, fallback) => {
  const base = String(raw ?? '').trim();
  const cleaned = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (cleaned) return cleaned.slice(0, 64);
  return String(fallback ?? 'col').slice(0, 64);
};

const CSV_TO_DB_ALIASES = {
  // identity handled automatically by matching column name
  // common CSV headers → Products table column names
  productcode: 'ProductCode',
  itemcode: 'ProductCode',
  sku: 'ProductCode',
  code: 'ProductCode',

  productname: 'ProductName',
  name: 'ProductName',
  productfullname: 'ProductFullName',

  manufacturercode: 'ManufacturerCode',
  brand: 'ManufacturerCode',
  brandcode: 'BrandCode',

  categorycode: 'CategoryCode',
  categoryid: 'CategoryCode',

  subcategory: 'SubCategory',
  subcategoryid: 'SubCategory',
  subcategorycode: 'SubCategory',
  subcategoryname: 'SubCategory',

  unitofmeasure: 'UnitOfMeasure',
  unit: 'UnitOfMeasure',
  uom: 'UnitOfMeasure',

  unitdescription: 'UnitDescription',
  description: 'UnitDescription',
  bulkdescription: 'UnitDescription',

  universalproductcode: 'UniversalProductCode',
  barcode: 'UniversalProductCode',
  barcodedescription: 'BarCodeDescription',

  commoditycode: 'CommodityCode',
  hsn: 'CommodityCode',
  hsncode: 'CommodityCode',

  purchaseprice: 'PurchasePrice',
  costprice: 'PurchasePrice',
  saleprice: 'SalePrice',
  sellingprice: 'SalePrice',
  price: 'SalePrice',
  mrp: 'MRP',

  taxamount: 'TaxAmount',
  gstrate: 'TaxAmount',
  taxrate: 'TaxAmount',
  tax: 'TaxAmount',

  remarks: 'Remarks',
  notes: 'Remarks',

  storeid: 'store_id',
  store_id: 'store_id',
};

const sanitizeTargetTable = (raw) => {
  const name = String(raw ?? '').trim();
  if (!name) return 'Products';
  // Allow only letters, numbers, underscore. Prevent SQL injection via table name.
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    return 'Products';
  }
  return name;
};

const ensureTargetTableExists = async (tableName) => {
  // Create a new table that can accept full CSV schema (generic types).
  // Keep ProductCode as PRIMARY KEY so upsert works.
  await query(
    `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      ProductCode VARCHAR(100) NOT NULL,
      ProductName VARCHAR(255) NULL,
      ProductFullName VARCHAR(255) NULL,
      store_id BIGINT UNSIGNED NULL,
      csv_data JSON NULL,
      PRIMARY KEY (ProductCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
  `
  );
};

const ensureColumnsExist = async (tableName, columns = []) => {
  if (!Array.isArray(columns) || columns.length === 0) return;
  const existing = await query(
    `
    SELECT COLUMN_NAME AS name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `,
    [tableName]
  );
  const existingSet = new Set((existing || []).map((r) => String(r.name)));

  const guessColumnType = (col) => {
    // Prefer sane MySQL types for known Products schema columns.
    const c = String(col);
    const norm = c.toLowerCase();
    if (c === 'ProductCode') return null;
    if (c === 'ProductName') return 'VARCHAR(255) NULL';
    if (c === 'ProductFullName') return 'VARCHAR(255) NULL';
    if (norm === 'store_id') return 'BIGINT UNSIGNED NULL';
    if (norm.endsWith('date') || norm.endsWith('datetime')) return 'DATETIME NULL';
    if (norm.includes('price') || norm === 'mrp' || norm.includes('amount') || norm.includes('tax') || norm.includes('margin')) {
      return 'DECIMAL(12,2) NULL';
    }
    if (norm.includes('stock') || norm.includes('level') || norm.includes('quantity') || norm.includes('qty') || norm.includes('ratio')) {
      return 'INT NULL';
    }
    if (norm.startsWith('is') || norm.startsWith('allow') || norm.startsWith('donot') || norm.includes('applicable')) {
      return 'TINYINT(1) NULL';
    }
    // Default: store as TEXT so we never lose CSV fields
    return 'TEXT NULL';
  };

  for (const col of columns) {
    if (!col || existingSet.has(col)) continue;
    if (col === 'ProductCode') continue; // already created
    try {
      const typeDef = guessColumnType(col) || 'TEXT NULL';
      await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${typeDef}`);
      existingSet.add(col);
    } catch (e) {
      // Ignore duplicates; otherwise continue
      if (!String(e?.message || '').includes('Duplicate column')) {
        console.warn(`Failed adding column ${col} to ${tableName}:`, e?.message);
      }
    }
  }

  return existingSet;
};

const getProductsTableSchema = async (tableName = 'Products') => {
  const cols = await query(
    `
    SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `
    ,
    [tableName]
  );
  const byNorm = new Map();
  const byName = new Map();
  for (const c of cols || []) {
    const name = String(c.name);
    byName.set(name, { name, dataType: String(c.dataType || '').toLowerCase() });
    byNorm.set(normalizeHeaderKey(name), name);
  }
  return { byNorm, byName };
};

const resolveBatchSize = (req) => {
  const raw = req.query.batchSize ?? req.query.batch ?? process.env.CSV_IMPORT_BATCH_SIZE;
  const n = Number(raw);
  // Conservative default for remote DB; user can override via ?batchSize=...
  const fallback = 1500;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 100), 5000);
};

const resolveBulkOnly = (req) => {
  const raw = req.query.bulkOnly ?? req.query.bulk_only;
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(s);
};

const resolveAsJson = (req) => {
  const raw = req.query.asJson ?? req.query.as_json ?? req.query.json;
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(s);
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

const coerceValueForColumn = (value, colType) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') return null;
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'null') return null;

  const t = String(colType || '').toLowerCase();
  if (['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal', 'double', 'float'].includes(t)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (t === 'date') {
    // Expect YYYY-MM-DD or any Date-parsable string; store as YYYY-MM-DD
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (t === 'datetime' || t === 'timestamp') {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d; // mysql2 will serialize Date
  }
  return typeof raw === 'string' ? raw : String(raw);
};

const buildDynamicBulkUpsert = ({ tableName, columnsToInsert, columnsToUpdate }) => {
  const insertColsSql = columnsToInsert.map((c) => `\`${c}\``).join(', ');
  const placeholderCols = [...columnsToInsert];
  const placeholders = `(${placeholderCols.map(() => '?').join(', ')})`;
  const updateSql = columnsToUpdate
    .map((c) =>
      c === 'ModifiedDate'
        ? '`ModifiedDate` = COALESCE(VALUES(`ModifiedDate`), NOW())'
        : `\`${c}\` = VALUES(\`${c}\`)`
    )
    .join(', ');

  return {
    placeholderCols,
    sql: (rowCount) => `
      INSERT INTO \`${tableName}\` (${insertColsSql})
      VALUES ${Array.from({ length: rowCount }).map(() => placeholders).join(', ')}
      ON DUPLICATE KEY UPDATE ${updateSql}
    `,
  };
};

const resolveProductCodeStrategy = async () => {
  const info = await query(
    `
    SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Products'
      AND COLUMN_NAME = 'ProductCode'
    LIMIT 1
  `
  );
  const dataType = info?.[0]?.dataType ? String(info[0].dataType).toUpperCase() : '';
  const columnType = info?.[0]?.columnType ? String(info[0].columnType).toUpperCase() : '';
  const isNumeric = ['INT', 'BIGINT', 'INTEGER', 'SMALLINT', 'MEDIUMINT', 'TINYINT'].includes(dataType) || columnType.includes('INT');

  if (!isNumeric) {
    return { kind: 'string' };
  }

  const maxRows = await query(
    `SELECT MAX(CAST(ProductCode AS UNSIGNED)) AS maxCode
     FROM Products
     WHERE ProductCode REGEXP '^[0-9]+$'`
  );
  const maxCode = Number(maxRows?.[0]?.maxCode ?? 0) || 0;
  return { kind: 'numeric', next: maxCode + 1 };
};

const detectOptionalColumns = async () => {
  const cols = await query(
    `
    SELECT COLUMN_NAME AS name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Products'
      AND COLUMN_NAME IN ('store_id', 'BrandCode')
  `
  );
  const set = new Set((cols || []).map((c) => String(c.name)));
  return {
    hasStoreId: set.has('store_id'),
    hasBrandCode: set.has('BrandCode'),
  };
};

const buildBulkUpsertSql = ({ hasStoreId, hasBrandCode }) => {
  const columns = [
    'ProductCode',
    'ProductName',
    'ProductFullName',
    hasBrandCode ? 'BrandCode' : 'ManufacturerCode',
    'CategoryCode',
    'SubCategory',
    'UnitOfMeasure',
    'UnitDescription',
    'MRP',
    'PurchasePrice',
    'SalePrice',
    'MinimumStockLevel',
    'ReorderLevel',
    'UniversalProductCode',
    'BarCodeDescription',
    'CommodityCode',
    'TaxAmount',
    'Remarks',
    ...(hasStoreId ? ['store_id'] : []),
    'CreationDate',
    'ModifiedDate',
    'TotalStock',
  ];

  // Last 3 columns are computed (NOW/NOW/0), so they don't take placeholders.
  const placeholderCols = columns.slice(0, columns.length - 3);
  const placeholders = `(${placeholderCols.map(() => '?').join(', ')}, NOW(), NOW(), 0)`;

  // Upsert: keep TotalStock as-is; update business fields + ModifiedDate.
  const updateCols = columns
    .filter((c) => !['ProductCode', 'CreationDate', 'TotalStock'].includes(c))
    .map((c) => (c === 'ModifiedDate' ? 'ModifiedDate = NOW()' : `${c} = VALUES(${c})`));

  return {
    columns,
    placeholders,
    placeholderCols,
    sql: (rowCount) => `
      INSERT INTO Products (${columns.join(', ')})
      VALUES ${Array.from({ length: rowCount }).map(() => placeholders).join(', ')}
      ON DUPLICATE KEY UPDATE ${updateCols.join(', ')}
    `,
  };
};

const subcategoryCodeFromComposite = (subcategoryId) => {
  if (subcategoryId === undefined || subcategoryId === null) return null;
  const s = String(subcategoryId).trim();
  if (!s) return null;
  if (!s.includes(':')) return s;
  const parts = s.split(':');
  const code = parts.slice(1).join(':').trim();
  return code || null;
};

export const importProductsCsv = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        status: 'error',
        message: 'CSV file is required (form-data key: file).',
      });
    }

    const failed = [];
    const modeRaw = String(req.query.mode ?? req.query.importMode ?? '').trim().toLowerCase();
    const mode = modeRaw === 'items' ? 'items' : 'products';

    // If items table exists, reuse existing logic (safe). Bulk insert is only for Products table.
    const itemsTable = await query(
      `
      SELECT 1 AS ok
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
      LIMIT 1
    `
    );
    const itemsTableExists = Array.isArray(itemsTable) && itemsTable.length > 0;

    if (itemsTableExists && mode === 'items') {
      const rows = await parseCsvBuffer(req.file.buffer);
      if (!rows.length) {
        return res.status(400).json({
          status: 'error',
          message: 'CSV is empty or unreadable.',
        });
      }
      let createdCount = 0;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const payload = mapCsvRowToItemPayload(row);
        const line = i + 2;
        if (!payload.name) {
          failed.push({ line, reason: 'Missing required column: name/ProductName', row });
          continue;
        }
        try {
          await createItemRepo(payload);
          createdCount += 1;
        } catch (error) {
          failed.push({
            line,
            reason: error?.message || 'Insert failed',
            code: error?.code,
            row,
          });
        }
      }

      return res.status(200).json({
        status: 'success',
        message: 'CSV import completed (items table mode).',
        data: {
          totalRows: rows.length,
          createdCount,
          failedCount: failed.length,
          failed: failed.slice(0, 50),
        },
      });
    }

    const targetTable = sanitizeTargetTable(req.query.targetTable ?? req.query.table ?? 'Products');
    await ensureTargetTableExists(targetTable);

    // Faster streaming bulk upsert into target table (schema-driven).
    const schema = await getProductsTableSchema(targetTable);
    const productCodeStrategy = await resolveProductCodeStrategy();
    const bulkOnly = resolveBulkOnly(req);
    const asJson = resolveAsJson(req);
    const batchSize = resolveBatchSize(req);
    const unmappedHeaders = new Set();

    let columnsToInsert = null;
    let bulk = null;
    let processedRows = 0;
    let upsertedCount = 0;
    let headerMapped = false;

    // For streaming flush
    let batch = [];
    let batchValues = [];

    const flushBatch = async () => {
      if (!bulk || batch.length === 0) return;
      try {
        await query(bulk.sql(batch.length), batchValues);
        upsertedCount += batch.length;
      } catch (error) {
        if (bulkOnly) {
          for (const entry of batch) {
            failed.push({
              line: entry.line,
              reason: error?.message || 'Bulk insert failed',
              row: entry.row,
            });
          }
        } else {
          // Fall back row-by-row for just this batch to isolate bad rows.
          for (const entry of batch) {
            try {
              const payload = mapCsvRowToItemPayload(entry.row);
              if (!payload.name) throw new Error('Missing required column: name/ProductName');
              await createItemRepo(payload);
              upsertedCount += 1;
            } catch (rowErr) {
              failed.push({
                line: entry.line,
                reason: rowErr?.message || error?.message || 'Insert failed',
                code: rowErr?.code,
                row: entry.row,
              });
            }
          }
        }
      } finally {
        batch = [];
        batchValues = [];
      }
    };

    const startedAt = Date.now();
    const stream = Readable.from(req.file.buffer).pipe(
      csvParser({ mapHeaders: ({ header }) => (header ? String(header).trim() : header) })
    );

    // Use async iteration for speed (avoid pause/resume per row).
    for await (const row of stream) {
      processedRows += 1;
      const line = processedRows + 1; // header line is 1

      if (!headerMapped) {
        // Build mapping: every CSV header -> a DB column name (create missing columns).
        const rawHeaders = Object.keys(row || {}).map((k) => String(k ?? '').trim()).filter(Boolean);
        const usedCols = new Set();
        const headerMappings = [];

        for (let idx = 0; idx < rawHeaders.length; idx += 1) {
          const original = rawHeaders[idx];
          const norm = normalizeHeaderKey(original);
          if (!norm) continue;
          const aliasTarget = CSV_TO_DB_ALIASES[norm];
          const directTarget = schema.byNorm.get(norm);
          const preferred = aliasTarget || directTarget || original;
          let dbCol = sanitizeColumnName(preferred, `col_${idx + 1}`);
          // Ensure unique column names
          let suffix = 1;
          while (usedCols.has(dbCol)) {
            suffix += 1;
            dbCol = sanitizeColumnName(`${dbCol}_${suffix}`, `col_${idx + 1}_${suffix}`);
          }
          usedCols.add(dbCol);
          headerMappings.push({ norm, original, dbCol });
        }

        const matchedDbCols = new Set(headerMappings.map((h) => h.dbCol));
        // Ensure essential columns exist in insert set.
        matchedDbCols.add('ProductCode');
        matchedDbCols.add('ProductName');
        matchedDbCols.add('ProductFullName');
        ['CreationDate', 'ModifiedDate', 'TotalStock'].forEach((c) => matchedDbCols.add(c));

        columnsToInsert = Array.from(matchedDbCols);

        // Ensure the target table has all columns we intend to write
        await ensureColumnsExist(targetTable, columnsToInsert);
        // Refresh schema after adding columns so type coercion can work where possible.
        const refreshed = await getProductsTableSchema(targetTable);
        schema.byName = refreshed.byName;
        schema.byNorm = refreshed.byNorm;

        // IMPORTANT: Only keep columns that actually exist (some ALTERs may fail due to row-size limits).
        columnsToInsert = columnsToInsert.filter((c) => schema.byName.has(c));

        const columnsToUpdate = columnsToInsert
          .filter((c) => !['ProductCode', 'CreationDate', 'TotalStock'].includes(c))
          .concat(schema.byName.has('ModifiedDate') ? ['ModifiedDate'] : []);
        bulk = buildDynamicBulkUpsert({
          tableName: targetTable,
          columnsToInsert,
          columnsToUpdate: Array.from(new Set(columnsToUpdate)),
        });
        headerMapped = true;
        // Save mapping in closure for row processing
        importProductsCsv.__headerMappings = headerMappings;
        // If JSON mode is requested, we additionally store raw CSV per row in Products_extra (or csv_data for custom tables).
        if (asJson) {
          await ensureColumnsExist(targetTable, ['csv_data']);
          const refreshed2 = await getProductsTableSchema(targetTable);
          schema.byName = refreshed2.byName;
          schema.byNorm = refreshed2.byNorm;
        }
      }

      const rowMap = buildRowKeyMap(row);
      const getRaw = (key) => rowMap.get(normalizeHeaderKey(key));

      let productCode = firstDefined(getRaw('ProductCode'), getRaw('itemCode'), getRaw('sku'), getRaw('code'));
      const productName = firstDefined(getRaw('ProductName'), getRaw('name'));

      if (!productName) {
        failed.push({ line, reason: 'Missing required column: ProductName/name', row });
        continue;
      }

      if (!productCode) {
        if (productCodeStrategy.kind === 'numeric') {
          productCode = String(productCodeStrategy.next);
          productCodeStrategy.next += 1;
        } else {
          productCode = `CSV_${Date.now()}_${processedRows}`;
        }
      }

      const record = new Map();
      record.set('ProductCode', String(productCode).trim());
      record.set('ProductName', String(productName).trim());

      const fullName = firstDefined(getRaw('ProductFullName'), getRaw('ProductName'), getRaw('name'));
      record.set('ProductFullName', String(fullName ?? productName).trim());

      const storeIdRaw = getRaw('store_id') ?? getRaw('storeId') ?? getRaw('StoreId') ?? getRaw('StoreID');
      const storeId = toNumber(storeIdRaw);
      if (storeId !== undefined) {
        record.set('store_id', storeId);
      }

      if (asJson) {
        if (schema.byName.has('csv_data')) {
          record.set('csv_data', JSON.stringify(normalizeNullStringsDeep(row)));
        }
      }

      // Option 3: enforce CreationDate/ModifiedDate defaults during import.
      // If CSV has CreationDate/ModifiedDate but it's blank/NULL, use current time.
      // If CSV doesn't have these columns, but DB expects them, still set a default.
      if (schema.byName.has('CreationDate')) {
        const rawCreation = rowMap.get(normalizeHeaderKey('CreationDate'));
        const creationIsNullLike =
          rawCreation === undefined ||
          rawCreation === null ||
          String(rawCreation).trim() === '' ||
          String(rawCreation).trim().toLowerCase() === 'null';
        record.set(
          'CreationDate',
          creationIsNullLike ? new Date() : coerceValueForColumn(rawCreation, 'datetime')
        );
      }
      if (schema.byName.has('ModifiedDate')) {
        const rawModified = rowMap.get(normalizeHeaderKey('ModifiedDate'));
        const modifiedIsNullLike =
          rawModified === undefined ||
          rawModified === null ||
          String(rawModified).trim() === '' ||
          String(rawModified).trim().toLowerCase() === 'null';
        record.set(
          'ModifiedDate',
          modifiedIsNullLike ? new Date() : coerceValueForColumn(rawModified, 'datetime')
        );
      }
      if (schema.byName.has('TotalStock') && !record.has('TotalStock')) {
        record.set('TotalStock', 0);
      }

      // Always map CSV columns into table columns (Products/custom table),
      // regardless of JSON mode (JSON mode just adds raw-row storage).
      const headerMappings = importProductsCsv.__headerMappings || [];
      for (const { norm, dbCol } of headerMappings) {
        const rawValue = rowMap.get(norm);
        if (rawValue === undefined) continue;
        if (dbCol === 'SubCategory') {
          const normalized = normalizeSubcategoryId(rawValue, getRaw('CategoryCode') ?? getRaw('categoryId'));
          record.set('SubCategory', subcategoryCodeFromComposite(normalized));
          continue;
        }
        const colType = schema.byName.get(dbCol)?.dataType;
        record.set(dbCol, coerceValueForColumn(rawValue, colType));
      }

      batch.push({ line, row });
      for (const c of bulk.placeholderCols) {
        batchValues.push(record.has(c) ? record.get(c) : null);
      }

      if (batch.length >= batchSize) {
        await flushBatch();
      }
    }

    await flushBatch();

    const elapsedMs = Date.now() - startedAt;

    return res.status(200).json({
      status: 'success',
      message: 'CSV import completed.',
      data: {
        totalRows: processedRows,
        createdCount: upsertedCount,
        failedCount: failed.length,
        failed: failed.slice(0, 50),
        unmappedHeaders: asJson ? [] : Array.from(unmappedHeaders).slice(0, 50),
        batchSize,
        elapsedMs,
        targetTable,
        asJson,
      },
    });
  } catch (error) {
    console.error('CSV import error:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Failed to import CSV.',
    });
  }
};

