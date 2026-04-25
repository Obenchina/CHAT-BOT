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
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
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
    gender ENUM('male', 'female', 'other') NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    specialty VARCHAR(100) NOT NULL,
    prescription_logo_path VARCHAR(500) NULL,
    prescription_primary_color VARCHAR(20) NULL,
    prescription_accent_color VARCHAR(20) NULL,
    prescription_specialty_text VARCHAR(255) NULL,
    prescription_services_text TEXT NULL,
    analyses_list TEXT NULL,
    letter_template TEXT NULL,
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
    date_of_birth DATE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NULL,
    siblings_alive INT NOT NULL DEFAULT 0,
    siblings_deceased INT NOT NULL DEFAULT 0,
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
    name VARCHAR(150) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_published (doctor_id, is_published),
    INDEX idx_active (doctor_id, is_active)
) ENGINE=InnoDB;

-- ======================
-- QUESTIONS TABLE
-- Stores questions within catalogues
-- Phase 2: Added section_name, section_order, clinical_measure, expanded answer_type
-- ======================
CREATE TABLE IF NOT EXISTS questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    catalogue_id INT NOT NULL,
    section_name VARCHAR(150) NULL DEFAULT NULL,
    section_order INT DEFAULT 0,
    question_text TEXT NOT NULL,
    answer_type ENUM('yes_no', 'voice', 'choices', 'text_short', 'text_long', 'number') NOT NULL,
    clinical_measure ENUM('none', 'temperature', 'weight', 'height', 'head_circumference', 'blood_pressure') NOT NULL DEFAULT 'none',
    choices JSON,
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    order_index INT NOT NULL DEFAULT 0,
    FOREIGN KEY (catalogue_id) REFERENCES catalogues(id) ON DELETE CASCADE,
    INDEX idx_catalogue_id (catalogue_id),
    INDEX idx_order (catalogue_id, section_order, order_index)
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
-- Phase 2: Expanded answer_type_snapshot to include new types
-- ======================
CREATE TABLE IF NOT EXISTS case_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    question_id INT NOT NULL,
    audio_path VARCHAR(500),
    transcribed_text TEXT,
    question_text_snapshot TEXT,
    answer_type_snapshot ENUM('yes_no', 'voice', 'choices', 'text_short', 'text_long', 'number') NULL,
    order_index_snapshot INT NULL,
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
-- PENDING REGISTRATIONS TABLE
-- Stores temporary registrations awaiting OTP verification
-- ======================
CREATE TABLE IF NOT EXISTS pending_registrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female', 'other') NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    specialty VARCHAR(100) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- ======================
-- AI CONFIGURATION TABLE
-- Stores per-doctor AI provider settings (Gemini / OpenAI)
-- ======================
CREATE TABLE IF NOT EXISTS ai_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    provider ENUM('gemini', 'openai') NOT NULL DEFAULT 'gemini',
    api_key VARCHAR(500) NOT NULL DEFAULT '',
    model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY doctor_provider_unique (doctor_id, provider),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ======================
-- PASSWORD RESETS TABLE
-- Stores OTP codes for password reset
-- ======================
CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- ======================
-- DOCTOR GROWTH CURVES TABLE
-- Stores metadata for custom curve background uploads with calibration
-- ======================
CREATE TABLE IF NOT EXISTS doctor_growth_curves (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    measure_key VARCHAR(50) NOT NULL, -- 'weight', 'height', 'head', 'bmi'
    gender ENUM('male', 'female', 'both') NOT NULL DEFAULT 'both',
    file_path VARCHAR(255) NOT NULL,
    -- Calibration Points: Mapping pixel coordinates to physical values
    -- P1: Typically the Origin (0,0) or bottom-left of grid
    p1_x FLOAT DEFAULT 0, -- Pixel X for P1
    p1_y FLOAT DEFAULT 0, -- Pixel Y for P1
    p1_val_x FLOAT DEFAULT 0, -- Age/Months for P1
    p1_val_y FLOAT DEFAULT 0, -- Weight/Height for P1
    -- P2: A reference point (e.g., top-right of grid)
    p2_x FLOAT DEFAULT 0, -- Pixel X for P2
    p2_y FLOAT DEFAULT 0, -- Pixel Y for P2
    p2_val_x FLOAT DEFAULT 60, -- Age/Months for P2
    p2_val_y FLOAT DEFAULT 30, -- Weight/Height for P2
    is_calibrated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ======================
-- AI CHAT MESSAGES TABLE
-- Stores doctor-AI conversation history per case
-- ======================
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    doctor_id INT NOT NULL,
    role ENUM('doctor', 'ai') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_case (case_id),
    INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB;

-- ======================
-- DOCTOR MEDICATIONS TABLE
-- Stores medications from CSV upload for search/selection
-- ======================
CREATE TABLE IF NOT EXISTS doctor_medications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(100),
    default_dosage VARCHAR(100),
    default_frequency VARCHAR(100),
    notes TEXT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_name (doctor_id, name)
) ENGINE=InnoDB;

-- ======================
-- SUCCESS MESSAGE
-- ======================
SELECT 'Database schema created successfully!' AS message;
