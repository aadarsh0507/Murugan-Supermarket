import { query } from '../db/index.js';

/**
 * Migration script to:
 * 1. Remove equipment_code column
 * 2. Rename id column to equipment_id
 * 3. Change equipment_id to INT with auto-increment and primary key
 */
async function migrateEquipmentsTable() {
  try {
    console.log('Starting equipments table migration...');

    // Check if equipments table exists
    const tableCheck = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'equipments'
    `);

    if (tableCheck.length === 0) {
      console.log('✅ Equipments table does not exist. Migration not needed.');
      return;
    }

    // Check current structure
    const columns = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'equipments'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nCurrent equipments table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.COLUMN_KEY || 'no key'}, ${col.EXTRA || 'no extra'})`);
    });

    // Step 1: Check if equipment_code column exists and remove it
    const equipmentCodeExists = columns.some(col => col.COLUMN_NAME === 'equipment_code');
    if (equipmentCodeExists) {
      console.log('\n📝 Step 1: Removing equipment_code column...');
      
      // Drop index on equipment_code if it exists
      try {
        await query(`ALTER TABLE equipments DROP INDEX idx_equipment_code`);
        console.log('  ✅ Dropped idx_equipment_code index');
      } catch (error) {
        if (!error.message.includes("Unknown key")) {
          console.log('  ⚠️  Could not drop idx_equipment_code index:', error.message);
        }
      }

      // Drop foreign key constraints if any (check first)
      const fkCheck = await query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'equipments' 
        AND COLUMN_NAME = 'equipment_code'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      for (const fk of fkCheck) {
        try {
          await query(`ALTER TABLE equipments DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
          console.log(`  ✅ Dropped foreign key ${fk.CONSTRAINT_NAME}`);
        } catch (error) {
          console.log(`  ⚠️  Could not drop foreign key ${fk.CONSTRAINT_NAME}:`, error.message);
        }
      }

      // Remove the column
      await query(`ALTER TABLE equipments DROP COLUMN equipment_code`);
      console.log('  ✅ Removed equipment_code column');
    } else {
      console.log('\n✅ Step 1: equipment_code column does not exist (already removed)');
    }

    // Step 2: Check if id column exists and rename it to equipment_id
    const idExists = columns.some(col => col.COLUMN_NAME === 'id');
    const equipmentIdExists = columns.some(col => col.COLUMN_NAME === 'equipment_id');

    if (idExists && !equipmentIdExists) {
      console.log('\n📝 Step 2: Renaming id column to equipment_id...');
      
      // Get current id column properties
      const idColumn = columns.find(col => col.COLUMN_NAME === 'id');
      const currentType = idColumn.DATA_TYPE;
      const isAutoIncrement = idColumn.EXTRA && idColumn.EXTRA.toLowerCase().includes('auto_increment');
      
      // Rename the column
      await query(`ALTER TABLE equipments CHANGE COLUMN id equipment_id ${currentType.toUpperCase()}${isAutoIncrement ? ' AUTO_INCREMENT' : ''} NOT NULL PRIMARY KEY`);
      console.log('  ✅ Renamed id to equipment_id');
    } else if (equipmentIdExists) {
      console.log('\n✅ Step 2: equipment_id column already exists');
    } else {
      console.log('\n⚠️  Step 2: Neither id nor equipment_id column found!');
    }

    // Step 3: Ensure equipment_id is INT with auto-increment and primary key
    if (equipmentIdExists || idExists) {
      console.log('\n📝 Step 3: Ensuring equipment_id is INT with auto-increment and primary key...');
      
      const currentColumn = columns.find(col => col.COLUMN_NAME === 'equipment_id' || col.COLUMN_NAME === 'id');
      const currentType = currentColumn.DATA_TYPE;
      const isAutoIncrement = currentColumn.EXTRA && currentColumn.EXTRA.toLowerCase().includes('auto_increment');
      const isPrimaryKey = currentColumn.COLUMN_KEY === 'PRI';

      if (currentType !== 'int' || !isAutoIncrement || !isPrimaryKey) {
        // Drop primary key if it exists on a different column
        if (isPrimaryKey && currentColumn.COLUMN_NAME !== 'equipment_id') {
          try {
            await query(`ALTER TABLE equipments DROP PRIMARY KEY`);
            console.log('  ✅ Dropped existing primary key');
          } catch (error) {
            console.log('  ⚠️  Could not drop primary key:', error.message);
          }
        }

        // Modify the column
        const columnName = equipmentIdExists ? 'equipment_id' : 'id';
        await query(`ALTER TABLE equipments MODIFY COLUMN ${columnName} INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY`);
        console.log(`  ✅ Modified ${columnName} to INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`);
      } else {
        console.log('  ✅ equipment_id is already INT with auto-increment and primary key');
      }
    }

    // Verify final structure
    console.log('\n📋 Verifying final structure...');
    const finalColumns = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'equipments'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nFinal equipments table structure:');
    finalColumns.forEach(col => {
      const marker = col.COLUMN_NAME === 'equipment_id' ? ' ✅' : '';
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.COLUMN_KEY || 'no key'}, ${col.EXTRA || 'no extra'})${marker}`);
    });

    // Check for equipment_code (should not exist)
    const equipmentCodeCheck = finalColumns.some(col => col.COLUMN_NAME === 'equipment_code');
    const equipmentIdCheck = finalColumns.some(col => col.COLUMN_NAME === 'equipment_id');
    const idCheck = finalColumns.some(col => col.COLUMN_NAME === 'id');

    if (equipmentCodeCheck) {
      console.log('\n❌ ERROR: equipment_code column still exists!');
    } else {
      console.log('\n✅ equipment_code column successfully removed');
    }

    if (equipmentIdCheck && !idCheck) {
      console.log('✅ equipment_id column exists and id column removed');
    } else if (idCheck && !equipmentIdCheck) {
      console.log('⚠️  WARNING: id column still exists, equipment_id not found!');
    } else if (equipmentIdCheck && idCheck) {
      console.log('⚠️  WARNING: Both id and equipment_id columns exist!');
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
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateEquipmentsTable()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateEquipmentsTable;

