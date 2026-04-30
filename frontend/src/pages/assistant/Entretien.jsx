/**
 * Entretien Médical — V2 — radical redesign (cockpit 3-column)
 * Plan (left) | Question stage (center) | Récapitulatif (right)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from '../../components/common/Sidebar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import caseService from '../../services/caseService';
import patientService from '../../services/patientService';
import { showError, showWarning, showSuccess } from '../../utils/toast';
import { getAuthUploadUrl } from '../../constants/config';

import '../../styles/entretien.css';

const MotionButton = motion.button;
const MotionDiv = motion.div;
const MotionSpan = motion.span;

// =====================================================
// validation helpers
// =====================================================
function validateClinicalInput(question, rawValue) {
  const cm = question?.clinical_measure || question?.clinicalMeasure;
  if (!cm || cm === 'none') return { valid: true };
  const value = String(rawValue ?? '').trim();
  if (!value) return { valid: false, message: 'Valeur clinique requise.' };
  if (cm === 'blood_pressure') {
    const match = value.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) return { valid: false, message: 'La tension doit être au format 120/80.' };
    return { valid: true };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return { valid: false, message: 'Valeur numérique invalide.' };
  const ranges = {
    weight: [0, 300, 'poids'],
    height: [0, 250, 'taille'],
    head_circumference: [0, 80, 'périmètre crânien'],
    temperature: [25, 45, 'température'],
  };
  const r = ranges[cm];
  if (!r) return { valid: true };
  if (n < r[0] || n > r[1]) return { valid: false, message: `Valeur ${r[2]} hors plage (${r[0]}-${r[1]}).` };
  return { valid: true };
}

function calcAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years >= 1 ? `${years} an${years > 1 ? 's' : ''}` : `${Math.max(1, Math.floor(((now - d) / (1000 * 60 * 60 * 24 * 30)) || 0))} mois`;
}

function initials(first, last) {
  return `${(first || '').slice(0, 1)}${(last || '').slice(0, 1)}`.toUpperCase() || '?';
}

// =====================================================
// QUESTION RENDERERS
// =====================================================

function YesNoQuestion({ value, onChange }) {
  return (
    <div className="entretien-yesno">
      <MotionButton
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={`entretien-yesno__btn entretien-yesno__btn--yes${value === 'yes' ? ' entretien-yesno__btn--selected' : ''}`}
        onClick={() => onChange('yes')}
      >
        ✓ Oui <span className="entretien-yesno__shortcut">Y</span>
      </MotionButton>
      <MotionButton
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={`entretien-yesno__btn entretien-yesno__btn--no${value === 'no' ? ' entretien-yesno__btn--selected' : ''}`}
        onClick={() => onChange('no')}
      >
        ✗ Non <span className="entretien-yesno__shortcut">N</span>
      </MotionButton>
    </div>
  );
}

function ChoicesQuestion({ choices = [], value, onChange }) {
  let parsed = choices;
  if (typeof choices === 'string') {
    try { parsed = JSON.parse(choices); } catch { parsed = choices.split(',').map(s => s.trim()); }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return (
    <div className="entretien-choices">
      {list.map((c, i) => {
        const txt = typeof c === 'string' ? c : (c.text || c.label || '');
        return (
          <MotionButton
            key={i}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            className={`entretien-choices__item${value === txt ? ' entretien-choices__item--selected' : ''}`}
            onClick={() => onChange(txt)}
          >
            <span className="entretien-choices__shortcut">{i + 1}</span>
            <span>{txt}</span>
          </MotionButton>
        );
      })}
    </div>
  );
}

function VoiceQuestion({ recording, recordTime, audioUrl, onStart, onStop, onClear }) {
  return (
    <div className="entretien-voice">
      <MotionButton
        animate={recording ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ repeat: recording ? Infinity : 0, duration: 1.4 }}
        className={`entretien-voice__btn${recording ? ' entretien-voice__btn--recording' : ''}`}
        onClick={recording ? onStop : onStart}
        aria-label={recording ? 'Arrêter' : 'Enregistrer'}
        title={recording ? 'Arrêter (R)' : 'Enregistrer (R)'}
      >
        {recording ? '■' : '🎙'}
      </MotionButton>

      {recording && (
        <div className="entretien-voice__waveform" aria-hidden>
          {[0.3, 0.8, 0.5, 1.0, 0.6, 0.9, 0.4].map((h, i) => (
            <MotionSpan
              key={i}
              className="entretien-voice__bar"
              animate={{ height: [`${h * 30}%`, `${h * 100}%`, `${h * 40}%`] }}
              transition={{ repeat: Infinity, duration: 0.7 + i * 0.1, ease: 'easeInOut' }}
              style={{ height: `${h * 60}%` }}
            />
          ))}
        </div>
      )}

      <div className="entretien-voice__status">
        {recording ? `Enregistrement…  ${recordTime}` : (audioUrl ? 'Enregistrement prêt' : 'Cliquer pour enregistrer')}
      </div>

      {audioUrl && !recording && (
        <div className="entretien-voice__player" style={{ width: '100%' }}>
          <audio src={audioUrl} controls />
          <button
            type="button"
            onClick={onClear}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            ↻ Réenregistrer
          </button>
        </div>
      )}
    </div>
  );
}

function NumberQuestion({ value, onChange, clinicalMeasure }) {
  const labels = {
    weight: { unit: 'kg', placeholder: '18.5' },
    height: { unit: 'cm', placeholder: '108' },
    head_circumference: { unit: 'cm', placeholder: '52' },
    temperature: { unit: '°C', placeholder: '37.5' },
    blood_pressure: { unit: 'mmHg', placeholder: '120/80' },
  };
  const cm = labels[clinicalMeasure];
  const isBP = clinicalMeasure === 'blood_pressure';
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={isBP ? 'text' : 'number'}
        step={isBP ? undefined : 'any'}
        className="entretien-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={cm?.placeholder || ''}
        autoFocus
      />
      {cm?.unit && (
        <span style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
          pointerEvents: 'none',
        }}>
          {cm.unit}
        </span>
      )}
    </div>
  );
}

function ShortcutsModal({ onClose }) {
  return (
    <div className="entretien-shortcuts-overlay" onClick={onClose}>
      <div className="entretien-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Raccourcis clavier</h3>
        <table>
          <tbody>
            <tr><td><kbd>←</kbd> / <kbd>→</kbd></td><td>Question précédente / suivante</td></tr>
            <tr><td><kbd>Y</kbd></td><td>Répondre Oui</td></tr>
            <tr><td><kbd>N</kbd></td><td>Répondre Non</td></tr>
            <tr><td><kbd>1</kbd>–<kbd>9</kbd></td><td>Sélectionner un choix</td></tr>
            <tr><td><kbd>R</kbd></td><td>Démarrer / arrêter l'enregistrement</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>Entrée</kbd></td><td>Question suivante</td></tr>
            <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Enregistrer la réponse</td></tr>
            <tr><td><kbd>?</kbd></td><td>Afficher cette aide</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Fermer</td></tr>
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'var(--color-brand-500)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function Entretien() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCatalogueId = searchParams.get('catalogueId');

  const [patient, setPatient] = useState(null);
  const [caseId, setCaseId] = useState(null);
  const [catalogueName, setCatalogueName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [internalNotes, setInternalNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartRef = useRef(0);
  const pendingSavesRef = useRef(new Set());

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const answeredCount = useMemo(() => questions.filter(q => answers[q.id]).length, [questions, answers]);
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  // ---- Init ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCaseId(null);
      setCatalogueName('');
      setQuestions([]);
      setAnswers({});
      setCurrentIndex(0);
      try {
        const pr = await patientService.getById(patientId);
        if (cancelled) return;
        if (pr.success) setPatient(pr.data);

        const cr = await caseService.create(patientId, selectedCatalogueId);
        if (cancelled) return;
        if (cr.success) {
          const cd = cr.data;
          setCaseId(cd.id || cd.caseId);
          setCatalogueName(cd.catalogueName || '');
          const allQs = cd.questions || [];
          setQuestions(allQs);

          if (cd.isResumed) {
            try {
              const fr = await caseService.getById(cd.id);
              if (!cancelled && fr.success) {
                const existing = {};
                (fr.data.answers || []).forEach(a => {
                  const qId = a.questionId || a.question_id;
                  const audioPath = a.audioPath || a.audio_path;
                  const at = a.answerType || a.answer_type;
                  const txt = a.textAnswer || a.text_answer || '';
                  if (qId) {
                    existing[qId] = {
                      type: at,
                      value: txt,
                      audioUrl: audioPath ? getAuthUploadUrl(audioPath) : null,
                    };
                  }
                });
                setAnswers(existing);
                const firstUnanswered = allQs.findIndex(q => !existing[q.id]);
                setCurrentIndex(firstUnanswered === -1 ? Math.max(0, allQs.length - 1) : firstUnanswered);
              }
            } catch (err) { console.error('Resume error:', err); }
          }
        }
      } catch (err) {
        console.error('Init error:', err);
        showError(err.message || 'Erreur de chargement du questionnaire');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, selectedCatalogueId]);

  // beforeunload guard
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [answers]);

  // ---- Save current answer ----
  const saveAnswer = useCallback(async (question, answerData) => {
    if (!answerData) return;
    const promise = (async () => {
      try {
        if (answerData.type === 'voice' && answerData.audioBlob) {
          const fd = new FormData();
          fd.append('audio', answerData.audioBlob, 'recording.webm');
          fd.append('questionId', question.id);
          await caseService.addAnswer(caseId, fd);
        } else if (['yes_no', 'choices', 'text_short', 'text_long', 'number'].includes(answerData.type)) {
          await caseService.addTextAnswer(caseId, {
            questionId: question.id,
            answer: String(answerData.value ?? ''),
          });
        }
      } catch (err) {
        console.error('Save error:', err);
        showError(err?.message || 'Erreur lors de l\'enregistrement');
      }
    })();
    pendingSavesRef.current.add(promise);
    try { await promise; } finally { pendingSavesRef.current.delete(promise); }
  }, [caseId]);

  // ---- Recording ----
  const tickTimer = () => {
    const elapsed = Math.floor((Date.now() - recordStartRef.current) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    setRecordTime(`${m}:${s}`);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: { type: 'voice', audioBlob: blob, audioUrl: url } }));
        stream.getTracks().forEach(t => t.stop());
      };
      recordStartRef.current = Date.now();
      setRecordTime('00:00');
      recordTimerRef.current = setInterval(tickTimer, 250);
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      showError('Impossible d\'accéder au microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  const clearRecording = () => {
    setAnswers(prev => {
      const n = { ...prev };
      const a = n[currentQuestion.id];
      if (a?.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(a.audioUrl);
      delete n[currentQuestion.id];
      return n;
    });
  };

  // ---- Setters ----
  const setAnswer = (val, type) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: { type, value: val } }));
  };

  // ---- Validation ----
  const validateCurrent = () => {
    if (!currentQuestion) return true;
    const required = currentQuestion.isRequired ?? currentQuestion.is_required;
    if (!required) return true;
    const a = answers[currentQuestion.id];
    if (!a && !isRecording) {
      showWarning('Cette question est obligatoire.');
      return false;
    }
    const at = currentQuestion.answerType || currentQuestion.answer_type;
    if (at === 'number' || (currentQuestion.clinical_measure && currentQuestion.clinical_measure !== 'none')) {
      const v = validateClinicalInput(currentQuestion, a?.value);
      if (!v.valid) { showWarning(v.message); return false; }
    }
    return true;
  };

  // ---- Navigation ----
  const goNext = async () => {
    if (!validateCurrent()) return;
    let lastBlob = null;
    if (isRecording && mediaRecorderRef.current) {
      await new Promise(resolve => {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          lastBlob = blob;
          setAnswers(prev => ({ ...prev, [currentQuestion.id]: { type: 'voice', audioBlob: blob, audioUrl: URL.createObjectURL(blob) } }));
          resolve();
        };
        mediaRecorderRef.current.stop();
      });
      setIsRecording(false);
      if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    }
    const a = lastBlob ? { type: 'voice', audioBlob: lastBlob } : answers[currentQuestion.id];
    if (a) saveAnswer(currentQuestion, a);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const goPrev = () => {
    if (isRecording) stopRecording();
    const a = answers[currentQuestion?.id];
    if (a) saveAnswer(currentQuestion, a);
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  const goTo = (idx) => {
    if (idx < 0 || idx >= questions.length) return;
    if (isRecording) stopRecording();
    const a = answers[currentQuestion?.id];
    if (a) saveAnswer(currentQuestion, a);
    setCurrentIndex(idx);
  };

  // ---- Finish ----
  const finish = async () => {
    if (!validateCurrent()) return;
    const missing = questions.find(q => (q.isRequired || q.is_required) && !answers[q.id] && !(q.id === currentQuestion.id && isRecording));
    if (missing) {
      showWarning(`Question obligatoire non répondue: "${missing.questionText || missing.question_text}"`);
      const idx = questions.findIndex(q => q.id === missing.id);
      if (idx !== -1) setCurrentIndex(idx);
      return;
    }
    setSubmitting(true);
    try {
      let lastBlob = null;
      if (isRecording && mediaRecorderRef.current) {
        await new Promise(resolve => {
          mediaRecorderRef.current.onstop = () => {
            lastBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            resolve();
          };
          mediaRecorderRef.current.stop();
        });
        setIsRecording(false);
      }
      const a = lastBlob ? { type: 'voice', audioBlob: lastBlob } : answers[currentQuestion?.id];
      if (a) await saveAnswer(currentQuestion, a);
      if (pendingSavesRef.current.size > 0) await Promise.all(pendingSavesRef.current);
      navigate(`/assistant/case/${caseId}/review`);
    } catch (err) {
      console.error('Finish error:', err);
      showError('Erreur lors de la finalisation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    if (!currentQuestion || showShortcuts) return;
    const at = currentQuestion.answerType || currentQuestion.answer_type;
    const choices = currentQuestion.choices;

    const onKey = (e) => {
      // ignore when typing in input (except for ctrl combos)
      const tag = e.target.tagName;
      const isText = (tag === 'INPUT' || tag === 'TEXTAREA');

      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); return; }
      if (e.key === 'Escape') {
        if (showShortcuts) setShowShortcuts(false);
        return;
      }

      if (e.key === 'ArrowRight' && !isText) { e.preventDefault(); goNext(); return; }
      if (e.key === 'ArrowLeft' && !isText) { e.preventDefault(); goPrev(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); goNext(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const a = answers[currentQuestion.id];
        if (a) { saveAnswer(currentQuestion, a); showSuccess('Réponse enregistrée'); }
        return;
      }

      if (isText) return;

      if (at === 'yes_no') {
        if (e.key.toLowerCase() === 'y') { e.preventDefault(); setAnswer('yes', 'yes_no'); return; }
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); setAnswer('no', 'yes_no'); return; }
      }
      if (at === 'choices') {
        const num = parseInt(e.key, 10);
        let parsed = choices;
        if (typeof choices === 'string') { try { parsed = JSON.parse(choices); } catch { /* ignore */ } }
        const list = Array.isArray(parsed) ? parsed : [];
        if (num >= 1 && num <= list.length) {
          const chosen = typeof list[num - 1] === 'string' ? list[num - 1] : (list[num - 1].text || list[num - 1].label);
          if (chosen) { e.preventDefault(); setAnswer(chosen, 'choices'); return; }
        }
      }
      if (at === 'voice' && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (isRecording) stopRecording(); else startRecording();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, isRecording, answers, showShortcuts, currentIndex, questions]);

  // ---- Group questions by section for plan & recap ----
  const grouped = useMemo(() => {
    const map = new Map();
    questions.forEach((q, idx) => {
      const sec = q.section_name || q.sectionName || 'Sans section';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec).push({ q, idx });
    });
    return Array.from(map.entries());
  }, [questions]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="entretien-page">
        <Sidebar />
        <div className="entretien-page__main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" text="Chargement de l'entretien…" />
        </div>
      </div>
    );
  }
  if (!currentQuestion) {
    return (
      <div className="entretien-page">
        <Sidebar />
        <div className="entretien-page__main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: 40, textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-text-primary)' }}>Aucune question disponible</h2>
            <button onClick={() => navigate(-1)} className="entretien-footer__btn">← Retour</button>
          </div>
        </div>
      </div>
    );
  }

  const questionText = currentQuestion.questionText || currentQuestion.question_text || '';
  const answerType = currentQuestion.answerType || currentQuestion.answer_type;
  const required = currentQuestion.isRequired ?? currentQuestion.is_required;
  const isLast = currentIndex === questions.length - 1;
  const sectionName = currentQuestion.section_name || currentQuestion.sectionName || 'Sans section';

  return (
    <div className="entretien-page">
      <Sidebar />
      <div className="entretien-page__main">
        {/* Top bar */}
        <header className="entretien-topbar">
          <button className="entretien-topbar__back" onClick={() => navigate(-1)}>← Quitter</button>
          {patient && (
            <div className="entretien-topbar__patient">
              <div className="entretien-topbar__avatar">
                {initials(patient.firstName || patient.first_name, patient.lastName || patient.last_name)}
              </div>
              <div>
                <div className="entretien-topbar__name">
                  {(patient.firstName || patient.first_name)} {(patient.lastName || patient.last_name)}
                </div>
                <div className="entretien-topbar__meta">
                  <span>{patient.gender === 'female' ? 'Féminin' : patient.gender === 'male' ? 'Masculin' : '—'}</span>
                  <span>{calcAge(patient.dateOfBirth || patient.date_of_birth)}</span>
                  {catalogueName && <span>· {catalogueName}</span>}
                </div>
              </div>
            </div>
          )}
          <div className="entretien-topbar__progress">
            <span className="entretien-topbar__progress-text">
              {answeredCount} / {questions.length}
            </span>
            <div className="entretien-topbar__progress-bar">
              <div className="entretien-topbar__progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <button className="entretien-topbar__shortcuts" onClick={() => setShowShortcuts(true)} title="Afficher les raccourcis (?)">
            ⌨ Raccourcis
          </button>
        </header>

        {/* 3-column workspace */}
        <div className="entretien-workspace">
          {/* LEFT: Plan */}
          <aside className="entretien-plan">
            <div className="entretien-plan__header">
              <h3 className="entretien-plan__title">Plan d'entretien</h3>
            </div>
            <div className="entretien-plan__list">
              {grouped.map(([sec, items]) => {
                const done = items.filter(({ q }) => answers[q.id]).length;
                return (
                  <div className="entretien-plan__section" key={sec}>
                    <div className="entretien-plan__section-name">
                      <span>{sec}</span>
                      <span className="entretien-plan__section-count">{done}/{items.length}</span>
                    </div>
                    {items.map(({ q, idx }) => {
                      const isCurrent = idx === currentIndex;
                      const isDone = !!answers[q.id];
                      const isRequired = q.isRequired ?? q.is_required;
                      return (
                        <button
                          key={q.id}
                          className={`entretien-plan__item${isCurrent ? ' entretien-plan__item--current' : ''}`}
                          onClick={() => goTo(idx)}
                        >
                          <span className={`entretien-plan__item-status${isDone ? ' entretien-plan__item-status--done' : isRequired ? ' entretien-plan__item-status--required' : ''}`}>
                            {isDone ? '✓' : isRequired ? '●' : '○'}
                          </span>
                          <span className="entretien-plan__item-text">
                            {q.questionText || q.question_text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* CENTER: Stage */}
          <main className="entretien-stage">
            <div className="entretien-stage__inner">
              <AnimatePresence mode="wait">
                <MotionDiv
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
                >
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="entretien-stage__chip">{sectionName}</span>
                    {required && <span className="entretien-stage__chip entretien-stage__chip--required">● Obligatoire</span>}
                    <span className="entretien-stage__qmeta">Question {currentIndex + 1} / {questions.length}</span>
                  </div>

                  <h2 className="entretien-stage__question">{questionText}</h2>

                  {/* Answer field by type */}
                  {answerType === 'yes_no' && (
                    <YesNoQuestion value={currentAnswer?.value} onChange={(v) => setAnswer(v, 'yes_no')} />
                  )}
                  {answerType === 'choices' && (
                    <ChoicesQuestion choices={currentQuestion.choices} value={currentAnswer?.value} onChange={(v) => setAnswer(v, 'choices')} />
                  )}
                  {answerType === 'text_short' && (
                    <input
                      type="text"
                      className="entretien-input"
                      value={currentAnswer?.value || ''}
                      onChange={(e) => setAnswer(e.target.value, 'text_short')}
                      autoFocus
                      placeholder="Réponse courte…"
                    />
                  )}
                  {answerType === 'text_long' && (
                    <textarea
                      className="entretien-input entretien-textarea"
                      value={currentAnswer?.value || ''}
                      onChange={(e) => setAnswer(e.target.value, 'text_long')}
                      autoFocus
                      placeholder="Décrivez en détail…"
                    />
                  )}
                  {answerType === 'number' && (
                    <NumberQuestion
                      value={currentAnswer?.value}
                      onChange={(v) => setAnswer(v, 'number')}
                      clinicalMeasure={currentQuestion.clinical_measure || currentQuestion.clinicalMeasure}
                    />
                  )}
                  {answerType === 'voice' && (
                    <VoiceQuestion
                      recording={isRecording}
                      recordTime={recordTime}
                      audioUrl={currentAnswer?.audioUrl}
                      onStart={startRecording}
                      onStop={stopRecording}
                      onClear={clearRecording}
                    />
                  )}

                  {/* internal note */}
                  <div className="entretien-note">
                    <div className="entretien-note__label">📝 Note interne (assistant uniquement)</div>
                    <textarea
                      value={internalNotes[currentQuestion.id] || ''}
                      onChange={(e) => setInternalNotes(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                      placeholder="Observation pour le médecin (non envoyée comme réponse)"
                    />
                  </div>
                </MotionDiv>
              </AnimatePresence>
            </div>
          </main>

          {/* RIGHT: Recap */}
          <aside className="entretien-recap">
            <div className="entretien-recap__header">
              <h3 className="entretien-recap__title">📋 Récapitulatif <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 'var(--font-size-xs)' }}>{answeredCount} réponse(s)</span></h3>
            </div>
            <div className="entretien-recap__list">
              {answeredCount === 0 ? (
                <div className="entretien-recap__empty">
                  Les réponses validées s'afficheront ici.
                </div>
              ) : (
                grouped.map(([sec, items]) => {
                  const answered = items.filter(({ q }) => answers[q.id]);
                  if (answered.length === 0) return null;
                  return (
                    <div key={sec} className="entretien-recap__group">
                      <div className="entretien-recap__group-title">{sec}</div>
                      {answered.map(({ q }) => {
                        const a = answers[q.id];
                        let display = a.value || (a.audioUrl ? '🎙 Audio enregistré' : '—');
                        if (a.type === 'yes_no') display = a.value === 'yes' ? '✓ Oui' : '✗ Non';
                        return (
                          <div key={q.id} className="entretien-recap__entry">
                            <div className="entretien-recap__q">{q.questionText || q.question_text}</div>
                            <div className="entretien-recap__a">{display}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="entretien-footer">
          <button className="entretien-footer__btn" onClick={goPrev} disabled={currentIndex === 0}>
            ← Précédente
          </button>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Astuce : <kbd style={{ background: 'var(--color-surface-2)', padding: '2px 6px', borderRadius: 4 }}>?</kbd> pour les raccourcis
          </div>
          {isLast ? (
            <button
              className="entretien-footer__btn entretien-footer__btn--success"
              onClick={finish}
              disabled={submitting}
            >
              {submitting ? '...' : '✓ Terminer'}
            </button>
          ) : (
            <button
              className="entretien-footer__btn entretien-footer__btn--primary"
              onClick={goNext}
            >
              Suivante →
            </button>
          )}
        </footer>

        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </div>
    </div>
  );
}
