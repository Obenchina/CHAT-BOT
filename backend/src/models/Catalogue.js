/**
 * Catalogue Model
 * Database operations for catalogues and questions tables
 */

const { pool } = require('../config/database');

const Catalogue = {
    /**
     * Create new catalogue version
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Object>} Created catalogue
     */
    async create(doctorId) {
        // Get current max version for this doctor
        const [versions] = await pool.execute(
            'SELECT MAX(version) as maxVersion FROM catalogues WHERE doctor_id = ?',
            [doctorId]
        );

        const newVersion = (versions[0].maxVersion || 0) + 1;

        const [result] = await pool.execute(
            `INSERT INTO catalogues (doctor_id, version, is_published, created_at)
       VALUES (?, ?, false, NOW())`,
            [doctorId, newVersion]
        );

        return {
            id: result.insertId,
            doctorId,
            version: newVersion,
            isPublished: false
        };
    },

    /**
     * Get active catalogue for doctor
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Object|null>} Active catalogue or null
     */
    async getActive(doctorId) {
        const [catalogues] = await pool.execute(
            `SELECT * FROM catalogues 
       WHERE doctor_id = ? AND is_published = true
       ORDER BY version DESC LIMIT 1`,
            [doctorId]
        );

        return catalogues.length > 0 ? catalogues[0] : null;
    },

    /**
     * Get all catalogues for doctor
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of catalogues
     */
    async findByDoctorId(doctorId) {
        const [catalogues] = await pool.execute(
            'SELECT * FROM catalogues WHERE doctor_id = ? ORDER BY version DESC',
            [doctorId]
        );

        return catalogues;
    },

    /**
     * Get catalogue by ID
     * @param {number} id - Catalogue ID
     * @returns {Promise<Object|null>} Catalogue or null
     */
    async findById(id) {
        const [catalogues] = await pool.execute(
            'SELECT * FROM catalogues WHERE id = ?',
            [id]
        );

        return catalogues.length > 0 ? catalogues[0] : null;
    },

    /**
     * Publish catalogue
     * @param {number} id - Catalogue ID
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<boolean>} Success status
     */
    async publish(id, doctorId) {
        // Unpublish all other catalogues for this doctor
        await pool.execute(
            'UPDATE catalogues SET is_published = false WHERE doctor_id = ?',
            [doctorId]
        );

        // Publish this catalogue
        const [result] = await pool.execute(
            'UPDATE catalogues SET is_published = true WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Get catalogue with questions
     * @param {number} id - Catalogue ID
     * @returns {Promise<Object|null>} Catalogue with questions
     */
    async getWithQuestions(id) {
        const catalogue = await this.findById(id);
        if (!catalogue) return null;

        const [questions] = await pool.execute(
            `SELECT * FROM questions 
       WHERE catalogue_id = ?
       ORDER BY order_index`,
            [id]
        );

        // Parse JSON choices for each question safely
        // Parse JSON choices for each question safely
        const parsedQuestions = questions.map(q => {
            let parsedChoices = [];
            if (q.choices) {
                if (typeof q.choices === 'string') {
                    try {
                        parsedChoices = JSON.parse(q.choices);
                    } catch (e) {
                        parsedChoices = [];
                    }
                } else if (Array.isArray(q.choices)) {
                    parsedChoices = q.choices;
                }
            }
            return {
                ...q,
                choices: parsedChoices
            };
        });

        return {
            ...catalogue,
            questions: parsedQuestions
        };
    },

    // ======================
    // QUESTION OPERATIONS
    // ======================

    /**
     * Add question to catalogue
     * @param {Object} questionData - Question data
     * @returns {Promise<Object>} Created question
     */
    async addQuestion(questionData) {
        const { catalogueId, questionText, answerType, choices, isRequired, orderIndex } = questionData;

        const [result] = await pool.execute(
            `INSERT INTO questions (catalogue_id, question_text, answer_type, choices, is_required, is_active, order_index)
       VALUES (?, ?, ?, ?, ?, true, ?)`,
            [catalogueId, questionText, answerType, JSON.stringify(choices || []), isRequired, orderIndex]
        );

        return {
            id: result.insertId,
            ...questionData,
            isActive: true
        };
    },

    /**
     * Update question
     * @param {number} id - Question ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async updateQuestion(id, updateData) {
        const { questionText, answerType, choices, isRequired, isActive, orderIndex } = updateData;

        const [result] = await pool.execute(
            `UPDATE questions SET 
        question_text = COALESCE(?, question_text),
        answer_type = COALESCE(?, answer_type),
        choices = COALESCE(?, choices),
        is_required = COALESCE(?, is_required),
        is_active = COALESCE(?, is_active),
        order_index = COALESCE(?, order_index)
       WHERE id = ?`,
            [
                questionText !== undefined ? questionText : null,
                answerType !== undefined ? answerType : null,
                choices !== undefined ? JSON.stringify(choices) : null,
                isRequired !== undefined ? isRequired : null,
                isActive !== undefined ? isActive : null,
                orderIndex !== undefined ? orderIndex : null,
                id
            ]
        );

        return result.affectedRows > 0;
    },

    /**
     * Delete question
     * @param {number} id - Question ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteQuestion(id) {
        const [result] = await pool.execute(
            'DELETE FROM questions WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Get questions for catalogue
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<Array>} List of questions
     */
    async getQuestions(catalogueId) {
        const [questions] = await pool.execute(
            'SELECT * FROM questions WHERE catalogue_id = ? ORDER BY order_index',
            [catalogueId]
        );

        // Parse JSON choices safely
        return questions.map(q => {
            let parsedChoices = [];
            if (q.choices) {
                if (typeof q.choices === 'string') {
                    try {
                        parsedChoices = JSON.parse(q.choices);
                    } catch (e) {
                        parsedChoices = [];
                    }
                } else if (Array.isArray(q.choices)) {
                    parsedChoices = q.choices;
                }
            }
            return {
                ...q,
                choices: parsedChoices
            };
        });
    },

    /**
     * Reorder questions
     * @param {number} catalogueId - Catalogue ID
     * @param {Array} orderData - Array of {id, orderIndex}
     * @returns {Promise<boolean>} Success status
     */
    async reorderQuestions(catalogueId, orderData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const item of orderData) {
                await connection.execute(
                    'UPDATE questions SET order_index = ? WHERE id = ? AND catalogue_id = ?',
                    [item.orderIndex, item.id, catalogueId]
                );
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
};

module.exports = Catalogue;
