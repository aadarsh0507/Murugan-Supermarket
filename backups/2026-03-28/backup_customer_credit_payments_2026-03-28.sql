-- Table Backup: customer_credit_payments
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.133Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `customer_credit_payments`
DROP TABLE IF EXISTS `customer_credit_payments`;
CREATE TABLE `customer_credit_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bill_id` bigint unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_mode` enum('cash','card','upi','credit','online','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `collected_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_credit_payment_bill` (`bill_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customer_credit_payments` (2 rows)
LOCK TABLES `customer_credit_payments` WRITE;
INSERT INTO `customer_credit_payments` (`id`, `bill_id`, `amount`, `payment_date`, `payment_mode`, `notes`, `collected_by`, `created_at`) VALUES (7, 31, '100.00', '2025-11-20 11:59:08', 'cash', NULL, 'PUSH DIGGY', '2025-11-20 11:59:08');
INSERT INTO `customer_credit_payments` (`id`, `bill_id`, `amount`, `payment_date`, `payment_mode`, `notes`, `collected_by`, `created_at`) VALUES (8, 31, '50.00', '2025-11-20 11:59:30', 'online', '286', 'PUSH DIGGY', '2025-11-20 11:59:30');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
