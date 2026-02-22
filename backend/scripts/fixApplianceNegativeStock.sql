-- Fix appliance table to allow negative stock values
-- Run this script in MySQL Workbench or via command line

USE Super_Market;

-- Check current column type
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'Super_Market'
  AND TABLE_NAME = 'appliance'
  AND COLUMN_NAME = 'qty_on_hand';

-- Alter the column to allow negative values
ALTER TABLE appliance
MODIFY COLUMN qty_on_hand INT NOT NULL DEFAULT 0;

-- Verify the change
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'Super_Market'
  AND TABLE_NAME = 'appliance'
  AND COLUMN_NAME = 'qty_on_hand';

-- The column should now show as 'int' instead of 'int unsigned'

