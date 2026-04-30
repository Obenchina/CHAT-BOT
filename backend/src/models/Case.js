/**
 * Case Model
 * Database operations for medical cases
 */

const { pool } = require('../config/database');

const Case = {
    /**
     * Create new case
     * @param {Object} caseData - Case data
     * @returns {Promise<Object>} Created case
     */
    async create(caseData) {
        const { patientId, assistantId, catalogueVersionId } = caseData;

        const [result] = await pool.execute(
            `INSERT INTO cases (patient_id, assistant_id, catalogue_version_id, status, created_at)
             VALUES (?, ?, ?, 'in_progress', NOW())`,
            [patientId, assistantId, catalogueVersionId]
        );

        return {
            id: result.insertId,
            ...caseData,
            status: 'in_progress'
        };
    },

    /**
     * Find case by ID
     * @param {number} id - Case ID
     * @returns {Promise<Object|null>} Case or null
     */
    async findById(id) {
        const [cases] = await pool.execute(
            'SELECT * FROM cases WHERE id = ?',
            [id]
        );

        return cases.length > 0 ? cases[0] : null;
    },

    /**
     * Get cases for doctor (inbox)
     * @param {number} doctorId - Doctor ID
     * @param {string} status - Filter by status (optional)
     * @returns {Promise<Array>} List of cases
     */
    async findByDoctorId(doctorId, status = null) {
        let query = `
            SELECT c.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
                   u_a.first_name as assistant_first_name, u_a.last_name as assistant_last_name
            FROM cases c
            JOIN patients p ON c.patient_id = p.id
            JOIN assistants a ON c.assistant_id = a.id
            JOIN users u_a ON a.user_id = u_a.id
            WHERE p.doctor_id = ?
        `;

        const params = [doctorId];

        if (status) {
            query += ' AND c.status = ?';
            params.push(status);
        } else {
            query += " AND c.status != 'in_progress'";
        }

        query += ' ORDER BY c.created_at DESC';

        const [cases] = await pool.execute(query, params);
        return cases;
    },

    /**
     * Get cases for patient
     * @param {number} patientId - Patient ID
     * @returns {Promise<Array>} List of cases
     */
    async findByPatientId(patientId) {
        const [cases] = await pool.execute(
            'SELECT * FROM cases WHERE patient_id = ? ORDER BY created_at DESC',
            [patientId]
        );

        return cases;
    },

    /**
     * Update case status
     * @param {number} id - Case ID
     * @param {string} status - New status
     * @returns {Promise<boolean>} Success status
     */
    async updateStatus(id, status) {
        let timestampField = '';
        if (status === 'submitted') {
            timestampField = ', submitted_at = NOW()';
        } else if (status === 'reviewed' || status === 'closed') {
            timestampField = ', reviewed_at = NOW()';
        }

        const [result] = await pool.execute(
            `UPDATE cases SET status = ?${timestampField} WHERE id = ?`,
            [status, id]
        );

        return result.affectedRows > 0;
    },

    async submit(id) {
        return this.updateStatus(id, 'submitted');
    },

    async saveAiAnalysis(id, analysis) {
        const [result] = await pool.execute(
            'UPDATE cases SET ai_analysis = ? WHERE id = ?',
            [JSON.stringify(analysis), id]
        );

        return result.affectedRows > 0;
    },

    async saveDoctorReview(id, doctorData) {
        const { diagnosis, prescription } = doctorData;

        const [result] = await pool.execute(
            `UPDATE cases SET
                 doctor_diagnosis = ?,
                 doctor_prescription = ?,
                 status = 'reviewed',
                 reviewed_at = NOW()
             WHERE id = ?`,
            [diagnosis, prescription, id]
        );

        return result.affectedRows > 0;
    },

    async close(id) {
        return this.updateStatus(id, 'closed');
    },

    /**
     * Get full case details
     * @param {number} id - Case ID
     * @returns {Promise<Object|null>} Case with all details
     */
    async getFullDetails(id) {
        try {
            console.log('getFullDetails called for case:', id);
            const caseData = await this.findById(id);
            if (!caseData) {
                console.log('Case not found in database');
                return null;
            }

            let patient = null;
            try {
                const [patients] = await pool.execute(
                    'SELECT * FROM patients WHERE id = ?',
                    [caseData.patient_id]
                );
                patient = patients[0] || null;
            } catch (err) {
                console.error('Error fetching patient:', err.message);
            }

            let answers = [];
            try {
                const [answerRows] = await pool.execute(
                    `SELECT ca.*,
                            COALESCE(ca.question_text_snapshot, q.question_text) AS question_text,
                            COALESCE(ca.answer_type_snapshot, q.answer_type) AS answer_type,
                            COALESCE(ca.order_index_snapshot, q.order_index, ca.id) AS display_order,
                            q.clinical_measure
                     FROM case_answers ca
                     LEFT JOIN questions q ON ca.question_id = q.id
                     WHERE ca.case_id = ?
                     ORDER BY display_order, ca.id`,
                    [id]
                );
                answers = answerRows || [];
            } catch (err) {
                console.error('Error fetching answers:', err.message);
            }

            let documents = [];
            try {
                const [docRows] = await pool.execute(
                    'SELECT * FROM documents WHERE case_id = ?',
                    [id]
                );
                documents = docRows || [];
            } catch (err) {
                console.error('Error fetching documents:', err.message);
            }

            let catalogue = null;
            try {
                const [catalogues] = await pool.execute(
                    'SELECT id, name FROM catalogues WHERE id = ?',
                    [caseData.catalogue_version_id]
                );
                catalogue = catalogues[0] || null;
            } catch (err) {
                console.error('Error fetching catalogue:', err.message);
            }

            let aiAnalysis = null;
            if (caseData.ai_analysis) {
                try {
                    if (typeof caseData.ai_analysis === 'object') {
                        aiAnalysis = caseData.ai_analysis;
                    } else if (typeof caseData.ai_analysis === 'string') {
                        aiAnalysis = JSON.parse(caseData.ai_analysis);
                    }
                } catch (parseErr) {
                    console.error('Error parsing ai_analysis:', parseErr.message);
                    aiAnalysis = null;
                }
            }

            return {
                ...caseData,
                aiAnalysis,
                patient,
                answers,
                documents,
                catalogue
            };
        } catch (error) {
            console.error('getFullDetails error:', error);
            throw error;
        }
    },

    // ======================
    // CASE ANSWERS
    // ======================

    /**
     * Add answer to case
     * @param {Object} answerData - Answer data
     * @returns {Promise<Object>} Created answer
     */
    async addAnswer(answerData) {
        const {
            caseId,
            questionId,
            audioPath,
            questionTextSnapshot,
            answerTypeSnapshot,
            orderIndexSnapshot
        } = answerData;
        const textAnswer = answerData.textAnswer ?? answerData.transcribedText;

        const [result] = await pool.execute(
            `INSERT INTO case_answers (
                case_id,
                question_id,
                audio_path,
                text_answer,
                question_text_snapshot,
                answer_type_snapshot,
                order_index_snapshot
            )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                caseId,
                questionId,
                audioPath,
                textAnswer || null,
                questionTextSnapshot || null,
                answerTypeSnapshot || null,
                orderIndexSnapshot ?? null
            ]
        );

        return {
            id: result.insertId,
            ...answerData
        };
    },

    /**
     * Update answer
     * @param {number} id - Answer ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async updateAnswer(id, updateData) {
        const {
            audioPath,
            questionTextSnapshot,
            answerTypeSnapshot,
            orderIndexSnapshot
        } = updateData;
        const textAnswer = updateData.textAnswer ?? updateData.transcribedText;

        const updates = [];
        const params = [];

        if (audioPath !== undefined) {
            updates.push('audio_path = ?');
            params.push(audioPath);
        }

        if (textAnswer !== undefined) {
            updates.push('text_answer = ?');
            params.push(textAnswer);
        }

        if (questionTextSnapshot !== undefined) {
            updates.push('question_text_snapshot = ?');
            params.push(questionTextSnapshot);
        }

        if (answerTypeSnapshot !== undefined) {
            updates.push('answer_type_snapshot = ?');
            params.push(answerTypeSnapshot);
        }

        if (orderIndexSnapshot !== undefined) {
            updates.push('order_index_snapshot = ?');
            params.push(orderIndexSnapshot);
        }

        if (updates.length === 0) {
            return false;
        }

        const query = `UPDATE case_answers SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        const [result] = await pool.execute(query, params);
        return result.affectedRows > 0;
    },

    /**
     * Get answers for case
     * @param {number} caseId - Case ID
     * @returns {Promise<Array>} List of answers
     */
    async getAnswers(caseId) {
        const [answers] = await pool.execute(
            `SELECT ca.*,
                    COALESCE(ca.question_text_snapshot, q.question_text) AS question_text,
                    COALESCE(ca.answer_type_snapshot, q.answer_type) AS answer_type,
                    COALESCE(ca.order_index_snapshot, q.order_index, ca.id) AS display_order,
                    q.clinical_measure
             FROM case_answers ca
             LEFT JOIN questions q ON ca.question_id = q.id
             WHERE ca.case_id = ?
             ORDER BY display_order, ca.id`,
            [caseId]
        );

        return answers;
    },

    async updateReview(id, reviewData) {
        const { doctorDiagnosis, doctorPrescription, status, reviewedAt } = reviewData;

        const [result] = await pool.execute(
            `UPDATE cases SET
                 doctor_diagnosis = ?,
                 doctor_prescription = ?,
                 status = ?,
                 reviewed_at = ?
             WHERE id = ?`,
            [doctorDiagnosis, doctorPrescription, status, reviewedAt, id]
        );

        return result.affectedRows > 0;
    },

    async delete(id) {
        await pool.execute('DELETE FROM case_answers WHERE case_id = ?', [id]);
        await pool.execute('DELETE FROM documents WHERE case_id = ?', [id]);

        const [result] = await pool.execute('DELETE FROM cases WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
};

module.exports = Case;
