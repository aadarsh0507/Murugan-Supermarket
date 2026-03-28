-- Table Backup: sync_sessions
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.314Z

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
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (1, 'default', 'in_progress', '2026-02-22 08:08:22', '2026-02-22 08:08:22');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (2, 'default', 'in_progress', '2026-02-22 08:22:40', '2026-02-22 08:22:40');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (3, 'default', 'in_progress', '2026-02-22 08:24:44', '2026-02-22 08:24:44');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (4, 'default', 'completed', '2026-02-22 08:26:57', '2026-02-22 08:27:30');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (5, 'default', 'in_progress', '2026-02-22 08:59:58', '2026-02-22 08:59:58');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (6, 'default', 'completed', '2026-02-22 09:06:19', '2026-02-22 09:06:39');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (7, 'default', 'completed', '2026-02-23 08:54:21', '2026-02-23 08:54:35');
INSERT INTO `sync_sessions` (`id`, `source_id`, `status`, `started_at`, `updated_at`) VALUES (8, 'default', 'completed', '2026-02-23 08:58:59', '2026-02-23 08:59:11');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
