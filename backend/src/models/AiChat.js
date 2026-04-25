/**
 * AiChat Model
 * Database operations for ai_chat_messages table
 */

const { pool } = require('../config/database');

const AiChat = {
    /**
     * Get all messages for a case
     */
    async getMessages(caseId) {
        const [rows] = await pool.execute(
            'SELECT * FROM ai_chat_messages WHERE case_id = ? ORDER BY created_at ASC',
            [caseId]
        );
        return rows;
    },

    /**
     * Add a message (doctor or AI)
     */
    async addMessage(caseId, doctorId, role, content) {
        const [result] = await pool.execute(
            'INSERT INTO ai_chat_messages (case_id, doctor_id, role, content) VALUES (?, ?, ?, ?)',
            [caseId, doctorId, role, content]
        );
        return {
            id: result.insertId,
            case_id: caseId,
            doctor_id: doctorId,
            role,
            content,
            created_at: new Date()
        };
    },

    /**
     * Delete all messages for a case
     */
    async deleteByCase(caseId) {
        await pool.execute('DELETE FROM ai_chat_messages WHERE case_id = ?', [caseId]);
    }
};

module.exports = AiChat;
