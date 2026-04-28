import { motion } from 'framer-motion';

export default function AiSummaryBlock({ caseData }) {
  const summary = caseData?.ai_summary || caseData?.aiSummary || '';
  let analysis = caseData?.ai_analysis || caseData?.aiAnalysis;
  if (typeof analysis === 'string') {
    try { analysis = JSON.parse(analysis); } catch { analysis = null; }
  }
  const diagnostics = Array.isArray(analysis?.diagnostics) ? analysis.diagnostics : [];

  return (
    <section className="case-block case-block--ai" id="block-ai-summary">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>🧠</span>
          Synthèse IA
        </h2>
      </div>

      {summary ? (
        <p className="ai-summary__text">{summary}</p>
      ) : (
        <p className="ai-summary__text" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Pas encore de synthèse. Soumettez le cas pour générer l'analyse IA.
        </p>
      )}

      {diagnostics.length > 0 && (
        <>
          <h3 className="ai-summary__diag-title">Diagnostics probables</h3>
          <div className="ai-summary__diag">
            {diagnostics.map((d, i) => {
              const pct = Number(d.probability || d.percentage || 0);
              return (
                <div key={i} className="ai-summary__bar-row">
                  <div className="ai-summary__bar-label">{d.diagnosis || d.name || '—'}</div>
                  <div className="ai-summary__bar-track">
                    <motion.div
                      className="ai-summary__bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, pct)}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                    />
                  </div>
                  <div className="ai-summary__bar-pct">{pct}%</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
