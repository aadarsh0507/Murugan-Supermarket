-- Table Backup: customer_credit_item_overrides
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:14.066Z

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
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customer_credit_item_overrides` (19 rows)
LOCK TABLES `customer_credit_item_overrides` WRITE;
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (22, 31, 1, 'BANANA CHIPS 200G', '', '1.00', '60.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (23, 31, 2, 'RAJMA 200G', '', '1.00', '34.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (24, 31, 3, 'KARAMANI RED 500GM', '', '2.00', '63.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (25, 31, 4, 'FLAKE SEED 250G', '', '1.00', '32.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (26, 31, 5, 'ORID DHALL 250GM', '', '1.00', '30.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (27, 31, 6, 'SAGO 100G', '', '1.00', '10.00', '0.00', '0.00', '0.00', '0.00', '2025-11-27 08:26:40', '2025-11-27 08:26:40');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (28, 59, 1, '20-20 CASHEW COOKIES', '', '1.00', '9.00', '0.00', '0.00', '0.00', '0.00', '2026-04-18 14:08:03', '2026-04-18 14:08:03');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (29, 59, 2, '3 ROSES 1 KG', '', '2.00', '700.00', '0.00', '0.00', '0.00', '0.00', '2026-04-18 14:08:03', '2026-04-18 14:08:03');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (30, 67, 1, '20-20 CASHEW COOKIES', '', '2.00', '9.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (31, 67, 2, '3 ROSES HP 1KG', '', '1.00', '700.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (32, 67, 3, '3 ROSES 500G', '', '1.00', '420.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (33, 67, 4, '555 BROOMS 190RS', '', '1.00', '160.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (34, 67, 5, '50-50 POTAZOS 10RS', '', '1.00', '9.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (35, 67, 6, '50-50 MASKA CHASKA  30RS', '', '1.00', '30.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (36, 67, 7, 'AAVIN GHEE 1LTR', '', '1.00', '650.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (37, 67, 8, '777 CHILLI SAUCE 200G', '', '1.00', '54.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (38, 67, 9, '777 MANGO THOKKU 1KG', '', '1.00', '135.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (39, 67, 10, '777 MANGO THOKKU 1KG', '', '1.00', '135.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_item_overrides` (`id`, `bill_id`, `line_no`, `item_name`, `hsn_code`, `quantity`, `unit_price`, `discount`, `tax_rate`, `sgst_rate`, `cgst_rate`, `created_at`, `updated_at`) VALUES (40, 73, 1, '3 ROSES 500G', '', '1.00', '420.00', '0.00', '0.00', '0.00', '0.00', '2026-04-19 07:04:18', '2026-04-19 07:04:18');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
