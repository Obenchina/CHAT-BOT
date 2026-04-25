import React, { useState, useEffect, useRef } from 'react';
import aiChatService from '../../services/aiChatService';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';

function AiChatPanel({ caseId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (caseId) loadMessages();
    }, [caseId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function loadMessages() {
        setLoading(true);
        try {
            const res = await aiChatService.getMessages(caseId);
            if (res.success) setMessages(res.data || []);
        } catch (e) {
            console.error('Load chat error:', e);
        }
        setLoading(false);
    }

    async function handleSend(withHistory = false) {
        if (!input.trim() || sending) return;
        
        const msg = input.trim();
        setInput('');
        setSending(true);
        setError('');

        // Optimistic update — show doctor message immediately
        setMessages(prev => [...prev, { id: Date.now(), role: 'doctor', content: msg, created_at: new Date().toISOString() }]);

        try {
            const res = withHistory
                ? await aiChatService.sendWithFullHistory(caseId, msg)
                : await aiChatService.sendMessage(caseId, msg);
            
            if (res.success) {
                // Replace optimistic message and add AI response
                setMessages(prev => {
                    const withoutOptimistic = prev.filter(m => m.id !== Date.now());
                    return [...withoutOptimistic.slice(0, -1), res.data.doctorMessage, res.data.aiMessage];
                });
            } else {
                setError(res.message || 'خطأ في الإرسال');
            }
        } catch (e) {
            setError(e.message || 'خطأ في الاتصال بالذكاء الاصطناعي');
        }
        setSending(false);
    }

    return (
        <div className="profile-section-card" style={{ marginTop: 'var(--space-lg)' }}>
            <div className="section-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-sm)' }}>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <SmartToyIcon style={{ color: 'var(--primary)' }} />
                    <span>Chat Médecin ↔ IA</span>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                padding: 'var(--space-md)', 
                backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                minHeight: '200px'
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>
                        Chargement...
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--space-xl)' }}>
                        <SmartToyIcon style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                        <p style={{ marginTop: 'var(--space-sm)' }}>Posez une question à l'IA à propos de ce patient.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={msg.id || idx} style={{
                            display: 'flex',
                            justifyContent: msg.role === 'doctor' ? 'flex-end' : 'flex-start',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            <div style={{
                                maxWidth: '80%',
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: msg.role === 'doctor' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                backgroundColor: msg.role === 'doctor' ? 'var(--primary)' : 'white',
                                color: msg.role === 'doctor' ? 'white' : 'var(--text-primary)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                fontSize: '0.9rem',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {msg.content}
                                <div style={{ 
                                    fontSize: '0.7rem', 
                                    opacity: 0.6, 
                                    marginTop: '4px',
                                    textAlign: msg.role === 'doctor' ? 'right' : 'left'
                                }}>
                                    {msg.role === 'doctor' ? 'Vous' : 'IA'} • {new Date(msg.created_at).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {sending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: '12px 12px 12px 0',
                            backgroundColor: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <span className="typing-indicator">L'IA réfléchit...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)', padding: '0 var(--space-sm)' }}>
                    ⚠ {error}
                </div>
            )}

            {/* Input Area */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Posez une question à l'IA sur ce patient..."
                    rows={2}
                    style={{
                        flex: 1,
                        padding: 'var(--space-sm)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        resize: 'none',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit'
                    }}
                    disabled={sending}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button 
                        onClick={() => handleSend(false)} 
                        disabled={sending || !input.trim()}
                        title="Envoyer"
                        style={{
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                            opacity: sending || !input.trim() ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <SendIcon style={{ fontSize: '1.2rem' }} />
                    </button>
                    <button 
                        onClick={() => handleSend(true)} 
                        disabled={sending || !input.trim()}
                        title="Envoyer avec le dossier complet du patient"
                        style={{
                            padding: '8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'white',
                            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                            opacity: sending || !input.trim() ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <HistoryIcon style={{ fontSize: '1rem' }} />
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Appuyez sur Entrée pour envoyer. Le bouton <HistoryIcon style={{ fontSize: '0.7rem', verticalAlign: 'middle' }} /> envoie avec le dossier complet.
            </p>
        </div>
    );
}

export default AiChatPanel;
