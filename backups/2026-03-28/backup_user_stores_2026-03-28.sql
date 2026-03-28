-- Table Backup: user_stores
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.332Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `user_stores`
DROP TABLE IF EXISTS `user_stores`;
CREATE TABLE `user_stores` (
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`store_id`),
  KEY `store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `user_stores` (6 rows)
LOCK TABLES `user_stores` WRITE;
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-01-31 09:21:59', '2026-01-31 09:21:59', 13, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-03-24 09:52:05', '2026-03-24 09:52:05', 14, 1);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
