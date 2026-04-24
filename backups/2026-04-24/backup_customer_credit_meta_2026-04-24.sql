-- Table Backup: customer_credit_meta
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:14.593Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `customer_credit_meta`
DROP TABLE IF EXISTS `customer_credit_meta`;
CREATE TABLE `customer_credit_meta` (
  `bill_id` bigint unsigned NOT NULL,
  `initial_amount` decimal(12,2) NOT NULL,
  `sgst_rate_global` decimal(5,2) DEFAULT NULL,
  `cgst_rate_global` decimal(5,2) DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customer_credit_meta` (4 rows)
LOCK TABLES `customer_credit_meta` WRITE;
INSERT INTO `customer_credit_meta` (`bill_id`, `initial_amount`, `sgst_rate_global`, `cgst_rate_global`, `notes`, `is_hidden`, `created_at`, `updated_at`) VALUES (31, '292.00', '0.00', '0.00', 'Adjusted prices in bill credit detail', 0, '2025-11-27 08:26:39', '2025-11-27 08:26:39');
INSERT INTO `customer_credit_meta` (`bill_id`, `initial_amount`, `sgst_rate_global`, `cgst_rate_global`, `notes`, `is_hidden`, `created_at`, `updated_at`) VALUES (59, '1409.00', '0.00', '0.00', 'Adjusted prices in bill credit detail', 0, '2026-04-18 13:51:38', '2026-04-18 14:08:03');
INSERT INTO `customer_credit_meta` (`bill_id`, `initial_amount`, `sgst_rate_global`, `cgst_rate_global`, `notes`, `is_hidden`, `created_at`, `updated_at`) VALUES (67, '2311.00', '0.00', '0.00', 'Adjusted prices in bill credit detail', 0, '2026-04-19 02:52:07', '2026-04-19 02:52:07');
INSERT INTO `customer_credit_meta` (`bill_id`, `initial_amount`, `sgst_rate_global`, `cgst_rate_global`, `notes`, `is_hidden`, `created_at`, `updated_at`) VALUES (73, '420.00', '0.00', '0.00', 'Adjusted prices in bill credit detail', 0, '2026-04-19 07:04:18', '2026-04-19 07:04:18');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
