import { query } from '../db/index.js';

/**
 * Adds subcategory_id to Brand so brands can be scoped to a subcategory (matches frontend composite id: categoryCode:subCode).
 */
const addBrandSubcategoryColumn = async () => {
  try {
    const brandTableCheck = await query(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Brand'
    `);
    if (brandTableCheck.length === 0) {
      console.log('Brand table not found; run addBrandTable first.');
      return;
    }

    const col = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Brand' AND COLUMN_NAME = 'subcategory_id'
    `);
    if (col.length > 0) {
      console.log('subcategory_id already exists on Brand.');
      return;
    }

    await query(`
      ALTER TABLE \`Brand\`
      ADD COLUMN \`subcategory_id\` VARCHAR(150) NULL AFTER \`store_id\`,
      ADD INDEX \`idx_brand_subcategory\` (\`subcategory_id\`)
    `);
    console.log('Added subcategory_id to Brand.');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

if (import.meta.url.endsWith(process.argv[1]) || import.meta.url.includes('addBrandSubcategoryColumn.js')) {
  addBrandSubcategoryColumn()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default addBrandSubcategoryColumn;
