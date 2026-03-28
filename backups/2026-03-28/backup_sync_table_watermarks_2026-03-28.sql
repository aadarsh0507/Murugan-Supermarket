-- Table Backup: sync_table_watermarks
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.322Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `sync_table_watermarks`
DROP TABLE IF EXISTS `sync_table_watermarks`;
CREATE TABLE `sync_table_watermarks` (
  `source_id` varchar(100) NOT NULL DEFAULT 'default',
  `table_name` varchar(255) NOT NULL,
  `last_synced_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`source_id`,`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `sync_table_watermarks` (12 rows)
LOCK TABLES `sync_table_watermarks` WRITE;
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'bills', '2026-02-23 08:57:51');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'Brand', '2025-11-27 07:44:59');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customer_credit_item_overrides', '2025-11-27 08:26:40');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customer_credit_meta', '2025-11-27 08:26:39');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'customers', '2025-11-20 11:56:18');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'item_overrides', '2026-02-23 08:53:33');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'po_credits', '2025-12-14 02:53:44');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'purchase_orders', '2025-12-14 02:53:43');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'store_inventory', '2026-02-23 08:57:51');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'stores', '2025-11-19 13:30:29');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'user_stores', '2025-11-20 12:36:26');
INSERT INTO `sync_table_watermarks` (`source_id`, `table_name`, `last_synced_at`) VALUES ('default', 'users', '2025-12-26 05:37:30');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
