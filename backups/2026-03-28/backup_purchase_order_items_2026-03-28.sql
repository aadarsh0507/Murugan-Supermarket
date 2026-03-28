-- Table Backup: purchase_order_items
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.243Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `purchase_order_items`
DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE `purchase_order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `line_index` int unsigned NOT NULL DEFAULT '0',
  `item_id` bigint unsigned DEFAULT NULL,
  `item_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subcategory_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hsn_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity` int unsigned NOT NULL DEFAULT '0',
  `cost_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '%',
  `discount_percent` decimal(5,2) DEFAULT '0.00',
  `discount_amount` decimal(12,2) DEFAULT '0.00',
  `tax_percent` decimal(5,2) DEFAULT '0.00',
  `mrp` decimal(12,2) DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_items_po` (`purchase_order_id`),
  KEY `idx_po_items_item` (`item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `purchase_order_items` (8 rows)
LOCK TABLES `purchase_order_items` WRITE;
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (11, 9, 0, 7223, 'AADARSH', '7223', 'pcs', 'Uncategorized', NULL, '123654', '12364', '2026-03-30 18:30:00', 21, '100.00', '2100.00', 'Rate', '0.00', '100.00', '5.00', '120.00', '2025-11-20 11:22:03');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (12, 10, 0, 7224, 'test', '8901751016680', 'pcs', 'TEST', NULL, '123654', '741258', '2026-03-30 18:30:00', 50, '90.00', '4725.00', '%', '0.00', '0.00', '5.00', '120.00', '2025-11-20 12:15:20');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (13, 11, 0, 5320, '3 ROSES 500G', '5320', 'pcs', 'Uncategorized', NULL, '123654', '8542', '2025-11-29 18:30:00', 20, '410.00', '8200.00', '%', '0.00', '0.00', '0.00', '420.00', '2025-11-28 07:00:47');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (14, 12, 0, 3892, '3 roses 1 kg', '3892', 'pcs', 'Uncategorized', NULL, '35151', NULL, '2025-12-30 18:30:00', 20, '650.00', '13000.00', '%', '0.00', '0.00', '0.00', '700.00', '2025-12-14 02:34:39');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (15, 13, 0, 5423, '3 roses rs 5', '5423', 'pcs', 'Uncategorized', NULL, '9874511', '68458', '2025-12-24 18:30:00', 20, '5.00', '100.00', '%', '0.00', '0.00', '0.00', '5.00', '2025-12-14 02:46:08');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (16, 14, 0, 3892, '3 roses 1 kg', '3892', 'pcs', 'Uncategorized', NULL, '15315', NULL, NULL, 2, '650.00', '1300.00', '%', '0.00', '0.00', '0.00', '700.00', '2025-12-14 02:51:11');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (17, 15, 0, 3892, 'test', '3892', 'pcs', 'Uncategorized', NULL, '8465', '165', '2025-12-17 18:30:00', 10, '650.00', '6500.00', '%', '0.00', '0.00', '0.00', '700.00', '2025-12-14 02:53:43');
INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `line_index`, `item_id`, `item_name`, `sku`, `unit`, `category_name`, `subcategory_name`, `batch_number`, `hsn_number`, `expiry_date`, `quantity`, `cost_price`, `total`, `discount_type`, `discount_percent`, `discount_amount`, `tax_percent`, `mrp`, `created_at`) VALUES (18, 16, 0, 698, 'AAKAA PUTTU FLOUR 500GM', '698', 'pcs', 'Uncategorized', NULL, '56365', NULL, '2029-02-22 18:30:00', 5, '80.95', '394.75', 'Rate', '0.00', '10.00', '0.00', '93.00', '2026-02-25 12:35:01');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
