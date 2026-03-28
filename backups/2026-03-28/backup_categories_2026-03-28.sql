-- Table Backup: categories
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.098Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `categories`
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table `categories` is empty

SET FOREIGN_KEY_CHECKS=1;
