-- Table Backup: Brand
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:37.897Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `Brand`
DROP TABLE IF EXISTS `Brand`;
CREATE TABLE `Brand` (
  `BrandCode` varchar(50) NOT NULL,
  `Description` varchar(200) DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `store_id` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`BrandCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `Brand` (1 rows)
LOCK TABLES `Brand` WRITE;
INSERT INTO `Brand` (`BrandCode`, `Description`, `IsActive`, `store_id`, `created_at`, `updated_at`) VALUES ('TEST', 'test', 1, 1, '2025-11-27 07:44:59', '2025-11-27 07:44:59');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
