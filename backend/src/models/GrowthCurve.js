/**
 * GrowthCurve model — v2 schema.
 *
 * A doctor's growth curve points either at a built-in reference
 * (source_type='reference', reference_id='who_height_boys_0_5')
 * OR carries inline AI-extracted percentile data
 * (source_type='extracted', curve_data={...})
 * OR overlays patient measurements directly on top of an uploaded image
 * (source_type='calibrated_overlay', original_image_path + calibration).
 *
 * Rendering uses curve_data when available; for calibrated_overlay rows the
 * frontend instead uses original_image_path + calibration to position
 * patient dots over the image with pixel-perfect accuracy.
 */
const { pool: db } = require('../config/database');

function toJsonString(value) {
    if (value == null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
}

function parseJsonField(value) {
    if (value == null) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function mapRow(row) {
    if (!row) return null;
    return {
        ...row,
        curve_data: parseJsonField(row.curve_data),
        calibration: parseJsonField(row.calibration),
    };
}

class GrowthCurve {
    static async create(data) {
        const [result] = await db.execute(
            `INSERT INTO doctor_growth_curves
                (doctor_id, measure_key, gender, source_type, reference_id, curve_data,
                 validation_status, original_image_path, label, chart_kind, calibration)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.doctor_id,
                data.measure_key,
                data.gender,
                data.source_type || 'reference',
                data.reference_id || null,
                toJsonString(data.curve_data),
                data.validation_status || 'auto_approved',
                data.original_image_path || null,
                data.label || null,
                data.chart_kind || null,
                toJsonString(data.calibration),
            ],
        );
        return GrowthCurve.findById(result.insertId);
    }

    static async findByDoctorId(doctorId) {
        const [rows] = await db.execute(
            'SELECT * FROM doctor_growth_curves WHERE doctor_id = ? ORDER BY created_at DESC',
            [doctorId],
        );
        return rows.map(mapRow);
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT * FROM doctor_growth_curves WHERE id = ?',
            [id],
        );
        return rows.length ? mapRow(rows[0]) : null;
    }

    static async delete(id, doctorId) {
        const [result] = await db.execute(
            'DELETE FROM doctor_growth_curves WHERE id = ? AND doctor_id = ?',
            [id, doctorId],
        );
        return result.affectedRows > 0;
    }

    static async updateValidationStatus(id, doctorId, status) {
        const allowed = ['auto_approved', 'pending_review', 'doctor_approved', 'rejected'];
        if (!allowed.includes(status)) throw new Error(`Invalid validation status: ${status}`);
        const [result] = await db.execute(
            `UPDATE doctor_growth_curves SET validation_status = ? WHERE id = ? AND doctor_id = ?`,
            [status, id, doctorId],
        );
        return result.affectedRows > 0;
    }

    static async updateCurveData(id, doctorId, curveData) {
        const [result] = await db.execute(
            `UPDATE doctor_growth_curves SET curve_data = ? WHERE id = ? AND doctor_id = ?`,
            [toJsonString(curveData), id, doctorId],
        );
        return result.affectedRows > 0;
    }

    /**
     * Save a calibration object (and optionally update label, chart_kind,
     * source_type and validation_status) atomically.
     */
    static async updateCalibration(id, doctorId, fields) {
        const sets = [];
        const params = [];
        if (fields.calibration !== undefined) {
            sets.push('calibration = ?');
            params.push(toJsonString(fields.calibration));
        }
        if (fields.chart_kind !== undefined) {
            sets.push('chart_kind = ?');
            params.push(fields.chart_kind || null);
        }
        if (fields.label !== undefined && fields.label !== null) {
            sets.push('label = ?');
            params.push(fields.label);
        }
        if (fields.source_type !== undefined) {
            sets.push('source_type = ?');
            params.push(fields.source_type);
        }
        if (fields.validation_status !== undefined) {
            const allowed = ['auto_approved', 'pending_review', 'doctor_approved', 'rejected'];
            if (!allowed.includes(fields.validation_status)) {
                throw new Error(`Invalid validation status: ${fields.validation_status}`);
            }
            sets.push('validation_status = ?');
            params.push(fields.validation_status);
        }
        if (!sets.length) return false;
        params.push(id, doctorId);
        const [result] = await db.execute(
            `UPDATE doctor_growth_curves SET ${sets.join(', ')} WHERE id = ? AND doctor_id = ?`,
            params,
        );
        return result.affectedRows > 0;
    }

    static async existsForReference(doctorId, referenceId) {
        const [rows] = await db.execute(
            `SELECT id FROM doctor_growth_curves
             WHERE doctor_id = ? AND source_type = 'reference' AND reference_id = ? LIMIT 1`,
            [doctorId, referenceId],
        );
        return rows.length > 0;
    }
}

module.exports = GrowthCurve;
