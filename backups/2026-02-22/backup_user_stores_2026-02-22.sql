-- Table Backup: user_stores
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:38.854Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `user_stores`
DROP TABLE IF EXISTS `user_stores`;
CREATE TABLE `user_stores` (
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`store_id`),
  KEY `store_id` (`store_id`),
  CONSTRAINT `user_stores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_stores_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `user_stores` (4 rows)
LOCK TABLES `user_stores` WRITE;
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 09:58:20', '2025-11-20 09:58:20', 10, 2);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 1);
INSERT INTO `user_stores` (`created_at`, `updated_at`, `user_id`, `store_id`) VALUES ('2025-11-20 12:36:26', '2025-11-20 12:36:26', 11, 2);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
