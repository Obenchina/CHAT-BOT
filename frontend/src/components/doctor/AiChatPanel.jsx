import React, { useState, useEffect, useRef, useCallback } from 'react';
import aiChatService from '../../services/aiChatService';
import { showError } from '../../utils/toast';
import { getTextAlign, getTextDirection, isRtlText } from '../../utils/textDirection';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';

function AiChatPanel({ caseId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [useFullHistory, setUseFullHistory] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

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

    async function handleSend() {
        if (!input.trim() || sending) return;
        
        const msg = input.trim();
        setInput('');
        setSending(true);
        setError('');

        // Optimistic update — show doctor message immediately
        const optimisticId = `tmp-${Date.now()}`;
        setMessages(prev => [...prev, { id: optimisticId, role: 'doctor', content: msg, created_at: new Date().toISOString() }]);

        try {
            const res = useFullHistory
                ? await aiChatService.sendWithFullHistory(caseId, msg)
                : await aiChatService.sendMessage(caseId, msg);
            
            if (res.success) {
                // Replace optimistic message and add AI response
                setMessages(prev => {
                    const withoutOptimistic = prev.filter(m => m.id !== optimisticId);
                    return [...withoutOptimistic, res.data.doctorMessage, res.data.aiMessage];
                });
            } else {
                setError(res.message || 'Erreur lors de l\'envoi');
            }
        } catch (e) {
            setError(e.message || 'Erreur de connexion avec l\'assistant IA');
        }
        setSending(false);
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                try {
                    setTranscribing(true);
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const res = await aiChatService.transcribe(blob);
                    if (res?.success) {
                        const text = res.data?.text ?? res.data?.data?.text ?? '';
                        const normalized = String(text || '').trim();
                        if (normalized) {
                            setInput(prev => (prev ? `${prev}\n${normalized}` : normalized));
                        }
                    } else {
                        showError(res?.message || 'Échec de la transcription audio');
                    }
                } catch (e) {
                    console.error('Chat transcription error:', e);
                    showError(e?.message || 'Échec de la transcription audio');
                } finally {
                    setTranscribing(false);
                    stream.getTracks().forEach(t => t.stop());
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error('Mic permission error:', e);
            showError('Microphone غير متاح. تحقق من الصلاحيات.');
        }
    }

    function stopRecording() {
        try {
            mediaRecorderRef.current?.stop();
        } catch {
            // ignore
        }
        setIsRecording(false);
    }

    const inputIsRtl = isRtlText(input);

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
                    {/* Reserved for future: clear history */}
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
                    messages.map((msg, idx) => {
                        const messageDirection = getTextDirection(msg.content);
                        const messageAlign = getTextAlign(msg.content);

                        return (
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
                                    direction: messageDirection,
                                    textAlign: messageAlign,
                                    unicodeBidi: 'plaintext'
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
                        );
                    })
                )}
                {sending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: '18px 18px 18px 4px',
                            backgroundColor: 'var(--bg-card)',
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
                            maxHeight: '150px',
                            direction: inputIsRtl ? 'rtl' : 'ltr',
                            textAlign: inputIsRtl ? 'right' : 'left',
                            unicodeBidi: 'plaintext'
                        }}
                        disabled={sending || transcribing}
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
                                type="button"
                                onClick={() => setUseFullHistory(v => !v)} 
                                disabled={sending}
                                className="btn btn-ghost btn-sm"
                                style={{ 
                                    fontSize: '0.7rem', 
                                    padding: '4px 10px', 
                                    height: '28px',
                                    borderRadius: '20px',
                                    background: useFullHistory ? 'var(--primary-50)' : 'transparent',
                                    color: useFullHistory ? 'var(--primary)' : 'var(--text-secondary)'
                                }}
                                title="Activer: envoyer مع الدوسييه الكامل"
                            >
                                <HistoryIcon style={{ fontSize: '0.9rem', marginRight: '4px' }} />
                                Dossier complet
                            </button>

                            <button
                                type="button"
                                onClick={() => (isRecording ? stopRecording() : startRecording())}
                                disabled={sending || transcribing}
                                className="btn btn-ghost btn-sm"
                                style={{
                                    fontSize: '0.7rem',
                                    padding: '4px 10px',
                                    height: '28px',
                                    borderRadius: '20px',
                                    background: isRecording ? 'var(--error-light)' : 'transparent',
                                    color: isRecording ? 'var(--error)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                title={isRecording ? 'Arrêter' : 'Dicter vocalement'}
                            >
                                {isRecording ? <StopIcon style={{ fontSize: '0.9rem' }} /> : <MicIcon style={{ fontSize: '0.9rem' }} />}
                                {transcribing ? '...' : 'Dicter'}
                            </button>
                        </div>

                        <button 
                            onClick={() => handleSend()} 
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
