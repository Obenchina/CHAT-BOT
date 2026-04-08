/**
 * Assistant Model
 * Database operations for assistants table
 */

const { pool } = require('../config/database');

const Assistant = {
    /**
     * Create assistant profile
     * @param {Object} assistantData - Assistant data
     * @returns {Promise<Object>} Created assistant
     */
    async create(assistantData) {
        const { userId, doctorId } = assistantData;

        const [result] = await pool.execute(
            `INSERT INTO assistants (user_id, doctor_id, is_active)
       VALUES (?, ?, true)`,
            [userId, doctorId]
        );

        return {
            id: result.insertId,
            ...assistantData,
            isActive: true
        };
    },

    /**
     * Find assistant by user ID (with name from users table)
     * @param {number} userId - User ID
     * @returns {Promise<Object|null>} Assistant profile or null
     */
    async findByUserId(userId) {
        const [assistants] = await pool.execute(
            `SELECT a.*, u.first_name, u.last_name, u.email
       FROM assistants a
       JOIN users u ON a.user_id = u.id
       WHERE a.user_id = ?`,
            [userId]
        );

        return assistants.length > 0 ? assistants[0] : null;
    },

    /**
     * Find assistant by ID (with name from users table)
     * @param {number} id - Assistant ID
     * @returns {Promise<Object|null>} Assistant profile or null
     */
    async findById(id) {
        const [assistants] = await pool.execute(
            `SELECT a.*, u.first_name, u.last_name, u.email
       FROM assistants a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
            [id]
        );

        return assistants.length > 0 ? assistants[0] : null;
    },

    /**
     * Get all assistants for a doctor (with name from users table)
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of assistants
     */
    async findByDoctorId(doctorId) {
        const [assistants] = await pool.execute(
            `SELECT a.*, u.email, u.first_name, u.last_name
       FROM assistants a
       JOIN users u ON a.user_id = u.id
       WHERE a.doctor_id = ?
       ORDER BY u.first_name, u.last_name`,
            [doctorId]
        );

        return assistants;
    },

    /**
     * Update assistant profile (only is_active lives in assistants table now)
     * @param {number} id - Assistant ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async update(id, updateData) {
        const { isActive } = updateData;

        if (isActive === undefined) return true;

        const [result] = await pool.execute(
            `UPDATE assistants SET 
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
            [
                isActive !== undefined ? isActive : null,
                id
            ]
        );

        return result.affectedRows > 0;
    },

    /**
     * Toggle assistant active status
     * @param {number} id - Assistant ID
     * @param {boolean} isActive - New status
     * @returns {Promise<boolean>} Success status
     */
    async setActiveStatus(id, isActive) {
        const [result] = await pool.execute(
            'UPDATE assistants SET is_active = ? WHERE id = ?',
            [isActive, id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Delete assistant
     * @param {number} id - Assistant ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        // First get the user_id to also deactivate the user
        const assistant = await this.findById(id);
        if (!assistant) return false;

        // Deactivate user account
        await pool.execute(
            'UPDATE users SET is_active = false WHERE id = ?',
            [assistant.user_id]
        );

        // Delete assistant record
        const [result] = await pool.execute(
            'DELETE FROM assistants WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    }
};

module.exports = Assistant;
