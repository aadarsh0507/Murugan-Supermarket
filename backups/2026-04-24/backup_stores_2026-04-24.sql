-- Table Backup: stores
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:20.309Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `stores`
DROP TABLE IF EXISTS `stores`;
CREATE TABLE `stores` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `store_code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `bank_ifsc_code` varchar(20) DEFAULT NULL,
  `bank_branch_name` varchar(100) DEFAULT NULL,
  `address_street` varchar(200) DEFAULT NULL,
  `address_city` varchar(50) DEFAULT NULL,
  `address_state` varchar(50) DEFAULT NULL,
  `address_zip_code` varchar(10) DEFAULT NULL,
  `address_country` varchar(50) DEFAULT 'India',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `store_code` (`store_code`),
  UNIQUE KEY `store_code_2` (`store_code`),
  UNIQUE KEY `store_code_3` (`store_code`),
  UNIQUE KEY `store_code_4` (`store_code`),
  UNIQUE KEY `store_code_5` (`store_code`),
  UNIQUE KEY `store_code_6` (`store_code`),
  UNIQUE KEY `store_code_7` (`store_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `stores` (2 rows)
LOCK TABLES `stores` WRITE;
INSERT INTO `stores` (`id`, `store_code`, `name`, `phone`, `email`, `gst_number`, `bank_name`, `bank_account_number`, `bank_ifsc_code`, `bank_branch_name`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES (1, 'MS', 'Murugan Stores', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No.172/4B2C1, Vandavasi Road,', 'Sothupakkam,Melmaruvathur', NULL, '603319', 'India', 1, 1, '2025-11-19 12:02:12', '2026-04-24 09:05:22');
INSERT INTO `stores` (`id`, `store_code`, `name`, `phone`, `email`, `gst_number`, `bank_name`, `bank_account_number`, `bank_ifsc_code`, `bank_branch_name`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES (2, 'MSM', 'Murugan Super Market', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No.172/4B2C1, Vandavasi Road,', 'Sothupakkam,Melmaruvathur', NULL, '603319', 'India', 1, 1, '2025-11-19 12:07:01', '2026-04-24 09:05:34');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
