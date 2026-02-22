-- Table Backup: users
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:38.866Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `users`
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address_street` varchar(200) DEFAULT NULL,
  `address_city` varchar(50) DEFAULT NULL,
  `address_state` varchar(50) DEFAULT NULL,
  `address_zip_code` varchar(10) DEFAULT NULL,
  `address_country` varchar(50) DEFAULT 'India',
  `preferences` json DEFAULT NULL,
  `screen_id` varchar(255) DEFAULT NULL,
  `edit_rights` json DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
  `reset_password_otp` varchar(10) DEFAULT NULL,
  `reset_password_otp_expires_at` datetime DEFAULT NULL,
  `selected_store_id` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `email_2` (`email`),
  UNIQUE KEY `email_3` (`email`),
  UNIQUE KEY `email_4` (`email`),
  UNIQUE KEY `email_5` (`email`),
  UNIQUE KEY `email_6` (`email`),
  UNIQUE KEY `email_7` (`email`),
  UNIQUE KEY `email_8` (`email`),
  UNIQUE KEY `email_9` (`email`),
  UNIQUE KEY `email_10` (`email`),
  UNIQUE KEY `email_11` (`email`),
  UNIQUE KEY `email_12` (`email`),
  UNIQUE KEY `email_13` (`email`),
  UNIQUE KEY `email_14` (`email`),
  UNIQUE KEY `email_15` (`email`),
  UNIQUE KEY `email_16` (`email`),
  UNIQUE KEY `email_17` (`email`),
  UNIQUE KEY `email_18` (`email`),
  UNIQUE KEY `email_19` (`email`),
  UNIQUE KEY `email_20` (`email`),
  UNIQUE KEY `email_21` (`email`),
  UNIQUE KEY `email_22` (`email`),
  UNIQUE KEY `email_23` (`email`),
  UNIQUE KEY `email_24` (`email`),
  UNIQUE KEY `email_25` (`email`),
  UNIQUE KEY `email_26` (`email`),
  UNIQUE KEY `email_27` (`email`),
  UNIQUE KEY `email_28` (`email`),
  UNIQUE KEY `email_29` (`email`),
  UNIQUE KEY `email_30` (`email`),
  UNIQUE KEY `email_31` (`email`),
  KEY `selected_store_id` (`selected_store_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `users_ibfk_59` FOREIGN KEY (`selected_store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_ibfk_60` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `users` (4 rows)
LOCK TABLES `users` WRITE;
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `preferences`, `screen_id`, `edit_rights`, `is_admin`, `is_active`, `last_login_at`, `reset_password_otp`, `reset_password_otp_expires_at`, `selected_store_id`, `created_by`, `created_at`, `updated_at`) VALUES (1, 'PUSH', 'DIGGY', 'pushdiggy@gmail.com', '$2a$12$9G4PqlpQ76Jte2aPD4WyVOK8S4KDw8OZKNU4y7q499JjZdzOkOghi', '9150690961', NULL, NULL, NULL, NULL, 'India', NULL, NULL, NULL, 1, 1, '2025-12-26 05:34:50', NULL, NULL, 2, NULL, '2025-11-18 03:23:00', '2025-11-18 03:23:00');
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `preferences`, `screen_id`, `edit_rights`, `is_admin`, `is_active`, `last_login_at`, `reset_password_otp`, `reset_password_otp_expires_at`, `selected_store_id`, `created_by`, `created_at`, `updated_at`) VALUES (10, 'Admin', NULL, 'admin@pushdiggy.com', '$2a$10$oMeodLZXfQIbr9cw3mFRqukoRbFeCUp7mvIxFMWOUjd/mNH5YWcyK', '123654', NULL, NULL, NULL, NULL, 'India', NULL, NULL, NULL, 1, 1, '2025-11-20 09:58:33', NULL, NULL, 1, 1, '2025-11-20 09:58:20', '2025-11-20 09:58:20');
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `preferences`, `screen_id`, `edit_rights`, `is_admin`, `is_active`, `last_login_at`, `reset_password_otp`, `reset_password_otp_expires_at`, `selected_store_id`, `created_by`, `created_at`, `updated_at`) VALUES (11, 'admin', NULL, 'jprsupermarket@gmail.com', '$2a$10$2YoUgt2WYjtHaAKgQMv10.P5jz2lUiTp1ivtncG4CiqbClyJ99/YK', '9445750954', NULL, NULL, NULL, NULL, 'India', NULL, '1,2,3,4,5,7,8,9,10,11', '[3]', 0, 1, '2025-11-27 08:06:09', '333528', '2025-11-22 01:39:21', 2, 1, '2025-11-20 12:36:26', '2025-11-20 12:36:26');
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `address_street`, `address_city`, `address_state`, `address_zip_code`, `address_country`, `preferences`, `screen_id`, `edit_rights`, `is_admin`, `is_active`, `last_login_at`, `reset_password_otp`, `reset_password_otp_expires_at`, `selected_store_id`, `created_by`, `created_at`, `updated_at`) VALUES (12, 'Aadarsh', NULL, 'infor0507@gmail.com', '$2a$10$hjkY88kWGI9K9SqFf6YRuuF46hBv/dekDWVM1OkYCO6YUFV8D7JRK', '9150690961', NULL, NULL, NULL, NULL, 'India', NULL, NULL, NULL, 1, 1, '2026-02-22 04:47:45', NULL, NULL, 2, 1, '2025-12-26 05:37:30', '2025-12-26 05:37:30');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
