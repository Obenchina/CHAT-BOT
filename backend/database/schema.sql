-- Medical Website Database Schema
-- MySQL Database Setup Script
-- Run this script to create all required tables

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS medical_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE medical_db;

-- ======================
-- USERS TABLE
-- Stores all user accounts (doctors and assistants)
-- ======================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('doctor', 'assistant') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ======================
-- DOCTORS TABLE
-- Stores doctor profiles
-- ======================
CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female', 'other') NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT,
    specialty VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ======================
-- ASSISTANTS TABLE
-- Stores assistant profiles linked to doctors
-- ======================
CREATE TABLE IF NOT EXISTS assistants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    doctor_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_doctor_id (doctor_id)
) ENGINE=InnoDB;

-- ======================
-- PATIENTS TABLE
-- Stores patient records
-- ======================
CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    age INT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_name (last_name, first_name)
) ENGINE=InnoDB;

-- ======================
-- CATALOGUES TABLE
-- Stores catalogue versions for questions
-- ======================
CREATE TABLE IF NOT EXISTS catalogues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_published (doctor_id, is_published)
) ENGINE=InnoDB;

-- ======================
-- QUESTIONS TABLE
-- Stores questions within catalogues
-- ======================
CREATE TABLE IF NOT EXISTS questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    catalogue_id INT NOT NULL,
    question_text TEXT NOT NULL,
    answer_type ENUM('yes_no', 'voice', 'choices') NOT NULL,
    choices JSON,
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    order_index INT NOT NULL DEFAULT 0,
    FOREIGN KEY (catalogue_id) REFERENCES catalogues(id) ON DELETE CASCADE,
    INDEX idx_catalogue_id (catalogue_id),
    INDEX idx_order (catalogue_id, order_index)
) ENGINE=InnoDB;

-- ======================
-- CASES TABLE
-- Stores medical cases
-- ======================
CREATE TABLE IF NOT EXISTS cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    assistant_id INT NOT NULL,
    catalogue_version_id INT NOT NULL,
    status ENUM('in_progress', 'submitted', 'reviewed', 'closed') NOT NULL DEFAULT 'in_progress',
    ai_analysis JSON,
    doctor_diagnosis TEXT,
    doctor_prescription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    reviewed_at TIMESTAMP NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE,
    FOREIGN KEY (catalogue_version_id) REFERENCES catalogues(id) ON DELETE CASCADE,
    INDEX idx_patient_id (patient_id),
    INDEX idx_assistant_id (assistant_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ======================
-- CASE_ANSWERS TABLE
-- Stores answers to questionnaire
-- ======================
CREATE TABLE IF NOT EXISTS case_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    question_id INT NOT NULL,
    audio_path VARCHAR(500),
    transcribed_text TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_case_id (case_id)
) ENGINE=InnoDB;

-- ======================
-- DOCUMENTS TABLE
-- Stores uploaded medical documents
-- ======================
CREATE TABLE IF NOT EXISTS documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    document_type ENUM('analysis', 'imagery', 'prescription', 'report') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    INDEX idx_case_id (case_id),
    INDEX idx_type (document_type)
) ENGINE=InnoDB;

-- ======================
-- AUDIT_LOGS TABLE
-- Stores all system actions for tracking
-- ======================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ======================
-- SUCCESS MESSAGE
-- ======================
SELECT 'Database schema created successfully!' AS message;
