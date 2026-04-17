/**
 * Case Routes
 * Handles medical case workflow operations
 */

const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly, assistantOnly, doctorOrAssistant } = require('../middleware/roleMiddleware');
const { uploadDocument, uploadAudio, handleUploadError } = require('../middleware/uploadMiddleware');

// All routes require authentication
router.use(authenticate);

// Cases inbox (doctor only)
router.get('/', doctorOnly, caseController.getAll);

// Get case by ID (doctor or assistant)
router.get('/:id', doctorOrAssistant, caseController.getById);

// Create new case (assistant only)
router.post('/', assistantOnly, caseController.create);

// Add answer with audio (assistant only)
router.post('/:id/answers',
    assistantOnly,
    uploadAudio.single('audio'),
    handleUploadError,
    caseController.addAnswer
);

// Add text answer (assistant only)
router.post('/:id/answers/text', assistantOnly, caseController.addTextAnswer);

// Upload document (assistant only, before submission)
router.post('/:id/documents',
    assistantOnly,
    uploadDocument.single('document'),
    handleUploadError,
    caseController.uploadDocument
);

// Delete document (assistant only, before submission)
router.delete('/:id/documents/:docId', assistantOnly, caseController.deleteDocument);

// Submit case (assistant only)
router.post('/:id/submit', assistantOnly, caseController.submit);

// Doctor review
router.put('/:id/review', doctorOnly, caseController.saveReview);

// Close case (doctor only)
router.post('/:id/close', doctorOnly, caseController.closeCase);

// Generate prescription PDF (doctor only)
router.get('/:id/prescription/pdf', doctorOnly, caseController.generatePrescriptionPdf);

// Generate analyses PDF (doctor only)
router.get('/:id/analyses/pdf', doctorOnly, caseController.generateAnalysesPdf);

// Generate letter PDF (doctor only)
router.get('/:id/letter/pdf', doctorOnly, caseController.generateLetterPdf);

// Retranscribe audio answers (doctor only)
router.post('/:id/retranscribe', doctorOnly, caseController.retranscribeCase);

// Reanalyze with AI (doctor only)
router.post('/:id/reanalyze', doctorOnly, caseController.reanalyzeCase);

// Delete case (doctor or assistant with restrictions)
router.delete('/:id', doctorOrAssistant, caseController.deleteCase);

module.exports = router;
