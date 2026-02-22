/**
 * Catalogue Routes
 * Handles catalogue and question management
 */

const express = require('express');
const router = express.Router();
const catalogueController = require('../controllers/catalogueController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/roleMiddleware');

// All routes require authentication and doctor role
router.use(authenticate);
router.use(doctorOnly);

// Catalogue operations
router.get('/', catalogueController.getCatalogue);
router.post('/', catalogueController.createCatalogue);
router.post('/:id/publish', catalogueController.publishCatalogue);
router.put('/:id/reorder', catalogueController.reorderQuestions);

// Question operations
router.post('/:id/questions', catalogueController.addQuestion);
router.put('/questions/:questionId', catalogueController.updateQuestion);
router.delete('/questions/:questionId', catalogueController.deleteQuestion);

module.exports = router;
