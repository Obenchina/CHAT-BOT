/**
 * Document Model
 * Database operations for medical documents
 */

const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

const Document = {
    /**
     * Create document record
     * @param {Object} documentData - Document data
     * @returns {Promise<Object>} Created document
     */
    async create(documentData) {
        const { caseId, documentType, filePath, fileName } = documentData;

        const [result] = await pool.execute(
            `INSERT INTO documents (case_id, document_type, file_path, file_name, uploaded_at)
       VALUES (?, ?, ?, ?, NOW())`,
            [caseId, documentType, filePath, fileName]
        );

        return {
            id: result.insertId,
            ...documentData
        };
    },

    /**
     * Find document by ID
     * @param {number} id - Document ID
     * @returns {Promise<Object|null>} Document or null
     */
    async findById(id) {
        const [documents] = await pool.execute(
            'SELECT * FROM documents WHERE id = ?',
            [id]
        );

        return documents.length > 0 ? documents[0] : null;
    },

    /**
     * Get all documents for a case
     * @param {number} caseId - Case ID
     * @returns {Promise<Array>} List of documents
     */
    async findByCaseId(caseId) {
        const [documents] = await pool.execute(
            'SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at',
            [caseId]
        );

        return documents;
    },

    /**
     * Get documents by type for a case
     * @param {number} caseId - Case ID
     * @param {string} documentType - Document type
     * @returns {Promise<Array>} List of documents
     */
    async findByType(caseId, documentType) {
        const [documents] = await pool.execute(
            'SELECT * FROM documents WHERE case_id = ? AND document_type = ?',
            [caseId, documentType]
        );

        return documents;
    },

    /**
     * Delete document
     * @param {number} id - Document ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        // Get document to delete file
        const document = await this.findById(id);
        if (!document) return false;

        // Delete file from disk
        try {
            const fullPath = path.join(__dirname, '../../uploads', document.file_path);
            await fs.unlink(fullPath);
        } catch (error) {
            console.error('Error deleting file:', error.message);
        }

        // Delete database record
        const [result] = await pool.execute(
            'DELETE FROM documents WHERE id = ?',
            [id]
        );

        return result.affectedRows > 0;
    },

    /**
     * Delete all documents for a case
     * @param {number} caseId - Case ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteByCaseId(caseId) {
        // Get all documents for case
        const documents = await this.findByCaseId(caseId);

        // Delete files from disk
        for (const doc of documents) {
            try {
                const fullPath = path.join(__dirname, '../../uploads', doc.file_path);
                await fs.unlink(fullPath);
            } catch (error) {
                console.error('Error deleting file:', error.message);
            }
        }

        // Delete database records
        const [result] = await pool.execute(
            'DELETE FROM documents WHERE case_id = ?',
            [caseId]
        );

        return result.affectedRows > 0;
    }
};

module.exports = Document;
