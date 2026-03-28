-- Table Backup: customer_credit_item_overrides
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.117Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `customer_credit_item_overrides`
DROP TABLE IF EXISTS `customer_credit_item_overrides`;
CREATE TABLE `customer_credit_item_overrides` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bill_id` bigint unsigned NOT NULL,
  `line_no` int unsigned NOT NULL,
  `item_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hsn_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(12,2) DEFAULT NULL,
  `unit_price` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) DEFAULT NULL,
  `tax_rate` decimal(5,2) DEFAULT NULL,
  `sgst_rate` decimal(5,2) DEFAULT NULL,
  `cgst_rate` decimal(5,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_override_bill` (`bill_id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customer_credit_item_overrides` (8 rows)
LOCK TABLES `customer_credit_item_overrides` WRITE;
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (22, 31, 1, 'BANANA CHIPS 200G', '', '1.00', '60.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (23, 31, 2, 'RAJMA 200G', '', '1.00', '34.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (24, 31, 3, 'KARAMANI RED 500GM', '', '2.00', '63.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (25, 31, 4, 'FLAKE SEED 250G', '', '1.00', '32.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (26, 31, 5, 'ORID DHALL 250GM', '', '1.00', '30.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (27, 31, 6, 'SAGO 100G', '', '1.00', '10.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (28, 80, 1, '20-20 CASHEW', '', '1.00', '5.00', '0.00', '0.00', '0.00', '0.00', '2026-03-24 10:57:19', '2026-03-24 10:57:19');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (29, 80, 2, '3 ROSES NATURALCARE 500G', '', '1.00', '449.62', '0.00', '0.00', '0.00', '0.00', '2026-03-24 10:57:19', '2026-03-24 10:57:19');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
