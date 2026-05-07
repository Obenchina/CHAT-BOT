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
    async addMessage(caseId, doctorId, role, content, attachment = null) {
        const [result] = await pool.execute(
            `INSERT INTO ai_chat_messages
                (case_id, doctor_id, role, content, attachment_path, attachment_name, attachment_mime)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                caseId,
                doctorId,
                role,
                content,
                attachment?.path || null,
                attachment?.name || null,
                attachment?.mime || null
            ]
        );
        return {
            id: result.insertId,
            case_id: caseId,
            doctor_id: doctorId,
            role,
            content,
            attachment_path: attachment?.path || null,
            attachment_name: attachment?.name || null,
            attachment_mime: attachment?.mime || null,
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
