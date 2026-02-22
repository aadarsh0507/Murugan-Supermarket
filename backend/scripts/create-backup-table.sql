-- Create backup_files table in GLOBAL DB (ONE TIME SETUP)
-- Run this SQL in your global MySQL database

CREATE TABLE IF NOT EXISTS db_backups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_db VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  backup_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source_db (source_db),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table was created
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'db_backups';

