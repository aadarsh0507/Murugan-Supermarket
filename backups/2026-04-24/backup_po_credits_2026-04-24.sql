-- Table Backup: po_credits
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:17.751Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `po_credits`
DROP TABLE IF EXISTS `po_credits`;
CREATE TABLE `po_credits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint unsigned NOT NULL,
  `po_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `store_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_date` datetime NOT NULL,
  `original_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `initial_original_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `balance_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','partially_paid','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_po_credit` (`purchase_order_id`),
  KEY `idx_po_credits_po` (`purchase_order_id`),
  KEY `idx_po_credits_po_number` (`po_number`),
  KEY `idx_po_credits_supplier` (`supplier_id`),
  KEY `idx_po_credits_store` (`store_id`),
  KEY `idx_po_credits_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `po_credits` (2 rows)
LOCK TABLES `po_credits` WRITE;
INSERT INTO `po_credits` (`id`, `purchase_order_id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `original_amount`, `initial_original_amount`, `paid_amount`, `balance_amount`, `status`, `notes`, `created_at`, `updated_at`) VALUES (8, 10, 'PO-MS-002', '98', NULL, '1', '2025-11-19 18:30:00', '4950.00', '4950.00', '0.00', '4950.00', 'pending', 'Credit entry', '2025-11-20 12:15:20', '2025-11-20 12:15:20');
INSERT INTO `po_credits` (`id`, `purchase_order_id`, `po_number`, `supplier_id`, `supplier_name`, `store_id`, `order_date`, `original_amount`, `initial_original_amount`, `paid_amount`, `balance_amount`, `status`, `notes`, `created_at`, `updated_at`) VALUES (9, 30, 'PO-MSM-018', '6', 'SRI KRISHANA AGENCIES', '2', '2026-04-20 18:30:00', '90.00', '90.00', '0.00', '90.00', 'pending', 'Credit entry', '2026-04-21 02:12:10', '2026-04-21 02:12:10');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
