import { query } from '../db/index.js';

const parseLimit = (value, defaultValue = 100, max = 500) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, max);
};

const parseOffset = (value, defaultValue = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
};

export const getAllBrands = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset ?? req.query.cursor, 0);
    const search = req.query.q?.trim() || req.query.search?.trim() || undefined;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      return res.json({
        status: 'success',
        data: {
          brands: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasNext: false,
            nextCursor: null
          }
        }
      });
    }

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'store_id'
    `);

    const hasStoreIdColumn = storeIdColumnCheck.length > 0;

    const subcategoryColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'subcategory_id'
    `);
    const hasSubcategoryIdColumn = subcategoryColumnCheck.length > 0;

    const subcategoryFilter =
      req.query.subcategory_id?.trim() || req.query.subcategoryId?.trim() || '';
    const includeLegacy = ['1', 'true', 'yes'].includes(
      String(req.query.include_legacy ?? req.query.includeLegacy ?? '').toLowerCase()
    );

    const filters = [];
    const params = [];

    if (hasStoreIdColumn && storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
      filters.push('store_id = ?');
      params.push(storeId);
    }

    if (hasSubcategoryIdColumn && subcategoryFilter) {
      const trimmed = String(subcategoryFilter).trim();
      if (trimmed) {
        const orParts = [];
        const subParams = [];
        orParts.push('subcategory_id <=> ?');
        subParams.push(trimmed);
        if (trimmed.includes(':')) {
          const tail = trimmed.split(':').slice(1).join(':').trim();
          if (tail && tail !== trimmed) {
            orParts.push('subcategory_id <=> ?');
            subParams.push(tail);
          }
        } else {
          orParts.push(`SUBSTRING_INDEX(COALESCE(subcategory_id, ''), ':', -1) <=> ?`);
          subParams.push(trimmed);
        }
        const inner = `(${orParts.join(' OR ')})`;
        if (includeLegacy) {
          filters.push(`(${inner} OR subcategory_id IS NULL)`);
        } else {
          filters.push(inner);
        }
        params.push(...subParams);
      }
    }

    if (search) {
      filters.push('(Description LIKE ? OR BrandCode LIKE ?)');
      const searchLike = `%${search}%`;
      params.push(searchLike, searchLike);
    }

    const includeInactive = ['1', 'true', 'yes'].includes(
      String(req.query.include_inactive ?? req.query.includeInactive ?? '').toLowerCase()
    );
    if (!includeInactive) {
      filters.push('IsActive = 1');
    }
    filters.push("Description IS NOT NULL");
    filters.push("TRIM(Description) <> ''");

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Get total count
    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM Brand ${whereClause}`,
      params
    );
    const total = Number(countResult?.total || 0);

    const selectCols = hasSubcategoryIdColumn
      ? 'BrandCode, Description, store_id, subcategory_id, IsActive'
      : 'BrandCode, Description, store_id, IsActive';

    // Get brands
    const brands = await query(
      `SELECT ${selectCols}
       FROM Brand
       ${whereClause}
       ORDER BY Description ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const formattedBrands = brands
      .map((row) => {
        const code = row.BrandCode ? String(row.BrandCode).trim() : null;
        const name = row.Description ? String(row.Description).trim() : null;
        if (!code || !name) return null;
        const entry = {
          id: code,
          code: code,
          name: name,
          storeId: row.store_id || null,
          isActive: Boolean(row.IsActive)
        };
        if (hasSubcategoryIdColumn) {
          entry.subcategoryId =
            row.subcategory_id != null && String(row.subcategory_id).trim() !== ''
              ? String(row.subcategory_id).trim()
              : null;
        }
        return entry;
      })
      .filter(Boolean);

    const hasNext = offset + formattedBrands.length < total;

    res.json({
      status: 'success',
      data: {
        brands: formattedBrands,
        pagination: {
          total,
          limit,
          offset,
          hasNext,
          nextCursor: hasNext ? offset + formattedBrands.length : null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching brands'
    });
  }
};

export const getBrandById = async (req, res) => {
  try {
    const brandCode = req.params.id?.trim();
    if (!brandCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid brand id'
      });
    }

    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Brand not found'
      });
    }

    const brandFilters = ['BrandCode = ?'];
    const brandParams = [brandCode];

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'store_id'
    `);

    if (storeIdColumnCheck.length > 0 && storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
      brandFilters.push('store_id = ?');
      brandParams.push(storeId);
    }

    const subcategoryColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'subcategory_id'
    `);
    const hasSubcategoryIdColumn = subcategoryColumnCheck.length > 0;

    const selectCols = hasSubcategoryIdColumn
      ? 'BrandCode, Description, store_id, subcategory_id, IsActive'
      : 'BrandCode, Description, store_id, IsActive';

    const brandRows = await query(
      `SELECT ${selectCols}
       FROM Brand
       WHERE ${brandFilters.join(' AND ')}`,
      brandParams
    );

    if (brandRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Brand not found'
      });
    }

    const brand = brandRows[0];

    const payload = {
      id: brand.BrandCode,
      code: brand.BrandCode,
      name: brand.Description || brand.BrandCode,
      storeId: brand.store_id || null,
      isActive: Boolean(brand.IsActive)
    };
    if (hasSubcategoryIdColumn) {
      payload.subcategoryId =
        brand.subcategory_id != null && String(brand.subcategory_id).trim() !== ''
          ? String(brand.subcategory_id).trim()
          : null;
    }

    res.json({
      status: 'success',
      data: payload
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching brand'
    });
  }
};

