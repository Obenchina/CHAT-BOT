/**
 * Assistant Routes
 * Handles assistant CRUD operations
 */

const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly, assistantOnly, doctorOrAssistant } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticate);

// Assistant profile (for logged-in assistant)
router.get('/profile', assistantOnly, assistantController.getProfile);
router.put('/profile', assistantOnly, assistantController.updateProfile);

// Doctor-only routes for managing assistants
router.get('/', doctorOnly, assistantController.getAll);
router.post('/', doctorOnly, assistantController.create);
router.put('/:id', doctorOnly, assistantController.update);
router.patch('/:id/toggle', doctorOnly, assistantController.toggleStatus);
router.delete('/:id', doctorOnly, assistantController.remove);

module.exports = router;
