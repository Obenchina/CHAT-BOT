/**
 * Patient Routes
 * Handles patient CRUD operations
 */

const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOrAssistant } = require('../middleware/roleMiddleware');

// All routes require authentication and doctor/assistant role
router.use(authenticate);
router.use(doctorOrAssistant);

// Patient operations
router.get('/', patientController.getAll);
router.get('/search', patientController.search);
router.get('/:id', patientController.getById);
router.post('/', patientController.create);
router.put('/:id', patientController.update);
router.delete('/:id', patientController.remove);

module.exports = router;
