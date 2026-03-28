-- Table Backup: sync_session_tables
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.303Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `sync_session_tables`
DROP TABLE IF EXISTS `sync_session_tables`;
CREATE TABLE `sync_session_tables` (
  `session_id` bigint NOT NULL,
  `table_name` varchar(255) NOT NULL,
  `completed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`,`table_name`),
  KEY `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `sync_session_tables` (62 rows)
LOCK TABLES `sync_session_tables` WRITE;
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Brand', '2026-02-22 08:08:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'customer_credit_meta', '2026-02-22 08:08:24');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'customers', '2026-02-22 08:08:24');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'item_overrides', '2026-02-22 08:08:25');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'po_credits', '2026-02-22 08:08:25');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'purchase_orders', '2026-02-22 08:08:26');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'screens', '2026-02-22 08:08:26');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Subcategory', '2026-02-22 08:08:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Suppliers', '2026-02-22 08:08:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Tax', '2026-02-22 08:08:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'screens', '2026-02-22 08:22:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Subcategory', '2026-02-22 08:22:40');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Suppliers', '2026-02-22 08:22:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Tax', '2026-02-22 08:22:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'screens', '2026-02-22 08:24:46');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Subcategory', '2026-02-22 08:24:45');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Suppliers', '2026-02-22 08:24:45');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Tax', '2026-02-22 08:24:45');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'bill_items', '2026-02-22 08:27:29');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'bills', '2026-02-22 08:27:18');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'customer_credit_item_overrides', '2026-02-22 08:27:30');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'customer_credit_payments', '2026-02-22 08:27:30');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'purchase_order_barcodes', '2026-02-22 08:27:11');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'purchase_order_items', '2026-02-22 08:27:12');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'screens', '2026-02-22 08:26:59');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'store_inventory', '2026-02-22 08:27:02');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'stores', '2026-02-22 08:27:02');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Subcategory', '2026-02-22 08:26:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Suppliers', '2026-02-22 08:26:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Tax', '2026-02-22 08:26:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'user_stores', '2026-02-22 08:27:18');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'users', '2026-02-22 08:27:13');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'bill_items', '2026-02-22 09:06:39');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'customer_credit_payments', '2026-02-22 09:06:39');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Products', '2026-02-22 09:06:37');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'purchase_order_barcodes', '2026-02-22 09:06:38');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'purchase_order_items', '2026-02-22 09:06:38');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'screens', '2026-02-22 09:06:38');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Subcategory', '2026-02-22 09:06:37');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Suppliers', '2026-02-22 09:06:37');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Tax', '2026-02-22 09:06:37');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'bill_items', '2026-02-23 08:54:35');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customer_credit_payments', '2026-02-23 08:54:35');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'item_overrides', '2026-02-23 08:54:34');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Products', '2026-02-23 08:54:33');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'purchase_order_barcodes', '2026-02-23 08:54:34');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'purchase_order_items', '2026-02-23 08:54:34');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'screens', '2026-02-23 08:54:34');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Subcategory', '2026-02-23 08:54:33');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Suppliers', '2026-02-23 08:54:33');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Tax', '2026-02-23 08:54:33');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'bill_items', '2026-02-23 08:59:11');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'bills', '2026-02-23 08:59:10');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'customer_credit_payments', '2026-02-23 08:59:11');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Products', '2026-02-23 08:59:08');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'purchase_order_barcodes', '2026-02-23 08:59:10');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'purchase_order_items', '2026-02-23 08:59:10');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'screens', '2026-02-23 08:59:09');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'store_inventory', '2026-02-23 08:59:09');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Subcategory', '2026-02-23 08:59:08');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Suppliers', '2026-02-23 08:59:08');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Tax', '2026-02-23 08:59:09');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
