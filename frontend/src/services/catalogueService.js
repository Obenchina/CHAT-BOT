/**
 * Catalogue Service
 * Handles catalogue and question-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const catalogueService = {
    /**
     * Get catalogue
     * @returns {Promise<Object>} API response
     */
    async getCatalogue() {
        return api.get(ENDPOINTS.CATALOGUE);
    },

    /**
     * Create new catalogue version
     * @returns {Promise<Object>} API response
     */
    async createCatalogue() {
        return api.post(ENDPOINTS.CATALOGUE);
    },

    /**
     * Publish catalogue
     * @param {number} id - Catalogue ID
     * @returns {Promise<Object>} API response
     */
    async publish(id) {
        return api.post(`${ENDPOINTS.CATALOGUE}/${id}/publish`);
    },

    /**
     * Add question
     * @param {number|null} catalogueId - Catalogue ID (will create new if null)
     * @param {Object} data - Question data
     * @returns {Promise<Object>} API response
     */
    async addQuestion(catalogueId, data) {
        // If no catalogue exists, create one first
        if (!catalogueId) {
            const createResponse = await api.post(ENDPOINTS.CATALOGUE);
            if (createResponse.success) {
                catalogueId = createResponse.data.id;
                const addResponse = await api.post(`${ENDPOINTS.CATALOGUE}/${catalogueId}/questions`, data);
                return {
                    success: addResponse.success,
                    data: {
                        catalogue: createResponse.data,
                        question: addResponse.data
                    }
                };
            }
            return createResponse;
        }
        return api.post(`${ENDPOINTS.CATALOGUE}/${catalogueId}/questions`, data);
    },

    /**
     * Update question
     * @param {number} questionId - Question ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} API response
     */
    async updateQuestion(questionId, data) {
        return api.put(`${ENDPOINTS.CATALOGUE}/questions/${questionId}`, data);
    },

    /**
     * Delete question
     * @param {number} questionId - Question ID
     * @returns {Promise<Object>} API response
     */
    async deleteQuestion(questionId) {
        return api.delete(`${ENDPOINTS.CATALOGUE}/questions/${questionId}`);
    },

    /**
     * Reorder questions
     * @param {number} catalogueId - Catalogue ID
     * @param {Array} order - Array of {id, orderIndex}
     * @returns {Promise<Object>} API response
     */
    async reorderQuestions(catalogueId, order) {
        return api.put(`${ENDPOINTS.CATALOGUE}/${catalogueId}/reorder`, { order });
    }
};

export default catalogueService;
