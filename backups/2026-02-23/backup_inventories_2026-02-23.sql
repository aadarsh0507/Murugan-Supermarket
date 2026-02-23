-- Table Backup: inventories
-- Database: Super_Market
-- Date: 2026-02-23
-- Generated: 2026-02-23T14:29:12.893Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `inventories`
DROP TABLE IF EXISTS `inventories`;
CREATE TABLE `inventories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint unsigned NOT NULL,
  `store_id` bigint unsigned NOT NULL,
  `qty_on_hand` int unsigned NOT NULL DEFAULT '0',
  `qty_reserved` int unsigned NOT NULL DEFAULT '0',
  `last_purchase_price` decimal(10,2) DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_store` (`item_id`,`store_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_item` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table `inventories` is empty

SET FOREIGN_KEY_CHECKS=1;
