/**
 * GrowthCurve model — v2 schema.
 *
 * A doctor's growth curve points either at a built-in reference
 * (source_type='reference', reference_id='who_height_boys_0_5')
 * OR carries inline AI-extracted percentile data
 * (source_type='extracted', curve_data={...}).
 *
 * Rendering uses curve_data exclusively; the original image path is
 * preserved only for audit / side-by-side comparison in the UI.
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
    };
}

class GrowthCurve {
    static async create(data) {
        const [result] = await db.execute(
            `INSERT INTO doctor_growth_curves
                (doctor_id, measure_key, gender, source_type, reference_id, curve_data,
                 validation_status, original_image_path, label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
