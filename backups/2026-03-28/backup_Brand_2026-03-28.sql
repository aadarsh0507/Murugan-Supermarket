-- Table Backup: Brand
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:14.427Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `Brand`
DROP TABLE IF EXISTS `Brand`;
CREATE TABLE `Brand` (
  `BrandCode` varchar(50) NOT NULL,
  `Description` varchar(200) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `store_id` int unsigned DEFAULT NULL,
  `subcategory_id` varchar(150) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`BrandCode`),
  KEY `idx_brand_subcategory` (`subcategory_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `Brand` (2 rows)
LOCK TABLES `Brand` WRITE;
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `subcategory_id`, `created_at`, `updated_at`) VALUES ('BRITIANAN', 'Britianan', 1, 2, '1:1', '2026-03-28 11:37:57', '2026-03-28 11:44:26');
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `subcategory_id`, `created_at`, `updated_at`) VALUES ('TEST', 'test', 1, 1, NULL, '2025-11-27 07:44:59', '2025-11-27 07:44:59');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
