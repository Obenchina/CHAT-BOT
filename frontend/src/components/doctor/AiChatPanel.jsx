import React, { useState, useEffect, useRef, useCallback } from 'react';
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

    const loadMessages = useCallback(async () => {
        setLoading(true);
        try {
            const res = await aiChatService.getMessages(caseId);
            if (res.success) setMessages(res.data || []);
        } catch (e) {
            console.error('Load chat error:', e);
        }
        setLoading(false);
    }, [caseId]);

    useEffect(() => {
        if (caseId) {
            queueMicrotask(() => {
                loadMessages();
            });
        }
    }, [caseId, loadMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend(withHistory = false) {
        if (!input.trim() || sending) return;
        
        const msg = input.trim();
        setInput('');
        setSending(true);
        setError('');

        // Optimistic update — show doctor message immediately
        const optimisticId = `tmp-${Date.now()}`;
        setMessages(prev => [...prev, { id: optimisticId, role: 'doctor', content: msg, created_at: new Date().toISOString() }]);

        try {
            const res = withHistory
                ? await aiChatService.sendWithFullHistory(caseId, msg)
                : await aiChatService.sendMessage(caseId, msg);
            
            if (res.success) {
                // Replace optimistic message and add AI response
                setMessages(prev => {
                    const withoutOptimistic = prev.filter(m => m.id !== optimisticId);
                    return [...withoutOptimistic, res.data.doctorMessage, res.data.aiMessage];
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
        <div className="card" style={{ marginTop: 'var(--space-lg)', display: 'flex', flexDirection: 'column', height: '600px' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md) var(--space-lg)' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '1rem' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--primary-50)', color: 'var(--primary)' }}>
                        <SmartToyIcon style={{ fontSize: '1.2rem' }} />
                    </div>
                    <span>Chat Médecin ↔ IA</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    {messages.length > 0 && (
                        <button 
                            onClick={() => { if(window.confirm('Voulez-vous effacer l\'historique ?')) aiChatService.deleteByCase(caseId).then(loadMessages); }}
                            className="btn btn-ghost btn-sm"
                            title="Effacer"
                        >
                            Effacer
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ 
                flex: 1,
                overflowY: 'auto', 
                padding: 'var(--space-lg)', 
                backgroundColor: 'var(--gray-50)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ marginBottom: 'var(--space-md)' }}></div>
                        Chargement des messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: 0.5 }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
                            <SmartToyIcon style={{ fontSize: '2rem' }} />
                        </div>
                        <p style={{ fontWeight: 500 }}>Posez une question à l'IA</p>
                        <p style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: '200px' }}>Je connais l'historique médical de ce patient et je peux vous aider.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={msg.id || idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'doctor' ? 'flex-end' : 'flex-start',
                        }}>
                            <div style={{
                                maxWidth: '85%',
                                padding: 'var(--space-md)',
                                borderRadius: msg.role === 'doctor' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                backgroundColor: msg.role === 'doctor' ? 'var(--primary)' : 'var(--bg-card)',
                                color: msg.role === 'doctor' ? 'white' : 'var(--text-primary)',
                                boxShadow: 'var(--shadow-sm)',
                                fontSize: '0.938rem',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                border: msg.role === 'doctor' ? 'none' : '1px solid var(--border-color)',
                                direction: 'rtl',
                                textAlign: 'right'
                            }}>
                                {msg.content}
                            </div>
                            <div style={{ 
                                fontSize: '0.7rem', 
                                color: 'var(--text-muted)', 
                                marginTop: '4px',
                                padding: '0 8px',
                                display: 'flex',
                                gap: '8px'
                            }}>
                                <span>{msg.role === 'doctor' ? 'Vous' : 'IA'}</span>
                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    ))
                )}
                {sending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: '18px 18px 18px 4px',
                            backgroundColor: 'white',
                            border: '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            fontSize: '0.9rem',
                            color: 'var(--primary)'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>
                                L'IA analyse les données...
                            </span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div className="alert alert-error" style={{ margin: 'var(--space-sm) var(--space-lg)', padding: '8px 12px' }}>
                    {error}
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: 'var(--space-lg)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 'var(--space-sm)',
                    background: 'var(--gray-50)',
                    padding: 'var(--space-sm)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)'
                }}>
                    <textarea
                        className="ai-chat-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Posez une question à l'IA..."
                        rows={input.split('\n').length > 3 ? 4 : input.split('\n').length || 1}
                        style={{
                            width: '100%',
                            padding: 'var(--space-sm) var(--space-md)',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            resize: 'none',
                            fontSize: '0.95rem',
                            outline: 'none',
                            maxHeight: '150px'
                        }}
                        disabled={sending}
                    />
                    
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        borderTop: '1px solid var(--border-color)',
                        paddingTop: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)'
                    }}>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <button 
                                onClick={() => handleSend(true)} 
                                disabled={sending || !input.trim()}
                                className="btn btn-ghost btn-sm"
                                style={{ 
                                    fontSize: '0.7rem', 
                                    padding: '4px 10px', 
                                    height: '28px',
                                    borderRadius: '20px',
                                    background: input.trim() ? 'var(--primary-50)' : 'transparent',
                                    color: input.trim() ? 'var(--primary)' : 'inherit'
                                }}
                                title="Inclure tout l'historique du patient"
                            >
                                <HistoryIcon style={{ fontSize: '0.9rem', marginRight: '4px' }} />
                                Dossier complet
                            </button>
                        </div>

                        <button 
                            onClick={() => handleSend(false)} 
                            disabled={sending || !input.trim()}
                            className="btn btn-primary"
                            style={{
                                width: '36px',
                                height: '36px',
                                minWidth: '36px',
                                borderRadius: '50%',
                                padding: 0
                            }}
                        >
                            <SendIcon style={{ fontSize: '1.1rem' }} />
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-xs)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Appuyez sur <b>Entrée</b> pour envoyer
                    </p>
                </div>
            </div>
        </div>
    );
}

export default AiChatPanel;
