/**
 * Catalogue Routes
 * Handles catalogue and question management
 */

const express = require('express');
const router = express.Router();
const catalogueController = require('../controllers/catalogueController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly, doctorOrAssistant } = require('../middleware/roleMiddleware');

router.use(authenticate);

// Shared route used by assistants before starting a case
router.get('/active/list', doctorOrAssistant, catalogueController.getActiveCatalogues);

// Doctor-only routes
router.use(doctorOnly);
router.get('/', catalogueController.getCatalogues);
router.post('/', catalogueController.createCatalogue);
router.get('/:id', catalogueController.getCatalogueById);
router.put('/:id', catalogueController.updateCatalogue);
router.delete('/:id', catalogueController.deleteCatalogue);
router.post('/:id/publish', catalogueController.publishCatalogue);
router.put('/:id/reorder', catalogueController.reorderQuestions);

// Question operations
router.post('/:id/questions', catalogueController.addQuestion);
router.put('/questions/:questionId', catalogueController.updateQuestion);
router.delete('/questions/:questionId', catalogueController.deleteQuestion);

module.exports = router;