export const createBrand = async (req, res) => {
  try {
    const { code, name, store_id, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Brand name is required'
      });
    }

    const storeId = store_id ? Number(store_id) : null;

    // Get current user and date for audit fields
    const userId = req.user?._id ?? req.user?.id ?? req.user?.email ?? 'System';
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'Brand table does not exist'
      });
    }

    // Check BrandCode column type
    const brandCodeColumn = await query(`
      SELECT DATA_TYPE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'BrandCode'
    `);

    const isBrandCodeInt = brandCodeColumn.length > 0 &&
      (brandCodeColumn[0].DATA_TYPE === 'int' || brandCodeColumn[0].DATA_TYPE === 'bigint');
    const isAutoIncrement = brandCodeColumn.length > 0 &&
      brandCodeColumn[0].EXTRA && brandCodeColumn[0].EXTRA.toLowerCase().includes('auto_increment');

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'store_id'
    `);

    const hasStoreIdColumn = storeIdColumnCheck.length > 0;

    const subcategoryColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'subcategory_id'
    `);
    const hasSubcategoryIdColumn = subcategoryColumnCheck.length > 0;
    const subRaw = req.body.subcategory_id ?? req.body.subcategoryId;
    const subcategoryId =
      subRaw != null && String(subRaw).trim() !== '' ? String(subRaw).trim() : null;

    // Determine brand code to use
    let brandCode = code || null;
    if (isBrandCodeInt) {
      if (code) {
        const parsedCode = Number(code);
        if (Number.isInteger(parsedCode) && parsedCode > 0) {
          brandCode = parsedCode;
        } else if (isAutoIncrement) {
          brandCode = null;
        } else {
          brandCode = null;
        }
      } else if (isAutoIncrement) {
        brandCode = null;
      } else {
        brandCode = null;
      }
    } else {
      // For VARCHAR type, if no code provided, we'll generate one below
      if (!code) {
        brandCode = null;
      }
    }

    // If brandCode is null/undefined and not auto-increment, generate a new code
    if ((brandCode === null || brandCode === undefined) && !isAutoIncrement) {
      if (isBrandCodeInt) {
        const maxResult = await query('SELECT MAX(BrandCode) as maxCode FROM Brand');
        const maxCode = maxResult[0]?.maxCode || 0;
        brandCode = Number(maxCode) + 1;
      } else {
        // Generate code from brand name
        const baseCode = name.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').substring(0, 50);
        let checkCode = baseCode || `BRAND_${Date.now()}`;
        let counter = 1;
        while (true) {
          const existingCheck = await query(
            'SELECT BrandCode FROM Brand WHERE BrandCode = ?',
            [checkCode]
          );
          if (existingCheck.length === 0) {
            brandCode = checkCode;
            break;
          }
          checkCode = `${baseCode}_${counter}`;
          counter++;
          if (counter > 1000) {
            brandCode = `BRAND_${Date.now()}`;
            break;
          }
        }
      }
    }

    // Check if brand already exists
    let existingQuery;
    const existingParams = [];

    if (brandCode !== null) {
      existingQuery = 'SELECT BrandCode FROM Brand WHERE BrandCode = ?';
      existingParams.push(brandCode);

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
    } else {
      existingQuery = 'SELECT BrandCode FROM Brand WHERE Description = ?';
      existingParams.push(name.trim());

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
      if (hasSubcategoryIdColumn) {
        existingQuery += ' AND (subcategory_id <=> ?)';
        existingParams.push(subcategoryId);
      }
    }

    const existing = await query(existingQuery, existingParams);

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Brand with this ' + (brandCode !== null ? 'code' : 'name') + ' already exists' + (hasStoreIdColumn && storeId ? ' for this store' : '')
      });
    }

    // Insert new brand
    const insertCols = [];
    const insertVals = [];
    if (brandCode !== null && brandCode !== undefined) {
      insertCols.push('BrandCode');
      insertVals.push(brandCode);
    }
    insertCols.push('Description');
    insertVals.push(name);
    if (hasStoreIdColumn) {
      insertCols.push('store_id');
      insertVals.push(storeId);
    }
    if (hasSubcategoryIdColumn) {
      insertCols.push('subcategory_id');
      insertVals.push(subcategoryId);
    }
    insertCols.push('IsActive', 'created_at', 'updated_at');
    insertVals.push(isActive ? 1 : 0, currentDate, currentDate);

    await query(
      `INSERT INTO Brand (${insertCols.join(', ')}) VALUES (${insertCols.map(() => '?').join(', ')})`,
      insertVals
    );

    // Fetch created brand
    let selectQuery = 'SELECT BrandCode, Description, IsActive';
    if (hasStoreIdColumn) {
      selectQuery += ', store_id';
    }
    if (hasSubcategoryIdColumn) {
      selectQuery += ', subcategory_id';
    }

    let brand;
    if (brandCode !== null) {
      selectQuery += ' FROM Brand WHERE BrandCode = ?';
      [brand] = await query(selectQuery, [brandCode]);
    } else {
      selectQuery += ' FROM Brand WHERE Description = ?';
      const selectParams = [name];
      if (hasStoreIdColumn && storeId) {
        selectQuery += ' AND store_id = ?';
        selectParams.push(storeId);
      }
      if (hasSubcategoryIdColumn) {
        selectQuery += ' AND (subcategory_id <=> ?)';
        selectParams.push(subcategoryId);
      }
      selectQuery += ' ORDER BY BrandCode DESC LIMIT 1';
      [brand] = await query(selectQuery, selectParams);
    }

    if (!brand) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve created brand'
      });
    }

    const createdPayload = {
      id: brand.BrandCode,
      code: brand.BrandCode,
      name: brand.Description,
      storeId: hasStoreIdColumn ? (brand.store_id || null) : null,
      isActive: Boolean(brand.IsActive)
    };
    if (hasSubcategoryIdColumn) {
      createdPayload.subcategoryId =
        brand.subcategory_id != null && String(brand.subcategory_id).trim() !== ''
          ? String(brand.subcategory_id).trim()
          : null;
    }

    res.status(201).json({
      status: 'success',
      message: 'Brand created successfully',
      data: createdPayload
    });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating brand',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const brandCode = req.params.id?.trim();
    if (!brandCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid brand id'
      });
    }

    const { name, isActive, store_id, subcategory_id, subcategoryId: bodySubcategoryId } = req.body;

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'Brand table does not exist'
      });
    }

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'store_id'
    `);

    const hasStoreIdColumn = storeIdColumnCheck.length > 0;

    const subcategoryColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
      AND COLUMN_NAME = 'subcategory_id'
    `);
    const hasSubcategoryIdColumn = subcategoryColumnCheck.length > 0;

    // Check if brand exists
    let checkQuery = 'SELECT BrandCode FROM Brand WHERE BrandCode = ?';
    const checkParams = [brandCode];

    if (hasStoreIdColumn && store_id) {
      const storeId = Number(store_id);
      if (Number.isInteger(storeId) && storeId > 0) {
        checkQuery += ' AND store_id = ?';
        checkParams.push(storeId);
      }
    }

    const existing = await query(checkQuery, checkParams);

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Brand not found'
      });
    }

    // Build update query
    const updates = [];
    const updateParams = [];

    if (name !== undefined) {
      updates.push('Description = ?');
      updateParams.push(name.trim());
    }

    if (isActive !== undefined) {
      updates.push('IsActive = ?');
      updateParams.push(isActive ? 1 : 0);
    }

    if (hasSubcategoryIdColumn && (subcategory_id !== undefined || bodySubcategoryId !== undefined)) {
      const subRaw = subcategory_id !== undefined ? subcategory_id : bodySubcategoryId;
      const subVal =
        subRaw != null && String(subRaw).trim() !== '' ? String(subRaw).trim() : null;
      updates.push('subcategory_id = ?');
      updateParams.push(subVal);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = ?');
    updateParams.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
    updateParams.push(brandCode);

    await query(
      `UPDATE Brand SET ${updates.join(', ')} WHERE BrandCode = ?`,
      updateParams
    );

    // Fetch updated brand
    let selectQuery = 'SELECT BrandCode, Description, IsActive';
    if (hasStoreIdColumn) {
      selectQuery += ', store_id';
    }
    if (hasSubcategoryIdColumn) {
      selectQuery += ', subcategory_id';
    }
    selectQuery += ' FROM Brand WHERE BrandCode = ?';

    const [updatedBrand] = await query(selectQuery, [brandCode]);

    const updatePayload = {
      id: updatedBrand.BrandCode,
      code: updatedBrand.BrandCode,
      name: updatedBrand.Description,
      storeId: hasStoreIdColumn ? (updatedBrand.store_id || null) : null,
      isActive: Boolean(updatedBrand.IsActive)
    };
    if (hasSubcategoryIdColumn) {
      updatePayload.subcategoryId =
        updatedBrand.subcategory_id != null && String(updatedBrand.subcategory_id).trim() !== ''
          ? String(updatedBrand.subcategory_id).trim()
          : null;
    }

    res.json({
      status: 'success',
      message: 'Brand updated successfully',
      data: updatePayload
    });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating brand'
    });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const brandCode = req.params.id?.trim();
    if (!brandCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid brand id'
      });
    }

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'Brand table does not exist'
      });
    }

    // Check if brand exists
    const [existing] = await query('SELECT BrandCode FROM Brand WHERE BrandCode = ?', [brandCode]);

    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Brand not found'
      });
    }

    // Soft delete by setting IsActive to 0
    await query(
      'UPDATE Brand SET IsActive = 0, updated_at = ? WHERE BrandCode = ?',
      [new Date().toISOString().slice(0, 19).replace('T', ' '), brandCode]
    );

    res.json({
      status: 'success',
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting brand'
    });
  }
};

