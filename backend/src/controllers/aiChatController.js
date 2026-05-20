/**
 * AI Chat Controller
 * Handles doctor-AI conversation endpoints.
 */

const AiChat = require('../models/AiChat');
const Case = require('../models/Case');
const Doctor = require('../models/Doctor');
const AiConfig = require('../models/AiConfig');
const aiService = require('../services/aiService');
const fs = require('fs');
const path = require('path');

function anonymizeCaseDataForAI(caseData) {
    if (!caseData || typeof caseData !== 'object') return caseData;
    const cloned = { ...caseData };
    if (cloned.patient && typeof cloned.patient === 'object') {
        cloned.patient = { ...cloned.patient };
        delete cloned.patient.first_name;
        delete cloned.patient.last_name;
        delete cloned.patient.firstName;
        delete cloned.patient.lastName;
    }
    return cloned;
}

function getChatImageAttachment(file) {
    if (!file) return null;
    return {
        path: `chat-images/${file.filename}`,
        name: file.originalname,
        mime: file.mimetype
    };
}

function getMessageTextWithImageFallback(message, attachment) {
    const text = String(message || '').trim();
    if (text) return text;
    return attachment ? '[Image medicale jointe]' : '';
}

async function getDoctorAiConfig(doctorId) {
    const activeAiConfig = await AiConfig.findActiveByDoctorId(doctorId);
    return activeAiConfig ? {
        provider: activeAiConfig.provider,
        apiKey: activeAiConfig.api_key,
        model: activeAiConfig.model,
        responseLanguage: activeAiConfig.response_language || 'fr'
    } : null;
}

/**
 * GET /api/ai-chat/:caseId
 */
async function getMessages(req, res) {
    try {
        const { caseId } = req.params;
        const messages = await AiChat.getMessages(caseId);
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Echec du chargement des messages' });
    }
}

/**
 * POST /api/ai-chat/:caseId
 */
