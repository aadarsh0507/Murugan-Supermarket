import { query } from '../db/index.js';

// Category code to name mapping
const CATEGORY_NAME_MAP = {
  '1': 'Beverages',
  '2': 'Snacks',
  '3': 'Dairy',
  '4': 'Fruits & Vegetables',
  '5': 'Bakery',
  '6': 'Meat & Seafood',
  '7': 'Frozen Foods',
  '8': 'Personal Care',
  '9': 'Household',
  '10': 'Electronics',
  '11': 'Clothing',
  '12': 'Home & Garden',
  '13': 'Sports & Outdoors',
  '14': 'Toys & Games',
  '15': 'Books',
  '16': 'Health & Beauty',
  '17': 'Automotive',
  '18': 'Office Supplies',
  '19': 'Pet Supplies',
  '20': 'Baby Products',
  '21': 'Jewelry',
  '22': 'Shoes',
  '23': 'Watches',
  '24': 'Luggage',
  '25': 'Musical Instruments',
  '26': 'Art & Crafts',
  '27': 'Party Supplies',
  '28': 'Seasonal',
  '29': 'Tea & Coffee',
  '30': 'Spices & Condiments',
  '31': 'Rice & Grains',
  '32': 'Pulses & Legumes',
  '33': 'Oil & Ghee',
  '34': 'Sugar & Sweeteners',
  '35': 'Flour & Baking',
  '38': 'Cleaning Supplies',
  '39': 'Stationery',
  '40': 'Gift Items',
  '41': 'Confectionery',
  '42': 'Biscuits & Cookies',
  '43': 'Noodles & Pasta',
  '44': 'Sauces & Pickles',
  '45': 'Ready to Eat',
  '46': 'Breakfast Cereals',
  '47': 'Health Supplements',
  '48': 'Ayurvedic Products',
  '49': 'Organic Products',
};

const getCategoryName = (code) => {
  if (!code) return null;
  const trimmedCode = String(code).trim();
  return CATEGORY_NAME_MAP[trimmedCode] || `Category ${trimmedCode}`;
};

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

