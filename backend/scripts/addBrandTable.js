import { query } from '../db/index.js';

/**
 * Migration script to create Brand table and add BrandCode column to Products table
 */
const addBrandTable = async () => {
  try {
    console.log('Starting migration to create Brand table and add BrandCode to Products...');

    // Check if Brand table exists
    const brandTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Brand'
    `);

    if (brandTableCheck.length === 0) {
      console.log('⚠️  Brand table not found. Creating Brand table...');
      
      // Create Brand table
      await query(`
        CREATE TABLE IF NOT EXISTS \`Brand\` (
          \`BrandCode\` VARCHAR(50) PRIMARY KEY,
          \`Description\` VARCHAR(200),
          \`IsActive\` TINYINT(1) DEFAULT 1,
          \`store_id\` INT UNSIGNED,
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_store_id\` (\`store_id\`),
          INDEX \`idx_is_active\` (\`IsActive\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Brand table created');
    } else {
      console.log('✅ Brand table already exists');
      
      // Check if store_id column exists
      const storeIdColumnCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Brand'
        AND COLUMN_NAME = 'store_id'
      `);
      
      if (storeIdColumnCheck.length === 0) {
        console.log('⚠️  Adding store_id column to Brand table...');
        await query(`
          ALTER TABLE \`Brand\`
          ADD COLUMN \`store_id\` INT UNSIGNED AFTER \`IsActive\`,
          ADD INDEX \`idx_store_id\` (\`store_id\`)
        `);
        console.log('✅ store_id column added to Brand table');
      }
    }

    // Check if Products table exists
    const productsTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Products'
    `);

    if (productsTableCheck.length > 0) {
      // Check if BrandCode column exists in Products table
      const brandCodeColumnCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Products'
        AND COLUMN_NAME = 'BrandCode'
      `);

      if (brandCodeColumnCheck.length === 0) {
        console.log('⚠️  Adding BrandCode column to Products table...');
        
        // Check if ManufacturerCode exists (might be used for brand)
        const manufacturerCodeCheck = await query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'Products'
          AND COLUMN_NAME = 'ManufacturerCode'
        `);

        // Add BrandCode column after SubCategoryCode or ManufacturerCode if exists
        let afterColumn = 'SubCategoryCode';
        if (manufacturerCodeCheck.length > 0) {
          afterColumn = 'ManufacturerCode';
        }

        await query(`
          ALTER TABLE \`Products\`
          ADD COLUMN \`BrandCode\` VARCHAR(50) AFTER \`${afterColumn}\`,
          ADD INDEX \`idx_brand_code\` (\`BrandCode\`)
        `);
        console.log('✅ BrandCode column added to Products table');
        
        // Optionally migrate existing ManufacturerCode values to BrandCode
        if (manufacturerCodeCheck.length > 0) {
          console.log('⚠️  Migrating ManufacturerCode values to BrandCode...');
          await query(`
            UPDATE \`Products\`
            SET \`BrandCode\` = \`ManufacturerCode\`
            WHERE \`ManufacturerCode\` IS NOT NULL 
              AND \`ManufacturerCode\` <> ''
              AND \`BrandCode\` IS NULL
          `);
          console.log('✅ ManufacturerCode values migrated to BrandCode');
        }
      } else {
        console.log('✅ BrandCode column already exists in Products table');
      }
    } else {
      console.log('⚠️  Products table not found. Skipping BrandCode column addition.');
    }

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

// Run migration if called directly
if (import.meta.url.endsWith(process.argv[1]) || import.meta.url.includes('addBrandTable.js')) {
  addBrandTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

export default addBrandTable;

