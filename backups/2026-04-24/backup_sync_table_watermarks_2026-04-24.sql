-- Table Backup: sync_table_watermarks
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:22.062Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `sync_table_watermarks`
DROP TABLE IF EXISTS `sync_table_watermarks`;
CREATE TABLE `sync_table_watermarks` (
  `source_id` varchar(100) NOT NULL DEFAULT 'default',
  `table_name` varchar(255) NOT NULL,
  `last_synced_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`source_id`,`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `sync_table_watermarks` (14 rows)
LOCK TABLES `sync_table_watermarks` WRITE;
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'bills', '2026-04-24 13:24:38');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'Brand', '2026-04-19 23:40:57');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customer_credit_item_overrides', '2026-04-19 07:04:18');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customer_credit_meta', '2026-04-19 07:04:18');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customers', '2026-04-24 07:24:24');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'item_overrides', '2026-04-24 08:42:47');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'po_credits', '2026-04-21 02:12:10');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'Products_extra', '2026-04-20 18:00:35');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'purchase_orders', '2026-04-21 02:12:09');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'store_inventory', '2026-04-24 08:55:51');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'stores', '2026-04-24 09:05:34');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'sync_sessions', '2026-04-24 09:10:14');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'user_stores', '2026-04-21 02:28:52');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'users', '2026-04-21 02:28:52');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
