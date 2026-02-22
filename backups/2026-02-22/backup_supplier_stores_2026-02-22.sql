-- Table Backup: supplier_stores
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:38.848Z

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
  KEY `store_id` (`store_id`),
  CONSTRAINT `supplier_stores_ibfk_34` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table `supplier_stores` is empty

SET FOREIGN_KEY_CHECKS=1;
