-- Migration: doctor_growth_curves v3 — calibrated-overlay support
-- Adds the 'calibrated_overlay' source type plus chart_kind and calibration JSON columns.
-- Safe to run multiple times (idempotent via IF NOT EXISTS / MODIFY COLUMN).
--
-- Mirrors the runtime migration in backend/src/app.js (ensureColumn pattern), so
-- fresh installs from schema.sql, manual migrations from this file, and rolling
-- deploys via app.js all converge on the same shape.

ALTER TABLE doctor_growth_curves
    MODIFY COLUMN source_type ENUM('reference', 'extracted', 'calibrated_overlay') NOT NULL DEFAULT 'reference';

ALTER TABLE doctor_growth_curves
    ADD COLUMN IF NOT EXISTS chart_kind VARCHAR(40) NULL AFTER label,
    ADD COLUMN IF NOT EXISTS calibration JSON NULL AFTER chart_kind;
