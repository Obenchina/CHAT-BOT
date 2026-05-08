-- Migration: doctor_growth_curves v2
-- Adds support for the reference + extraction architecture.
-- Safe to run multiple times.

ALTER TABLE doctor_growth_curves
    ADD COLUMN IF NOT EXISTS source_type ENUM('reference', 'extracted') NOT NULL DEFAULT 'reference' AFTER gender,
    ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100) NULL AFTER source_type,
    ADD COLUMN IF NOT EXISTS curve_data JSON NULL AFTER reference_id,
    ADD COLUMN IF NOT EXISTS validation_status ENUM('auto_approved', 'pending_review', 'doctor_approved', 'rejected') NOT NULL DEFAULT 'auto_approved' AFTER curve_data,
    ADD COLUMN IF NOT EXISTS original_image_path VARCHAR(255) NULL AFTER validation_status,
    ADD COLUMN IF NOT EXISTS label VARCHAR(255) NULL AFTER original_image_path,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Drop legacy columns (template_config, is_calibrated, file_path) once data is migrated.
-- We keep them for now to allow a rolling deploy; remove in a follow-up migration.
