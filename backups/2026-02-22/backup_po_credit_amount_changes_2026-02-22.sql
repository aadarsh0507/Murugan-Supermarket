-- Table Backup: po_credit_amount_changes
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:38.765Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `po_credit_amount_changes`
DROP TABLE IF EXISTS `po_credit_amount_changes`;
CREATE TABLE `po_credit_amount_changes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `po_credit_id` bigint unsigned NOT NULL,
  `previous_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `updated_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `change_date` datetime NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `changed_by_first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_by_last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_credit_amount_changes_credit` (`po_credit_id`),
  CONSTRAINT `fk_po_credit_amount_changes_credit` FOREIGN KEY (`po_credit_id`) REFERENCES `po_credits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table `po_credit_amount_changes` is empty

SET FOREIGN_KEY_CHECKS=1;
