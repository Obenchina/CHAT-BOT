export default function DocumentsBlock({ caseData, onPreview }) {
  const docs = caseData?.documents || [];

  return (
    <section className="case-block" id="block-documents">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📎</span>
          Documents
        </h2>
      </div>

      {docs.length === 0 ? (
        <div className="rx__empty">Aucun document joint.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          {docs.map(d => (
            <button
              key={d.id}
              onClick={() => onPreview && onPreview(d)}
              style={{
                textAlign: 'left',
                background: 'var(--color-surface-0)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                color: 'var(--color-text-primary)',
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden>📄</span>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', wordBreak: 'break-word' }}>
                {d.original_name || d.filename || `Document #${d.id}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
