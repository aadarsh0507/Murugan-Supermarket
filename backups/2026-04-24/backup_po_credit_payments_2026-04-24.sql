-- Table Backup: po_credit_payments
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:17.443Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `po_credit_payments`
DROP TABLE IF EXISTS `po_credit_payments`;
CREATE TABLE `po_credit_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `po_credit_id` bigint unsigned NOT NULL,
  `payment_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_date` datetime NOT NULL,
  `payment_mode` enum('cash','card','upi','credit','online','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `collected_by_first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collected_by_last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_credit_payments_credit` (`po_credit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table `po_credit_payments` is empty

SET FOREIGN_KEY_CHECKS=1;
