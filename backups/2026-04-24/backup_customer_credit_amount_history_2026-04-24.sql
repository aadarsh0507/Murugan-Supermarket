-- Table Backup: customer_credit_amount_history
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:13.642Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `customer_credit_amount_history`
DROP TABLE IF EXISTS `customer_credit_amount_history`;
CREATE TABLE `customer_credit_amount_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bill_id` bigint unsigned NOT NULL,
  `previous_amount` decimal(12,2) NOT NULL,
  `updated_amount` decimal(12,2) NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `changed_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `change_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_credit_amount_bill` (`bill_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `customer_credit_amount_history` (3 rows)
LOCK TABLES `customer_credit_amount_history` WRITE;
INSERT INTO `customer_credit_amount_history` (`id`, `bill_id`, `previous_amount`, `updated_amount`, `notes`, `changed_by`, `change_date`) VALUES (3, 59, '1409.00', '1400.00', NULL, 'Aadarsh A', '2026-04-18 13:51:38');
INSERT INTO `customer_credit_amount_history` (`id`, `bill_id`, `previous_amount`, `updated_amount`, `notes`, `changed_by`, `change_date`) VALUES (4, 67, '2311.00', '1000.00', '14-03-2026', 'admin', '2026-04-19 02:56:12');
INSERT INTO `customer_credit_amount_history` (`id`, `bill_id`, `previous_amount`, `updated_amount`, `notes`, `changed_by`, `change_date`) VALUES (5, 67, '1000.00', '997.00', NULL, 'admin', '2026-04-19 02:56:24');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
