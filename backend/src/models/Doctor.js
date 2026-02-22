/**
 * Doctor Model
 * Database operations for doctors table
 */

const { pool } = require('../config/database');

const Doctor = {
    /**
     * Create doctor profile
     * @param {Object} doctorData - Doctor profile data
     * @returns {Promise<Object>} Created doctor profile
     */
    async create(doctorData) {
        const { userId, firstName, lastName, gender, phone, email, address, specialty } = doctorData;

        const [result] = await pool.execute(
            `INSERT INTO doctors (user_id, first_name, last_name, gender, phone, email, address, specialty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, firstName, lastName, gender || null, phone, email, address, specialty]
        );

        return {
            id: result.insertId,
            ...doctorData
        };
    },

    /**
     * Find doctor by user ID
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>} Doctor profile or null
     */
    async findByUserId(userId) {
        const [doctors] = await pool.execute(
            'SELECT * FROM doctors WHERE user_id = ?',
            [userId]
        );

        return doctors.length > 0 ? doctors[0] : null;
    },

    /**
     * Find doctor by ID
     * @param {number} id - Doctor ID
     * @returns {Promise<Object|null>} Doctor profile or null
     */
    async findById(id) {
        const [doctors] = await pool.execute(
            'SELECT * FROM doctors WHERE id = ?',
            [id]
        );

        return doctors.length > 0 ? doctors[0] : null;
    },

    /**
     * Update doctor profile
     * @param {number} userId - User ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async update(userId, updateData) {
        const { firstName, lastName, gender, phone, email, address, specialty } = updateData;

        const [result] = await pool.execute(
            `UPDATE doctors SET 
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        specialty = COALESCE(?, specialty)
       WHERE user_id = ?`,
            [firstName, lastName, gender, phone, email, address, specialty, userId]
        );

        return result.affectedRows > 0;
    },

    /**
     * Get doctor with user info
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>} Doctor with user info
     */
    async getFullProfile(userId) {
        const [results] = await pool.execute(
            `SELECT d.*, u.email as login_email, u.created_at as account_created
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = ?`,
            [userId]
        );

        return results.length > 0 ? results[0] : null;
    }
};

module.exports = Doctor;
