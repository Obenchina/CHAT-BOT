/**
 * Authentication Routes
 * Handles login, register, and password reset endpoints
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
