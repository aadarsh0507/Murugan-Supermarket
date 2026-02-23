-- Table Backup: purchase_orders
-- Database: Super_Market
-- Date: 2026-02-23
-- Generated: 2026-02-23T14:29:12.957Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `purchase_orders`
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `store_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_date` datetime NOT NULL,
  `expected_delivery_date` datetime DEFAULT NULL,
  `total_items` int unsigned NOT NULL DEFAULT '0',
  `total_quantity` int unsigned NOT NULL DEFAULT '0',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(12,2) NOT NULL DEFAULT '0.00',
  `shipping` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `partial_payment` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_credit` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('created','ordered','received','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `purchase_orders` (7 rows)
LOCK TABLES `purchase_orders` WRITE;
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (9, 'PO-MS-001', '94', NULL, '1', '2025-11-19 18:30:00', NULL, 1, 21, '2100.00', '100.00', '100.00', '0.00', '2100.00', '0.00', 0, 'created', NULL, '2025-11-20 11:22:03', '2025-11-20 11:22:03');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (10, 'PO-MS-002', '98', NULL, '1', '2025-11-19 18:30:00', NULL, 1, 50, '4725.00', '0.00', '225.00', '0.00', '4950.00', '0.00', 1, 'created', NULL, '2025-11-20 12:15:20', '2025-11-20 12:15:20');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (11, 'PO-MSM-001', '2', NULL, '2', '2025-11-28 00:00:00', NULL, 1, 20, '8200.00', '0.00', '0.00', '0.00', '8200.00', '0.00', 0, 'created', NULL, '2025-11-28 07:00:47', '2025-11-28 07:00:47');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (12, 'PO-MSM-002', '3', NULL, '2', '2025-12-14 00:00:00', NULL, 1, 20, '13000.00', '0.00', '0.00', '0.00', '13000.00', '0.00', 0, 'created', NULL, '2025-12-14 02:34:39', '2025-12-14 02:34:39');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (13, 'PO-MSM-003', '3', NULL, '2', '2025-12-14 00:00:00', NULL, 1, 20, '100.00', '0.00', '0.00', '0.00', '100.00', '0.00', 0, 'created', NULL, '2025-12-14 02:46:08', '2025-12-14 02:46:08');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (14, 'PO-MSM-004', '2', NULL, '2', '2025-12-14 00:00:00', NULL, 1, 2, '1300.00', '0.00', '0.00', '0.00', '1300.00', '0.00', 1, 'created', NULL, '2025-12-14 02:51:11', '2025-12-14 02:51:11');
INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `expected_delivery_date`, `total_items`, `total_quantity`, `subtotal`, `discount`, `tax`, `shipping`, `total_amount`, `partial_payment`, `is_credit`, `status`, `notes`, `created_at`, `updated_at`) VALUES (15, 'PO-MSM-005', '2', NULL, '2', '2025-12-14 00:00:00', NULL, 1, 10, '6500.00', '0.00', '0.00', '0.00', '6500.00', '0.00', 1, 'created', NULL, '2025-12-14 02:53:43', '2025-12-14 02:53:43');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
