/**
 * Patient Service
 * Handles patient-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const patientService = {
    /**
     * Get all patients
     * @returns {Promise<Object>} API response
     */
    async getAll() {
        return api.get(ENDPOINTS.PATIENTS);
    },

    /**
     * Search patients
     * @param {string} query - Search query
     * @returns {Promise<Object>} API response
     */
    async search(query) {
        return api.get(`${ENDPOINTS.PATIENTS_SEARCH}?q=${encodeURIComponent(query)}`);
    },

    /**
     * Get patient by ID
     * @param {number} id - Patient ID
     * @returns {Promise<Object>} API response
     */
    async getById(id) {
        return api.get(`${ENDPOINTS.PATIENTS}/${id}`);
    },

    /**
     * Create patient
     * @param {Object} data - Patient data
     * @returns {Promise<Object>} API response
     */
    async create(data) {
        return api.post(ENDPOINTS.PATIENTS, data);
    },

    /**
     * Update patient
     * @param {number} id - Patient ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} API response
     */
    async update(id, data) {
        return api.put(`${ENDPOINTS.PATIENTS}/${id}`, data);
    },

    /**
     * Delete patient
     * @param {number} id - Patient ID
     * @returns {Promise<Object>} API response
     */
    async delete(id) {
        return api.delete(`${ENDPOINTS.PATIENTS}/${id}`);
    }
};

export default patientService;
