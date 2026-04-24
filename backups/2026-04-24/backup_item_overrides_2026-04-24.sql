-- Table Backup: item_overrides
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:16.527Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `item_overrides`
DROP TABLE IF EXISTS `item_overrides`;
CREATE TABLE `item_overrides` (
  `product_code` varchar(100) NOT NULL,
  `store_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT '0=legacy global; use stores.id for per-store overrides',
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
  `bogo_offer` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`product_code`,`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `item_overrides` (16 rows)
LOCK TABLES `item_overrides` WRITE;
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('1283', 2, NULL, 'HORLICKS BISCUITS 10RS', '0.00', NULL, NULL, NULL, 0, 0, '2026-04-21 01:43:14', '2026-04-21 01:43:14', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('3892', 2, NULL, '3 ROSES 1 KG', '700.00', NULL, NULL, NULL, 0, 0, '2026-04-12 03:21:32', '2026-04-12 04:15:09', 'Buy 1 Get 1 Free');
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('4891', 0, NULL, 'BANANA CHIPS 200G', '60.00', NULL, NULL, NULL, 0, 0, '2025-11-20 12:05:21', '2025-11-20 12:05:21', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('5320', 2, NULL, '3 ROSES 500G', '420.00', NULL, NULL, NULL, 0, 0, '2026-04-12 04:15:51', '2026-04-12 04:16:19', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('5718', 0, NULL, 'COTHAS SPECIALITY BLEND FCOFFEE 200G', '200.00', NULL, NULL, NULL, 0, 0, '2026-02-24 00:35:16', '2026-02-24 00:35:27', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('576', 0, NULL, 'EVA BLUSE 125ML', '150.00', NULL, NULL, NULL, 0, 0, '2025-12-07 10:10:03', '2025-12-07 10:10:10', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('6272', 0, NULL, '20-20 CASHEW COOKIES', '9.00', NULL, '/uploads/items/item-1770188611352-669828573.jpg', '61-IvODJD5L._AC_UL210_SR210,210_.jpg', 0, 0, '2026-02-04 01:33:08', '2026-03-27 09:55:04', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('6272', 2, NULL, '20-20 CASHEW COOKIES', '9.00', NULL, NULL, NULL, 0, 0, '2026-04-19 02:02:28', '2026-04-21 01:46:30', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('6817', 0, NULL, '626 SY STORAGE BOX', '285.00', NULL, NULL, NULL, 0, 0, '2025-11-27 07:29:16', '2025-11-27 07:29:16', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('6821', 0, NULL, '8075 CONTAINER 4PIC SET', '310.00', NULL, NULL, NULL, 0, 0, '2025-11-27 07:45:20', '2025-11-27 07:45:20', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('7223', 0, NULL, 'AADARSH', '120.00', NULL, NULL, NULL, 0, 0, '2026-02-25 10:43:00', '2026-02-25 11:25:50', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('7224', 0, NULL, 'test', '120.00', NULL, NULL, NULL, 0, 0, '2025-11-20 11:47:45', '2025-12-15 06:53:03', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('7226', 0, NULL, 'YYY', '100.00', NULL, NULL, NULL, 0, 0, '2026-02-25 09:24:42', '2026-02-25 11:19:49', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('7230', 2, NULL, 'Mangoes', '50.00', NULL, '/uploads/items/item-1776532048257-978823967.jpg', 'mangoes.jpg', 0, 0, '2026-04-18 11:24:53', '2026-04-18 11:37:28', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('7967', 2, NULL, '+DR CARE  SURFACE CLEANER 1+1', '122.00', NULL, NULL, NULL, 0, 0, '2026-04-24 08:42:47', '2026-04-24 08:42:47', NULL);
INSERT INTO `item_overrides` (`product_code`, `store_id`, `sku`, `name`, `price`, `description`, `image_url`, `image_file_name`, `min_stock`, `max_stock`, `created_at`, `updated_at`, `bogo_offer`) VALUES ('8237', 2, NULL, '#NAME?', '34.00', NULL, '/uploads/items/item-1777031658292-932893689.jpg', 'mangoes.jpg', 0, 0, '2026-04-24 06:24:17', '2026-04-24 08:21:03', NULL);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
