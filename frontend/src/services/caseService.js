/**
 * Case Service
 * Handles medical case-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const caseService = {
    /**
     * Get all cases (doctor inbox)
     * @param {string} status - Filter by status (optional)
     * @returns {Promise<Object>} API response
     */
    async getAll(status = null) {
        const url = status ? `${ENDPOINTS.CASES}?status=${status}` : ENDPOINTS.CASES;
        return api.get(url);
    },

    /**
     * Get case by ID
     * @param {number} id - Case ID
     * @returns {Promise<Object>} API response
     */
    async getById(id) {
        return api.get(`${ENDPOINTS.CASES}/${id}`);
    },

    /**
     * Create new case
     * @param {number} patientId - Patient ID
     * @returns {Promise<Object>} API response
     */
    async create(patientId) {
        return api.post(ENDPOINTS.CASES, { patientId });
    },

    /**
     * Add answer to case
     * @param {number} caseId - Case ID
     * @param {FormData} formData - Form data with audio and question info
     * @returns {Promise<Object>} API response
     */
    async addAnswer(caseId, formData) {
        return api.post(`${ENDPOINTS.CASES}/${caseId}/answers`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    /**
     * Add text answer to case (for yes/no and choices)
     * @param {number} caseId - Case ID
     * @param {Object} data - Question ID and answer value
     * @returns {Promise<Object>} API response
     */
    async addTextAnswer(caseId, data) {
        return api.post(`${ENDPOINTS.CASES}/${caseId}/answers/text`, data);
    },

    /**
     * Upload document to case
     * @param {number} caseId - Case ID
     * @param {FormData} formData - Form data with document
     * @returns {Promise<Object>} API response
     */
    async uploadDocument(caseId, formData) {
        return api.post(`${ENDPOINTS.CASES}/${caseId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    /**
     * Delete document from case
     * @param {number} caseId - Case ID
     * @param {number} docId - Document ID
     * @returns {Promise<Object>} API response
     */
    async deleteDocument(caseId, docId) {
        return api.delete(`${ENDPOINTS.CASES}/${caseId}/documents/${docId}`);
    },

    /**
     * Submit case for review
     * @param {number} caseId - Case ID
     * @returns {Promise<Object>} API response
     */
    async submit(caseId) {
        return api.post(`${ENDPOINTS.CASES}/${caseId}/submit`);
    },

    /**
     * Save doctor review
     * @param {number} caseId - Case ID
     * @param {Object} data - Diagnosis and prescription
     * @returns {Promise<Object>} API response
     */
    async saveReview(caseId, data) {
        return api.put(`${ENDPOINTS.CASES}/${caseId}/review`, data);
    },

    /**
     * Close case
     * @param {number} caseId - Case ID
     * @returns {Promise<Object>} API response
     */
    async closeCase(caseId) {
        return api.post(`${ENDPOINTS.CASES}/${caseId}/close`);
    },

    /**
     * Delete case
     * @param {number} caseId - Case ID
     * @returns {Promise<Object>} API response
     */
    async deleteCase(caseId) {
        return api.delete(`${ENDPOINTS.CASES}/${caseId}`);
    }
};

export default caseService;
