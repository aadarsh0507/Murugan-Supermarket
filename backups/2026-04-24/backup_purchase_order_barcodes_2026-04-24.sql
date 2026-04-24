-- Table Backup: purchase_order_barcodes
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:18.160Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `purchase_order_barcodes`
DROP TABLE IF EXISTS `purchase_order_barcodes`;
CREATE TABLE `purchase_order_barcodes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `item_index` int unsigned NOT NULL DEFAULT '0',
  `item_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `barcode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_barcodes_po` (`purchase_order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=464 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table `purchase_order_barcodes` is empty

SET FOREIGN_KEY_CHECKS=1;
