/**
 * Catalogue Model
 * Database operations for catalogues and questions tables
 */

const { pool } = require('../config/database');

function parseChoices(rawChoices) {
    if (!rawChoices) {
        return [];
    }

    if (Array.isArray(rawChoices)) {
        return rawChoices;
    }

    if (typeof rawChoices === 'string') {
        try {
            return JSON.parse(rawChoices);
        } catch (error) {
            return [];
        }
    }

    return [];
}

function normalizeQuestion(question) {
    if (!question) {
        return null;
    }

    return {
        ...question,
        choices: parseChoices(question.choices),
        clinical_measure: question.clinical_measure || 'none'
    };
}

const Catalogue = {
    /**
     * Create a new catalogue for a doctor
     * @param {Object} catalogueData - Catalogue data
     * @returns {Promise<Object>} Created catalogue
     */
    async create(catalogueData) {
        const { doctorId, name, isActive = true } = catalogueData;

        const trimmedName = String(name || '').trim() || 'Nouveau Catalogue';
        const activeValue = Boolean(isActive);

        const [result] = await pool.execute(
            `INSERT INTO catalogues (doctor_id, name, is_active, is_published, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [doctorId, trimmedName, activeValue, activeValue]
        );

        return {
            id: result.insertId,
            doctor_id: doctorId,
            name: trimmedName,
            is_active: activeValue,
            is_published: activeValue
        };
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
     * Get all catalogues for a doctor with question counts
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} List of catalogues
     */
    async findByDoctorId(doctorId) {
        const [catalogues] = await pool.execute(
            `SELECT c.*,
                    COUNT(q.id) AS question_count,
                    SUM(CASE WHEN q.is_active = true THEN 1 ELSE 0 END) AS active_question_count,
                    (
                        SELECT COUNT(*)
                        FROM cases cs
                        WHERE cs.catalogue_version_id = c.id
                    ) AS case_count
             FROM catalogues c
             LEFT JOIN questions q ON q.catalogue_id = c.id
             WHERE c.doctor_id = ?
             GROUP BY c.id
             ORDER BY c.is_active DESC, c.created_at DESC, c.id DESC`,
            [doctorId]
        );

        return catalogues;
    },

    /**
     * Count cases using a catalogue
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<number>} Number of linked cases
     */
    async countCasesUsing(catalogueId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) AS case_count FROM cases WHERE catalogue_version_id = ?',
            [catalogueId]
        );

        return Number(rows[0]?.case_count || 0);
    },

    /**
     * Get active catalogues for a doctor that assistants can use
     * @param {number} doctorId - Doctor ID
     * @returns {Promise<Array>} Active catalogues with at least one active question
     */
    async findActiveByDoctorId(doctorId) {
        const [catalogues] = await pool.execute(
            `SELECT c.*,
                    COUNT(q.id) AS active_question_count
             FROM catalogues c
             LEFT JOIN questions q ON q.catalogue_id = c.id AND q.is_active = true
             WHERE c.doctor_id = ? AND c.is_active = true
             GROUP BY c.id
             HAVING COUNT(q.id) > 0
             ORDER BY c.created_at DESC, c.id DESC`,
            [doctorId]
        );

        return catalogues;
    },

    /**
     * Update catalogue metadata
     * @param {number} id - Catalogue ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async update(id, updateData) {
        const updates = [];
        const params = [];

        if (updateData.name !== undefined) {
            updates.push('name = ?');
            params.push(String(updateData.name).trim());
        }

        if (updateData.isActive !== undefined) {
            const activeValue = Boolean(updateData.isActive);
            updates.push('is_active = ?');
            updates.push('is_published = ?');
            params.push(activeValue, activeValue);
        }

        if (updates.length === 0) {
            return false;
        }

        const [result] = await pool.execute(
            `UPDATE catalogues SET ${updates.join(', ')} WHERE id = ?`,
            [...params, id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Delete catalogue
     * @param {number} id - Catalogue ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        const [result] = await pool.execute(
            'DELETE FROM catalogues WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Get catalogue with all questions
     * @param {number} id - Catalogue ID
     * @returns {Promise<Object|null>} Catalogue with questions
     */
    async getWithQuestions(id) {
        const catalogue = await this.findById(id);
        if (!catalogue) {
            return null;
        }

        const questions = await this.getQuestions(id);

        return {
            ...catalogue,
            questions
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
        const { catalogueId, questionText, answerType, choices, isRequired, orderIndex, clinicalMeasure } = questionData;

        const [result] = await pool.execute(
            `INSERT INTO questions (catalogue_id, question_text, answer_type, clinical_measure, choices, is_required, is_active, order_index)
             VALUES (?, ?, ?, ?, ?, ?, true, ?)`,
            [
                catalogueId,
                questionText,
                answerType,
                clinicalMeasure || 'none',
                JSON.stringify(choices || []),
                isRequired,
                orderIndex
            ]
        );

        return {
            id: result.insertId,
            catalogue_id: catalogueId,
            question_text: questionText,
            answer_type: answerType,
            clinical_measure: clinicalMeasure || 'none',
            choices: choices || [],
            is_required: isRequired,
            is_active: true,
            order_index: orderIndex
        };
    },

    /**
     * Update question
     * @param {number} id - Question ID
     * @param {Object} updateData - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    async updateQuestion(id, updateData) {
        const { questionText, answerType, choices, isRequired, isActive, orderIndex, clinicalMeasure } = updateData;

        const [result] = await pool.execute(
            `UPDATE questions SET
                 question_text = COALESCE(?, question_text),
                 answer_type = COALESCE(?, answer_type),
                 clinical_measure = COALESCE(?, clinical_measure),
                 choices = COALESCE(?, choices),
                 is_required = COALESCE(?, is_required),
                 is_active = COALESCE(?, is_active),
                 order_index = COALESCE(?, order_index)
             WHERE id = ?`,
            [
                questionText !== undefined ? questionText : null,
                answerType !== undefined ? answerType : null,
                clinicalMeasure !== undefined ? clinicalMeasure : null,
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
     * Get a question by ID
     * @param {number} questionId - Question ID
     * @returns {Promise<Object|null>} Question or null
     */
    async getQuestionById(questionId) {
        const [questions] = await pool.execute(
            'SELECT * FROM questions WHERE id = ? LIMIT 1',
            [questionId]
        );

        return questions.length > 0 ? normalizeQuestion(questions[0]) : null;
    },

    /**
     * Get question with catalogue ownership details
     * @param {number} questionId - Question ID
     * @returns {Promise<Object|null>} Question with doctor ownership
     */
    async getQuestionWithCatalogue(questionId) {
        const [questions] = await pool.execute(
            `SELECT q.*, c.doctor_id
             FROM questions q
             JOIN catalogues c ON c.id = q.catalogue_id
             WHERE q.id = ?
             LIMIT 1`,
            [questionId]
        );

        return questions.length > 0 ? normalizeQuestion(questions[0]) : null;
    },

    /**
     * Get questions for catalogue
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<Array>} List of questions
     */
    async getQuestions(catalogueId) {
        const [questions] = await pool.execute(
            'SELECT * FROM questions WHERE catalogue_id = ? ORDER BY order_index, id',
            [catalogueId]
        );

        return questions.map(normalizeQuestion);
    },

    // ======================
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
    },

    async getSections() {
        return [];
    },

    async getSectionById() {
        return null;
    },

    async ensureSectionByName(catalogueId, name, sectionOrder = 0) {
        return {
            id: null,
            catalogue_id: catalogueId,
            name: String(name || '').trim(),
            section_order: Number(sectionOrder || 0)
        };
    },

    async createSection(catalogueId, name) {
        return this.ensureSectionByName(catalogueId, name, 0);
    },

    async renameSection() {
        return false;
    },

    async reorderSections() {
        return true;
    },

    async deleteSection() {
        return true;
    }
};

module.exports = Catalogue;
