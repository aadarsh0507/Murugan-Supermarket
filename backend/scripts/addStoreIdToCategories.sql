-- Direct SQL script to add store_id to Category and Subcategory tables
-- Run this if the Node.js migration script doesn't work

-- Add store_id to Category table
ALTER TABLE `Category` 
ADD COLUMN `store_id` INT UNSIGNED NULL;

-- Add index on store_id for Category table
CREATE INDEX `idx_store_id` ON `Category` (`store_id`);

-- Add store_id to Subcategory table
ALTER TABLE `Subcategory` 
ADD COLUMN `store_id` INT UNSIGNED NULL;

-- Add index on store_id for Subcategory table
CREATE INDEX `idx_store_id` ON `Subcategory` (`store_id`);

-- Verify the changes
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'Category' 
AND COLUMN_NAME = 'store_id';

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'Subcategory' 
AND COLUMN_NAME = 'store_id';

