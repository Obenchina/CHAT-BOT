/**
 * AI Chat Controller
 * Handles doctor-AI conversation endpoints
 */

const AiChat = require('../models/AiChat');
const Case = require('../models/Case');
const Doctor = require('../models/Doctor');
const AiConfig = require('../models/AiConfig');
const aiService = require('../services/aiService');

/**
 * Get chat messages for a case
 * GET /api/ai-chat/:caseId
 */
async function getMessages(req, res) {
    try {
        const { caseId } = req.params;
        const messages = await AiChat.getMessages(caseId);
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Échec du chargement des messages' });
    }
}

/**
 * Send a message and get AI response
 * POST /api/ai-chat/:caseId
 */
async function sendMessage(req, res) {
    try {
        const { caseId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Le message est vide' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable' });
        }

        // Load case data for context
        const caseData = await Case.getFullDetails(caseId);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Cas introuvable' });
        }

        // Get AI config
        const activeAiConfig = await AiConfig.findActiveByDoctorId(doctor.id);
        const aiConfig = activeAiConfig ? {
            provider: activeAiConfig.provider,
            apiKey: activeAiConfig.api_key,
            model: activeAiConfig.model
        } : null;

        // Save doctor's message
        const doctorMsg = await AiChat.addMessage(caseId, doctor.id, 'doctor', message.trim());

        // Get chat history
        const history = await AiChat.getMessages(caseId);
        // Exclude the just-added message from history (it's the new message)
        const chatHistory = history.filter(m => m.id !== doctorMsg.id);

        // Build context and call AI
        const systemContext = aiService.buildChatSystemPrompt(caseData);
        const aiResponse = await aiService.chatWithAI(systemContext, chatHistory, message.trim(), aiConfig);

        // Save AI response
        const aiMsg = await AiChat.addMessage(caseId, doctor.id, 'ai', aiResponse);

        res.json({
            success: true,
            data: {
                doctorMessage: doctorMsg,
                aiMessage: aiMsg
            }
        });
    } catch (error) {
        console.error('Send chat message error:', error);
        
        let statusCode = 500;
        let userMessage = 'Échec de l\'envoi du message';
        
        if (error.code === 'QUOTA_EXCEEDED') {
            statusCode = 429;
            userMessage = 'Crédit IA épuisé';
        } else if (error.code === 'MISSING_API_KEY') {
            statusCode = 400;
            userMessage = 'Clé API non configurée';
        }

        res.status(statusCode).json({ success: false, message: userMessage });
    }
}

/**
 * Send message with full patient history across all visits
 * POST /api/ai-chat/:caseId/with-history
 */
async function sendWithFullHistory(req, res) {
    try {
        const { caseId } = req.params;
        const { message } = req.body;

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable' });
        }

        const caseData = await Case.getFullDetails(caseId);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Cas introuvable' });
        }

        // Get ALL cases for this patient (full history)
        const allCases = await Case.findByPatientId(caseData.patient_id);
        
        let fullHistoryContext = `══════════════════════════════\nالدوسييه الكامل للمريض (جميع الزيارات):\n══════════════════════════════\n`;
        
        for (const historicCase of allCases) {
            const fullCase = await Case.getFullDetails(historicCase.id);
            if (fullCase) {
                fullHistoryContext += `\n--- زيارة ${new Date(historicCase.created_at).toLocaleDateString()} ---\n`;
                if (fullCase.answers) {
                    fullCase.answers.forEach(a => {
                        fullHistoryContext += `${a.question_text}: ${a.transcribed_text || 'N/A'}\n`;
                    });
                }
                const analysis = fullCase.ai_analysis;
                if (analysis && analysis.summary) {
                    fullHistoryContext += `ملخص IA: ${analysis.summary}\n`;
                }
            }
        }

        // Get AI config
        const activeAiConfig = await AiConfig.findActiveByDoctorId(doctor.id);
        const aiConfig = activeAiConfig ? {
            provider: activeAiConfig.provider,
            apiKey: activeAiConfig.api_key,
            model: activeAiConfig.model
        } : null;

        const doctorMsg = await AiChat.addMessage(caseId, doctor.id, 'doctor', `[مع الدوسييه الكامل] ${message}`);

        const chatHistory = await AiChat.getMessages(caseId);
        const filteredHistory = chatHistory.filter(m => m.id !== doctorMsg.id);

        const systemContext = aiService.buildChatSystemPrompt(caseData) + '\n\n' + fullHistoryContext;
        const aiResponse = await aiService.chatWithAI(systemContext, filteredHistory, message, aiConfig);

        const aiMsg = await AiChat.addMessage(caseId, doctor.id, 'ai', aiResponse);

        res.json({
            success: true,
            data: { doctorMessage: doctorMsg, aiMessage: aiMsg }
        });
    } catch (error) {
        console.error('Send with history error:', error);
        res.status(500).json({ success: false, message: 'Échec de l\'envoi avec historique' });
    }
}

module.exports = {
    getMessages,
    sendMessage,
    sendWithFullHistory
};
