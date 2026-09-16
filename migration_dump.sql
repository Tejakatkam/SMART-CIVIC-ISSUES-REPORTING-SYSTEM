-- ==========================================
-- CIVICDB COMPLETE MIGRATION DUMP WITH ALL DATA
-- ==========================================

CREATE DATABASE IF NOT EXISTS civicdb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE civicdb;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS municipalities;
CREATE TABLE `municipalities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for municipalities (13 rows)
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (1, 'Secunderabad', '227r1a6627@cmrtc.ac.in');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (2, 'Secunderabad Cantonment Board', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (3, 'Cantonment Board Hyderabad', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (4, 'Serilingampally Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (5, 'Kukatpally Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (6, 'Quthbullapur Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (7, 'Alwal Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (8, 'Malkajgiri Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (9, 'Kapra Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (10, 'Uppal Kalan Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (11, 'L.B. Nagar Municipality', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (12, 'Gaddiannaram Municipality ', 'destroyerboyyy@gmail.com');
INSERT INTO municipalities (`id`, `name`, `email`) VALUES (13, 'Greater Hyderabad Municipal Corporation (GHMC)', 'destroyerboyyy@gmail.com');

DROP TABLE IF EXISTS users;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `role` enum('user','municipality','admin') NOT NULL,
  `municipalityId` int NOT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `accountStatus` enum('active','blocked') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_municipalityId` (`municipalityId`),
  CONSTRAINT `fk_users_municipality` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for users (6 rows)
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (1, 'SCIRS', '$2b$10$/hKTJtY9Nw7TvZNwCsCIP.AUi6IPyMsp2C8Hew6bNUvx7IOrw4pZ6', 'smartcivicissuereportingsystem@gmail.com', 'admin', 1, '2026-01-19 11:20:54.000', 'active');
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (2, 'KATKAM TEJA', '$2b$10$8lRroovBji8QsVtahDuiaeYlL3oZHQBs4rz.56K1rlsVukm7gDOyC', 'tejakatkam2907@gmail.com', 'user', 1, '2026-01-19 11:26:27.000', 'active');
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (3, 'munsec', '$2b$10$inSUZxEeXmihJh8RaScbTuS5GhSBZW9XaB3rwNI8Y8VXMahr/aNGK', '227r1a6627@cmrtc.ac.in', 'municipality', 1, '2026-01-19 11:27:23.000', 'active');
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (4, 'AJAY', '$2b$10$6BUBkVkjt7h1u/m1QAVfpOnOB0Uzw6j42JsFnGcA3xGDN5Be/WWRu', 'ajaykumarsoma703@gmail.com', 'user', 1, '2026-01-19 12:57:47.000', 'active');
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (5, 'SHRIA VARMA', '$2b$10$OF5855SobROiLzMFgDdiB.NXJZvHjS78fbmP9hQyv2egrjxCrRPz2', 'varmashria79992@gmail.com', 'user', 1, '2026-01-19 13:09:01.000', 'active');
INSERT INTO users (`id`, `username`, `password`, `email`, `role`, `municipalityId`, `createdAt`, `accountStatus`) VALUES (6, 'SHRIA', '$2b$10$U9/VJLwVYyS1pc0RNDhv0OCahh0bJr9FHoS.zEgoVRLwa3oYdyb5.', 'varmashria7999@gmail.com', 'user', 1, '2026-01-19 13:10:24.000', 'active');

