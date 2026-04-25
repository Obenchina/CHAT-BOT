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
        const {
            doctorId, firstName, lastName, gender,
            dateOfBirth, phone, address,
            siblingsAlive, siblingsDeceased
        } = patientData;

        const [result] = await pool.execute(
            `INSERT INTO patients (doctor_id, first_name, last_name, gender, date_of_birth, phone, address, siblings_alive, siblings_deceased, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                doctorId, firstName, lastName, gender,
                dateOfBirth, phone, address || null,
                siblingsAlive || 0, siblingsDeceased || 0
            ]
        );

        return {
            id: result.insertId,
            ...patientData
        };
    },

    /**
     * Find patient by ID (with calculated age)
     * @param {number} id - Patient ID
     * @returns {Promise<Object|null>} Patient or null
     */
    async findById(id) {
        const [patients] = await pool.execute(
            `SELECT *, TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age
             FROM patients WHERE id = ?`,
            [id]
        );

        return patients.length > 0 ? patients[0] : null;
    },

    /**
     * Get longitudinal measurements for a patient
     * @param {number} patientId - Patient ID
     * @returns {Promise<Array>} List of measurements
     */
    async getMeasurements(patientId) {
        // We select the case date, the actual numeric value (from text_answer, safely cast later or returned as string), 
        // and the clinical_measure type from the question.
        const [measurements] = await pool.execute(
            `SELECT 
                c.id AS case_id,
                c.created_at AS date,
                q.clinical_measure,
                ca.text_answer AS value
             FROM cases c
             JOIN case_answers ca ON c.id = ca.case_id
             JOIN questions q ON ca.question_id = q.id
             WHERE c.patient_id = ? 
             AND ca.answer_type_snapshot = 'number'
             AND q.clinical_measure IS NOT NULL 
             AND q.clinical_measure != 'none'
             ORDER BY c.created_at ASC`,
            [patientId]
        );

        return measurements;
    },

    /**
     * Get all patients for a doctor (with calculated age)
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of patients
     */
    async findByDoctorId(doctorId) {
        const [patients] = await pool.execute(
            `SELECT p.*, 
                TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
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
            `SELECT *, TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age
             FROM patients 
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
        const {
            firstName, lastName, gender,
            dateOfBirth, phone, address,
            siblingsAlive, siblingsDeceased
        } = updateData;

        const [result] = await pool.execute(
            `UPDATE patients SET 
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                gender = COALESCE(?, gender),
                date_of_birth = COALESCE(?, date_of_birth),
                phone = COALESCE(?, phone),
                address = COALESCE(?, address),
                siblings_alive = COALESCE(?, siblings_alive),
                siblings_deceased = COALESCE(?, siblings_deceased)
             WHERE id = ?`,
            [
                firstName, lastName, gender,
                dateOfBirth, phone, address,
                siblingsAlive !== undefined ? siblingsAlive : null,
                siblingsDeceased !== undefined ? siblingsDeceased : null,
                id
            ]
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
     * Get patient with case history (with calculated age)
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
