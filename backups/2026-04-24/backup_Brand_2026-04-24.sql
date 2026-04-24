-- Table Backup: Brand
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:06.628Z

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

-- Dumping data for table `Brand` (3 rows)
LOCK TABLES `Brand` WRITE;
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `subcategory_id`, `created_at`, `updated_at`) VALUES ('BRITANIA', 'Britania', 1, 2, '2:2', '2026-04-19 01:47:23', '2026-04-19 01:47:23');
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `subcategory_id`, `created_at`, `updated_at`) VALUES ('BRITANNIA', 'Britannia', 1, 2, '1:3', '2026-04-19 23:40:15', '2026-04-19 23:40:57');
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `subcategory_id`, `created_at`, `updated_at`) VALUES ('NUTRITION', 'Nutrition', 1, 2, '1:1', '2026-04-19 01:39:46', '2026-04-19 01:39:46');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
