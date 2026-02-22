-- Migration: Add edit_rights column to users table
-- Run this manually if the auto-migration doesn't work
-- This will fail if the column already exists, which is fine

ALTER TABLE users 
ADD COLUMN edit_rights JSON NULL AFTER screen_id;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'edit_rights';

