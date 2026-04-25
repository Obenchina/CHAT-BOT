/**
 * AI Chat Routes
 * Doctor-AI conversation endpoints
 */

const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const { authenticate } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/roleMiddleware');

router.use(authenticate);
router.use(doctorOnly);

// Get chat messages for a case
router.get('/:caseId', aiChatController.getMessages);

// Send message and get AI response
router.post('/:caseId', aiChatController.sendMessage);

// Send with full patient history
router.post('/:caseId/with-history', aiChatController.sendWithFullHistory);

module.exports = router;
