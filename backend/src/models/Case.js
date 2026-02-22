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
             a.first_name as assistant_first_name, a.last_name as assistant_last_name
      FROM cases c
      JOIN patients p ON c.patient_id = p.id
      JOIN assistants a ON c.assistant_id = a.id
      WHERE p.doctor_id = ?
    `;

        const params = [doctorId];

        if (status) {
            query += ' AND c.status = ?';
            params.push(status);
        } else {
            // For general list (All), exclude in_progress (drafts)
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
            `SELECT * FROM cases WHERE patient_id = ? ORDER BY created_at DESC`,
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

    /**
     * Submit case for review
     * @param {number} id - Case ID
     * @returns {Promise<boolean>} Success status
     */
    async submit(id) {
        return this.updateStatus(id, 'submitted');
    },

    /**
     * Save AI analysis
     * @param {number} id - Case ID
     * @param {Object} analysis - AI analysis data
     * @returns {Promise<boolean>} Success status
     */
    async saveAiAnalysis(id, analysis) {
        const [result] = await pool.execute(
            'UPDATE cases SET ai_analysis = ? WHERE id = ?',
            [JSON.stringify(analysis), id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Save doctor's diagnosis and prescription
     * @param {number} id - Case ID
     * @param {Object} doctorData - Diagnosis and prescription
     * @returns {Promise<boolean>} Success status
     */
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

    /**
     * Close case
     * @param {number} id - Case ID
     * @returns {Promise<boolean>} Success status
     */
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
            console.log('Case found, patient_id:', caseData.patient_id);

            // Get patient info
            let patient = null;
            try {
                const [patients] = await pool.execute(
                    'SELECT * FROM patients WHERE id = ?',
                    [caseData.patient_id]
                );
                patient = patients[0] || null;
                console.log('Patient found:', patient ? 'yes' : 'no');
            } catch (err) {
                console.error('Error fetching patient:', err.message);
            }

            // Get answers (use LEFT JOIN to avoid failures)
            let answers = [];
            try {
                const [answerRows] = await pool.execute(
                    `SELECT ca.*, q.question_text, q.answer_type
                     FROM case_answers ca
                     LEFT JOIN questions q ON ca.question_id = q.id
                     WHERE ca.case_id = ?
                     ORDER BY q.order_index`,
                    [id]
                );
                answers = answerRows || [];
                console.log('Answers found:', answers.length);
            } catch (err) {
                console.error('Error fetching answers:', err.message);
            }

            // Get documents
            let documents = [];
            try {
                const [docRows] = await pool.execute(
                    'SELECT * FROM documents WHERE case_id = ?',
                    [id]
                );
                documents = docRows || [];
                console.log('Documents found:', documents.length);
            } catch (err) {
                console.error('Error fetching documents:', err.message);
            }

            // Safely parse ai_analysis
            let aiAnalysis = null;
            if (caseData.ai_analysis) {
                try {
                    // Check if it's already an object
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
                documents
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
        const { caseId, questionId, audioPath, transcribedText } = answerData;

        const [result] = await pool.execute(
            `INSERT INTO case_answers (case_id, question_id, audio_path, transcribed_text)
       VALUES (?, ?, ?, ?)`,
            [caseId, questionId, audioPath, transcribedText]
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
        const { audioPath, transcribedText } = updateData;

        const updates = [];
        const params = [];

        if (audioPath !== undefined) {
            updates.push('audio_path = ?');
            params.push(audioPath);
        }

        if (transcribedText !== undefined) {
            updates.push('transcribed_text = ?');
            params.push(transcribedText);
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
            `SELECT ca.*, q.question_text, q.answer_type
       FROM case_answers ca
       JOIN questions q ON ca.question_id = q.id
       WHERE ca.case_id = ?
       ORDER BY q.order_index`,
            [caseId]
        );

        return answers;
    },

    /**
     * Update case with doctor review
     * @param {number} id - Case ID
     * @param {Object} reviewData - Review data
     * @returns {Promise<boolean>} Success status
     */
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

    /**
     * Delete a case and its related data
     * @param {number} id - Case ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        // Delete answers first
        await pool.execute('DELETE FROM case_answers WHERE case_id = ?', [id]);

        // Delete documents
        await pool.execute('DELETE FROM documents WHERE case_id = ?', [id]);

        // Delete case
        const [result] = await pool.execute('DELETE FROM cases WHERE id = ?', [id]);

        return result.affectedRows > 0;
    }
};

module.exports = Case;

