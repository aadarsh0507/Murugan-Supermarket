-- Migrates data from the legacy `screens` column into `screen_id` (if needed)
-- and drops the deprecated column safely. Run this after deploying the code
-- changes that no longer reference `users.screens`.

SET @has_screens_column := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'screens'
);

SET @migrate_sql := IF(
    @has_screens_column > 0,
    'UPDATE users SET screen_id = screens WHERE (screen_id IS NULL OR screen_id = '''') AND screens IS NOT NULL AND screens <> '''';',
    'SELECT 1'
);
PREPARE migrate_stmt FROM @migrate_sql;
EXECUTE migrate_stmt;
DEALLOCATE PREPARE migrate_stmt;

SET @drop_sql := IF(
    @has_screens_column > 0,
    'ALTER TABLE users DROP COLUMN screens;',
    'SELECT 1'
);
PREPARE drop_stmt FROM @drop_sql;
EXECUTE drop_stmt;
DEALLOCATE PREPARE drop_stmt;

