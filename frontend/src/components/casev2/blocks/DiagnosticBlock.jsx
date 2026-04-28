export default function DiagnosticBlock({
  diagnosis,
  onChange,
  autoSaving,
  lastSavedAt,
  onSave,
  onSubmitReview,
  saving,
}) {
  return (
    <section className="case-block" id="block-diagnostic">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>✍️</span>
          Diagnostic
        </h2>
      </div>

      <textarea
        className="diagnostic__editor"
        value={diagnosis || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Saisissez votre diagnostic clinique. Vous pouvez utiliser le Copilot IA à droite et épingler ses suggestions ici."
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
