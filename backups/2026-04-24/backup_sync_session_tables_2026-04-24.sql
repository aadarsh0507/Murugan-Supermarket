-- Table Backup: sync_session_tables
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:21.437Z

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

-- Dumping data for table `sync_session_tables` (113 rows)
LOCK TABLES `sync_session_tables` WRITE;
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Brand', '2026-03-29 11:12:55');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (1, 'Category', '2026-03-29 11:12:55');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Category', '2026-03-29 11:17:54');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Products', '2026-03-29 11:35:22');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (2, 'Subcategory', '2026-03-29 11:35:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'bill_items', '2026-03-29 11:39:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'bills', '2026-03-29 11:39:45');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Category', '2026-03-29 11:38:37');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'customer_credit_item_overrides', '2026-03-29 11:39:59');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'customer_credit_meta', '2026-03-29 11:38:59');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'customer_credit_payments', '2026-03-29 11:39:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'customers', '2026-03-29 11:38:59');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'item_overrides', '2026-03-29 11:39:01');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'po_credits', '2026-03-29 11:39:01');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Products', '2026-03-29 11:38:44');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'purchase_order_barcodes', '2026-03-29 11:39:39');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'purchase_order_items', '2026-03-29 11:39:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'purchase_orders', '2026-03-29 11:39:02');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'screens', '2026-03-29 11:39:04');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'store_inventory', '2026-03-29 11:39:11');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'stores', '2026-03-29 11:39:12');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Subcategory', '2026-03-29 11:38:44');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Suppliers', '2026-03-29 11:38:55');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'Tax', '2026-03-29 11:38:58');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'user_stores', '2026-03-29 11:39:46');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (3, 'users', '2026-03-29 11:39:43');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'bill_items', '2026-03-29 11:43:32');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'bills', '2026-03-29 11:43:32');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Category', '2026-03-29 11:43:23');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'customer_credit_payments', '2026-03-29 11:43:32');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Products', '2026-03-29 11:43:30');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'purchase_order_barcodes', '2026-03-29 11:43:31');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'purchase_order_items', '2026-03-29 11:43:31');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'screens', '2026-03-29 11:43:31');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Subcategory', '2026-03-29 11:43:30');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Suppliers', '2026-03-29 11:43:30');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (4, 'Tax', '2026-03-29 11:43:31');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'bill_items', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'bills', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'customer_credit_amount_history', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'customer_credit_item_overrides', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'customer_credit_meta', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'customer_credit_payments', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'customers', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'item_overrides', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'Products', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'purchase_order_barcodes', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'purchase_order_items', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'purchase_orders', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'screens', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'store_inventory', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'Suppliers', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'sync_session_tables', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'sync_sessions', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'sync_table_watermarks', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'Tax', '2026-04-18 17:50:27');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'user_stores', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (5, 'users', '2026-04-18 17:50:28');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'bill_items', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'customer_credit_amount_history', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'customer_credit_payments', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Products', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'purchase_order_barcodes', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'purchase_order_items', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'screens', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Suppliers', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'sync_session_tables', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'sync_sessions', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'sync_table_watermarks', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (6, 'Tax', '2026-04-18 17:50:41');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'bill_items', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'bills', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Brand', '2026-04-21 07:35:56');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Category', '2026-04-21 07:35:56');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customer_credit_amount_history', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customer_credit_item_overrides', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customer_credit_meta', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customer_credit_payments', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'customers', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'item_overrides', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'po_credits', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Products', '2026-04-21 07:36:01');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Products_extra', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'purchase_order_barcodes', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'purchase_order_items', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'purchase_orders', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'screens', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'store_inventory', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Subcategory', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Suppliers', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'sync_session_tables', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'sync_sessions', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'sync_table_watermarks', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'Tax', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'user_stores', '2026-04-21 07:36:07');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (7, 'users', '2026-04-21 07:36:08');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'bill_items', '2026-04-24 09:10:45');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'bills', '2026-04-24 09:10:47');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Category', '2026-04-24 09:10:17');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'customer_credit_amount_history', '2026-04-24 09:10:49');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'customer_credit_payments', '2026-04-24 09:10:51');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'customers', '2026-04-24 09:10:53');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'item_overrides', '2026-04-24 09:11:01');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Products', '2026-04-24 09:10:43');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'screens', '2026-04-24 09:11:01');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'store_inventory', '2026-04-24 09:11:02');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'stores', '2026-04-24 09:11:03');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Subcategory', '2026-04-24 09:10:43');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Suppliers', '2026-04-24 09:10:44');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'sync_session_tables', '2026-04-24 09:11:04');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'sync_sessions', '2026-04-24 09:11:04');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'sync_table_watermarks', '2026-04-24 09:11:05');
INSERT INTO `sync_session_tables` (`session_id`, `table_name`, `completed_at`) VALUES (8, 'Tax', '2026-04-24 09:10:44');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
