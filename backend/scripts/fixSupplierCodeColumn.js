import { query } from '../db/index.js';

/**
 * Migration script to fix the corrupted SUPPLIERCODE column name
 * The column has UTF-8 BOM characters (ï»¿) that need to be removed
 */
const fixSupplierCodeColumn = async () => {
  try {
    console.log('Starting migration to fix SUPPLIERCODE column...');

    // First, check if the corrupted column exists
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Suppliers'
      AND COLUMN_NAME LIKE '%SUPPLIERCODE%'
    `);

    console.log('Found columns:', columns.map(c => c.COLUMN_NAME));

    // Check if the corrupted column exists
    const corruptedColumn = columns.find(c => 
      c.COLUMN_NAME.includes('ï»¿') || 
      c.COLUMN_NAME.charCodeAt(0) === 0xFEFF || // UTF-8 BOM
      c.COLUMN_NAME.startsWith('\uFEFF') // BOM character
    );

    if (corruptedColumn) {
      const corruptedName = corruptedColumn.COLUMN_NAME;
      console.log(`Found corrupted column: "${corruptedName}"`);
      console.log(`Column name bytes:`, Buffer.from(corruptedName).toString('hex'));

      // Check if SUPPLIERCODE already exists (without BOM)
      const cleanColumnExists = columns.some(c => 
        c.COLUMN_NAME === 'SUPPLIERCODE' || 
        c.COLUMN_NAME === 'Suppliercode'
      );

      if (cleanColumnExists) {
        console.log('SUPPLIERCODE column already exists. Dropping corrupted column...');
        // Drop the corrupted column if clean one exists
        await query(`ALTER TABLE \`Suppliers\` DROP COLUMN \`${corruptedName}\``);
        console.log('Corrupted column dropped successfully');
      } else {
        // Rename the corrupted column to clean name
        console.log('Renaming corrupted column to SUPPLIERCODE...');
        
        // Use backticks to handle the BOM character in column name
        // MySQL requires the exact column name including BOM
        await query(`
          ALTER TABLE \`Suppliers\` 
          CHANGE COLUMN \`${corruptedName}\` \`SUPPLIERCODE\` INT UNSIGNED NOT NULL AUTO_INCREMENT
        `);
        
        console.log('Column renamed successfully from corrupted name to SUPPLIERCODE');
      }
    } else {
      // Check if we need to create it or if it already exists correctly
      const supplierCodeExists = columns.some(c => 
        c.COLUMN_NAME === 'SUPPLIERCODE' || 
        c.COLUMN_NAME === 'Suppliercode'
      );

      if (!supplierCodeExists) {
        console.log('SUPPLIERCODE column not found. This might be a different issue.');
        console.log('Please check the table structure manually.');
      } else {
        console.log('SUPPLIERCODE column already exists with correct name. No migration needed.');
      }
    }

    // Verify the fix
    const verifyColumns = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Suppliers'
      AND COLUMN_NAME LIKE '%SUPPLIERCODE%'
    `);

    console.log('\nVerification - SUPPLIERCODE related columns:');
    verifyColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, ${col.COLUMN_KEY})`);
    });

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
fixSupplierCodeColumn();

