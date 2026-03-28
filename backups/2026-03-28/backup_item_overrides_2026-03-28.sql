-- Table Backup: item_overrides
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.154Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `item_overrides`
DROP TABLE IF EXISTS `item_overrides`;
CREATE TABLE `item_overrides` (
  `product_code` varchar(100) NOT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `description` text,
  `image_url` varchar(255) DEFAULT NULL,
  `image_file_name` varchar(255) DEFAULT NULL,
  `min_stock` int DEFAULT NULL,
  `max_stock` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `item_overrides` (10 rows)
LOCK TABLES `item_overrides` WRITE;
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('3892', NULL, 'test', '700.00', NULL, NULL, NULL, 0, 0, '2025-11-20 12:41:03', '2025-12-14 02:53:15');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('4858', NULL, '3 ROSES HP 1KG', '700.00', 'fhisuhgisuhg', NULL, NULL, 0, 0, '2026-03-28 11:24:47', '2026-03-28 11:24:47');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('4891', NULL, 'BANANA CHIPS 200G', '60.00', NULL, NULL, NULL, 0, 0, '2025-11-20 12:05:21', '2025-11-20 12:05:21');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('5320', NULL, '3 ROSES', '420.00', NULL, NULL, NULL, 0, 0, '2025-11-28 07:01:07', '2026-03-28 11:17:54');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('576', NULL, 'EVA BLUSE 125ML', '150.00', NULL, NULL, NULL, 0, 0, '2025-12-07 10:10:03', '2025-12-07 10:10:10');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('6272', NULL, '20-20 CASHEW', '9.00', NULL, '/uploads/items/item-1764266695334-370514193.jpg', 'idcard.jpg', 0, 0, '2025-11-27 12:34:55', '2026-02-22 07:56:03');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('6817', NULL, '626 SY STORAGE BOX', '285.00', NULL, NULL, NULL, 0, 0, '2025-11-27 07:29:16', '2025-11-27 07:29:16');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('6821', NULL, '8075 CONTAINER 4PIC SET', '310.00', NULL, NULL, NULL, 0, 0, '2025-11-27 07:45:20', '2025-11-27 07:45:20');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('6824', NULL, '3 LAYER', '302.00', NULL, NULL, NULL, 0, 0, '2026-02-23 08:53:33', '2026-02-23 08:53:33');
INSERT INTO `item_overrides` (`product_code`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`) VALUES ('7224', NULL, 'test', '120.00', NULL, NULL, NULL, 0, 0, '2025-11-20 11:47:45', '2025-11-27 08:21:25');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
