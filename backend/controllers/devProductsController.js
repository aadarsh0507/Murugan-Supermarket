import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { createItem as createItemRepo } from '../repositories/itemRepository.js';
import { query } from '../db/index.js';

const firstDefined = (...values) =>
  values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');

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
  // Accept many possible column headers (case-insensitive-ish by trying variants).
  const itemCode = firstDefined(row.itemCode, row.ItemCode, row.ProductCode, row.productCode, row.SKU, row.sku);
  const name = firstDefined(row.name, row.Name, row.ProductName, row.productName, row.ProductFullName);
  const barcode = firstDefined(row.barcode, row.Barcode, row.UniversalProductCode, row.universalProductCode, row.BarCodeDescription);
  const brand = firstDefined(row.brand, row.Brand, row.ManufacturerCode, row.manufacturerCode, row.BrandCode, row.brandCode);
  const categoryId = firstDefined(row.categoryId, row.CategoryCode, row.categoryCode, row.category);
  const subcategoryIdRaw = firstDefined(row.subcategoryId, row.SubCategory, row.subCategory, row.subcategory);
  const unit = firstDefined(row.unit, row.UnitOfMeasure, row.uom, row.UOM);
  const description = firstDefined(row.description, row.UnitDescription, row.unitDescription, row.BulkDescription);
  const notes = firstDefined(row.notes, row.Remarks, row.remarks);
  const hsnCode = firstDefined(row.hsnCode, row.CommodityCode, row.commodityCode, row.hsn);
  const storeId = toNumber(firstDefined(row.storeId, row.store_id, row.StoreId, row.StoreID));

  const costPrice = toNumber(firstDefined(row.costPrice, row.purchasePrice, row.PurchasePrice, row.CostPrice));
  const sellingPrice = toNumber(firstDefined(row.sellingPrice, row.salePrice, row.SalePrice, row.Price, row.price));
  const mrp = toNumber(firstDefined(row.mrp, row.MRP));
  const gstRate = toNumber(firstDefined(row.gstRate, row.GstRate, row.TaxAmount, row.tax, row.taxRate));
  const reorderLevel = toNumber(firstDefined(row.reorderLevel, row.ReorderLevel));
  const minStock = toNumber(firstDefined(row.minStock, row.MinimumStockLevel, row.minimumStockLevel));
  const maxStock = toNumber(firstDefined(row.maxStock, row.MaximumStockLevel, row.maximumStockLevel));
  const bogoOffer = firstDefined(row.bogoOffer, row.BogoOffer, row.bogo);

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

const getProductsTableSchema = async () => {
  const cols = await query(
    `
    SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Products'
  `
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

const coerceValueForColumn = (value, colType) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') return null;

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

const buildDynamicBulkUpsert = ({ columnsToInsert, columnsToUpdate }) => {
  const insertColsSql = columnsToInsert.map((c) => `\`${c}\``).join(', ');
  const placeholderCols = columnsToInsert.filter((c) => !['CreationDate', 'ModifiedDate', 'TotalStock'].includes(c));
  const placeholders = `(${placeholderCols.map(() => '?').join(', ')}, NOW(), NOW(), 0)`;
  const updateSql = columnsToUpdate
    .map((c) => (c === 'ModifiedDate' ? '`ModifiedDate` = NOW()' : `\`${c}\` = VALUES(\`${c}\`)`))
    .join(', ');

  return {
    placeholderCols,
    sql: (rowCount) => `
      INSERT INTO Products (${insertColsSql})
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

    if (itemsTableExists) {
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

    // Faster streaming bulk upsert into Products table (schema-driven).
    const schema = await getProductsTableSchema();
    const productCodeStrategy = await resolveProductCodeStrategy();
    const bulkOnly = resolveBulkOnly(req);
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
        const normalizedCsvHeaders = new Set(Object.keys(row || {}).map((k) => normalizeHeaderKey(k)));
        const matchedDbCols = new Set();

        for (const h of normalizedCsvHeaders) {
          if (!h) continue;
          const aliasTarget = CSV_TO_DB_ALIASES[h];
          const directTarget = schema.byNorm.get(h);
          const target = aliasTarget || directTarget || null;
          if (target && schema.byName.has(target)) {
            matchedDbCols.add(target);
          } else {
            unmappedHeaders.add(h);
          }
        }

        matchedDbCols.add('ProductCode');
        if (schema.byName.has('ProductName')) matchedDbCols.add('ProductName');
        if (schema.byName.has('ProductFullName')) matchedDbCols.add('ProductFullName');
        ['CreationDate', 'ModifiedDate', 'TotalStock'].forEach((c) => {
          if (schema.byName.has(c)) matchedDbCols.add(c);
        });

        columnsToInsert = Array.from(matchedDbCols);
        const columnsToUpdate = columnsToInsert
          .filter((c) => !['ProductCode', 'CreationDate', 'TotalStock'].includes(c))
          .concat(schema.byName.has('ModifiedDate') ? ['ModifiedDate'] : []);
        bulk = buildDynamicBulkUpsert({
          columnsToInsert,
          columnsToUpdate: Array.from(new Set(columnsToUpdate)),
        });
        headerMapped = true;
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

      if (schema.byName.has('ProductFullName')) {
        const fullName = firstDefined(getRaw('ProductFullName'), getRaw('ProductName'), getRaw('name'));
        record.set('ProductFullName', String(fullName ?? productName).trim());
      }

      for (const dbCol of columnsToInsert) {
        if (['ProductCode', 'ProductName', 'ProductFullName', 'CreationDate', 'ModifiedDate', 'TotalStock'].includes(dbCol)) {
          continue;
        }

        let rawValue = getRaw(dbCol);
        if (rawValue === undefined) {
          for (const [csvKeyNorm, target] of Object.entries(CSV_TO_DB_ALIASES)) {
            if (target === dbCol) {
              const v = rowMap.get(csvKeyNorm);
              if (v !== undefined) {
                rawValue = v;
                break;
              }
            }
          }
        }
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
        if (c === 'CreationDate' || c === 'ModifiedDate' || c === 'TotalStock') continue;
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
        unmappedHeaders: Array.from(unmappedHeaders).slice(0, 50),
        batchSize,
        elapsedMs,
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

