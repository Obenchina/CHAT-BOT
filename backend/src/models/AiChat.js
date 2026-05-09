/**
 * AiChat Model
 * Database operations for ai_chat_messages table
 */

const { pool } = require('../config/database');

const AiChat = {
    /**
     * Get all messages for a case with their attachments
     */
    async getMessages(caseId) {
        // Query messages
        const [messages] = await pool.execute(
            'SELECT * FROM ai_chat_messages WHERE case_id = ? ORDER BY created_at ASC',
            [caseId]
        );
        
        if (messages.length === 0) return [];

        // Query attachments for these messages
        const messageIds = messages.map(m => m.id);
        const [attachments] = await pool.query(
            'SELECT * FROM ai_chat_attachments WHERE message_id IN (?)',
            [messageIds]
        );

        // Group attachments by message_id
        const attachmentsByMsg = {};
        attachments.forEach(att => {
            if (!attachmentsByMsg[att.message_id]) {
                attachmentsByMsg[att.message_id] = [];
            }
            attachmentsByMsg[att.message_id].push({
                path: att.path,
                name: att.name,
                mime: att.mime
            });
        });

        // Attach them to messages
        return messages.map(msg => ({
            ...msg,
            attachments: attachmentsByMsg[msg.id] || []
        }));
    },

    /**
     * Add a message (doctor or AI)
     */
    async addMessage(caseId, doctorId, role, content, attachments = []) {
        // Start a transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO ai_chat_messages
                    (case_id, doctor_id, role, content)
                 VALUES (?, ?, ?, ?)`,
                [caseId, doctorId, role, content]
            );
            
            const messageId = result.insertId;
            const savedAttachments = [];

            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (!att) continue;
                    await connection.execute(
                        `INSERT INTO ai_chat_attachments
                            (message_id, path, name, mime)
                         VALUES (?, ?, ?, ?)`,
                        [messageId, att.path, att.name, att.mime]
                    );
                    savedAttachments.push({
                        path: att.path,
                        name: att.name,
                        mime: att.mime
                    });
                }
            }

            await connection.commit();

            return {
                id: messageId,
                case_id: caseId,
                doctor_id: doctorId,
                role,
                content,
                attachments: savedAttachments,
                created_at: new Date()
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    /**
     * Delete all messages for a case
     */
    async deleteByCase(caseId) {
        await pool.execute('DELETE FROM ai_chat_messages WHERE case_id = ?', [caseId]);
    }
};

module.exports = AiChat;
