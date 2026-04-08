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
        const { userId, gender, phone, address, specialty } = doctorData;

        const [result] = await pool.execute(
            `INSERT INTO doctors (user_id, gender, phone, address, specialty)
       VALUES (?, ?, ?, ?, ?)`,
            [userId, gender || null, phone, address, specialty]
        );

        return {
            id: result.insertId,
            ...doctorData
        };
    },

    /**
     * Find doctor by user ID (with name from users table)
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>} Doctor profile or null
     */
    async findByUserId(userId) {
        const [doctors] = await pool.execute(
            `SELECT d.*, u.first_name, u.last_name, u.email
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = ?`,
            [userId]
        );

        return doctors.length > 0 ? doctors[0] : null;
    },

    /**
     * Find doctor by ID (with name from users table)
     * @param {number} id - Doctor ID
     * @returns {Promise<Object|null>} Doctor profile or null
     */
    async findById(id) {
        const [doctors] = await pool.execute(
            `SELECT d.*, u.first_name, u.last_name, u.email
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = ?`,
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
        const { gender, phone, address, specialty } = updateData;

        const [result] = await pool.execute(
            `UPDATE doctors SET 
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        specialty = COALESCE(?, specialty)
       WHERE user_id = ?`,
            [gender, phone, address, specialty, userId]
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
            `SELECT d.*, u.email, u.first_name, u.last_name, u.created_at as account_created
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = ?`,
            [userId]
        );

        return results.length > 0 ? results[0] : null;
    }
};

module.exports = Doctor;
