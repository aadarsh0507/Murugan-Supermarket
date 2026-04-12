import { query } from '../db/index.js';

const toNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

let itemsTableExistsCache = null;
let overridesTableEnsured = false;
let itemsTableColumnsEnsured = false;

const ensureItemsTableColumns = async () => {
  if (itemsTableColumnsEnsured) {
    return;
  }

  try {
    const requiredColumns = [
      {
        name: 'min_stock',
        definition: 'INT UNSIGNED NOT NULL DEFAULT 0',
        after: 'reorder_level'
      },
      {
        name: 'max_stock',
        definition: 'INT UNSIGNED NOT NULL DEFAULT 0',
        after: 'min_stock'
      },
      {
        name: 'bogo_offer',
        definition: 'VARCHAR(255) NULL',
        after: 'notes'
      }
    ];

    for (const column of requiredColumns) {
      const existingColumn = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'items' 
           AND COLUMN_NAME = ?`,
        [column.name]
      );

      if (!Array.isArray(existingColumn) || existingColumn.length === 0) {
        const afterClause = column.after ? `AFTER ${column.after}` : '';
        await query(
          `ALTER TABLE items 
           ADD COLUMN ${column.name} ${column.definition} ${afterClause}`
        );
      }
    }
  } catch (error) {
    console.warn('Failed to ensure items table columns:', error);
    // Continue even if migration fails; future operations will attempt again
    return;
  }

  itemsTableColumnsEnsured = true;
};

const ensureOverridesTable = async () => {
  if (overridesTableEnsured) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS item_overrides (
      product_code VARCHAR(100) PRIMARY KEY,
      sku VARCHAR(100) NULL,
      name VARCHAR(255) NULL,
      price DECIMAL(12, 2) NULL,
      description TEXT NULL,
      image_url VARCHAR(255) NULL,
      image_file_name VARCHAR(255) NULL,
      min_stock INT NULL,
      max_stock INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure new columns exist for legacy tables
  const columns = await query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'item_overrides'
      AND COLUMN_NAME IN ('min_stock', 'max_stock')
  `);
  const existingCols = new Set(columns.map((col) => col.COLUMN_NAME));
  if (!existingCols.has('min_stock')) {
    await query(`ALTER TABLE item_overrides ADD COLUMN min_stock INT NULL`);
  }
  if (!existingCols.has('max_stock')) {
    await query(`ALTER TABLE item_overrides ADD COLUMN max_stock INT NULL`);
  }

  const bogoCol = await query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'item_overrides'
      AND COLUMN_NAME = 'bogo_offer'
  `);
  if (!bogoCol.length) {
    await query(`ALTER TABLE item_overrides ADD COLUMN bogo_offer VARCHAR(255) NULL`);
  }

  const storeIdOverrideCol = await query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'item_overrides'
      AND COLUMN_NAME = 'store_id'
  `);
  if (!storeIdOverrideCol.length) {
    try {
      await query(`
        ALTER TABLE item_overrides
        ADD COLUMN store_id BIGINT UNSIGNED NOT NULL DEFAULT 0
        COMMENT '0=legacy global; use stores.id for per-store overrides'
        AFTER product_code
      `);
    } catch (error) {
      console.warn('item_overrides store_id column:', error.message);
    }
  }

  try {
    const pkRows = await query(`
      SELECT COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'item_overrides'
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
    `);
    const pkCols = pkRows.map((r) => r.COLUMN_NAME);
    if (pkCols.length === 1 && pkCols[0] === 'product_code') {
      await query('ALTER TABLE item_overrides DROP PRIMARY KEY');
      await query(
        'ALTER TABLE item_overrides ADD PRIMARY KEY (product_code, store_id)'
      );
    }
  } catch (error) {
    console.warn('item_overrides composite PK migration:', error.message);
  }

  overridesTableEnsured = true;
};