async function sendMessage(req, res) {
    try {
        const { caseId } = req.params;
        const attachment = getChatImageAttachment(req.file);
        const messageText = getMessageTextWithImageFallback(req.body?.message, attachment);

        if (!messageText) {
            return res.status(400).json({ success: false, message: 'Le message est vide' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Medecin introuvable' });
        }

        const caseData = await Case.getFullDetails(caseId);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Cas introuvable' });
        }
        if (caseData.patient?.doctor_id && caseData.patient.doctor_id !== doctor.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const aiConfig = await getDoctorAiConfig(doctor.id);
        if (!aiConfig?.apiKey) {
            return res.status(400).json({ success: false, message: 'Cle API IA non configuree' });
        }

        const attachmentsArray = attachment ? [attachment] : [];
        const doctorMsg = await AiChat.addMessage(caseId, doctor.id, 'doctor', messageText, attachmentsArray);
        const history = await AiChat.getMessages(caseId);
        const chatHistory = history.filter((m) => m.id !== doctorMsg.id);
        const systemContext = aiService.buildChatSystemPrompt(
            anonymizeCaseDataForAI(caseData),
            aiConfig.responseLanguage
        );
        const aiResponse = await aiService.chatWithAI(
            systemContext,
            chatHistory,
            messageText,
            aiConfig,
            attachment ? [attachment] : []
        );
        const aiMsg = await AiChat.addMessage(caseId, doctor.id, 'ai', aiResponse);

        res.json({
            success: true,
            data: { doctorMessage: doctorMsg, aiMessage: aiMsg }
        });
    } catch (error) {
        console.error('Send chat message error:', error);
        let statusCode = 500;
        let userMessage = 'Echec de l envoi du message';
        if (error.code === 'QUOTA_EXCEEDED') {
            statusCode = 429;
            userMessage = 'Credit IA epuise';
        } else if (error.code === 'MISSING_API_KEY') {
            statusCode = 400;
            userMessage = 'Cle API non configuree';
        }
        res.status(statusCode).json({ success: false, message: userMessage });
    }
}

/**
 * POST /api/ai-chat/:caseId/with-history
 */
async function sendWithFullHistory(req, res) {
    try {
        const { caseId } = req.params;
        const attachment = getChatImageAttachment(req.file);
        const messageText = getMessageTextWithImageFallback(req.body?.message, attachment);

        if (!messageText) {
            return res.status(400).json({ success: false, message: 'Le message est vide' });
        }

        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Medecin introuvable' });
        }

        const caseData = await Case.getFullDetails(caseId);
        if (!caseData) {
            return res.status(404).json({ success: false, message: 'Cas introuvable' });
        }
        if (caseData.patient?.doctor_id && caseData.patient.doctor_id !== doctor.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const aiConfig = await getDoctorAiConfig(doctor.id);
        if (!aiConfig?.apiKey) {
            return res.status(400).json({ success: false, message: 'Cle API IA non configuree' });
        }

        const allCases = await Case.findByPatientId(caseData.patient_id);
        let fullHistoryContext = 'Dossier complet du patient (toutes les visites):\n';

        for (const historicCase of allCases) {
            const fullCase = await Case.getFullDetails(historicCase.id);
            if (!fullCase) continue;
            const date = historicCase.created_at
                ? new Date(historicCase.created_at).toLocaleDateString('fr-FR')
                : 'date inconnue';
            fullHistoryContext += `\n--- Visite du ${date} ---\n`;
            fullHistoryContext += aiService.buildComprehensiveCaseContext(
                anonymizeCaseDataForAI(fullCase),
                aiConfig.responseLanguage
            );
            fullHistoryContext += '\n';
        }

        const attachmentsArray = attachment ? [attachment] : [];
        const doctorMsg = await AiChat.addMessage(
            caseId,
            doctor.id,
            'doctor',
            `[avec le dossier complet] ${messageText}`,
            attachmentsArray
        );

        const chatHistory = await AiChat.getMessages(caseId);
        const filteredHistory = chatHistory.filter((m) => m.id !== doctorMsg.id);
        const systemContext = aiService.buildChatSystemPrompt(
            anonymizeCaseDataForAI(caseData),
            aiConfig.responseLanguage
        ) + '\n\n' + fullHistoryContext;

        const aiResponse = await aiService.chatWithAI(
            systemContext,
            filteredHistory,
            messageText,
            aiConfig,
            attachment ? [attachment] : []
        );
        const aiMsg = await AiChat.addMessage(caseId, doctor.id, 'ai', aiResponse);

        res.json({
            success: true,
            data: { doctorMessage: doctorMsg, aiMessage: aiMsg }
        });
    } catch (error) {
        console.error('Send with history error:', error);
        res.status(500).json({ success: false, message: 'Echec de l envoi avec historique' });
    }
}

/**
 * POST /api/ai-chat/transcribe
 */
async function transcribe(req, res) {
    try {
        const doctor = await Doctor.findByUserId(req.user.id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Medecin introuvable' });
        }

        const audioPath = req.file ? `audio/${req.file.filename}` : null;
        if (!audioPath) {
            return res.status(400).json({ success: false, message: 'Fichier audio manquant' });
        }

        const aiConfig = await getDoctorAiConfig(doctor.id);
        if (!aiConfig?.apiKey) {
            return res.status(400).json({ success: false, message: 'Cle API IA non configuree' });
        }

        const { lang } = req.body;
        const text = await aiService.transcribeAudio(audioPath, aiConfig, lang);

        try {
            const abs = path.join(__dirname, '../../uploads', audioPath);
            fs.unlink(abs, () => {});
        } catch {}

        res.json({ success: true, data: { text: text || '' } });
    } catch (error) {
        console.error('Transcribe audio error:', error);
        let statusCode = 500;
        let userMessage = 'Echec de la transcription audio';
        if (error.code === 'MISSING_API_KEY') {
            statusCode = 400;
            userMessage = 'Cle API non configuree';
        }
        if (error.code === 'QUOTA_EXCEEDED') {
            statusCode = 429;
            userMessage = 'Credit IA epuise';
        }
        res.status(statusCode).json({ success: false, message: userMessage });
    }
}

module.exports = {
    getMessages,
    sendMessage,
    sendWithFullHistory,
    transcribe
};
