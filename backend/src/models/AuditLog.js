/**
 * Audit Log Model
 * Database operations for audit trail logging
 */

const { pool } = require('../config/database');

const AuditLog = {
    /**
     * Create audit log entry
     * @param {Object} logData - Log data
     * @returns {Promise<Object>} Created log entry
     */
    async create(logData) {
        const { userId, action, entityType, entityId, details } = logData;

        const [result] = await pool.execute(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, action, entityType, entityId, JSON.stringify(details || {})]
        );

        return {
            id: result.insertId,
            ...logData
        };
    },

    /**
     * Get logs for specific entity
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     * @returns {Promise<Array>} List of log entries
     */
    async findByEntity(entityType, entityId) {
        const [logs] = await pool.execute(
            `SELECT al.*, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC`,
            [entityType, entityId]
        );

        return logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : {}
        }));
    },

    /**
     * Get logs for specific user
     * @param {number} userId - User ID
     * @returns {Promise<Array>} List of log entries
     */
    async findByUserId(userId) {
        const [logs] = await pool.execute(
            `SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        return logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : {}
        }));
    },

    /**
     * Get case audit trail
     * @param {number} caseId - Case ID
     * @returns {Promise<Array>} List of log entries
     */
    async getCaseAuditTrail(caseId) {
        return this.findByEntity('case', caseId);
    },

    // ======================
    // HELPER METHODS
    // ======================

    /**
     * Log case creation
     * @param {number} userId - User ID
     * @param {number} caseId - Case ID
     * @param {Object} details - Additional details
     */
    async logCaseCreated(userId, caseId, details = {}) {
        return this.create({
            userId,
            action: 'case_created',
            entityType: 'case',
            entityId: caseId,
            details
        });
    },

    /**
     * Log case submission
     * @param {number} userId - User ID
     * @param {number} caseId - Case ID
     */
    async logCaseSubmitted(userId, caseId) {
        return this.create({
            userId,
            action: 'case_submitted',
            entityType: 'case',
            entityId: caseId,
            details: { status: 'submitted' }
        });
    },

    /**
     * Log AI analysis
     * @param {number} caseId - Case ID
     */
    async logAiAnalysis(caseId) {
        return this.create({
            userId: null,
            action: 'ai_analyzed',
            entityType: 'case',
            entityId: caseId,
            details: { analyzedBy: 'gemini_ai' }
        });
    },

    /**
     * Log doctor review
     * @param {number} userId - User ID
     * @param {number} caseId - Case ID
     * @param {Object} details - Review details
     */
    async logDoctorReview(userId, caseId, details = {}) {
        return this.create({
            userId,
            action: 'doctor_reviewed',
            entityType: 'case',
            entityId: caseId,
            details
        });
    }
};

module.exports = AuditLog;
