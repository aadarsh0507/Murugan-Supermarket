-- Adds store_id and screen_id columns to the users table and migrates existing data.
-- Run this script against your MySQL database after taking a backup.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS store_id BIGINT UNSIGNED NULL AFTER selected_store_id,
    ADD COLUMN IF NOT EXISTS screen_id VARCHAR(255) NULL AFTER preferences;

-- Add a supporting index to speed up joins on store_id if it doesn't already exist.
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users (store_id);

