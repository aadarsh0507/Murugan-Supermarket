-- Table Backup: supplier_stores
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.293Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `supplier_stores`
DROP TABLE IF EXISTS `supplier_stores`;
CREATE TABLE `supplier_stores` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned NOT NULL,
  `priority` int unsigned DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_stores_storeId_supplierId_unique` (`supplier_id`,`store_id`),
  UNIQUE KEY `supplier_stores_supplier_id_store_id` (`supplier_id`,`store_id`),
  KEY `store_id` (`store_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `supplier_stores` (3 rows)
LOCK TABLES `supplier_stores` WRITE;
INSERT INTO `supplier_stores` (`id`, `supplier_id`, `store_id`, `priority`, `is_primary`, `created_at`, `updated_at`) VALUES (2, 94, 1, NULL, 0, '2026-03-24 09:58:39', '2026-03-24 09:58:39');
INSERT INTO `supplier_stores` (`id`, `supplier_id`, `store_id`, `priority`, `is_primary`, `created_at`, `updated_at`) VALUES (5, 99, 1, NULL, 0, '2026-03-24 10:05:16', '2026-03-24 10:05:16');
INSERT INTO `supplier_stores` (`id`, `supplier_id`, `store_id`, `priority`, `is_primary`, `created_at`, `updated_at`) VALUES (6, 99, 2, NULL, 0, '2026-03-24 10:05:45', '2026-03-24 10:05:45');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
