import { query } from '../db/index.js';
import pool from '../db/index.js';

/**
 * Migration script to rename equipments table to appliance
 */
async function migrateEquipmentsToAppliance() {
  try {
    console.log('Starting migration: equipments -> appliance...');
    console.log('Connecting to database...');

    // Check if equipments table exists
    console.log('Checking for equipments table...');
    const equipmentsTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'equipments'
    `);
    console.log(`Found equipments table: ${equipmentsTableCheck.length > 0}`);

    if (equipmentsTableCheck.length === 0) {
      console.log('✅ equipments table does not exist. Checking for appliance table...');
      
      // Check if appliance table already exists
      const applianceTableCheck = await query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'appliance'
      `);

      if (applianceTableCheck.length > 0) {
        console.log('✅ appliance table already exists. Migration not needed.');
      } else {
        console.log('⚠️  Neither equipments nor appliance table exists.');
      }
      return;
    }

    // Check if appliance table already exists
    const applianceTableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appliance'
    `);

    if (applianceTableCheck.length > 0) {
      console.log('⚠️  appliance table already exists. Cannot rename equipments to appliance.');
      console.log('   Please drop the appliance table first or rename it to something else.');
      return;
    }

    console.log('\n📝 Renaming equipments table to appliance...');
    
    // Rename the table
    await query(`RENAME TABLE equipments TO appliance`);
    console.log('  ✅ Renamed equipments table to appliance');

    // Check if equipment_id column exists, if not rename id to appliance_id
    const columns = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appliance'
      ORDER BY ORDINAL_POSITION
    `);

    const hasEquipmentId = columns.some(col => col.COLUMN_NAME === 'equipment_id');
    const hasId = columns.some(col => col.COLUMN_NAME === 'id');

    if (hasId && !hasEquipmentId) {
      console.log('\n📝 Renaming id column to appliance_id...');
      const idColumn = columns.find(col => col.COLUMN_NAME === 'id');
      const currentType = idColumn.DATA_TYPE;
      const isAutoIncrement = idColumn.EXTRA && idColumn.EXTRA.toLowerCase().includes('auto_increment');
      
      await query(`ALTER TABLE appliance CHANGE COLUMN id appliance_id ${currentType.toUpperCase()}${isAutoIncrement ? ' AUTO_INCREMENT' : ''} NOT NULL PRIMARY KEY`);
      console.log('  ✅ Renamed id to appliance_id');
    } else if (hasEquipmentId) {
      console.log('\n📝 Renaming equipment_id column to appliance_id...');
      const equipmentIdColumn = columns.find(col => col.COLUMN_NAME === 'equipment_id');
      const currentType = equipmentIdColumn.DATA_TYPE;
      const isAutoIncrement = equipmentIdColumn.EXTRA && equipmentIdColumn.EXTRA.toLowerCase().includes('auto_increment');
      
      await query(`ALTER TABLE appliance CHANGE COLUMN equipment_id appliance_id ${currentType.toUpperCase()}${isAutoIncrement ? ' AUTO_INCREMENT' : ''} NOT NULL PRIMARY KEY`);
      console.log('  ✅ Renamed equipment_id to appliance_id');
    } else {
      console.log('\n⚠️  Neither id nor equipment_id column found. Creating appliance_id...');
      await query(`ALTER TABLE appliance ADD COLUMN appliance_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST`);
      console.log('  ✅ Created appliance_id column');
    }

    // Verify final structure
    console.log('\n📋 Verifying final structure...');
    const finalColumns = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appliance'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nFinal appliance table structure:');
    finalColumns.forEach(col => {
      const marker = col.COLUMN_NAME === 'appliance_id' ? ' ✅' : '';
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.COLUMN_KEY || 'no key'}, ${col.EXTRA || 'no extra'})${marker}`);
    });

    // Verify table rename
    const equipmentsCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'equipments'
    `);
    const applianceCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appliance'
    `);

    if (equipmentsCheck.length === 0 && applianceCheck.length > 0) {
      console.log('\n✅ Table successfully renamed from equipments to appliance');
    } else if (equipmentsCheck.length > 0) {
      console.log('\n❌ ERROR: equipments table still exists!');
    } else if (applianceCheck.length === 0) {
      console.log('\n❌ ERROR: appliance table not found!');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    throw error;
  } finally {
    // Close database connection pool
    try {
      await pool.end();
      console.log('Database connection pool closed.');
    } catch (closeError) {
      console.error('Error closing connection pool:', closeError.message);
    }
  }
}

// Always run if this file is executed directly
migrateEquipmentsToAppliance()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

export default migrateEquipmentsToAppliance;

