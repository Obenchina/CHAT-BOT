/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import api from './api';
import { ENDPOINTS } from '../constants/config';

const authService = {
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} API response
     */
    async login(email, password) {
        return api.post(ENDPOINTS.LOGIN, { email, password });
    },

    /**
     * Register new doctor
     * @param {Object} data - Registration data
     * @returns {Promise<Object>} API response
     */
    async register(data) {
        return api.post(ENDPOINTS.REGISTER, data);
    },

    /**
     * Request password reset
     * @param {string} email - User email
     * @returns {Promise<Object>} API response
     */
    async forgotPassword(email) {
        return api.post(ENDPOINTS.FORGOT_PASSWORD, { email });
    },

    /**
     * Reset password with token
     * @param {string} token - Reset token
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} API response
     */
    async resetPassword(token, newPassword) {
        return api.post(ENDPOINTS.RESET_PASSWORD, { token, newPassword });
    },

    /**
     * Get current user info
     * @returns {Promise<Object>} API response
     */
    async getCurrentUser() {
        return api.get(ENDPOINTS.CURRENT_USER);
    },

    /**
     * Change password
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} API response
     */
    async changePassword(currentPassword, newPassword) {
        return api.post('/auth/change-password', { currentPassword, newPassword });
    }
};

export default authService;
