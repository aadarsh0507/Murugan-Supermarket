-- Table Backup: store_inventory
-- Database: Super_Market
-- Date: 2026-02-23
-- Generated: 2026-02-23T14:29:12.970Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `store_inventory`
DROP TABLE IF EXISTS `store_inventory`;
CREATE TABLE `store_inventory` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `product_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `store_id` bigint unsigned NOT NULL,
  `qty_on_hand` int unsigned NOT NULL DEFAULT '0',
  `last_purchase_price` decimal(10,2) DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_store` (`product_code`,`store_id`),
  KEY `idx_store` (`store_id`),
  KEY `idx_product` (`product_code`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `store_inventory` (30 rows)
LOCK TABLES `store_inventory` WRITE;
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (13, '7223', 1, 21, '100.00', '2025-11-20 11:22:03');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (15, '7224', 1, 50, '90.00', '2025-11-20 12:15:20');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (17, '7225', 2, 0, '0.00', '2025-11-22 22:52:14');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (18, '6818', 1, 0, NULL, '2025-11-27 07:27:59');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (19, '6817', 1, 0, NULL, '2025-11-27 07:27:59');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (20, '6824', 1, 0, NULL, '2025-11-27 08:01:45');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (21, '2', 1, 0, NULL, '2025-11-27 08:33:29');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (22, '1', 1, 0, NULL, '2025-11-27 08:33:29');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (23, '3', 1, 0, NULL, '2025-11-27 08:33:29');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (24, '2770', 2, 0, NULL, '2025-11-27 08:38:25');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (25, '2625', 2, 0, NULL, '2025-11-27 08:38:25');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (26, '6824', 2, 0, NULL, '2025-11-27 08:39:35');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (27, '6817', 2, 0, NULL, '2025-11-27 08:39:35');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (28, '6382', 2, 0, NULL, '2025-11-27 08:39:35');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (29, '5320', 2, 5, '410.00', '2026-01-13 12:21:54');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (30, '3892', 2, 28, '650.00', '2025-12-14 04:15:13');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (31, '5423', 2, 6, '5.00', '2026-01-13 12:21:54');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (34, '6272', 2, 0, NULL, '2025-12-14 04:01:37');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (35, '1850', 2, 0, NULL, '2025-12-14 04:01:37');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (36, '5791', 2, 0, NULL, '2025-12-14 04:01:37');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (37, '1109', 2, 0, NULL, '2025-12-14 04:15:12');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (38, '3263', 2, 0, NULL, '2025-12-14 04:15:13');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (39, '4858', 2, 0, NULL, '2025-12-14 04:15:13');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (40, '3262', 2, 0, NULL, '2025-12-14 04:15:13');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (41, '5321', 2, 0, NULL, '2025-12-14 04:33:44');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (42, '3072', 2, 0, NULL, '2026-01-13 11:13:39');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (43, '6277', 2, 0, NULL, '2026-01-13 11:47:27');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (44, '2468', 2, 0, NULL, '2026-01-13 11:53:56');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (45, '418', 2, 0, NULL, '2026-01-13 12:21:54');
INSERT INTO `store_inventory` (`id`, `product_code`, `store_id`, `qty_on_hand`, `last_purchase_price`, `updated_at`) VALUES (46, '2555', 2, 0, NULL, '2026-02-23 08:57:51');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