DROP TABLE IF EXISTS requests;
CREATE TABLE `requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `municipalityId` int NOT NULL,
  `issue_type` enum('garbage','streetlights','waterleak','sewage','pothole') NOT NULL,
  `description` text NOT NULL,
  `imagePath` varchar(255) NOT NULL,
  `afterImagePath` varchar(255) DEFAULT NULL,
  `status` enum('pending','accepted','rejected','completed') DEFAULT 'pending',
  `modelResult` decimal(5,2) DEFAULT NULL,
  `feedback` enum('satisfied','unsatisfied') DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL DEFAULT NULL,
  `rejectReason` text,
  `after_confidence` decimal(5,2) DEFAULT NULL,
  `last_reopen_reason` text,
  PRIMARY KEY (`id`),
  KEY `idx_requests_userId` (`userId`),
  KEY `idx_requests_municipalityId` (`municipalityId`),
  KEY `idx_requests_status` (`status`),
  CONSTRAINT `fk_requests_municipality` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_requests_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for requests (11 rows)
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (1, 2, 1, 'garbage', 'kokokok', 'photo-1768803390376-436868195.jpg', 'afterPhoto-1768804008029-649315430.jpg', 'completed', '70.38', 'satisfied', '17.5971362', '78.4866924', '2026-01-19 11:46:35.000', '2026-01-19 11:56:48.000', NULL, NULL, NULL);
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (2, 2, 1, 'garbage', 'lkokokoko', 'photo-1768803578240-383375981.jpg', 'afterPhoto-1768804004686-382281429.jpg', 'completed', '95.11', 'satisfied', '17.5972100', '78.4866556', '2026-01-19 11:49:45.000', '2026-01-19 11:56:44.000', NULL, NULL, NULL);
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (3, 2, 1, 'garbage', 'kokokoko', 'photo-1768803761952-382361387.jpg', 'afterPhoto-1768803996437-358039162.jpg', 'completed', '80.72', 'unsatisfied', '17.5972447', '78.4866480', '2026-01-19 11:52:51.000', '2026-01-19 11:56:36.000', 'Citizen marked Unsatisfied → but after photo still valid by AI (9.8%)', '9.82', 'Citizen marked Unsatisfied → but after photo still valid by AI (9.8%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (4, 2, 1, 'garbage', 'kkkokok', 'photo-1768804139963-854091430.jpg', 'afterPhoto-1768804171375-476443463.jpg', 'rejected', '69.55', 'unsatisfied', '17.5971639', '78.4866330', '2026-01-19 11:59:09.000', '2026-01-19 11:59:31.000', 'i d k', '69.55', 'Citizen marked Unsatisfied → after photo re-validated OK (69.5% ≥ 65%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (5, 2, 1, 'garbage', 'kk', 'photo-1768804367454-465135607.jpg', 'afterPhoto-1768804449704-300554250.jpg', 'completed', '90.54', 'unsatisfied', '17.5971574', '78.4866868', '2026-01-19 12:02:56.000', '2026-01-19 12:04:09.000', 'Citizen marked Unsatisfied → but after photo still valid by AI (0.6%)', '0.55', 'Citizen marked Unsatisfied → but after photo still valid by AI (0.6%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (6, 2, 1, 'garbage', 'kkk', 'photo-1768835543125-616251903.jpg', 'afterPhoto-1768835600151-971137815.jpg', 'accepted', '80.46', 'unsatisfied', '17.4330314', '78.4916287', '2026-01-19 20:42:42.000', '2026-01-19 20:43:20.000', NULL, '88.06', 'Citizen marked Unsatisfied → after photo re-validated OK (88.1% ≥ 65%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (7, 2, 1, 'garbage', 'kkk', 'photo-1768884824460-637008176.jpg', 'afterPhoto-1768884894424-807884971.jpg', 'rejected', '87.76', 'unsatisfied', '17.5970640', '78.4866419', '2026-01-20 10:24:17.000', '2026-01-20 10:24:54.000', 'xyz', '78.60', 'Citizen marked Unsatisfied → after photo re-validated OK (78.6% ≥ 65%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (8, 2, 1, 'pothole', 'not drivable this way due to potholes', 'photo-1769168916031-294256626.jpg', NULL, 'rejected', '96.30', NULL, '17.4272000', '78.4914000', '2026-01-23 17:18:56.000', NULL, 'fault civic issue reported', NULL, NULL);
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (9, 2, 1, 'garbage', 'overloading of garbage', 'photo-1775652487727-111026262.jpg', 'afterPhoto-1775654694402-237127097.jpg', 'pending', '98.54', 'unsatisfied', '17.4328936', '78.4916422', '2026-04-08 18:18:50.000', '2026-04-08 18:54:54.000', 'Citizen marked Unsatisfied → after photo re-validated OK (98.5% ≥ 65%)', '98.54', 'Citizen marked Unsatisfied → after photo re-validated OK (98.5% ≥ 65%)');
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (10, 2, 1, 'garbage', 'overloading of garbage', 'photo-1775654450570-310877307.jpg', 'afterPhoto-1775654610731-193760752.jpg', 'completed', '99.41', 'satisfied', '17.4328936', '78.4916422', '2026-04-08 18:52:02.000', '2026-04-08 18:53:30.000', NULL, NULL, NULL);
INSERT INTO requests (`id`, `userId`, `municipalityId`, `issue_type`, `description`, `imagePath`, `afterImagePath`, `status`, `modelResult`, `feedback`, `latitude`, `longitude`, `createdAt`, `completedAt`, `rejectReason`, `after_confidence`, `last_reopen_reason`) VALUES (11, 2, 1, 'garbage', 'overloading of garbage', 'photo-1776399693512-678439784.jpg', NULL, 'pending', '93.26', NULL, '17.5964910', '78.4869210', '2026-04-17 09:52:22.000', NULL, NULL, NULL, NULL);

DROP TABLE IF EXISTS official_applications;
CREATE TABLE `official_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `municipality_id` int NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by_admin_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_official_app_municipality` (`municipality_id`),
  KEY `idx_official_app_reviewed_by` (`reviewed_by_admin_id`),
  CONSTRAINT `fk_official_app_municipality` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_official_app_reviewed_by` FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for official_applications (2 rows)