/** 0 = legacy / global row; >0 matches stores.id for scoped item_overrides */
const resolveOverrideStoreId = (storeId) => {
  const n = Number(storeId);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const buildPlaceholders = (values = []) => {
  return values.map(() => '?').join(', ');
};

const upsertItemOverride = async (productCode, updates = {}, overrideStoreId = 0) => {
  if (!productCode || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    return;
  }

  await ensureOverridesTable();

  const storeIdVal = resolveOverrideStoreId(overrideStoreId);
  const columns = ['product_code', 'store_id'];
  const placeholders = ['?', '?'];
  const values = [productCode, storeIdVal];
  const updateAssignments = [];

  const addField = (column, value) => {
    columns.push(column);
    placeholders.push('?');
    values.push(value);
    updateAssignments.push(`${column} = VALUES(${column})`);
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'sku')) {
    addField('sku', updates.sku ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    addField('name', updates.name ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'price')) {
    addField('price', updates.price ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    addField('description', updates.description ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'imageUrl')) {
    addField('image_url', updates.imageUrl ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'imageFileName')) {
    addField('image_file_name', updates.imageFileName ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'minStock')) {
    addField('min_stock', updates.minStock ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'maxStock')) {
    addField('max_stock', updates.maxStock ?? null);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'bogoOffer')) {
    addField('bogo_offer', updates.bogoOffer ?? null);
  }

  if (columns.length <= 2) {
    return;
  }

  const sql = `
    INSERT INTO item_overrides (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON DUPLICATE KEY UPDATE ${updateAssignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
  `;

  await query(sql, values);
};

const fetchOverridesForCodes = async (productCodes = [], storeId = undefined) => {
  if (!productCodes || productCodes.length === 0) {
    return new Map();
  }

  await ensureOverridesTable();

  const storeIdNum = Number(storeId);
  const hasStore =
    storeId !== undefined && storeId !== null && storeId !== '' && Number.isFinite(storeIdNum) && storeIdNum > 0;

  const selectCols =
    'product_code, store_id, sku, name, price, description, image_url, image_file_name, min_stock, max_stock, bogo_offer';

  let rows = [];
  if (hasStore) {
    rows = await query(
      `SELECT ${selectCols}
       FROM item_overrides
       WHERE product_code IN (${buildPlaceholders(productCodes)}) AND store_id = ?`,
      [...productCodes, storeIdNum]
    );
    const have = new Set(rows.map((r) => String(r.product_code)));
    const missing = productCodes.filter((c) => !have.has(String(c)));
    if (missing.length > 0) {
      const legacy = await query(
        `SELECT ${selectCols}
         FROM item_overrides
         WHERE product_code IN (${buildPlaceholders(missing)}) AND store_id = 0`,
        missing
      );
      rows = rows.concat(legacy);
    }
  } else {
    rows = await query(
      `SELECT ${selectCols}
       FROM item_overrides
       WHERE product_code IN (${buildPlaceholders(productCodes)}) AND store_id = 0`,
      productCodes
    );
  }

  const overridesMap = new Map();
  for (const row of rows) {
    const key = String(row.product_code);
    if (overridesMap.has(key)) {
      continue;
    }
    const entry = {
      sku: row.sku ?? null,
      name: row.name ?? null,
      price: row.price !== null ? Number(row.price) : null,
      description: row.description ?? null,
      imageUrl: row.image_url ?? null,
      imageFileName: row.image_file_name ?? null,
      minStock: row.min_stock !== null ? Number(row.min_stock) : null,
      maxStock: row.max_stock !== null ? Number(row.max_stock) : null
    };
    if (row.bogo_offer != null && String(row.bogo_offer).trim() !== '') {
      entry.bogoOffer = String(row.bogo_offer).trim();
    }
    overridesMap.set(key, entry);
  }
  return overridesMap;
};

const applyOverrideToItem = (item, override) => {
  if (!override) {
    return item;
  }

  return {
    ...item,
    ...(override.name !== null && override.name !== undefined ? { name: override.name } : {}),
    ...(override.sku !== null && override.sku !== undefined ? { sku: override.sku } : {}),
    ...(override.price !== null && override.price !== undefined
      ? { price: override.price, sellingPrice: override.price }
      : {}),
    ...(override.description !== null && override.description !== undefined
      ? { description: override.description }
      : {}),
    ...(override.imageUrl !== null && override.imageUrl !== undefined
      ? { imageUrl: override.imageUrl }
      : {}),
    ...(override.imageFileName !== null && override.imageFileName !== undefined
      ? { imageFileName: override.imageFileName }
      : {}),
    ...(override.stock !== null && override.stock !== undefined
      ? { stock: override.stock }
      : {}),
    ...(override.minStock !== null && override.minStock !== undefined
      ? { minStock: Number(override.minStock) }
      : {}),
    ...(override.maxStock !== null && override.maxStock !== undefined
      ? { maxStock: Number(override.maxStock) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(override, 'bogoOffer')
      ? { bogoOffer: override.bogoOffer }
      : {})
  };
};

const findOverrideProductCodeBySku = async (sku) => {
  if (!sku) {
    return null;
  }

  await ensureOverridesTable();
  const rows = await query(
    `SELECT product_code
     FROM item_overrides
     WHERE sku = ?
     LIMIT 1`,
    [sku]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0].product_code;
};

const checkItemsTableExists = async () => {
  if (itemsTableExistsCache !== null) {
    if (itemsTableExistsCache) {
      await ensureItemsTableColumns();
    }
    return itemsTableExistsCache;
  }

  try {
    await query('SELECT 1 FROM items LIMIT 1');
    itemsTableExistsCache = true;
    await ensureItemsTableColumns();
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      itemsTableExistsCache = false;
    } else {
      throw error;
    }
  }

  return itemsTableExistsCache;
};

const mapItem = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    itemCode: row.item_code,
    sku: row.item_code,
    name: row.name,
    description: row.description,
    brand: row.brand,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    unit: row.unit,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    price: Number(row.selling_price ?? 0),
    mrp: Number(row.mrp ?? 0),
    reorderLevel: Number(row.reorder_level ?? 0),
    gstRate: Number(row.gst_rate ?? 0),
    hsnCode: row.hsn_code,
    barcode: row.barcode,
    notes: row.notes,
    bogoOffer: row.bogo_offer != null && String(row.bogo_offer).trim() !== ''
      ? String(row.bogo_offer).trim()
      : null,
    isActive: row.is_active === 1 || row.is_active === true,
    minStock: Number(row.min_stock ?? row.reorder_level ?? 0),
    maxStock: Number(row.max_stock ?? 0),
    stock: Number(row.stock ?? row.quantity ?? 0),
    storeId:
      row.store_id != null && row.store_id !== ""
        ? (Number.isFinite(Number(row.store_id)) ? Number(row.store_id) : null)
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapProduct = (row) => {
  if (!row) return null;
  
  // Reconstruct composite subcategoryId format (categoryCode:subcategoryCode) for frontend compatibility
  // The Products table stores just the subcategory code, but frontend expects "categoryCode:subcategoryCode"
  let subcategoryId = null;
  if (row.SubCategory && row.SubCategory !== null && String(row.SubCategory).trim() !== '') {
    const categoryCode = row.CategoryCode ? String(row.CategoryCode).trim() : null;
    const subcategoryCode = String(row.SubCategory).trim();
    
    if (categoryCode && subcategoryCode) {
      // Construct composite format: "categoryCode:subcategoryCode"
      subcategoryId = `${categoryCode}:${subcategoryCode}`;
    } else if (subcategoryCode) {
      // If no category but has subcategory, use just the subcategory code
      subcategoryId = subcategoryCode;
    }
  }
  
  return {
    id: row.ProductCode ?? row.productCode ?? null,
    itemCode: row.ProductCode !== undefined && row.ProductCode !== null
      ? String(row.ProductCode)
      : row.ProductCode ?? null,
    sku: row.ProductCode !== undefined && row.ProductCode !== null ? String(row.ProductCode) : null,
    name: row.ProductName ?? row.ProductFullName ?? '',
    description: row.UnitDescription ?? row.BulkDescription ?? null,
    brand: row.ManufacturerCode ?? null,
    categoryId: row.CategoryCode ?? null,
    subcategoryId: subcategoryId,
    unit: row.UnitOfMeasure ?? null,
    costPrice: toNumber(row['PurchasePrice']),
    sellingPrice: toNumber(row.SalePrice ?? row.MRP),
    price: toNumber(row.SalePrice ?? row.MRP),
    mrp: toNumber(row.MRP ?? row.SalePrice),
    reorderLevel: toNumber(row.MinimumStockLevel ?? row.ReorderLevel),
    gstRate: toNumber(row.DerivedGstRate ?? row.TaxAmount ?? row.TaxId),
    hsnCode: row.CommodityCode ?? null,
    hsnId: row.HSNId ?? null,
    barcode: row.UniversalProductCode ?? row.BarCodeDescription ?? null,
    notes: row.Remarks ?? null,
    minStock: toNumber(row.MinimumStockLevel ?? row.ReorderLevel),
    maxStock: toNumber(row.MaximumStockLevel ?? row.MinimumStockLevel ?? 0),
    stock: (() => {
      const totalStockRaw = toNumber(row.TotalStock, 0);
      const hasTotalStockValue = row.TotalStock !== undefined && row.TotalStock !== null;
      const stockReceivedRaw =
        row.StockReceived !== undefined && row.StockReceived !== null
          ? toNumber(row.StockReceived, 0)
          : null;

      if (hasTotalStockValue && totalStockRaw !== 0) {
        return totalStockRaw;
      }

      if (stockReceivedRaw !== null && stockReceivedRaw !== 0) {
        return stockReceivedRaw;
      }

      return totalStockRaw;
    })(),
    isActive: true,
    createdAt: row.CreationDate ?? null,
    updatedAt: row.ModifiedDate ?? null
  };
};

const listItemsFromItemsTable = async ({
  search,
  categoryId,
  subcategoryId,
  isActive,
  storeId,
  limit = 50,
  offset = 0
} = {}) => {
  const filters = [];
  const params = [];

  if (search) {
    filters.push('(i.name LIKE ? OR i.item_code LIKE ? OR i.barcode LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (categoryId) {
    filters.push('i.category_id = ?');
    params.push(categoryId);
  }

  if (subcategoryId) {
    filters.push('i.subcategory_id = ?');
    params.push(subcategoryId);
  }

  if (isActive !== undefined) {
    filters.push('i.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (storeId !== undefined && storeId !== null) {
    // Check if store_id column exists in items table
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'items'
      AND COLUMN_NAME = 'store_id'
    `);
    
    if (storeIdColumnCheck.length > 0) {
      filters.push('i.store_id = ?');
      params.push(storeId);
    }
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await query(
    `SELECT i.id, i.item_code, i.name, i.description, i.brand, i.category_id, i.subcategory_id,
            i.unit, i.cost_price, i.selling_price,
            COALESCE(NULLIF(i.mrp, 0), P.MRP, 0) AS mrp,
            i.reorder_level, i.min_stock, i.max_stock,
            i.gst_rate, i.hsn_code, i.barcode, i.notes, i.bogo_offer, i.is_active,
            i.store_id, i.created_at, i.updated_at
     FROM items i
     LEFT JOIN Products P ON P.ProductCode = i.item_code
     ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countWhere = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM items i ${countWhere}`,
    params
  );

  const codes = [
    ...new Set(
      rows
        .map((row) => String(row.item_code ?? '').trim())
        .filter((c) => c.length > 0)
    )
  ];
  const overrides = await fetchOverridesForCodes(codes, storeId);

  return {
    items: rows.map((row) => {
      const baseItem = mapItem(row);
      const override = overrides.get(String(baseItem.itemCode ?? baseItem.id ?? ''));
      return applyOverrideToItem(baseItem, override);
    }),
    total: countRows[0]?.total || 0
  };
};

const listItemsFromProductsTable = async ({
  search,
  categoryId,
  subcategoryId,
  storeId,
  limit = 50,
  offset = 0
} = {}) => {
  const filters = [];
  const params = [];

  // Check if Products table has store_id column
  let hasStoreIdColumn = false;
  try {
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Products'
      AND COLUMN_NAME = 'store_id'
    `);
    hasStoreIdColumn = storeIdColumnCheck.length > 0;
  } catch (error) {
    console.warn('Error checking for store_id column in Products table:', error);
  }

  // Add store_id filter if column exists and storeId is provided
  if (hasStoreIdColumn && storeId !== undefined && storeId !== null) {
    filters.push('store_id = ?');
    params.push(storeId);
  }

  if (search) {
    const searchLike = `%${search}%`;
    const overrideRows = await query(
      `SELECT product_code
       FROM item_overrides
       WHERE (sku LIKE ? OR name LIKE ?)
         AND product_code IS NOT NULL`,
      [searchLike, searchLike]
    );

    const overrideCodes = overrideRows
      .map((row) => row.product_code)
      .filter((code) => code !== null && code !== undefined)
      .map((code) => String(code));

    const searchConditions = [
      'ProductName LIKE ?',
      'ProductFullName LIKE ?',
      'ProductCode LIKE ?',
      'UniversalProductCode LIKE ?',
      'BarCodeDescription LIKE ?'
    ];

    params.push(searchLike, searchLike, searchLike, searchLike, searchLike);

    if (overrideCodes.length > 0) {
      searchConditions.push(`ProductCode IN (${buildPlaceholders(overrideCodes)})`);
      params.push(...overrideCodes);
    }

    filters.push(`(${searchConditions.join(' OR ')})`);
  }

  if (categoryId) {
    filters.push('CategoryCode = ?');
    params.push(String(categoryId));
  }

  if (subcategoryId) {
    filters.push('SubCategory = ?');
    params.push(String(subcategoryId));
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await query(
    `SELECT ProductCode AS ProductCode, ProductName, ProductFullName, ManufacturerCode, CategoryCode, SubCategory,
            UnitOfMeasure, UnitDescription, MRP, PurchasePrice, SalePrice,
            MinimumStockLevel, ReorderLevel, UniversalProductCode, BarCodeDescription,
            Remarks, CreationDate, ModifiedDate, CommodityCode, HSNId, TaxAmount, TaxId,
            COALESCE(
              NULLIF(Products.TaxAmount, 0),
              (SELECT CAST(REGEXP_SUBSTR(t.Description, '[0-9]+') AS DECIMAL(5,2))
                 FROM Tax t WHERE t.Taxcode = Products.TaxId LIMIT 1),
              0
            ) AS DerivedGstRate,
            TotalStock
     FROM Products
     ${whereClause}
     ORDER BY ProductName ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM Products ${whereClause}`,
    params
  );

  const productCodes = rows
    .map((row) => row.ProductCode ?? row.productCode ?? null)
    .filter((code) => code !== null && code !== undefined)
    .map((code) => String(code));

  const overrides = await fetchOverridesForCodes(productCodes, storeId);

  // Build a map of subcategory to category for items that have subcategory but no category
  const subcategoryToCategoryMap = new Map();
  const itemsWithSubcategoryButNoCategory = rows.filter(row =>
    (!row.CategoryCode || String(row.CategoryCode).trim() === '') &&
    row.SubCategory && String(row.SubCategory).trim() !== ''
  );

  if (itemsWithSubcategoryButNoCategory.length > 0) {
    const uniqueSubcategories = [...new Set(
      itemsWithSubcategoryButNoCategory
        .map(row => String(row.SubCategory).trim())
        .filter(sub => sub && sub.length > 0)
    )];

    // Find which category each subcategory belongs to
    for (const subcategory of uniqueSubcategories) {
      const categoryRows = await query(
        `SELECT DISTINCT TRIM(CategoryCode) AS categoryCode
         FROM Products
         WHERE TRIM(SubCategory) = ? AND CategoryCode IS NOT NULL AND TRIM(CategoryCode) <> ''
         LIMIT 1`,
        [subcategory]
      );

      if (categoryRows.length > 0 && categoryRows[0].categoryCode) {
        subcategoryToCategoryMap.set(subcategory, String(categoryRows[0].categoryCode).trim());
      }
    }
  }

  const items = rows.map((row) => {
    const baseItem = mapProduct(row);

    // If item has no category but has subcategory, try to find category from subcategory
    if ((!baseItem.categoryId || String(baseItem.categoryId).trim() === '') &&
      baseItem.subcategoryId && String(baseItem.subcategoryId).trim() !== '') {
      const foundCategoryId = subcategoryToCategoryMap.get(String(baseItem.subcategoryId).trim());
      if (foundCategoryId) {
        baseItem.categoryId = foundCategoryId;
      }
    }

    const override = overrides.get(String(baseItem.itemCode ?? baseItem.id ?? ''));
    return applyOverrideToItem(baseItem, override);
  });

  return {
    items,
    total: countRows[0]?.total || 0
  };
};

const getItemByIdFromItemsTable = async (itemId, storeId = undefined) => {
  const rows = await query(
    `SELECT i.id, i.item_code, i.name, i.description, i.brand, i.category_id, i.subcategory_id,
            i.unit, i.cost_price, i.selling_price,
            COALESCE(NULLIF(i.mrp, 0), P.MRP, 0) AS mrp,
            i.reorder_level, i.min_stock, i.max_stock,
            i.gst_rate, i.hsn_code, i.barcode, i.notes, i.bogo_offer, i.is_active,
            i.store_id, i.created_at, i.updated_at
     FROM items i
     LEFT JOIN Products P ON P.ProductCode = i.item_code
     WHERE i.id = ?
     LIMIT 1`,
    [itemId]
  );

  if (rows.length === 0) return null;
  const baseItem = mapItem(rows[0]);
  const code = String(baseItem.itemCode ?? baseItem.id ?? itemId);
  const fetchStore =
    storeId !== undefined && storeId !== null && storeId !== ''
      ? Number(storeId)
      : baseItem.storeId != null
        ? Number(baseItem.storeId)
        : undefined;
  const overrides = await fetchOverridesForCodes(
    [code],
    Number.isFinite(fetchStore) && fetchStore > 0 ? fetchStore : undefined
  );
  return applyOverrideToItem(baseItem, overrides.get(code));
};

const getItemByIdFromProductsTable = async (itemId, storeId = undefined) => {
  const rows = await query(
    `SELECT ProductCode AS ProductCode, ProductName, ProductFullName, ManufacturerCode, CategoryCode, SubCategory,
            UnitOfMeasure, UnitDescription, MRP, PurchasePrice, SalePrice,
            MinimumStockLevel, ReorderLevel, UniversalProductCode, BarCodeDescription,
            Remarks, CreationDate, ModifiedDate, CommodityCode, HSNId, TaxAmount, TaxId,
            COALESCE(
              NULLIF(Products.TaxAmount, 0),
              (SELECT CAST(REGEXP_SUBSTR(t.Description, '[0-9]+') AS DECIMAL(5,2))
                 FROM Tax t WHERE t.Taxcode = Products.TaxId LIMIT 1),
              0
            ) AS DerivedGstRate,
            TotalStock,
            store_id
     FROM Products
     WHERE ProductCode = ? OR UniversalProductCode = ?
     LIMIT 1`,
    [itemId, itemId]
  );

  if (rows.length === 0) return null;
  const baseItem = mapProduct(rows[0]);
  const code = String(baseItem.itemCode ?? baseItem.id ?? itemId);
  const pStore = rows[0].store_id != null ? Number(rows[0].store_id) : undefined;
  const fetchStore =
    storeId !== undefined && storeId !== null && storeId !== ''
      ? Number(storeId)
      : Number.isFinite(pStore) && pStore > 0
        ? pStore
        : undefined;
  const overrides = await fetchOverridesForCodes(
    [code],
    Number.isFinite(fetchStore) && fetchStore > 0 ? fetchStore : undefined
  );
  return applyOverrideToItem(baseItem, overrides.get(code));
};

const findItemByBarcodeInItemsTable = async (barcodeOrCode, storeId = undefined) => {
  const rows = await query(
    `SELECT i.id, i.item_code, i.name, i.description, i.brand, i.category_id, i.subcategory_id,
            i.unit, i.cost_price, i.selling_price,
            COALESCE(NULLIF(i.mrp, 0), P.MRP, 0) AS mrp,
            i.reorder_level, i.min_stock, i.max_stock,
            i.gst_rate, i.hsn_code, i.barcode, i.notes, i.bogo_offer, i.is_active,
            i.store_id, i.created_at, i.updated_at
     FROM items i
     LEFT JOIN Products P ON P.ProductCode = i.item_code
     WHERE i.barcode = ? OR i.item_code = ?
     LIMIT 1`,
    [barcodeOrCode, barcodeOrCode]
  );

  if (rows.length === 0) return null;
  const baseItem = mapItem(rows[0]);
  const code = String(baseItem.itemCode ?? baseItem.id ?? barcodeOrCode);
  const fetchStore =
    storeId !== undefined && storeId !== null && storeId !== ''
      ? Number(storeId)
      : baseItem.storeId != null
        ? Number(baseItem.storeId)
        : undefined;
  const overrides = await fetchOverridesForCodes(
    [code],
    Number.isFinite(fetchStore) && fetchStore > 0 ? fetchStore : undefined
  );
  return applyOverrideToItem(baseItem, overrides.get(code));
};

const findItemByBarcodeInProductsTable = async (barcodeOrCode, storeId = undefined) => {
  const rows = await query(
    `SELECT ProductCode AS ProductCode, ProductName, ProductFullName, ManufacturerCode, CategoryCode, SubCategory,
            UnitOfMeasure, UnitDescription, MRP, PurchasePrice, SalePrice,
            MinimumStockLevel, ReorderLevel, UniversalProductCode, BarCodeDescription,
            Remarks, CreationDate, ModifiedDate, CommodityCode, HSNId, TaxAmount, TaxId,
            COALESCE(
              NULLIF(Products.TaxAmount, 0),
              (SELECT CAST(REGEXP_SUBSTR(t.Description, '[0-9]+') AS DECIMAL(5,2))
                 FROM Tax t WHERE t.Taxcode = Products.TaxId LIMIT 1),
              0
            ) AS DerivedGstRate,
            TotalStock,
            store_id
     FROM Products
     WHERE UniversalProductCode = ? OR BarCodeDescription = ? OR ProductCode = ?
     LIMIT 1`,
    [barcodeOrCode, barcodeOrCode, barcodeOrCode]
  );

  if (rows.length === 0) return null;
  const baseItem = mapProduct(rows[0]);
  const code = String(baseItem.itemCode ?? baseItem.id ?? barcodeOrCode);
  const pStore = rows[0].store_id != null ? Number(rows[0].store_id) : undefined;
  const fetchStore =
    storeId !== undefined && storeId !== null && storeId !== ''
      ? Number(storeId)
      : Number.isFinite(pStore) && pStore > 0
        ? pStore
        : undefined;
  const overrides = await fetchOverridesForCodes(
    [code],
    Number.isFinite(fetchStore) && fetchStore > 0 ? fetchStore : undefined
  );
  return applyOverrideToItem(baseItem, overrides.get(code));
};

export const listItems = async (options = {}) => {
  if (await checkItemsTableExists()) {
    return listItemsFromItemsTable(options);
  }
  return listItemsFromProductsTable(options);
};

export const getItemById = async (itemId, storeId = undefined) => {
  if (await checkItemsTableExists()) {
    return getItemByIdFromItemsTable(itemId, storeId);
  }
  return getItemByIdFromProductsTable(itemId, storeId);
};

const generateProductCode = async () => {
  try {
    // Check if ProductCode column is numeric or varchar
    const columnInfo = await query(`
      SELECT DATA_TYPE, COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Products'
        AND COLUMN_NAME = 'ProductCode'
      LIMIT 1
    `);
    
    if (columnInfo.length === 0) {
      // Fallback: assume varchar and generate from timestamp
      return `PROD_${Date.now()}`;
    }
    
    const dataType = columnInfo[0].DATA_TYPE?.toUpperCase();
    const columnType = columnInfo[0].COLUMN_TYPE?.toUpperCase() || '';
    
    if (dataType === 'INT' || dataType === 'BIGINT' || dataType === 'INTEGER' || columnType.includes('INT')) {
      // Numeric ProductCode - get MAX and add 1
      const maxResult = await query('SELECT MAX(CAST(ProductCode AS UNSIGNED)) as maxCode FROM Products WHERE ProductCode REGEXP \'^[0-9]+$\'');
      const maxCode = maxResult[0]?.maxCode || 0;
      return String(Number(maxCode) + 1);
    } else {
      // VARCHAR ProductCode - generate from timestamp with counter
      let counter = 1;
      while (counter < 1000) {
        const code = `PROD_${Date.now()}_${counter}`;
        const existing = await query('SELECT ProductCode FROM Products WHERE ProductCode = ? LIMIT 1', [code]);
        if (existing.length === 0) {
          return code;
        }
        counter++;
      }
      // Fallback if we can't find unique code
      return `PROD_${Date.now()}`;
    }
  } catch (error) {
    console.error('Error generating ProductCode:', error);
    // Fallback to timestamp-based code
    return `PROD_${Date.now()}`;
  }
};

export const createItem = async (itemData) => {
  const {
    itemCode,
    name,
    description,
    brand,
    categoryId,
    subcategoryId,
    unit,
    costPrice,
    sellingPrice,
    mrp,
    reorderLevel,
    minStock,
    maxStock,
    gstRate,
    hsnCode,
    barcode,
    notes,
    bogoOffer,
    isActive = true,
    storeId
  } = itemData;
  const normalizedBogo =
    bogoOffer === null || bogoOffer === undefined || bogoOffer === ''
      ? null
      : String(bogoOffer).trim() || null;
  const normalizedMinStock = Number.isFinite(Number(minStock)) ? Number(minStock) : 0;
  const normalizedMaxStock = Number.isFinite(Number(maxStock)) ? Number(maxStock) : 0;

  // Check if items table exists
  const itemsTableExists = await checkItemsTableExists();
  
  if (!itemsTableExists) {
    // Create item in Products table
    if (!name || !name.trim()) {
      const error = new Error('Item name is required');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // Generate ProductCode if not provided
    let productCode = itemCode;
    if (!productCode || !productCode.trim()) {
      productCode = await generateProductCode();
    } else {
      // Check if ProductCode already exists
      const existing = await query('SELECT ProductCode FROM Products WHERE ProductCode = ? LIMIT 1', [productCode]);
      if (existing.length > 0) {
        const error = new Error(`Product with code ${productCode} already exists`);
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
    }

    // Check if Products table has store_id column
    let hasStoreIdColumnInProducts = false;
    try {
      const storeIdColumnCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Products'
        AND COLUMN_NAME = 'store_id'
      `);
      hasStoreIdColumnInProducts = storeIdColumnCheck.length > 0;
    } catch (error) {
      console.warn('Error checking for store_id column in Products table:', error);
    }

    // Ensure store_inventory table exists
    try {
      await query(`
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
    } catch (tableError) {
      // Table might already exist, ignore error
      console.warn('store_inventory table creation:', tableError.message);
    }

    // Check if BrandCode column exists in Products table
    let hasBrandCodeColumn = false;
    try {
      const brandCodeColumnCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Products'
        AND COLUMN_NAME = 'BrandCode'
      `);
      hasBrandCodeColumn = brandCodeColumnCheck.length > 0;
    } catch (error) {
      console.warn('Error checking for BrandCode column in Products table:', error);
    }

    // Build INSERT statement for Products table
    let insertColumns = [
      'ProductCode', 'ProductName', 'ProductFullName', 'CategoryCode', 'SubCategory',
      'UnitOfMeasure', 'UnitDescription', 'MRP', 'PurchasePrice', 'SalePrice',
      'MinimumStockLevel', 'ReorderLevel', 'UniversalProductCode', 'BarCodeDescription',
      'CommodityCode', 'TaxAmount', 'Remarks'
    ];
    
    // Add brand column - prefer BrandCode if available, otherwise ManufacturerCode
    if (hasBrandCodeColumn) {
      insertColumns.splice(3, 0, 'BrandCode'); // Insert after ProductFullName
    } else {
      insertColumns.splice(3, 0, 'ManufacturerCode'); // Insert after ProductFullName
    }
    // Extract subcategory code from composite ID (format: "categoryCode:subcategoryCode")
    let subcategoryCode = null;
    if (subcategoryId && subcategoryId !== '' && subcategoryId !== null && subcategoryId !== undefined) {
      const subcategoryStr = String(subcategoryId).trim();
      if (subcategoryStr && subcategoryStr !== '') {
        if (subcategoryStr.includes(':')) {
          // Extract code part after the colon (e.g., "51:34" -> "34" or "51:SUB001" -> "SUB001")
          const parts = subcategoryStr.split(':');
          if (parts.length > 1) {
            subcategoryCode = parts.slice(1).join(':').trim();
          }
        } else {
          // Use as-is if no colon separator
          subcategoryCode = subcategoryStr;
        }
        // Only use if not empty after extraction
        if (subcategoryCode === '' || subcategoryCode === 'null' || subcategoryCode === 'undefined') {
          subcategoryCode = null;
        }
      }
    }

    // Handle brand - if brandId is provided, use it as brandCode, otherwise use brand string
    let brandCode = null;
    if (itemData.brandId !== undefined && itemData.brandId !== null && itemData.brandId !== '') {
      brandCode = String(itemData.brandId).trim();
    } else if (brand) {
      brandCode = brand.trim() || null;
    }

    let insertValues = [
      productCode,
      name.trim(),
      name.trim(),
      brandCode || null,
      categoryId ? String(categoryId) : null,
      subcategoryCode,
      unit || null,
      description || null,
      mrp || 0,
      costPrice || 0,
      sellingPrice || 0,
      normalizedMinStock || reorderLevel || 0,
      reorderLevel || normalizedMinStock || 0,
      barcode || null,
      barcode || null,
      hsnCode || null,
      gstRate || 0,
      notes || null
    ];

    // Add store_id to INSERT if column exists and storeId is provided
    if (hasStoreIdColumnInProducts && storeId) {
      insertColumns.push('store_id');
      insertValues.push(storeId);
    }

    // Add date columns and placeholders
    insertColumns.push('CreationDate', 'ModifiedDate', 'TotalStock');
    const placeholders = insertValues.map(() => '?').join(', ') + ', NOW(), NOW(), 0';

    // Insert into Products table
    const insertResult = await query(
      `INSERT INTO Products (${insertColumns.join(', ')})
       VALUES (${placeholders})`,
      insertValues
    );

    // Create store_inventory entry if storeId is provided
    if (storeId) {
      try {
        await query(
          `INSERT INTO store_inventory (product_code, store_id, qty_on_hand, last_purchase_price)
           VALUES (?, ?, 0, ?)
           ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
          [productCode, storeId, costPrice || 0]
        );
      } catch (invError) {
        console.warn('Error creating store_inventory entry:', invError.message);
        // Continue even if store_inventory fails
      }
    }

    if (normalizedBogo) {
      await upsertItemOverride(productCode, { bogoOffer: normalizedBogo }, resolveOverrideStoreId(storeId));
    }

    // Get the created item and return it
    return getItemByIdFromProductsTable(productCode, storeId);
  }

  // Original logic for items table
  // Check if store_id column exists in items table
  const storeIdColumnCheck = await query(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'store_id'
  `);

  const hasStoreIdColumn = storeIdColumnCheck.length > 0;

  if (hasStoreIdColumn) {
    const result = await query(
      `INSERT INTO items (
        item_code, name, description, brand, category_id, subcategory_id,
        unit, cost_price, selling_price, mrp, reorder_level, min_stock, max_stock,
        gst_rate, hsn_code, barcode, notes, bogo_offer, is_active, store_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemCode,
        name,
        description || null,
        brand || null,
        categoryId || null,
        subcategoryId || null,
        unit || null,
        costPrice || 0,
        sellingPrice || 0,
        mrp || 0,
        reorderLevel || 0,
        normalizedMinStock || 0,
        normalizedMaxStock || 0,
        gstRate || 0,
        hsnCode || null,
        barcode || null,
        notes || null,
        normalizedBogo,
        isActive ? 1 : 0,
        storeId || null
      ]
    );
    return getItemById(result.insertId, storeId);
  } else {
    // Fallback: insert without store_id if column doesn't exist
    const result = await query(
      `INSERT INTO items (
        item_code, name, description, brand, category_id, subcategory_id,
        unit, cost_price, selling_price, mrp, reorder_level, min_stock, max_stock,
        gst_rate, hsn_code, barcode, notes, bogo_offer, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemCode,
        name,
        description || null,
        brand || null,
        categoryId || null,
        subcategoryId || null,
        unit || null,
        costPrice || 0,
        sellingPrice || 0,
        mrp || 0,
        reorderLevel || 0,
        normalizedMinStock || 0,
        normalizedMaxStock || 0,
        gstRate || 0,
        hsnCode || null,
        barcode || null,
        notes || null,
        normalizedBogo,
        isActive ? 1 : 0
      ]
    );
    return getItemById(result.insertId, storeId);
  }
};

export const updateItem = async (itemId, updates = {}) => {
  const normalizedId = String(itemId);
  const normalizedUpdates = { ...updates };

  if (normalizedUpdates.price !== undefined && normalizedUpdates.sellingPrice === undefined) {
    normalizedUpdates.sellingPrice = normalizedUpdates.price;
  }

  const overrideUpdates = {};

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sku')) {
    const skuValue = normalizedUpdates.sku ?? null;
    overrideUpdates.sku = skuValue;
    if (!Object.prototype.hasOwnProperty.call(normalizedUpdates, 'itemCode')) {
      normalizedUpdates.itemCode = skuValue;
    }
    if (!Object.prototype.hasOwnProperty.call(normalizedUpdates, 'barcode') && skuValue) {
      normalizedUpdates.barcode = skuValue;
    }
    delete normalizedUpdates.sku;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'imageUrl')) {
    overrideUpdates.imageUrl = normalizedUpdates.imageUrl;
    delete normalizedUpdates.imageUrl;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'imageFileName')) {
    overrideUpdates.imageFileName = normalizedUpdates.imageFileName;
    delete normalizedUpdates.imageFileName;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'description')) {
    overrideUpdates.description = normalizedUpdates.description;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'name')) {
    overrideUpdates.name = normalizedUpdates.name;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sellingPrice')) {
    overrideUpdates.price = normalizedUpdates.sellingPrice;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'minStock')) {
    overrideUpdates.minStock = normalizedUpdates.minStock;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'maxStock')) {
    overrideUpdates.maxStock = normalizedUpdates.maxStock;
  }

  const itemsTableExists = await checkItemsTableExists();

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'bogoOffer') && !itemsTableExists) {
    const raw = normalizedUpdates.bogoOffer;
    overrideUpdates.bogoOffer =
      raw === null || raw === undefined || raw === ''
        ? null
        : String(raw).trim() || null;
    delete normalizedUpdates.bogoOffer;
  }

  let effectiveOverrideStoreId = resolveOverrideStoreId(normalizedUpdates.storeId);
  if (effectiveOverrideStoreId === 0) {
    try {
      if (itemsTableExists) {
        const er = await query('SELECT store_id FROM items WHERE id = ? LIMIT 1', [normalizedId]);
        const ex = er[0]?.store_id;
        if (ex != null && ex !== '') {
          effectiveOverrideStoreId = resolveOverrideStoreId(ex);
        }
      } else {
        const colCheck = await query(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Products' AND COLUMN_NAME = 'store_id'
        `);
        if (colCheck.length > 0) {
          const pr = await query(
            'SELECT store_id FROM Products WHERE ProductCode = ? OR UniversalProductCode = ? LIMIT 1',
            [normalizedId, normalizedId]
          );
          const px = pr[0]?.store_id;
          if (px != null && px !== '') {
            effectiveOverrideStoreId = resolveOverrideStoreId(px);
          }
        }
      }
    } catch (_) {
      /* ignore */
    }
  }

  if (!itemsTableExists) {
    let legacyUpdatedItem = null;

    if (Object.keys(normalizedUpdates).length > 0) {
      try {
        legacyUpdatedItem = await syncLegacyProductRecord(normalizedId, normalizedUpdates);
      } catch (legacyError) {
        console.error('Failed to update legacy Products table:', legacyError);
      }
    }

    if (Object.keys(overrideUpdates).length > 0) {
      await upsertItemOverride(normalizedId, overrideUpdates, effectiveOverrideStoreId);
    }

    if (legacyUpdatedItem) {
      return legacyUpdatedItem;
    }

    return getItemById(
      normalizedId,
      effectiveOverrideStoreId > 0 ? effectiveOverrideStoreId : undefined
    );
  }

  const fields = [];
  const params = [];

  if (normalizedUpdates.itemCode !== undefined) {
    fields.push('item_code = ?');
    params.push(normalizedUpdates.itemCode);
  }
  if (normalizedUpdates.name !== undefined) {
    fields.push('name = ?');
    params.push(normalizedUpdates.name);
  }
  if (normalizedUpdates.description !== undefined) {
    fields.push('description = ?');
    params.push(normalizedUpdates.description || null);
  }
  if (normalizedUpdates.brand !== undefined) {
    fields.push('brand = ?');
    params.push(normalizedUpdates.brand || null);
  }
  if (normalizedUpdates.categoryId !== undefined) {
    fields.push('category_id = ?');
    params.push(normalizedUpdates.categoryId || null);
  }
  if (normalizedUpdates.subcategoryId !== undefined) {
    fields.push('subcategory_id = ?');
    params.push(normalizedUpdates.subcategoryId || null);
  }
  if (normalizedUpdates.unit !== undefined) {
    fields.push('unit = ?');
    params.push(normalizedUpdates.unit || null);
  }
  if (normalizedUpdates.costPrice !== undefined) {
    fields.push('cost_price = ?');
    params.push(normalizedUpdates.costPrice || 0);
  }
  if (normalizedUpdates.sellingPrice !== undefined) {
    fields.push('selling_price = ?');
    params.push(normalizedUpdates.sellingPrice || 0);
  }
  if (normalizedUpdates.mrp !== undefined) {
    fields.push('mrp = ?');
    params.push(normalizedUpdates.mrp || 0);
  }
  if (normalizedUpdates.reorderLevel !== undefined) {
    fields.push('reorder_level = ?');
    params.push(normalizedUpdates.reorderLevel || 0);
  }
  if (normalizedUpdates.minStock !== undefined) {
    const minValue = Number.isFinite(Number(normalizedUpdates.minStock))
      ? Number(normalizedUpdates.minStock)
      : 0;
    fields.push('min_stock = ?');
    params.push(minValue);
  }
  if (normalizedUpdates.maxStock !== undefined) {
    const maxValue = Number.isFinite(Number(normalizedUpdates.maxStock))
      ? Number(normalizedUpdates.maxStock)
      : 0;
    fields.push('max_stock = ?');
    params.push(maxValue);
  }
  if (normalizedUpdates.gstRate !== undefined) {
    fields.push('gst_rate = ?');
    params.push(normalizedUpdates.gstRate || 0);
  }
  if (normalizedUpdates.hsnCode !== undefined) {
    fields.push('hsn_code = ?');
    params.push(normalizedUpdates.hsnCode || null);
  }
  if (normalizedUpdates.barcode !== undefined) {
    fields.push('barcode = ?');
    params.push(normalizedUpdates.barcode || null);
  }
  if (normalizedUpdates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(normalizedUpdates.notes || null);
  }
  if (normalizedUpdates.bogoOffer !== undefined) {
    const raw = normalizedUpdates.bogoOffer;
    const bogoValue =
      raw === null || raw === undefined || raw === ''
        ? null
        : String(raw).trim() || null;
    fields.push('bogo_offer = ?');
    params.push(bogoValue);
  }
  if (normalizedUpdates.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(normalizedUpdates.isActive ? 1 : 0);
  }

  // Check if store_id column exists and handle store_id update
  const storeIdColumnCheck = await query(`
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'items'
    AND COLUMN_NAME = 'store_id'
  `);

  const hasStoreIdColumn = storeIdColumnCheck.length > 0;
  if (hasStoreIdColumn && normalizedUpdates.storeId !== undefined) {
    fields.push('store_id = ?');
    params.push(normalizedUpdates.storeId || null);
  }

  if (fields.length > 0) {
    params.push(normalizedId);
    await query(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (Object.keys(overrideUpdates).length > 0) {
    await upsertItemOverride(normalizedId, overrideUpdates, effectiveOverrideStoreId);
  }

  return getItemById(
    normalizedId,
    effectiveOverrideStoreId > 0 ? effectiveOverrideStoreId : undefined
  );
};

const normalizeLegacyString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLegacyNumber = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
};

export async function syncLegacyProductRecord(productCode, updates = {}) {
  if (!productCode || !updates || typeof updates !== 'object') {
    return null;
  }

  const normalizedCode = String(productCode).trim();
  if (!normalizedCode || Object.keys(updates).length === 0) {
    return null;
  }

  // Check if Products table has store_id column
  let hasStoreIdColumnInProducts = false;
  try {
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Products'
      AND COLUMN_NAME = 'store_id'
    `);
    hasStoreIdColumnInProducts = storeIdColumnCheck.length > 0;
  } catch (error) {
    console.warn('Error checking for store_id column in Products table:', error);
  }

  const fields = [];
  const params = [];

  const setField = (condition, column, value, type = 'string', defaultValue = null) => {
    if (!condition) return;

    let normalizedValue = value;
    if (type === 'number') {
      normalizedValue = normalizeLegacyNumber(value, defaultValue ?? 0);
    } else {
      normalizedValue = normalizeLegacyString(value);
      if (normalizedValue === null && defaultValue !== null) {
        normalizedValue = defaultValue;
      }
    }

    fields.push(`${column} = ?`);
    params.push(normalizedValue);
  };

  const hasProp = (prop) => Object.prototype.hasOwnProperty.call(updates, prop);

  // Check if BrandCode column exists
  let hasBrandCodeColumn = false;
  try {
    const brandCodeColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Products'
      AND COLUMN_NAME = 'BrandCode'
    `);
    hasBrandCodeColumn = brandCodeColumnCheck.length > 0;
  } catch (error) {
    console.warn('Error checking for BrandCode column in Products table:', error);
  }

  setField(hasProp('name'), 'ProductName', updates.name);
  setField(hasProp('name'), 'ProductFullName', updates.name);
  setField(hasProp('description'), 'UnitDescription', updates.description);
  setField(hasProp('unit'), 'UnitOfMeasure', updates.unit);
  
  // Handle brand - prefer brandId (brandCode) over brand string
  if (hasProp('brandId') && updates.brandId !== undefined && updates.brandId !== null && updates.brandId !== '') {
    const brandCodeValue = String(updates.brandId).trim();
    if (hasBrandCodeColumn) {
      setField(true, 'BrandCode', brandCodeValue);
    } else {
      setField(true, 'ManufacturerCode', brandCodeValue);
    }
  } else if (hasProp('brand')) {
    const brandValue = updates.brand ? String(updates.brand).trim() : null;
    if (hasBrandCodeColumn) {
      setField(true, 'BrandCode', brandValue);
    } else {
      setField(true, 'ManufacturerCode', brandValue);
    }
  }
  
  setField(hasProp('categoryId'), 'CategoryCode', updates.categoryId);
  
  // Extract subcategory code from composite ID (format: "categoryCode:subcategoryCode")
  if (hasProp('subcategoryId') && updates.subcategoryId) {
    const subcategoryStr = String(updates.subcategoryId).trim();
    let subcategoryCode = null;
    if (subcategoryStr.includes(':')) {
      // Extract code part after the colon (e.g., "51:SUB001" -> "SUB001")
      subcategoryCode = subcategoryStr.split(':').slice(1).join(':').trim();
    } else {
      // Use as-is if no colon separator
      subcategoryCode = subcategoryStr;
    }
    if (subcategoryCode === '') {
      subcategoryCode = null;
    }
    setField(true, 'SubCategory', subcategoryCode);
  }

  const purchasePriceValue = hasProp('costPrice') || hasProp('purchasePrice')
    ? (updates.costPrice !== undefined ? updates.costPrice : updates.purchasePrice)
    : undefined;
  setField(purchasePriceValue !== undefined, 'PurchasePrice', purchasePriceValue, 'number');

  const sellingPriceValue = hasProp('sellingPrice') || hasProp('price')
    ? (updates.sellingPrice !== undefined ? updates.sellingPrice : updates.price)
    : undefined;
  setField(sellingPriceValue !== undefined, 'SalePrice', sellingPriceValue, 'number');

  setField(hasProp('mrp'), 'MRP', updates.mrp, 'number');
  setField(hasProp('reorderLevel'), 'ReorderLevel', updates.reorderLevel, 'number');
  setField(hasProp('minStock'), 'MinimumStockLevel', updates.minStock, 'number');

  const barcodeValue = hasProp('barcode') ? (updates.barcode ?? updates.itemCode) : undefined;
  setField(barcodeValue !== undefined, 'UniversalProductCode', barcodeValue);
  setField(barcodeValue !== undefined, 'BarCodeDescription', barcodeValue);

  setField(hasProp('hsnCode'), 'CommodityCode', updates.hsnCode);

  const taxValue = hasProp('gstRate') || hasProp('taxRate') || hasProp('tax')
    ? (updates.gstRate ?? updates.taxRate ?? updates.tax)
    : undefined;
  setField(taxValue !== undefined, 'TaxAmount', taxValue, 'number');

  setField(hasProp('notes'), 'Remarks', updates.notes);

  // Handle store_id update if column exists
  if (hasStoreIdColumnInProducts && hasProp('storeId')) {
    setField(true, 'store_id', updates.storeId, 'number');
  }

  if (fields.length === 0) {
    return null;
  }

  params.push(normalizedCode);

  try {
    const result = await query(`UPDATE Products SET ${fields.join(', ')} WHERE ProductCode = ?`, params);
    if (result.affectedRows === 0) {
      console.warn(`Legacy Products row not found for code ${normalizedCode}`);
      return null;
    }
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.warn('Products table not found while attempting to sync appliance data. Skipping legacy sync.');
      return null;
    }
    throw error;
  }

  return getItemByIdFromProductsTable(normalizedCode, updates.storeId);
}

