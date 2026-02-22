/**
 * Assistant Service
 * Handles assistant-related API calls
 */

import api from './api';

const assistantService = {
    /**
     * Get assistant profile
     * @returns {Promise<Object>} API response
     */
    async getProfile() {
        console.log('Calling API: /assistant/profile');
        return api.get('/assistant/profile');
    },

    /**
     * Update assistant profile
     * @param {Object} data - Profile data
     * @returns {Promise<Object>} API response
     */
    async updateProfile(data) {
        return api.put('/assistant/profile', data);
    }
};

export default assistantService;
