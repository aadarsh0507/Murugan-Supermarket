-- Migration: Add gst_number column to stores table
-- Run this manually if the auto-migration doesn't work
-- This will fail if the column already exists, which is fine

ALTER TABLE stores 
ADD COLUMN gst_number VARCHAR(20) NULL AFTER email;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'stores' 
  AND COLUMN_NAME = 'gst_number';

