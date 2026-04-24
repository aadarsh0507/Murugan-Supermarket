-- Table Backup: sync_sessions
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:21.748Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `sync_sessions`
DROP TABLE IF EXISTS `sync_sessions`;
CREATE TABLE `sync_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `source_id` varchar(100) DEFAULT 'default',
  `status` enum('in_progress','completed','failed') DEFAULT 'in_progress',
  `started_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `sync_sessions` (8 rows)
LOCK TABLES `sync_sessions` WRITE;
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (1, 'default', 'in_progress', '2026-03-29 11:12:54', '2026-03-29 11:12:54');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (2, 'default', 'failed', '2026-03-29 11:17:54', '2026-03-29 11:35:23');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (3, 'default', 'completed', '2026-03-29 11:38:36', '2026-03-29 11:39:59');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (4, 'default', 'completed', '2026-03-29 11:43:22', '2026-03-29 11:43:32');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (5, 'default', 'completed', '2026-04-18 17:50:22', '2026-04-18 17:50:28');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (6, 'default', 'completed', '2026-04-18 17:50:36', '2026-04-18 17:50:41');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (7, 'default', 'completed', '2026-04-21 07:35:56', '2026-04-21 07:36:08');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (8, 'default', 'completed', '2026-04-24 09:10:14', '2026-04-24 09:11:05');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