export const deleteItem = async (itemId) => {
  if (!(await checkItemsTableExists())) {
    await removeItemOverride(String(itemId));
    return;
  }

  await query('DELETE FROM items WHERE id = ?', [itemId]);
};

export const getStockWithBatches = async (filters = {}) => {
  const { search, storeId, categoryId } = filters;

  try {
    // Query purchase_order_items from purchase orders
    // Include all statuses that might have batches (created, ordered, received)
    // Exclude only cancelled orders
    // Only include items that have a batch_number (not null and not empty)
    // This ensures we only show batches that the user has explicitly added
    let whereConditions = ['po.status != ?'];
    let params = ['cancelled'];

    // Only include items with batch numbers
    whereConditions.push('poi.batch_number IS NOT NULL');
    whereConditions.push('poi.batch_number != ?');
    whereConditions.push('TRIM(poi.batch_number) != ?');
    params.push('', '');

    // Don't filter by store ID - get ALL batches across all stores
    // This ensures batches are available for all items regardless of store
    // if (storeId) {
    //   whereConditions.push('po.store_id = ?');
    //   params.push(storeId);
    // }

    // Don't filter by search here - fetch all batches and let frontend filter
    // This ensures we get all batches regardless of search term
    // if (search) {
    //   whereConditions.push('(poi.item_name LIKE ? OR poi.sku LIKE ? OR poi.batch_number LIKE ?)');
    //   const searchLike = `%${search}%`;
    //   params.push(searchLike, searchLike, searchLike);
    // }

    if (categoryId) {
      whereConditions.push('poi.category_name = ?');
      params.push(categoryId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get purchase order items with batch information
    const rows = await query(`
      SELECT 
        poi.id,
        poi.purchase_order_id,
        poi.item_name,
        poi.sku,
        poi.batch_number,
        poi.expiry_date,
        poi.quantity,
        poi.cost_price,
        poi.hsn_number,
        poi.category_name,
        poi.subcategory_name,
        poi.unit,
        po.id AS po_id,
        po.po_number,
        po.order_date,
        po.store_id,
        po.status AS po_status
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po ON poi.purchase_order_id = po.id
      ${whereClause}
      ORDER BY po.order_date DESC, poi.item_name ASC, poi.batch_number ASC
    `, params);

    // Group by SKU, batch number, and purchase order ID
    // This ensures each unique batch per PO is treated separately
    const batchMap = new Map();

    for (const row of rows) {
      // All rows here have batch_number (filtered in SQL)
      // Create a unique key: SKU + batch_number + purchase_order_id
      const batchKey = `${String(row.sku || '').trim()}-${String(row.batch_number || '').trim()}-${String(row.purchase_order_id)}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          sku: row.sku,
          itemName: row.item_name,
          batchNumber: row.batch_number, // Always has a value since we filtered for it
          batchQuantity: Number(row.quantity || 0),
          costPrice: Number(row.cost_price || 0),
          expiryDate: row.expiry_date,
          purchaseOrderId: String(row.purchase_order_id),
          purchaseOrderNumber: row.po_number,
          purchaseDate: row.order_date,
          hsnNumber: row.hsn_number,
          categoryName: row.category_name,
          subcategoryName: row.subcategory_name,
          unit: row.unit,
          storeId: row.store_id,
          poStatus: row.po_status,
          barcodes: [] // Barcodes will be loaded on demand in the frontend
        });
      } else {
        // If batch already exists, aggregate quantities
        const existing = batchMap.get(batchKey);
        existing.batchQuantity += Number(row.quantity || 0);
      }
    }

    // Return batches without barcodes (barcodes loaded on demand)
    // This improves performance and reduces initial load time
    const batches = Array.from(batchMap.values());

    // Sort batches by purchase date (newest first), then by batch number
    batches.sort((a, b) => {
      if (a.purchaseDate && b.purchaseDate) {
        const dateA = new Date(a.purchaseDate);
        const dateB = new Date(b.purchaseDate);
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
      }
      // Then sort by batch number
      const batchNumA = (a.batchNumber || '').toString();
      const batchNumB = (b.batchNumber || '').toString();
      return batchNumA.localeCompare(batchNumB);
    });

    // Note: Barcodes are NOT loaded here for performance reasons
    // They will be loaded on-demand when a batch is selected in the frontend
    // This allows the frontend to handle barcode loading asynchronously

    return batches;
  } catch (error) {
    console.error('Error getting stock with batches:', error);
    throw error;
  }
};

export const findItemByBarcode = async (barcode, storeId = undefined) => {
  if (!barcode) {
    return null;
  }

  const trimmed = String(barcode).trim();
  if (!trimmed) {
    return null;
  }

  if (await checkItemsTableExists()) {
    const item = await findItemByBarcodeInItemsTable(trimmed, storeId);
    if (item) {
      return item;
    }
  }

  const overrideProductCode = await findOverrideProductCodeBySku(trimmed);
  if (overrideProductCode) {
    const item = await getItemById(overrideProductCode, storeId);
    if (item) {
      return item;
    }
  }

  return findItemByBarcodeInProductsTable(trimmed, storeId);
};

const removeItemOverride = async (productCode) => {
  if (!productCode) {
    return;
  }

  await ensureOverridesTable();
  await query('DELETE FROM item_overrides WHERE product_code = ?', [productCode]);
};

