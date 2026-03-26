/**
 * Doctor Routes
 * Handles doctor dashboard and profile endpoints
 */

const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/roleMiddleware');

// All routes require authentication and doctor role
router.use(authenticate);
router.use(doctorOnly);

// Dashboard
router.get('/dashboard', doctorController.getDashboard);

// Profile
router.get('/profile', doctorController.getProfile);
router.put('/profile', doctorController.updateProfile);

// AI Configuration
router.get('/ai-config', doctorController.getAiConfig);
router.put('/ai-config', doctorController.updateAiConfig);
router.put('/ai-config/activate', doctorController.activateAiConfig);
router.get('/ai-config/status', doctorController.getAiStatus);

module.exports = router;
