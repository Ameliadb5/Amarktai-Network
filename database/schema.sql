-- ================================================================
-- Amarktai Network — Database Schema
-- Run: mysql -u amarktainet1 -p amarktainet1 < database/schema.sql
-- ================================================================

SET NAMES utf8mb4;
-- Use named timezone instead of hardcoded offset
SET time_zone = 'Africa/Johannesburg';

-- ── Waitlist ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `waitlist` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`      VARCHAR(320)    NOT NULL,
  `app_name`   VARCHAR(100)    NOT NULL DEFAULT 'General',
  `ip`         VARCHAR(45)     NOT NULL DEFAULT '',
  `created_at` DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_waitlist_email_app` (`email`, `app_name`),
  KEY `idx_waitlist_email` (`email`),
  KEY `idx_waitlist_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Contacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contacts` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`   VARCHAR(100)    NOT NULL,
  `last_name`    VARCHAR(100)    NOT NULL,
  `email`        VARCHAR(320)    NOT NULL,
  `company`      VARCHAR(200)    NOT NULL DEFAULT '',
  `inquiry_type` VARCHAR(100)    NOT NULL DEFAULT 'other',
  `message`      TEXT            NOT NULL,
  `ip`           VARCHAR(45)     NOT NULL DEFAULT '',
  `created_at`   DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contacts_email`   (`email`),
  KEY `idx_contacts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Revenue (per-app monthly snapshots) ────────────────────────────
CREATE TABLE IF NOT EXISTS `revenue` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `app_name`    VARCHAR(100)    NOT NULL,
  `amount`      DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
  `currency`    CHAR(3)         NOT NULL DEFAULT 'ZAR',
  `recorded_at` DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_revenue_app` (`app_name`),
  KEY `idx_revenue_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Users ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`       VARCHAR(320)    NOT NULL,
  `display_name`VARCHAR(200)    NOT NULL DEFAULT '',
  `app_source`  VARCHAR(100)    NOT NULL DEFAULT 'general',
  `status`      ENUM('active','inactive','banned') NOT NULL DEFAULT 'active',
  `city`        VARCHAR(100)    NOT NULL DEFAULT '',
  `country`     CHAR(2)         NOT NULL DEFAULT 'ZA',
  `created_at`  DATETIME        NOT NULL,
  `last_seen`   DATETIME            NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_status`  (`status`),
  KEY `idx_users_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Admin Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event`      VARCHAR(100)    NOT NULL,
  `detail`     VARCHAR(500)    NOT NULL DEFAULT '',
  `ip`         VARCHAR(45)     NOT NULL DEFAULT '',
  `created_at` DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_logs_event`   (`event`),
  KEY `idx_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Apps (managed via admin) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `apps` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)    NOT NULL,
  `icon`        VARCHAR(10)     NOT NULL DEFAULT '🚀',
  `url`         VARCHAR(500)    NOT NULL DEFAULT '#',
  `description` TEXT,
  `status`      ENUM('live','invite-only','coming-soon') NOT NULL DEFAULT 'coming-soon',
  `sort_order`  TINYINT         NOT NULL DEFAULT 99,
  `created_at`  DATETIME        NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_apps_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: initial app revenue snapshots ────────────────────────────
INSERT IGNORE INTO `revenue` (`app_name`, `amount`, `currency`, `recorded_at`) VALUES
  ('Amarktai Crypto',           89500.00, 'ZAR', NOW()),
  ('EquiProfile',               42000.00, 'ZAR', NOW()),
  ('Amarktai Secure',           31200.00, 'ZAR', NOW()),
  ('Amarktai Marketing',        28700.00, 'ZAR', NOW()),
  ('Amarktai Agents',           22100.00, 'ZAR', NOW()),
  ('Amarktai Property Manager', 19400.00, 'ZAR', NOW()),
  ('Amarktai Forex',            15600.00, 'ZAR', NOW());
