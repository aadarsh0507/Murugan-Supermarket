-- Table Backup: screens
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:19.177Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `screens`
DROP TABLE IF EXISTS `screens`;
CREATE TABLE `screens` (
  `id` int unsigned NOT NULL,
  `screen_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `screens` (11 rows)
LOCK TABLES `screens` WRITE;
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (1, 'Select Store', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (2, 'Dashboard', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (3, 'Items', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (4, 'Billing', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (5, 'Suppliers', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (6, 'Stores', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (7, 'Purchase Orders', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (8, 'Credits', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (9, 'Users', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (10, 'Screen Rights', 1);
INSERT INTO `screens` (`id`, `screen_name`, `is_active`) VALUES (11, 'Reports', 1);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