INSERT INTO official_applications (`id`, `username`, `email`, `password_hash`, `municipality_id`, `status`, `created_at`, `reviewed_at`, `reviewed_by_admin_id`) VALUES (1, 'munsec', '227r1a6627@cmrtc.ac.in', '$2b$10$inSUZxEeXmihJh8RaScbTuS5GhSBZW9XaB3rwNI8Y8VXMahr/aNGK', 1, 'approved', '2026-01-19 11:26:49.000', '2026-01-19 11:27:19.000', 1);
INSERT INTO official_applications (`id`, `username`, `email`, `password_hash`, `municipality_id`, `status`, `created_at`, `reviewed_at`, `reviewed_by_admin_id`) VALUES (2, 'munghmc', NULL, '$2b$10$W6kIPmKU8lIyN2eMWssMQumacmuQcxTxNS3EZz.BxeENVQe04uYpy', 13, 'pending', '2026-04-17 09:58:32.000', NULL, NULL);

DROP TABLE IF EXISTS official_issue_completions;
CREATE TABLE `official_issue_completions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requestId` int NOT NULL,
  `officialId` int NOT NULL,
  `completedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_oic_request` (`requestId`),
  KEY `idx_oic_official` (`officialId`),
  CONSTRAINT `fk_oic_official` FOREIGN KEY (`officialId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_oic_request` FOREIGN KEY (`requestId`) REFERENCES `requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data for official_issue_completions (10 rows)
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (1, 3, 3, '2026-01-19 11:56:36.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (2, 2, 3, '2026-01-19 11:56:44.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (3, 1, 3, '2026-01-19 11:56:48.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (4, 4, 3, '2026-01-19 11:59:31.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (5, 5, 3, '2026-01-19 12:03:21.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (6, 5, 3, '2026-01-19 12:04:09.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (7, 6, 3, '2026-01-19 20:43:20.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (8, 7, 3, '2026-01-20 10:24:54.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (9, 10, 3, '2026-04-08 18:53:30.000');
INSERT INTO official_issue_completions (`id`, `requestId`, `officialId`, `completedAt`) VALUES (10, 9, 3, '2026-04-08 18:54:54.000');

SET FOREIGN_KEY_CHECKS = 1;
