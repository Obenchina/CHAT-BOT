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

/**
 * Robustly extract the message text & role from any backend shape.
 * Backend stores rows as { role: 'doctor' | 'ai', content: '...' }
 * Send response is { data: { doctorMessage, aiMessage } }
 * We accept all of these and fall back gracefully.
 */
function normalizeMessage(raw, fallbackRole = null) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { id: `m-${Date.now()}-${Math.random()}`, role: fallbackRole || 'ai', content: raw };
  }
  const role =
    raw.role ||
    raw.sender ||
    fallbackRole ||
    'ai';
  const content =
    raw.content ??
    raw.message ??
    raw.text ??
    raw.reply ??
    '';
  return {
    id: raw.id ?? `m-${Date.now()}-${Math.random()}`,
    role,
    content: String(content ?? ''),
    created_at: raw.created_at || raw.createdAt || null,
  };
}

function isDoctorRole(role) {
  return role === 'doctor' || role === 'user';
}

function MessageBubble({ msg, onPin }) {
  const isUser = isDoctorRole(msg.role);
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
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content || '—'}</div>
      ) : msg.content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {msg.content}
        </ReactMarkdown>
      ) : (
        <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          (Réponse vide — réessayez ou vérifiez la configuration IA)
        </div>
      )}
      {!isUser && msg.content && onPin && (
        <div className="copilot__bubble-actions">
          <button className="copilot__bubble-action" onClick={() => onPin(msg.content)}>
            📌 Épingler à Diagnostic
          </button>
          <button
            className="copilot__bubble-action"
            onClick={() => navigator.clipboard?.writeText(msg.content).then(() => showSuccess('Copié'))}
          >
            ⧉ Copier
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function CopilotPanel({ caseId, onPinToDiagnostic, onCollapse, onExpand, expanded = false }) {
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
          const list = Array.isArray(res.data) ? res.data : [];
          setMessages(list.map((m) => normalizeMessage(m)).filter(Boolean));
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
  }, [messages, sending]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    const tempUser = normalizeMessage({ id: `u-${Date.now()}`, role: 'doctor', content: text });
    setMessages((prev) => [...prev, tempUser]);
    setInput('');
    try {
      const fn = withDossier ? aiChatService.sendWithFullHistory : aiChatService.sendMessage;
      const res = await fn(caseId, text);

      if (res?.success) {
        // Backend shape: { data: { doctorMessage, aiMessage } }
        // Older shape:   { data: '...' } or { data: { content/message/reply } }
        const payload = res.data;
        let aiNormalized = null;

        if (payload && typeof payload === 'object' && payload.aiMessage) {
          aiNormalized = normalizeMessage(payload.aiMessage, 'ai');
        } else {
          aiNormalized = normalizeMessage(payload, 'ai');
        }

        if (aiNormalized && aiNormalized.content) {
          setMessages((prev) => [...prev, aiNormalized]);
        } else {
          // Last fallback — refetch full history so UI stays consistent
          const refresh = await aiChatService.getMessages(caseId);
          if (refresh?.success && Array.isArray(refresh.data)) {
            setMessages(refresh.data.map((m) => normalizeMessage(m)).filter(Boolean));
          } else {
            showError('Réponse IA vide reçue');
          }
        }
      } else {
        showError(res?.message || 'Erreur lors de l\'envoi');
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
    <aside className={`copilot${expanded ? ' copilot--expanded' : ''}`} aria-label="Copilot IA">
      <div className="copilot__header">
        <h3 className="copilot__title">
          <span aria-hidden>🤖</span>
          Copilot IA
        </h3>
        <div className="copilot__actions">
          {onExpand && (
            <button
              className="copilot__action-btn"
              title={expanded ? 'Réduire' : 'Agrandir le copilot'}
              onClick={onExpand}
              aria-label={expanded ? 'Réduire' : 'Agrandir'}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
          )}
          <button className="copilot__action-btn" title="Fermer" onClick={onCollapse} aria-label="Fermer">›</button>
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
            style={{ display: 'flex', gap: 6, alignItems: 'center' }}
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

        <div className="copilot__hint">Entrée pour envoyer · Maj+Entrée saut de ligne</div>
      </div>
    </aside>
  );
}
