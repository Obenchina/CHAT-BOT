import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import aiChatService from '../../services/aiChatService';
import { showError, showSuccess } from '../../utils/toast';

const QUICK_PROMPTS = [
  'Synthèse en 5 lignes',
  'Diagnostics différentiels probables ?',
  'Examens complémentaires à demander',
  'Posologie pédiatrique pour ce cas',
];

function MessageBubble({ msg, onPin }) {
  const isUser = msg.role === 'user' || msg.sender === 'doctor';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`copilot__bubble copilot__bubble--${isUser ? 'user' : 'ai'}`}
    >
      {!isUser && (
        <div className="copilot__bubble-meta">
          <span aria-hidden>🤖</span>
          <span>Copilot</span>
        </div>
      )}
      {isUser ? (
        <div>{msg.content || msg.message}</div>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {msg.content || msg.message || ''}
        </ReactMarkdown>
      )}
      {!isUser && onPin && (
        <div className="copilot__bubble-actions">
          <button className="copilot__bubble-action" onClick={() => onPin(msg.content || msg.message || '')}>
            📌 Épingler à Diagnostic
          </button>
          <button
            className="copilot__bubble-action"
            onClick={() => navigator.clipboard?.writeText(msg.content || msg.message || '').then(() => showSuccess('Copié'))}
          >
            ⧉ Copier
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function CopilotPanel({ caseId, onPinToDiagnostic, onCollapse }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [withDossier, setWithDossier] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await aiChatService.getMessages(caseId);
        if (!cancelled && res.success) {
          setMessages(res.data || []);
        }
      } catch (err) {
        console.error('Load messages error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    const tempUser = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, tempUser]);
    setInput('');
    try {
      const fn = withDossier ? aiChatService.sendWithFullHistory : aiChatService.sendMessage;
      const res = await fn(caseId, text);
      if (res.success) {
        const aiMsg = res.data || res.message;
        const content = typeof aiMsg === 'string' ? aiMsg : (aiMsg?.content || aiMsg?.message || '');
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content }]);
      } else {
        showError(res.message || 'Erreur lors de l\'envoi');
        setInput(text);
      }
    } catch (err) {
      console.error('Send error:', err);
      showError(err?.response?.data?.message || 'Erreur de connexion');
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = !loading && messages.length === 0;

  return (
    <aside className="copilot" aria-label="Copilot IA">
      <div className="copilot__header">
        <h3 className="copilot__title">
          <span aria-hidden>🤖</span>
          Copilot IA
        </h3>
        <div className="copilot__actions">
          <button className="copilot__action-btn" title="Réduire" onClick={onCollapse} aria-label="Réduire">›</button>
        </div>
      </div>

      <div className="copilot__messages">
        {loading && (
          <div className="copilot__empty">
            <div style={{ color: 'var(--color-text-muted)' }}>Chargement…</div>
          </div>
        )}

        {isEmpty && (
          <div className="copilot__empty">
            <div className="copilot__empty-icon" aria-hidden>🤖</div>
            <h4 className="copilot__empty-title">Posez une question</h4>
            <p className="copilot__empty-desc">Le Copilot a accès au dossier complet du patient.</p>
            <div className="copilot__suggestions">
              {QUICK_PROMPTS.map((p, i) => (
                <motion.button
                  key={i}
                  className="copilot__suggestion"
                  onClick={() => send(p)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {p}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble key={m.id || i} msg={m} onPin={onPinToDiagnostic} />
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="copilot__bubble copilot__bubble--ai"
            style={{ display: 'flex', gap: 6 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', display: 'inline-block' }}
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="copilot__input">
        <button
          className={`copilot__context-toggle${withDossier ? ' copilot__context-toggle--active' : ''}`}
          onClick={() => setWithDossier((v) => !v)}
          title="Inclure le dossier complet dans le contexte"
        >
          <span aria-hidden>{withDossier ? '✓' : '○'}</span>
          {withDossier ? 'Dossier complet inclus' : 'Sans contexte dossier'}
        </button>

        <div className="copilot__textarea-wrap">
          <textarea
            ref={textareaRef}
            className="copilot__textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Demandez à l'IA…  (Entrée pour envoyer · Maj+Entrée pour saut de ligne)"
            disabled={sending}
          />
          <button
            className="copilot__send"
            onClick={() => send()}
            disabled={!input.trim() || sending}
            aria-label="Envoyer"
            title="Envoyer"
          >
            ↑
          </button>
        </div>

        <div className="copilot__hint">Cmd/Ctrl+K pour ouvrir · Entrée pour envoyer</div>
      </div>
    </aside>
  );
}
