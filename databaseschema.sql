-- Create database
CREATE DATABASE IF NOT EXISTS civicdb
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE civicdb;

-- -----------------------------------------------------
-- Table: municipalities
-- -----------------------------------------------------
DROP TABLE IF EXISTS official_issue_completions;
DROP TABLE IF EXISTS official_applications;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS municipalities;

CREATE TABLE municipalities (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  role ENUM('user','municipality','admin') NOT NULL,
  municipalityId INT NOT NULL,
  createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  accountStatus ENUM('active','blocked') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_municipalityId (municipalityId),
  CONSTRAINT fk_users_municipality
    FOREIGN KEY (municipalityId) REFERENCES municipalities(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: requests
-- -----------------------------------------------------
CREATE TABLE requests (
  id INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  municipalityId INT NOT NULL,
  issue_type ENUM('garbage','streetlights','waterleak','sewage','pothole') NOT NULL,
  description TEXT NOT NULL,
  imagePath VARCHAR(255) NOT NULL,
  afterImagePath VARCHAR(255) NULL,
  status ENUM('pending','accepted','rejected','completed') NULL DEFAULT 'pending',
  modelResult DECIMAL(5,2) NULL,
  feedback ENUM('satisfied','unsatisfied') NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP NULL DEFAULT NULL,
  rejectReason TEXT NULL,
  after_confidence DECIMAL(5,2) NULL,
  last_reopen_reason TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_requests_userId (userId),
  KEY idx_requests_municipalityId (municipalityId),
  KEY idx_requests_status (status),
  CONSTRAINT fk_requests_user
    FOREIGN KEY (userId) REFERENCES users(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_requests_municipality
    FOREIGN KEY (municipalityId) REFERENCES municipalities(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: official_applications
-- -----------------------------------------------------
CREATE TABLE official_applications (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) NULL,
  password_hash VARCHAR(255) NOT NULL,
  municipality_id INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by_admin_id INT NULL,
  PRIMARY KEY (id),
  KEY idx_official_app_municipality (municipality_id),
  KEY idx_official_app_reviewed_by (reviewed_by_admin_id),
  CONSTRAINT fk_official_app_municipality
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_official_app_reviewed_by
    FOREIGN KEY (reviewed_by_admin_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------
-- Table: official_issue_completions
-- -----------------------------------------------------
CREATE TABLE official_issue_completions (
  id INT NOT NULL AUTO_INCREMENT,
  requestId INT NOT NULL,
  officialId INT NOT NULL,
  completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oic_request (requestId),
  KEY idx_oic_official (officialId),
  CONSTRAINT fk_oic_request
    FOREIGN KEY (requestId) REFERENCES requests(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_oic_official
    FOREIGN KEY (officialId) REFERENCES users(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
