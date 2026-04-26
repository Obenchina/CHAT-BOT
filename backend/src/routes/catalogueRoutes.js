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

// Sections operations (independent management)
router.get('/:id/sections', catalogueController.getSections);
router.post('/:id/sections', catalogueController.createSection);
router.put('/:id/sections/reorder', catalogueController.reorderSections);
router.patch('/:id/sections/:sectionId', catalogueController.renameSection);
router.delete('/:id/sections/:sectionId', catalogueController.deleteSection);

// Question operations
router.post('/:id/questions', catalogueController.addQuestion);
router.put('/questions/:questionId', catalogueController.updateQuestion);
router.delete('/questions/:questionId', catalogueController.deleteQuestion);

module.exports = router;
