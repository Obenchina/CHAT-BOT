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

    async register(data) {
        return api.post(ENDPOINTS.REGISTER, data);
    },

    /**
     * Verify registration OTP
     * @param {string} pendingId - Pending registration ID
     * @param {string} code - 6-digit OTP code
     * @returns {Promise<Object>} API response
     */
    async verifyRegistration(pendingId, code) {
        return api.post(ENDPOINTS.VERIFY_REGISTRATION, { pendingId, code });
    },

    /**
     * Resend verification OTP
     * @param {string} pendingId - Pending registration ID
     * @returns {Promise<Object>} API response
     */
    async resendOtp(pendingId) {
        return api.post(ENDPOINTS.RESEND_OTP, { pendingId });
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
     * Reset password with OTP
     * @param {string} email - User email
     * @param {string} otp - OTP code
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} API response
     */
    async resetPassword(email, otp, newPassword) {
        return api.post(ENDPOINTS.RESET_PASSWORD, { email, otp, newPassword });
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
