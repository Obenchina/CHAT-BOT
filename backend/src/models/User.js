/**
 * User Model
 * Database operations for users table (doctors and assistants)
 */

const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
    /**
     * Create a new user
     * @param {Object} userData - User data (email, password, role)
     * @returns {Promise<Object>} Created user
     */
    async create(userData) {
        const { email, password, role } = userData;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            `INSERT INTO users (email, password, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, true, NOW(), NOW())`,
            [email, hashedPassword, role]
        );

        return {
            id: result.insertId,
            email,
            role
        };
    },

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User object or null
     */
    async findByEmail(email) {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        return users.length > 0 ? users[0] : null;
    },

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User object or null
     */
    async findById(id) {
        const [users] = await pool.execute(
            'SELECT id, email, role, is_active, created_at FROM users WHERE id = ?',
            [id]
        );

        return users.length > 0 ? users[0] : null;
    },

    /**
     * Find user by ID with password (for auth checks)
     * @param {number} id - User ID
     * @returns {Promise<Object|null>} User object including password
     */
    async findByIdWithPassword(id) {
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        return users.length > 0 ? users[0] : null;
    },

    /**
     * Update user password
     * @param {number} id - User ID
     * @param {string} newPassword - New password (will be hashed)
     * @returns {Promise<boolean>} Success status
     */
    async updatePassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const [result] = await pool.execute(
            'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
            [hashedPassword, id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Verify password
     * @param {string} plainPassword - Plain text password
     * @param {string} hashedPassword - Hashed password from database
     * @returns {Promise<boolean>} Password match status
     */
    async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    },

    /**
     * Update user active status
     * @param {number} id - User ID
     * @param {boolean} isActive - Active status
     * @returns {Promise<boolean>} Success status
     */
    async updateActiveStatus(id, isActive) {
        const [result] = await pool.execute(
            'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?',
            [isActive, id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Update user email
     * @param {number} id - User ID
     * @param {string} email - New email
     * @returns {Promise<boolean>} Success status
     */
    async updateEmail(id, email) {
        const [result] = await pool.execute(
            'UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?',
            [email, id]
        );

        return result.affectedRows > 0;
    }
};

module.exports = User;
