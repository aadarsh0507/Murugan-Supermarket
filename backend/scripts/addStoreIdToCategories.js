import { query } from '../db/index.js';

/**
 * Migration script to add store_id field to Category and Subcategory tables
 * This allows filtering categories and subcategories by store
 */
const addStoreIdToCategories = async () => {
  try {
    console.log('Starting migration to add store_id to Category and Subcategory tables...');

    // Check if Category table exists
    const categoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND (TABLE_NAME = 'Category' OR TABLE_NAME = 'category' OR TABLE_NAME = 'categories')
    `);

    if (categoryTableCheck.length === 0) {
      console.log('⚠️  Category table not found. Creating Category table...');
      
      // Create Category table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS \`Category\` (
          \`CategoryCode\` VARCHAR(50) PRIMARY KEY,
          \`Description\` VARCHAR(200),
          \`IsActive\` TINYINT(1) DEFAULT 1,
          \`store_id\` INT UNSIGNED,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_store_id\` (\`store_id\`),
          INDEX \`idx_is_active\` (\`IsActive\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Category table created with store_id field');
    } else {
      const tableName = categoryTableCheck[0].TABLE_NAME;
      console.log(`Found Category table: ${tableName}`);

      // Check if store_id column already exists
      const categoryColumns = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'store_id'
      `, [tableName]);

      if (categoryColumns.length === 0) {
        console.log(`Adding store_id column to ${tableName} table...`);
        
        // First, check if index exists to avoid errors
        const indexCheck = await query(`
          SELECT INDEX_NAME 
          FROM information_schema.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ? 
          AND INDEX_NAME = 'idx_store_id'
        `, [tableName]);
        
        try {
          // Try to add column after IsActive
          await query(`
            ALTER TABLE \`${tableName}\` 
            ADD COLUMN \`store_id\` INT UNSIGNED NULL AFTER \`IsActive\`
          `);
          console.log(`✅ Added store_id column to ${tableName} table`);
          
          // Add index if it doesn't exist
          if (indexCheck.length === 0) {
            await query(`
              ALTER TABLE \`${tableName}\` 
              ADD INDEX \`idx_store_id\` (\`store_id\`)
            `);
            console.log(`✅ Added index on store_id column`);
          }
        } catch (alterError) {
          // If AFTER clause fails, try without it
          console.log(`⚠️  Failed to add column with AFTER clause, trying without...`);
          try {
            await query(`
              ALTER TABLE \`${tableName}\` 
              ADD COLUMN \`store_id\` INT UNSIGNED NULL
            `);
            console.log(`✅ Added store_id column to ${tableName} table (without position)`);
            
            // Add index if it doesn't exist
            if (indexCheck.length === 0) {
              await query(`
                ALTER TABLE \`${tableName}\` 
                ADD INDEX \`idx_store_id\` (\`store_id\`)
              `);
              console.log(`✅ Added index on store_id column`);
            }
          } catch (secondError) {
            console.error(`❌ Failed to add store_id column:`, secondError.message);
            throw secondError;
          }
        }
      } else {
        console.log(`✅ store_id column already exists in ${tableName} table`);
        
        // Ensure index exists even if column exists
        const indexCheck = await query(`
          SELECT INDEX_NAME 
          FROM information_schema.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ? 
          AND INDEX_NAME = 'idx_store_id'
        `, [tableName]);
        
        if (indexCheck.length === 0) {
          console.log(`Adding missing index on store_id...`);
          await query(`
            ALTER TABLE \`${tableName}\` 
            ADD INDEX \`idx_store_id\` (\`store_id\`)
          `);
          console.log(`✅ Added index on store_id column`);
        }
      }
    }

    // Check if Subcategory table exists
    const subcategoryTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND (TABLE_NAME = 'Subcategory' OR TABLE_NAME = 'subcategory' OR TABLE_NAME = 'sub_categories')
    `);

    if (subcategoryTableCheck.length === 0) {
      console.log('⚠️  Subcategory table not found. Creating Subcategory table...');
      
      // Create Subcategory table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS \`Subcategory\` (
          \`SubCategoryCode\` VARCHAR(50) PRIMARY KEY,
          \`Description\` VARCHAR(200),
          \`ParentId\` VARCHAR(50),
          \`IsActive\` TINYINT(1) DEFAULT 1,
          \`store_id\` INT UNSIGNED,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_store_id\` (\`store_id\`),
          INDEX \`idx_parent_id\` (\`ParentId\`),
          INDEX \`idx_is_active\` (\`IsActive\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Subcategory table created with store_id field');
    } else {
      const tableName = subcategoryTableCheck[0].TABLE_NAME;
      console.log(`Found Subcategory table: ${tableName}`);

      // Check if store_id column already exists
      const subcategoryColumns = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND COLUMN_NAME = 'store_id'
      `, [tableName]);

      if (subcategoryColumns.length === 0) {
        console.log(`Adding store_id column to ${tableName} table...`);
        
        // First, check if index exists to avoid errors
        const indexCheck = await query(`
          SELECT INDEX_NAME 
          FROM information_schema.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ? 
          AND INDEX_NAME = 'idx_store_id'
        `, [tableName]);
        
        try {
          // Try to add column after IsActive
          await query(`
            ALTER TABLE \`${tableName}\` 
            ADD COLUMN \`store_id\` INT UNSIGNED NULL AFTER \`IsActive\`
          `);
          console.log(`✅ Added store_id column to ${tableName} table`);
          
          // Add index if it doesn't exist
          if (indexCheck.length === 0) {
            await query(`
              ALTER TABLE \`${tableName}\` 
              ADD INDEX \`idx_store_id\` (\`store_id\`)
            `);
            console.log(`✅ Added index on store_id column`);
          }
        } catch (alterError) {
          // If AFTER clause fails, try without it
          console.log(`⚠️  Failed to add column with AFTER clause, trying without...`);
          try {
            await query(`
              ALTER TABLE \`${tableName}\` 
              ADD COLUMN \`store_id\` INT UNSIGNED NULL
            `);
            console.log(`✅ Added store_id column to ${tableName} table (without position)`);
            
            // Add index if it doesn't exist
            if (indexCheck.length === 0) {
              await query(`
                ALTER TABLE \`${tableName}\` 
                ADD INDEX \`idx_store_id\` (\`store_id\`)
              `);
              console.log(`✅ Added index on store_id column`);
            }
          } catch (secondError) {
            console.error(`❌ Failed to add store_id column:`, secondError.message);
            throw secondError;
          }
        }
      } else {
        console.log(`✅ store_id column already exists in ${tableName} table`);
        
        // Ensure index exists even if column exists
        const indexCheck = await query(`
          SELECT INDEX_NAME 
          FROM information_schema.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ? 
          AND INDEX_NAME = 'idx_store_id'
        `, [tableName]);
        
        if (indexCheck.length === 0) {
          console.log(`Adding missing index on store_id...`);
          await query(`
            ALTER TABLE \`${tableName}\` 
            ADD INDEX \`idx_store_id\` (\`store_id\`)
          `);
          console.log(`✅ Added index on store_id column`);
        }
      }
    }

    // Verify the changes
    console.log('\n📋 Verification:');
    
    const categoryTable = categoryTableCheck.length > 0 ? categoryTableCheck[0].TABLE_NAME : 'Category';
    
    // Check if store_id exists
    const storeIdCheck = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
      AND COLUMN_NAME = 'store_id'
    `, [categoryTable]);
    
    if (storeIdCheck.length > 0) {
      console.log(`\n✅ Category table (${categoryTable}) - store_id column exists:`);
      storeIdCheck.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}, ${col.COLUMN_KEY || 'no key'})`);
      });
    } else {
      console.log(`\n❌ Category table (${categoryTable}) - store_id column NOT FOUND!`);
      console.log(`   Please check the migration output above for errors.`);
    }
    
    // Show all columns for reference
    const allCategoryCols = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [categoryTable]);
    
    console.log(`\nAll columns in Category table:`);
    allCategoryCols.forEach(col => {
      const marker = col.COLUMN_NAME === 'store_id' ? ' ✅' : '';
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})${marker}`);
    });

    const subcategoryTable = subcategoryTableCheck.length > 0 ? subcategoryTableCheck[0].TABLE_NAME : 'Subcategory';
    
    // Check if store_id exists
    const subStoreIdCheck = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = ?
      AND COLUMN_NAME = 'store_id'
    `, [subcategoryTable]);
    
    if (subStoreIdCheck.length > 0) {
      console.log(`\n✅ Subcategory table (${subcategoryTable}) - store_id column exists:`);
      subStoreIdCheck.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}, ${col.COLUMN_KEY || 'no key'})`);
      });
    } else {
      console.log(`\n❌ Subcategory table (${subcategoryTable}) - store_id column NOT FOUND!`);
      console.log(`   Please check the migration output above for errors.`);
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    process.exit(1);
  }
};

// Run the migration
addStoreIdToCategories();

