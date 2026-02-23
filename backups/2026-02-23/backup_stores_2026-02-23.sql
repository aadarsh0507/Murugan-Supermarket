-- Table Backup: stores
-- Database: Super_Market
-- Date: 2026-02-23
-- Generated: 2026-02-23T14:29:12.977Z

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
  UNIQUE KEY `store_code_7` (`store_code`),
  UNIQUE KEY `store_code_8` (`store_code`),
  UNIQUE KEY `store_code_9` (`store_code`),
  UNIQUE KEY `store_code_10` (`store_code`),
  UNIQUE KEY `store_code_11` (`store_code`),
  UNIQUE KEY `store_code_12` (`store_code`),
  UNIQUE KEY `store_code_13` (`store_code`),
  UNIQUE KEY `store_code_14` (`store_code`),
  UNIQUE KEY `store_code_15` (`store_code`),
  UNIQUE KEY `store_code_16` (`store_code`),
  UNIQUE KEY `store_code_17` (`store_code`),
  UNIQUE KEY `store_code_18` (`store_code`),
  UNIQUE KEY `store_code_19` (`store_code`),
  UNIQUE KEY `store_code_20` (`store_code`),
  UNIQUE KEY `store_code_21` (`store_code`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `stores` (2 rows)
LOCK TABLES `stores` WRITE;
INSERT INTO `stores` (`id`, `store_code`, `name`, `phone`, `email`, `gst_number`, `bank_name`, `bank_account_number`, `bank_ifsc_code`, `bank_branch_name`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES (1, 'MS', 'Murugan Stores', NULL, NULL, '33BKQPV8495P1ZP', 'Central Bank of India', '98745212236562', 'CBI79546874', 'Melamruvathur', NULL, NULL, NULL, NULL, 'India', 1, 1, '2025-11-19 12:02:12', '2025-11-19 13:30:17');
INSERT INTO `stores` (`id`, `store_code`, `name`, `phone`, `email`, `gst_number`, `bank_name`, `bank_account_number`, `bank_ifsc_code`, `bank_branch_name`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES (2, 'MSM', 'Murugan Super Market', NULL, NULL, '33BKQPV8495P1ZP', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'India', 1, 1, '2025-11-19 12:07:01', '2025-11-19 13:30:29');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
