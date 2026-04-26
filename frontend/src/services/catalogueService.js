/**
 * Catalogue Service
 * Handles catalogue and question-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const catalogueService = {
    /**
     * Get all catalogues for the current doctor
     * @returns {Promise<Object>} API response
     */
    async getCatalogues() {
        return api.get(ENDPOINTS.CATALOGUE);
    },

    /**
     * Get a catalogue with its questions
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<Object>} API response
     */
    async getCatalogue(catalogueId) {
        return api.get(`${ENDPOINTS.CATALOGUE}/${catalogueId}`);
    },

    /**
     * Get active catalogues visible to assistants
     * @returns {Promise<Object>} API response
     */
    async getActiveCatalogues() {
        return api.get(`${ENDPOINTS.CATALOGUE}/active/list`);
    },

    /**
     * Create new catalogue
     * @param {Object} data - Catalogue data
     * @returns {Promise<Object>} API response
     */
    async createCatalogue(data) {
        return api.post(ENDPOINTS.CATALOGUE, data);
    },

    /**
     * Update catalogue metadata
     * @param {number} catalogueId - Catalogue ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} API response
     */
    async updateCatalogue(catalogueId, data) {
        return api.put(`${ENDPOINTS.CATALOGUE}/${catalogueId}`, data);
    },

    /**
     * Delete catalogue
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<Object>} API response
     */
    async deleteCatalogue(catalogueId) {
        return api.delete(`${ENDPOINTS.CATALOGUE}/${catalogueId}`);
    },

    /**
     * Backward-compatible activate action
     * @param {number} catalogueId - Catalogue ID
     * @returns {Promise<Object>} API response
     */
    async publish(catalogueId) {
        return api.post(`${ENDPOINTS.CATALOGUE}/${catalogueId}/publish`);
    },

    /**
     * Add question to catalogue
     * @param {number} catalogueId - Catalogue ID
     * @param {Object} data - Question data
     * @returns {Promise<Object>} API response
     */
    async addQuestion(catalogueId, data) {
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
    ,

    // ======================
    // SECTIONS
    // ======================

    async getSections(catalogueId) {
        return api.get(`${ENDPOINTS.CATALOGUE}/${catalogueId}/sections`);
    },

    async createSection(catalogueId, name) {
        return api.post(`${ENDPOINTS.CATALOGUE}/${catalogueId}/sections`, { name });
    },

    async renameSection(catalogueId, sectionId, name) {
        return api.patch(`${ENDPOINTS.CATALOGUE}/${catalogueId}/sections/${sectionId}`, { name });
    },

    async reorderSections(catalogueId, order) {
        return api.put(`${ENDPOINTS.CATALOGUE}/${catalogueId}/sections/reorder`, { order });
    },

    async deleteSection(catalogueId, sectionId) {
        return api.delete(`${ENDPOINTS.CATALOGUE}/${catalogueId}/sections/${sectionId}`);
    }
};

export default catalogueService;
