-- Table Backup: customers
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:15.224Z

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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customers` (4 rows)
LOCK TABLES `customers` WRITE;
INSERT INTO `customers` (`id`, `store_id`, `name`, `phone`, `email`, `address`, `gstin`, `last_purchase_at`, `created_at`, `updated_at`) VALUES (5, 1, 'Surendar', '9150690961', NULL, NULL, NULL, '2026-04-18 13:49:19', '2025-11-20 11:56:18', '2026-04-18 13:49:19');
INSERT INTO `customers` (`id`, `store_id`, `name`, `phone`, `email`, `address`, `gstin`, `last_purchase_at`, `created_at`, `updated_at`) VALUES (6, 2, 'Surendar', '9150690961', NULL, NULL, '123654851255325', '2026-04-19 12:33:30', '2026-04-18 13:48:37', '2026-04-19 07:03:34');
INSERT INTO `customers` (`id`, `store_id`, `name`, `phone`, `email`, `address`, `gstin`, `last_purchase_at`, `created_at`, `updated_at`) VALUES (7, 2, 'surren', '9042361614', '7surren@gmail.com', '23 pillaiyar kovil st', '123456789YYEETU', '2026-04-21 07:15:31', '2026-04-19 02:48:45', '2026-04-21 02:20:37');
INSERT INTO `customers` (`id`, `store_id`, `name`, `phone`, `email`, `address`, `gstin`, `last_purchase_at`, `created_at`, `updated_at`) VALUES (8, 2, 'surren', '904236164', '7surren@gmail.com', 'no 23 vinayagar Kovil street Pudupettai,Acharapakkam', '456789012345677', '2026-04-24 12:51:20', '2026-04-24 07:24:24', '2026-04-24 07:24:24');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
