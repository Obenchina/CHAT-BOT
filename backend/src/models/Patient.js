/**
 * Patient Model
 * Database operations for patients table
 */

const { pool } = require('../config/database');

const Patient = {
    /**
     * Create new patient
     * @param {Object} patientData - Patient data
     * @returns {Promise<Object>} Created patient
     */
    async create(patientData) {
        const { doctorId, firstName, lastName, gender, age, phone } = patientData;

        const [result] = await pool.execute(
            `INSERT INTO patients (doctor_id, first_name, last_name, gender, age, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [doctorId, firstName, lastName, gender, age, phone]
        );

        return {
            id: result.insertId,
            ...patientData
        };
    },

    /**
     * Find patient by ID
     * @param {number} id - Patient ID
     * @returns {Promise<Object|null>} Patient or null
     */
    async findById(id) {
        const [patients] = await pool.execute(
            'SELECT * FROM patients WHERE id = ?',
            [id]
        );

        return patients.length > 0 ? patients[0] : null;
    },

    /**
     * Get all patients for a doctor
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of patients
     */
    async findByDoctorId(doctorId) {
        const [patients] = await pool.execute(
            `SELECT p.*, 
        (SELECT COUNT(*) FROM cases c WHERE c.patient_id = p.id) as case_count
       FROM patients p
       WHERE p.doctor_id = ?
       ORDER BY p.last_name, p.first_name`,
            [doctorId]
        );

        return patients;
    },

    /**
     * Search patients by name or phone
     * @param {number} doctorId - Doctor ID
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching patients
     */
    async search(doctorId, query) {
        const searchTerm = `%${query}%`;

        const [patients] = await pool.execute(
            `SELECT * FROM patients 
       WHERE doctor_id = ? 
       AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
       ORDER BY last_name, first_name`,
            [doctorId, searchTerm, searchTerm, searchTerm]
        );

        return patients;
    },

    /**
     * Update patient
     * @param {number} id - Patient ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async update(id, updateData) {
        const { firstName, lastName, gender, age, phone } = updateData;

        const [result] = await pool.execute(
            `UPDATE patients SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        gender = COALESCE(?, gender),
        age = COALESCE(?, age),
        phone = COALESCE(?, phone)
       WHERE id = ?`,
            [firstName, lastName, gender, age, phone, id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Delete patient
     * @param {number} id - Patient ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        const [result] = await pool.execute(
            'DELETE FROM patients WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Check for duplicate patient
     * @param {number} doctorId - Doctor ID
     * @param {string} firstName - First Name
     * @param {string} lastName - Last Name
     * @returns {Promise<boolean>} True if duplicate exists
     */
    async checkDuplicate(doctorId, firstName, lastName) {
        const [rows] = await pool.execute(
            `SELECT id FROM patients 
             WHERE doctor_id = ? 
             AND UPPER(first_name) = ? 
             AND UPPER(last_name) = ?`,
            [doctorId, firstName.toUpperCase(), lastName.toUpperCase()]
        );
        return rows.length > 0;
    },

    /**
     * Get patient with case history
     * @param {number} id - Patient ID
     * @returns {Promise<Object|null>} Patient with cases
     */
    async getWithCases(id) {
        const patient = await this.findById(id);
        if (!patient) return null;

        const [cases] = await pool.execute(
            `SELECT c.id, c.status, c.created_at, c.submitted_at, c.reviewed_at, c.doctor_diagnosis
       FROM cases c
       WHERE c.patient_id = ?
       ORDER BY c.created_at DESC`,
            [id]
        );

        return {
            ...patient,
            cases
        };
    }
};

module.exports = Patient;
