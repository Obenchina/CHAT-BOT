const { pool: db } = require('../config/database');

class GrowthCurve {
    static async create(data) {
        const [result] = await db.execute(
            `INSERT INTO doctor_growth_curves 
            (doctor_id, measure_key, gender, file_path, p1_x, p1_y, p1_val_x, p1_val_y, p2_x, p2_y, p2_val_x, p2_val_y, is_calibrated) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.doctor_id, 
                data.measure_key, 
                data.gender, 
                data.file_path,
                data.p1_x || 0,
                data.p1_y || 0,
                data.p1_val_x || 0,
                data.p1_val_y || 0,
                data.p2_x || 0,
                data.p2_y || 0,
                data.p2_val_x || 0,
                data.p2_val_y || 0,
                data.is_calibrated || false
            ]
        );
        return { id: result.insertId, ...data };
    }

    static async findByDoctorId(doctorId) {
        const [rows] = await db.execute(
            'SELECT * FROM doctor_growth_curves WHERE doctor_id = ? ORDER BY created_at DESC',
            [doctorId]
        );
        return rows;
    }

    static async delete(id, doctorId) {
        const [result] = await db.execute(
            'DELETE FROM doctor_growth_curves WHERE id = ? AND doctor_id = ?',
            [id, doctorId]
        );
        return result.affectedRows > 0;
    }

    static async updateCalibration(id, doctorId, calibrationData) {
        const [result] = await db.execute(
            `UPDATE doctor_growth_curves SET 
                p1_x = ?, p1_y = ?, p1_val_x = ?, p1_val_y = ?,
                p2_x = ?, p2_y = ?, p2_val_x = ?, p2_val_y = ?,
                is_calibrated = TRUE
            WHERE id = ? AND doctor_id = ?`,
            [
                calibrationData.p1_x, calibrationData.p1_y, calibrationData.p1_val_x, calibrationData.p1_val_y,
                calibrationData.p2_x, calibrationData.p2_y, calibrationData.p2_val_x, calibrationData.p2_val_y,
                id, doctorId
            ]
        );
        return result.affectedRows > 0;
    }
}

module.exports = GrowthCurve;
