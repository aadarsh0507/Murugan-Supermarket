-- Table Backup: customer_credit_amount_history
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:38.695Z

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
  KEY `idx_credit_amount_bill` (`bill_id`),
  CONSTRAINT `fk_credit_amount_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table `customer_credit_amount_history` is empty

SET FOREIGN_KEY_CHECKS=1;