export const getAllCategories = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset ?? req.query.cursor, 0);
    const search = req.query.q?.trim() || req.query.search?.trim() || undefined;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;

    // Check if Category table exists and has data
    const categoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
    `);

    if (categoryTableCheck.length > 0) {
      // Use Category table
      const filters = [];
      const params = [];

      if (storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
        filters.push('store_id = ?');
        params.push(storeId);
      }

      if (search) {
        filters.push('(CategoryCode LIKE ? OR Description LIKE ?)');
        const likeValue = `%${search}%`;
        params.push(likeValue, likeValue);
      }

      const includeInactive = ['1', 'true', 'yes'].includes(
        String(req.query.include_inactive ?? req.query.includeInactive ?? '').toLowerCase()
      );
      if (!includeInactive) {
        filters.push('IsActive = 1');
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const rows = await query(
        `SELECT CategoryCode, Description, store_id, IsActive
         FROM Category
         ${whereClause}
         ORDER BY CategoryCode ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const countRows = await query(
        `SELECT COUNT(*) AS total
         FROM Category
         ${whereClause}`,
        params
      );

      const total = countRows[0]?.total || 0;
      const categories = rows.map((row) => ({
        id: row.CategoryCode,
        code: row.CategoryCode,
        name: row.Description || getCategoryName(row.CategoryCode),
        storeId: row.store_id,
        isActive: Boolean(row.IsActive)
      }));

      const hasNext = offset + categories.length < total;

      return res.json({
        status: 'success',
        data: {
          categories,
          pagination: {
            total,
            limit,
            offset,
            hasNext,
            nextCursor: hasNext ? offset + categories.length : null
          }
        }
      });
    }

    // Fallback to Products table (legacy)
    const filters = ['CategoryCode IS NOT NULL', "TRIM(CategoryCode) <> ''"];
    const params = [];

    if (search) {
      filters.push('(CategoryCode LIKE ? OR SubCategory LIKE ?)');
      const likeValue = `%${search}%`;
      params.push(likeValue, likeValue);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await query(
      `SELECT DISTINCT TRIM(CategoryCode) AS categoryCode
       FROM Products
       ${whereClause}
       ORDER BY categoryCode ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRows = await query(
      `SELECT COUNT(DISTINCT TRIM(CategoryCode)) AS total
       FROM Products
       ${whereClause}`,
      params
    );

    const total = countRows[0]?.total || 0;
    const categories = rows
      .map((row) => row.categoryCode?.trim())
      .filter((code) => code && code.length > 0)
      .map((code) => {
        const categoryName = getCategoryName(code);
        return {
          id: code,
          code,
          name: categoryName,
          isActive: true
        };
      });

    const hasNext = offset + categories.length < total;

    res.json({
      status: 'success',
      data: {
        categories,
        pagination: {
          total,
          limit,
          offset,
          hasNext,
          nextCursor: hasNext ? offset + categories.length : null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching categories'
    });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const categoryCode = req.params.id?.trim();
    if (!categoryCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid category id'
      });
    }

    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;

    // Check if Category table exists
    const categoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
    `);

    let category = null;
    if (categoryTableCheck.length > 0) {
      // Get category from Category table
      const categoryFilters = ['CategoryCode = ?'];
      const categoryParams = [categoryCode];

      if (storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
        categoryFilters.push('store_id = ?');
        categoryParams.push(storeId);
      }

      const categoryRows = await query(
        `SELECT CategoryCode, Description, store_id, IsActive
         FROM Category
         WHERE ${categoryFilters.join(' AND ')}`,
        categoryParams
      );

      if (categoryRows.length > 0) {
        category = categoryRows[0];
      }
    }

    // Get subcategories from Subcategory table using ParentId (match INT/VARCHAR like hierarchy)
    const subcategoryFilters = ['IsActive = 1', "Description IS NOT NULL", "TRIM(Description) <> ''"];
    const subcategoryParams = [];
    const categoryCodeNum = Number(categoryCode);
    if (Number.isInteger(categoryCodeNum)) {
      subcategoryFilters.push('(ParentId = ? OR ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
      subcategoryParams.push(categoryCodeNum, categoryCode, categoryCode);
    } else {
      subcategoryFilters.push('(ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
      subcategoryParams.push(categoryCode, categoryCode);
    }

    const subStoreIdColumnCheck = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Subcategory' AND COLUMN_NAME = 'store_id'
    `);
    const subHasStoreId = subStoreIdColumnCheck.length > 0;
    if (subHasStoreId && storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
      subcategoryFilters.push('(store_id = ? OR store_id IS NULL)');
      subcategoryParams.push(storeId);
    }

    const rows = await query(
      `SELECT SubCategoryCode, Description, ParentId${subHasStoreId ? ', store_id' : ''}
       FROM Subcategory
       WHERE ${subcategoryFilters.join(' AND ')}
       ORDER BY Description ASC`,
      subcategoryParams
    );

    const subcategories = rows
      .map((row) => {
        const code = row.SubCategoryCode ? String(row.SubCategoryCode).trim() : null;
        const name = row.Description ? String(row.Description).trim() : null;
        if (!code || !name) return null;
        return {
          id: `${categoryCode}:${code}`,
          code: code,
          name: name,
          storeId: row.store_id,
          isActive: true
        };
      })
      .filter(Boolean);

    if (category) {
      return res.json({
        status: 'success',
        data: {
          id: category.CategoryCode,
          code: category.CategoryCode,
          name: category.Description || getCategoryName(category.CategoryCode),
          storeId: category.store_id,
          isActive: Boolean(category.IsActive),
          subcategories
        }
      });
    }

    // Fallback to legacy approach
    res.json({
      status: 'success',
      data: {
        id: categoryCode,
        code: categoryCode,
        name: getCategoryName(categoryCode),
        isActive: true,
        subcategories
      }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching category'
    });
  }
};

export const getCategoryHierarchy = async (req, res) => {
  try {
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const includeInactive = ['1', 'true', 'yes'].includes(
      String(req.query.include_inactive ?? req.query.includeInactive ?? '').toLowerCase()
    );

    // Check if Category table exists
    const categoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
    `);

    if (categoryTableCheck.length > 0) {
      // Check if store_id column exists
      const storeIdColumnCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Category'
        AND COLUMN_NAME = 'store_id'
      `);

      const hasStoreIdColumn = storeIdColumnCheck.length > 0;

      // Use Category table
      const categoryFilters = [];
      if (!includeInactive) {
        categoryFilters.push('IsActive = 1');
      }
      const categoryParams = [];

      if (hasStoreIdColumn && storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
        categoryFilters.push('store_id = ?');
        categoryParams.push(storeId);
      }

      const categoryWhere =
        categoryFilters.length > 0 ? `WHERE ${categoryFilters.join(' AND ')}` : '';

      const categoryRows = await query(
        `SELECT CategoryCode, Description, IsActive${hasStoreIdColumn ? ', store_id' : ''}
         FROM Category
         ${categoryWhere}
         ORDER BY CategoryCode ASC`,
        categoryParams
      );

      const categories = await Promise.all(
        categoryRows.map(async (row) => {
          // CategoryCode is INT, so convert to string
          const categoryCode = row.CategoryCode ? String(row.CategoryCode).trim() : null;
          if (!categoryCode) return null;

          // Check if Subcategory table has store_id column
          const subStoreIdColumnCheck = await query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'Subcategory'
            AND COLUMN_NAME = 'store_id'
          `);

          const subHasStoreIdColumn = subStoreIdColumnCheck.length > 0;

          // Get subcategories for this category from Subcategory table
          // ParentId might be INT or VARCHAR, so we'll match both
          const subcategoryFilters = [];
          if (!includeInactive) {
            subcategoryFilters.push('IsActive = 1');
          }
          const subcategoryParams = [];

          // Try to match ParentId - it could be INT or VARCHAR
          // Convert categoryCode to number if possible for INT comparison
          const categoryCodeNum = Number(categoryCode);
          if (Number.isInteger(categoryCodeNum)) {
            subcategoryFilters.push('(ParentId = ? OR ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
            subcategoryParams.push(categoryCodeNum, categoryCode, categoryCode);
          } else {
            subcategoryFilters.push('(ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
            subcategoryParams.push(categoryCode, categoryCode);
          }

          // Add Description filters
          subcategoryFilters.push("Description IS NOT NULL");
          subcategoryFilters.push("TRIM(Description) <> ''");

          if (subHasStoreIdColumn && storeId !== undefined && Number.isInteger(storeId) && storeId > 0) {
            subcategoryFilters.push('(store_id = ? OR store_id IS NULL)');
            subcategoryParams.push(storeId);
          }

          let subcategoryRows = [];
          try {
            subcategoryRows = await query(
              `SELECT SubCategoryCode, Description, ParentId, IsActive${subHasStoreIdColumn ? ', store_id' : ''}
               FROM Subcategory
               WHERE ${subcategoryFilters.join(' AND ')}
               ORDER BY Description ASC`,
              subcategoryParams
            );
          } catch (subError) {
            console.error('Error fetching subcategories with store_id filter:', subError);
            // Fallback: try without store_id filter if it was being used
            try {
              const fallbackFilters = [];
              if (!includeInactive) {
                fallbackFilters.push('IsActive = 1');
              }
              const fallbackParams = [];

              // Match ParentId with type flexibility
              const categoryCodeNum = Number(categoryCode);
              if (Number.isInteger(categoryCodeNum)) {
                fallbackFilters.push('(ParentId = ? OR ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
                fallbackParams.push(categoryCodeNum, categoryCode, categoryCode);
              } else {
                fallbackFilters.push('(ParentId = ? OR CAST(ParentId AS CHAR) = ?)');
                fallbackParams.push(categoryCode, categoryCode);
              }

              fallbackFilters.push("Description IS NOT NULL");
              fallbackFilters.push("TRIM(Description) <> ''");

              subcategoryRows = await query(
                `SELECT SubCategoryCode, Description, ParentId, IsActive${subHasStoreIdColumn ? ', store_id' : ''}
                 FROM Subcategory
                 WHERE ${fallbackFilters.join(' AND ')}
                 ORDER BY Description ASC`,
                fallbackParams
              );
            } catch (fallbackError) {
              console.error('Error in fallback subcategory query:', fallbackError);
              subcategoryRows = [];
            }
          }

          const subcategories = subcategoryRows
            .map((subRow) => {
              const code = subRow.SubCategoryCode ? String(subRow.SubCategoryCode).trim() : null;
              const name = subRow.Description ? String(subRow.Description).trim() : null;
              if (!code || !name) return null;
              return {
                id: `${categoryCode}:${code}`,
                code: code,
                name: name,
                storeId: subRow.store_id || null,
                isActive: Boolean(subRow.IsActive)
              };
            })
            .filter(Boolean);

          return {
            id: categoryCode,
            code: categoryCode,
            name: row.Description || getCategoryName(categoryCode),
            storeId: row.store_id || null,
            isActive: Boolean(row.IsActive),
            subcategories
          };
        })
      );

      return res.json({
        status: 'success',
        data: {
          categories: categories.filter(Boolean)
        }
      });
    }

    // Fallback to Products table (legacy)
    const categoryRows = await query(
      `SELECT DISTINCT TRIM(CategoryCode) AS categoryCode
       FROM Products
       WHERE CategoryCode IS NOT NULL AND TRIM(CategoryCode) <> ''
       ORDER BY categoryCode ASC`
    );

    const categories = await Promise.all(
      categoryRows.map(async (row) => {
        const categoryCode = row.categoryCode?.trim();
        if (!categoryCode) return null;

        // Get subcategories for this category from Subcategory table
        // Using ParentId to match the category and Description as the name
        const subActiveClause = includeInactive ? '' : ' AND IsActive = 1';
        const subcategoryRows = await query(
          `SELECT SubCategoryCode, Description, ParentId, IsActive
           FROM Subcategory
           WHERE ParentId = ?${subActiveClause} AND Description IS NOT NULL AND TRIM(Description) <> ''
           ORDER BY Description ASC`,
          [categoryCode]
        );

        const subcategories = subcategoryRows
          .map((subRow) => {
            const code = subRow.SubCategoryCode ? String(subRow.SubCategoryCode).trim() : null;
            const name = subRow.Description ? String(subRow.Description).trim() : null;
            if (!code || !name) return null;
            return {
              id: `${categoryCode}:${code}`,
              code: code,
              name: name,
              isActive: Boolean(subRow.IsActive)
            };
          })
          .filter(Boolean);

        return {
          id: categoryCode,
          code: categoryCode,
          name: getCategoryName(categoryCode),
          isActive: true,
          subcategories
        };
      })
    );

    res.json({
      status: 'success',
      data: {
        categories: categories.filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error fetching category hierarchy:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      sql: error.sql
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching category hierarchy',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { code, name, store_id, isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Category name is required'
      });
    }

    const storeId = store_id ? Number(store_id) : null;

    // Get current user and date for audit fields
    const userId = req.user?._id ?? req.user?.id ?? req.user?.email ?? 'System';
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS

    // Check if Category table exists
    const categoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
    `);

    if (categoryTableCheck.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'Category table does not exist'
      });
    }

    // Check CategoryCode column type
    const categoryCodeColumn = await query(`
      SELECT DATA_TYPE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
      AND COLUMN_NAME = 'CategoryCode'
    `);

    const isCategoryCodeInt = categoryCodeColumn.length > 0 &&
      (categoryCodeColumn[0].DATA_TYPE === 'int' || categoryCodeColumn[0].DATA_TYPE === 'bigint');
    const isAutoIncrement = categoryCodeColumn.length > 0 &&
      categoryCodeColumn[0].EXTRA && categoryCodeColumn[0].EXTRA.toLowerCase().includes('auto_increment');

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Category'
      AND COLUMN_NAME = 'store_id'
    `);

    const hasStoreIdColumn = storeIdColumnCheck.length > 0;

    // Determine category code to use
    let categoryCode = code;
    if (isCategoryCodeInt) {
      // If CategoryCode is INT, try to parse the code or generate one
      if (code) {
        const parsedCode = Number(code);
        if (Number.isInteger(parsedCode) && parsedCode > 0) {
          categoryCode = parsedCode;
        } else if (isAutoIncrement) {
          // If auto-increment, don't provide code
          categoryCode = null;
        } else {
          // Not a valid number and not auto-increment, generate one
          categoryCode = null; // Will generate below
        }
      } else if (isAutoIncrement) {
        categoryCode = null; // Let it auto-increment
      } else {
        // No code provided and not auto-increment, generate one
        categoryCode = null; // Will generate below
      }
    }

    // If categoryCode is null and not auto-increment, generate a new code
    if (categoryCode === null && !isAutoIncrement) {
      if (isCategoryCodeInt) {
        // Get the maximum CategoryCode and add 1
        const maxResult = await query('SELECT MAX(CategoryCode) as maxCode FROM Category');
        const maxCode = maxResult[0]?.maxCode || 0;
        categoryCode = Number(maxCode) + 1;
      } else {
        // For VARCHAR, generate a code from the name
        const baseCode = name.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 50);
        // Check if this code exists, if so append a number
        let checkCode = baseCode;
        let counter = 1;
        while (true) {
          const existingCheck = await query(
            'SELECT CategoryCode FROM Category WHERE CategoryCode = ?',
            [checkCode]
          );
          if (existingCheck.length === 0) {
            categoryCode = checkCode;
            break;
          }
          checkCode = `${baseCode}_${counter}`;
          counter++;
          if (counter > 1000) {
            // Fallback: use timestamp
            categoryCode = `CAT_${Date.now()}`;
            break;
          }
        }
      }
    }

    // Check if category already exists (with store_id filter if applicable)
    let existingQuery;
    const existingParams = [];

    if (categoryCode !== null) {
      existingQuery = 'SELECT CategoryCode FROM Category WHERE CategoryCode = ?';
      existingParams.push(categoryCode);

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
    } else {
      // If no code, check by name and store_id
      existingQuery = 'SELECT CategoryCode FROM Category WHERE Description = ?';
      existingParams.push(name);

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
    }

    const existing = await query(existingQuery, existingParams);

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Category with this ' + (categoryCode !== null ? 'code' : 'name') + ' already exists' + (hasStoreIdColumn && storeId ? ' for this store' : '')
      });
    }

    // Insert new category with audit fields
    if (hasStoreIdColumn) {
      if (categoryCode !== null) {
        await query(
          `INSERT INTO Category (CategoryCode, Description, store_id, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [categoryCode, name, storeId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      } else {
        await query(
          `INSERT INTO Category (Description, store_id, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?)`,
          [name, storeId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      }
    } else {
      if (categoryCode !== null) {
        await query(
          `INSERT INTO Category (CategoryCode, Description, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?)`,
          [categoryCode, name, isActive ? 1 : 0, currentDate, String(userId)]
        );
      } else {
        await query(
          `INSERT INTO Category (Description, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?)`,
          [name, isActive ? 1 : 0, currentDate, String(userId)]
        );
      }
    }

    // Fetch created category - use the last inserted ID or the code
    let selectQuery = 'SELECT CategoryCode, Description, IsActive';
    if (hasStoreIdColumn) {
      selectQuery += ', store_id';
    }

    let category;
    if (categoryCode !== null) {
      selectQuery += ' FROM Category WHERE CategoryCode = ?';
      [category] = await query(selectQuery, [categoryCode]);
    } else {
      // Get by name and store_id if available
      selectQuery += ' FROM Category WHERE Description = ?';
      const selectParams = [name];
      if (hasStoreIdColumn && storeId) {
        selectQuery += ' AND store_id = ?';
        selectParams.push(storeId);
      }
      selectQuery += ' ORDER BY CategoryCode DESC LIMIT 1';
      [category] = await query(selectQuery, selectParams);
    }

    if (!category) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve created category'
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Category created successfully',
      data: {
        id: category.CategoryCode,
        code: category.CategoryCode,
        name: category.Description,
        storeId: hasStoreIdColumn ? (category.store_id || null) : null,
        isActive: Boolean(category.IsActive)
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating category',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const categoryCode = req.params.id?.trim();
    if (!categoryCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid category id'
      });
    }

    const { name, store_id, isActive } = req.body;

    // Check if category exists
    const existing = await query(
      'SELECT CategoryCode FROM Category WHERE CategoryCode = ?',
      [categoryCode]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('Description = ?');
      params.push(name);
    }

    if (store_id !== undefined) {
      updates.push('store_id = ?');
      params.push(store_id ? Number(store_id) : null);
    }

    if (isActive !== undefined) {
      updates.push('IsActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    params.push(categoryCode);

    await query(
      `UPDATE Category SET ${updates.join(', ')} WHERE CategoryCode = ?`,
      params
    );

    // Fetch updated category
    const [category] = await query(
      'SELECT CategoryCode, Description, store_id, IsActive FROM Category WHERE CategoryCode = ?',
      [categoryCode]
    );

    res.json({
      status: 'success',
      message: 'Category updated successfully',
      data: {
        id: category.CategoryCode,
        code: category.CategoryCode,
        name: category.Description,
        storeId: category.store_id,
        isActive: Boolean(category.IsActive)
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating category'
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const categoryCode = req.params.id?.trim();
    if (!categoryCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid category id'
      });
    }

    // Check if category exists
    const existing = await query(
      'SELECT CategoryCode FROM Category WHERE CategoryCode = ?',
      [categoryCode]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }

    // Soft delete by setting IsActive to 0
    await query(
      'UPDATE Category SET IsActive = 0 WHERE CategoryCode = ?',
      [categoryCode]
    );

    res.json({
      status: 'success',
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting category'
    });
  }
};

export const createSubcategory = async (req, res) => {
  try {
    const { code, name, parent_id, store_id, isActive = true } = req.body;

    if (!name || !parent_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Subcategory name and parent_id are required'
      });
    }

    const storeId = store_id ? Number(store_id) : null;
    const parentId = Number(parent_id);

    if (!Number.isInteger(parentId) || parentId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parent_id. Must be a positive integer.'
      });
    }

    // Get current user and date for audit fields
    const userId = req.user?._id ?? req.user?.id ?? req.user?.email ?? 'System';
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS

    // Check if Subcategory table exists
    const subcategoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Subcategory'
    `);

    if (subcategoryTableCheck.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'Subcategory table does not exist'
      });
    }

    // Check SubCategoryCode column type
    const subcategoryCodeColumn = await query(`
      SELECT DATA_TYPE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Subcategory'
      AND COLUMN_NAME = 'SubCategoryCode'
    `);

    const isSubcategoryCodeInt = subcategoryCodeColumn.length > 0 &&
      (subcategoryCodeColumn[0].DATA_TYPE === 'int' || subcategoryCodeColumn[0].DATA_TYPE === 'bigint');
    const isAutoIncrement = subcategoryCodeColumn.length > 0 &&
      subcategoryCodeColumn[0].EXTRA && subcategoryCodeColumn[0].EXTRA.toLowerCase().includes('auto_increment');

    // Check if store_id column exists
    const storeIdColumnCheck = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Subcategory'
      AND COLUMN_NAME = 'store_id'
    `);

    const hasStoreIdColumn = storeIdColumnCheck.length > 0;

    // Determine subcategory code to use
    let subcategoryCode = code;
    if (isSubcategoryCodeInt) {
      // If SubCategoryCode is INT, try to parse the code or generate one
      if (code) {
        const parsedCode = Number(code);
        if (Number.isInteger(parsedCode) && parsedCode > 0) {
          subcategoryCode = parsedCode;
        } else if (isAutoIncrement) {
          // If auto-increment, don't provide code
          subcategoryCode = null;
        } else {
          // Not a valid number and not auto-increment, generate one
          subcategoryCode = null; // Will generate below
        }
      } else if (isAutoIncrement) {
        subcategoryCode = null; // Let it auto-increment
      } else {
        // No code provided and not auto-increment, generate one
        subcategoryCode = null; // Will generate below
      }
    }

    // If subcategoryCode is null and not auto-increment, generate a new code
    if (subcategoryCode === null && !isAutoIncrement) {
      if (isSubcategoryCodeInt) {
        // Get the maximum SubCategoryCode and add 1
        const maxResult = await query('SELECT MAX(SubCategoryCode) as maxCode FROM Subcategory');
        const maxCode = maxResult[0]?.maxCode || 0;
        subcategoryCode = Number(maxCode) + 1;
      } else {
        // For VARCHAR, generate a code from the name
        const baseCode = name.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 50);
        // Check if this code exists, if so append a number
        let checkCode = baseCode;
        let counter = 1;
        while (true) {
          const existingCheck = await query(
            'SELECT SubCategoryCode FROM Subcategory WHERE SubCategoryCode = ?',
            [checkCode]
          );
          if (existingCheck.length === 0) {
            subcategoryCode = checkCode;
            break;
          }
          checkCode = `${baseCode}_${counter}`;
          counter++;
          if (counter > 1000) {
            // Fallback: use timestamp
            subcategoryCode = `SUB_${Date.now()}`;
            break;
          }
        }
      }
    }

    // Check if subcategory already exists (with store_id filter if applicable)
    let existingQuery;
    const existingParams = [];

    if (subcategoryCode !== null) {
      existingQuery = 'SELECT SubCategoryCode FROM Subcategory WHERE SubCategoryCode = ?';
      existingParams.push(subcategoryCode);

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
    } else {
      // If no code, check by name, parent_id and store_id
      existingQuery = 'SELECT SubCategoryCode FROM Subcategory WHERE Description = ? AND ParentId = ?';
      existingParams.push(name, parentId);

      if (hasStoreIdColumn && storeId) {
        existingQuery += ' AND store_id = ?';
        existingParams.push(storeId);
      }
    }

    const existing = await query(existingQuery, existingParams);

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Subcategory with this ' + (subcategoryCode !== null ? 'code' : 'name') + ' already exists' + (hasStoreIdColumn && storeId ? ' for this store' : '')
      });
    }

    // Insert new subcategory with audit fields
    if (hasStoreIdColumn) {
      if (subcategoryCode !== null) {
        await query(
          `INSERT INTO Subcategory (SubCategoryCode, Description, ParentId, store_id, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [subcategoryCode, name, parentId, storeId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      } else {
        await query(
          `INSERT INTO Subcategory (Description, ParentId, store_id, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [name, parentId, storeId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      }
    } else {
      if (subcategoryCode !== null) {
        await query(
          `INSERT INTO Subcategory (SubCategoryCode, Description, ParentId, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [subcategoryCode, name, parentId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      } else {
        await query(
          `INSERT INTO Subcategory (Description, ParentId, IsActive, CreationDate, CreatedbyUser)
           VALUES (?, ?, ?, ?, ?)`,
          [name, parentId, isActive ? 1 : 0, currentDate, String(userId)]
        );
      }
    }

    // Fetch created subcategory
    let selectQuery = 'SELECT SubCategoryCode, Description, ParentId, IsActive';
    if (hasStoreIdColumn) {
      selectQuery += ', store_id';
    }

    let subcategory;
    if (subcategoryCode !== null) {
      selectQuery += ' FROM Subcategory WHERE SubCategoryCode = ?';
      [subcategory] = await query(selectQuery, [subcategoryCode]);
    } else {
      // Get by name, parent_id and store_id if available
      selectQuery += ' FROM Subcategory WHERE Description = ? AND ParentId = ?';
      const selectParams = [name, parentId];
      if (hasStoreIdColumn && storeId) {
        selectQuery += ' AND store_id = ?';
        selectParams.push(storeId);
      }
      selectQuery += ' ORDER BY SubCategoryCode DESC LIMIT 1';
      [subcategory] = await query(selectQuery, selectParams);
    }

    if (!subcategory) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve created subcategory'
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Subcategory created successfully',
      data: {
        id: `${parentId}:${subcategory.SubCategoryCode}`,
        code: subcategory.SubCategoryCode,
        name: subcategory.Description,
        parentId: subcategory.ParentId,
        storeId: hasStoreIdColumn ? (subcategory.store_id || null) : null,
        isActive: Boolean(subcategory.IsActive)
      }
    });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating subcategory',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateSubcategory = async (req, res) => {
  try {
    const subcategoryCode = req.params.id?.trim();
    if (!subcategoryCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subcategory id'
      });
    }

    const { name, parent_id, store_id, isActive } = req.body;

    // Check if subcategory exists
    const existing = await query(
      'SELECT SubCategoryCode FROM Subcategory WHERE SubCategoryCode = ?',
      [subcategoryCode]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Subcategory not found'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('Description = ?');
      params.push(name);
    }

    if (parent_id !== undefined) {
      updates.push('ParentId = ?');
      params.push(parent_id);
    }

    if (store_id !== undefined) {
      updates.push('store_id = ?');
      params.push(store_id ? Number(store_id) : null);
    }

    if (isActive !== undefined) {
      updates.push('IsActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    params.push(subcategoryCode);

    await query(
      `UPDATE Subcategory SET ${updates.join(', ')} WHERE SubCategoryCode = ?`,
      params
    );

    // Fetch updated subcategory
    const [subcategory] = await query(
      'SELECT SubCategoryCode, Description, ParentId, store_id, IsActive FROM Subcategory WHERE SubCategoryCode = ?',
      [subcategoryCode]
    );

    res.json({
      status: 'success',
      message: 'Subcategory updated successfully',
      data: {
        id: `${subcategory.ParentId}:${subcategory.SubCategoryCode}`,
        code: subcategory.SubCategoryCode,
        name: subcategory.Description,
        parentId: subcategory.ParentId,
        storeId: subcategory.store_id,
        isActive: Boolean(subcategory.IsActive)
      }
    });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating subcategory'
    });
  }
};

export const deleteSubcategory = async (req, res) => {
  try {
    const subcategoryCode = req.params.id?.trim();
    if (!subcategoryCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subcategory id'
      });
    }

    // Check if subcategory exists
    const existing = await query(
      'SELECT SubCategoryCode FROM Subcategory WHERE SubCategoryCode = ?',
      [subcategoryCode]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Subcategory not found'
      });
    }

    // Soft delete by setting IsActive to 0
    await query(
      'UPDATE Subcategory SET IsActive = 0 WHERE SubCategoryCode = ?',
      [subcategoryCode]
    );

    res.json({
      status: 'success',
      message: 'Subcategory deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting subcategory'
    });
  }
};

export const notImplemented = (feature) => (req, res) => {
  res.status(501).json({
    status: 'error',
    message: `${feature} is not available in the legacy Products dataset`
  });
};

