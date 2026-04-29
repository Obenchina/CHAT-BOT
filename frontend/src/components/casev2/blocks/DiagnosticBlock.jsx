import { useRef } from 'react';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import useVoiceTranscription from '../../../hooks/useVoiceTranscription';

export default function DiagnosticBlock({
  diagnosis,
  onChange,
  autoSaving,
  lastSavedAt,
  onSave,
  onSubmitReview,
  saving,
}) {
  const textareaRef = useRef(null);

  const insertDictation = (text) => {
    const current = diagnosis || '';
    const textarea = textareaRef.current;

    if (!textarea) {
      onChange(current ? `${current}\n${text}` : text);
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? start;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const spacerBefore = before && !/\s$/.test(before) ? ' ' : '';
    const spacerAfter = after && !/^\s/.test(after) ? ' ' : '';
    const next = `${before}${spacerBefore}${text}${spacerAfter}${after}`;
    const cursor = (before + spacerBefore + text).length;

    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const voice = useVoiceTranscription({ onText: insertDictation });

  return (
    <section className="case-block" id="block-diagnostic">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>✍️</span>
          Diagnostic
        </h2>
        <div className="case-block__actions">
          <button
            type="button"
            className={`btn btn--ghost btn--small diagnostic__voice${voice.recording ? ' diagnostic__voice--recording' : ''}`}
            onClick={voice.toggle}
            disabled={saving || voice.transcribing}
            title={voice.recording ? 'Arrêter la dictée' : 'Dicter vocalement'}
          >
            {voice.recording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
            {voice.recording ? 'Arrêter' : voice.transcribing ? 'Transcription…' : 'Dicter'}
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="diagnostic__editor"
        value={diagnosis || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Saisissez votre diagnostic clinique. Vous pouvez utiliser le chat médical IA à droite et épingler ses suggestions ici."
      />

      <div className="diagnostic__footer">
        <span className="diagnostic__autosave">
          {autoSaving ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning-500)', display: 'inline-block' }} />
              Sauvegarde…
            </>
          ) : lastSavedAt ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success-500)', display: 'inline-block' }} />
              Enregistré
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>Modifications non enregistrées</span>
          )}
        </span>

        <div className="diagnostic__actions">
          <button className="btn btn--ghost" onClick={onSave} disabled={saving}>Enregistrer</button>
          <button className="btn btn--success" onClick={onSubmitReview} disabled={saving || !(diagnosis || '').trim()}>
            ✓ Valider l'examen
          </button>
        </div>
      </div>
    </section>
  );
}
