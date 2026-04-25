const { pool: db } = require('../config/database');

class GrowthCurve {
    static async create(data) {
        const templateConfig = data.template_config
            ? (typeof data.template_config === 'string' ? data.template_config : JSON.stringify(data.template_config))
            : null;

        const [result] = await db.execute(
            `INSERT INTO doctor_growth_curves 
            (doctor_id, measure_key, gender, file_path, template_config, is_calibrated) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                data.doctor_id,
                data.measure_key,
                data.gender,
                data.file_path,
                templateConfig,
                data.is_calibrated || false
            ]
        );
        return { id: result.insertId, ...data, template_config: templateConfig ? JSON.parse(templateConfig) : null };
    }

    static async findByDoctorId(doctorId) {
        const [rows] = await db.execute(
            'SELECT * FROM doctor_growth_curves WHERE doctor_id = ? ORDER BY created_at DESC',
            [doctorId]
        );
        // Parse template_config JSON for each row
        return rows.map(row => ({
            ...row,
            template_config: row.template_config
                ? (typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config)
                : null
        }));
    }

    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT * FROM doctor_growth_curves WHERE id = ?',
            [id]
        );
        if (!rows.length) return null;
        const row = rows[0];
        return {
            ...row,
            template_config: row.template_config
                ? (typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config)
                : null
        };
    }

    static async delete(id, doctorId) {
        const [result] = await db.execute(
            'DELETE FROM doctor_growth_curves WHERE id = ? AND doctor_id = ?',
            [id, doctorId]
        );
        return result.affectedRows > 0;
    }

    static async updateCalibration(id, doctorId, calibrationData) {
        const templateConfig = calibrationData.template_config
            ? (typeof calibrationData.template_config === 'string'
                ? calibrationData.template_config
                : JSON.stringify(calibrationData.template_config))
            : null;

        const [result] = await db.execute(
            `UPDATE doctor_growth_curves SET 
                template_config = ?,
                is_calibrated = TRUE
            WHERE id = ? AND doctor_id = ?`,
            [templateConfig, id, doctorId]
        );
        return result.affectedRows > 0;
    }
}

module.exports = GrowthCurve;
