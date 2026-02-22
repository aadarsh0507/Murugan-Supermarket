ALTER TABLE `users`
ADD COLUMN `is_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `screen_id`;

UPDATE `users`
SET `is_admin` = 1
WHERE `email` IN ('admin@example.com');

-- Remove the UPDATE above or adjust its WHERE clause to seed specific admin users.

