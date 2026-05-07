/**
 * AI Chat Service
 * Handles doctor-AI conversation API calls
 */

import api from './api';

const aiChatService = {
    async getMessages(caseId) {
        return api.get(`/ai-chat/${caseId}`);
    },

    async sendMessage(caseId, message, image = null) {
        if (image) {
            const form = new FormData();
            form.append('message', message || '');
            form.append('image', image);
            return api.post(`/ai-chat/${caseId}`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.post(`/ai-chat/${caseId}`, { message });
    },

    async sendWithFullHistory(caseId, message, image = null) {
        if (image) {
            const form = new FormData();
            form.append('message', message || '');
            form.append('image', image);
            return api.post(`/ai-chat/${caseId}/with-history`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.post(`/ai-chat/${caseId}/with-history`, { message });
    },

    async transcribe(audioBlob, lang = null) {
        const form = new FormData();
        form.append('audio', audioBlob, 'recording.webm');
        if (lang) form.append('lang', lang);
        return api.post(`/ai-chat/transcribe`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

export default aiChatService;
