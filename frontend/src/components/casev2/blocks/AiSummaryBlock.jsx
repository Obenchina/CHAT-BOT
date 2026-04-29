import { useState } from 'react';
import { motion } from 'framer-motion';
import caseService from '../../../services/caseService';
import { showError, showSuccess } from '../../../utils/toast';

export default function AiSummaryBlock({ caseData, onUpdate }) {
  const [regenerating, setRegenerating] = useState(false);

  const summary = caseData?.ai_summary || caseData?.aiSummary || '';
  let analysis = caseData?.ai_analysis || caseData?.aiAnalysis;
  if (typeof analysis === 'string') {
    try { analysis = JSON.parse(analysis); } catch { analysis = null; }
  }
  const diagnostics = Array.isArray(analysis?.diagnostics)
    ? analysis.diagnostics
    : (Array.isArray(analysis?.diagnoses) ? analysis.diagnoses : []);

  const caseId = caseData?.id;

  const handleRegenerate = async () => {
    if (!caseId) return;
    setRegenerating(true);
    try {
      const res = await caseService.reanalyze(caseId);
      if (res?.success) {
        showSuccess('Synthèse IA régénérée');
        if (typeof onUpdate === 'function') {
          // fetch fresh case data on the parent
          onUpdate();
        } else {
          // fallback: full reload so user sees new summary
          window.location.reload();
        }
      } else {
        showError(res?.message || 'Échec de la régénération');
      }
    } catch (err) {
      console.error('Reanalyze error:', err);
      showError(err?.response?.data?.message || 'Échec de la régénération');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section className="case-block case-block--ai" id="block-ai-summary">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>🧠</span>
          Synthèse IA
        </h2>
        {caseId && (
          <div className="case-block__actions">
            <button
              className="btn btn--ghost btn--small"
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Régénérer la synthèse à partir des réponses"
            >
              ↻ {regenerating ? 'Génération…' : (summary ? 'Régénérer' : 'Générer la synthèse')}
            </button>
          </div>
        )}
      </div>

      {summary ? (
        <p className="ai-summary__text">{summary}</p>
      ) : (
        <p className="ai-summary__text" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Aucune synthèse pour le moment.
          {caseId && ' Cliquez sur « Générer la synthèse » pour produire un résumé clinique à partir des réponses.'}
        </p>
      )}

      {diagnostics.length > 0 && (
        <>
          <h3 className="ai-summary__diag-title">Diagnostics probables</h3>
          <div className="ai-summary__diag">
            {diagnostics.map((d, i) => {
              const pct = Number(d.probability || d.percentage || 0);
              const label = d.diagnosis || d.name || d.label || '—';
              return (
                <div key={i} className="ai-summary__bar-row">
                  <div className="ai-summary__bar-label">{label}</div>
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
