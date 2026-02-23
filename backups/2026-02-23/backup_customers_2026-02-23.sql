-- Table Backup: customers
-- Database: Super_Market
-- Date: 2026-02-23
-- Generated: 2026-02-23T14:29:12.887Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `customers`
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `store_id` bigint unsigned DEFAULT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_purchase_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_store_phone_unique` (`store_id`,`phone`),
  KEY `customers_phone_idx` (`phone`),
  KEY `customers_store_idx` (`store_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customers` (1 rows)
LOCK TABLES `customers` WRITE;
INSERT INTO `customers` (`id`, `store_id`, `name`, `phone`, `email`, `address`, `gstin`, `last_purchase_at`, `created_at`, `updated_at`) VALUES (5, 1, 'Om Sakthi', '9150690961', NULL, NULL, NULL, '2025-11-20 11:56:18', '2025-11-20 11:56:18', '2025-11-20 11:56:18');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
