/**
 * Doctor Service
 * Handles doctor-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const doctorService = {
    /**
     * Get dashboard data
     * @returns {Promise<Object>} API response
     */
    async getDashboard() {
        return api.get(ENDPOINTS.DOCTOR_DASHBOARD);
    },

    /**
     * Get doctor profile
     * @returns {Promise<Object>} API response
     */
    async getProfile() {
        return api.get(ENDPOINTS.DOCTOR_PROFILE);
    },

    /**
     * Update doctor profile
     * @param {Object} data - Profile data
     * @returns {Promise<Object>} API response
     */
    async updateProfile(data) {
        return api.put(ENDPOINTS.DOCTOR_PROFILE, data);
    },

    // ======================
    // AI CONFIGURATION
    // ======================

    async getAiConfig() {
        return api.get(ENDPOINTS.DOCTOR_AI_CONFIG);
    },

    async updateAiConfig(data) {
        return api.put(ENDPOINTS.DOCTOR_AI_CONFIG, data);
    },

    async activateAiConfig(provider) {
        return api.put(`${ENDPOINTS.DOCTOR_AI_CONFIG}/activate`, { provider });
    },

    async getAiStatus() {
        return api.get(`${ENDPOINTS.DOCTOR_AI_CONFIG}/status`);
    },

    // ======================
    // ASSISTANT MANAGEMENT
    // ======================

    /**
     * Get all assistants
     * @returns {Promise<Object>} API response
     */
    async getAssistants() {
        return api.get(ENDPOINTS.ASSISTANTS);
    },

    /**
     * Create assistant
     * @param {Object} data - Assistant data
     * @returns {Promise<Object>} API response
     */
    async createAssistant(data) {
        return api.post(ENDPOINTS.ASSISTANTS, data);
    },

    /**
     * Update assistant
     * @param {number} id - Assistant ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} API response
     */
    async updateAssistant(id, data) {
        return api.put(`${ENDPOINTS.ASSISTANTS}/${id}`, data);
    },

    /**
     * Toggle assistant status
     * @param {number} id - Assistant ID
     * @returns {Promise<Object>} API response
     */
    async toggleAssistant(id) {
        return api.patch(`${ENDPOINTS.ASSISTANTS}/${id}/toggle`);
    },

    /**
     * Delete assistant
     * @param {number} id - Assistant ID
     * @returns {Promise<Object>} API response
     */
    async deleteAssistant(id) {
        return api.delete(`${ENDPOINTS.ASSISTANTS}/${id}`);
    }
};

export default doctorService;
