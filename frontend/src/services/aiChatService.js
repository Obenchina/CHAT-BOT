/**
 * AI Chat Service
 * Handles doctor-AI conversation API calls
 */

import api from './api';

const aiChatService = {
    async getMessages(caseId) {
        return api.get(`/ai-chat/${caseId}`);
    },

    async sendMessage(caseId, message) {
        return api.post(`/ai-chat/${caseId}`, { message });
    },

    async sendWithFullHistory(caseId, message) {
        return api.post(`/ai-chat/${caseId}/with-history`, { message });
    },

    async transcribe(audioBlob) {
        const form = new FormData();
        form.append('audio', audioBlob, 'recording.webm');
        return api.post(`/ai-chat/transcribe`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

export default aiChatService;
