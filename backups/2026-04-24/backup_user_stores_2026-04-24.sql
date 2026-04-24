-- Table Backup: user_stores
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:22.380Z

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

-- Dumping data for table `user_stores` (9 rows)
LOCK TABLES `user_stores` WRITE;
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-03-30 10:51:28', '2026-03-30 10:51:28', 12, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-03-30 10:51:28', '2026-03-30 10:51:28', 12, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-04-18 14:38:40', '2026-04-18 14:38:40', 13, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-04-18 14:38:40', '2026-04-18 14:38:40', 13, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2026-04-21 02:28:52', '2026-04-21 02:28:52', 14, 2);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
