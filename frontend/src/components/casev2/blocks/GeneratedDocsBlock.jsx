import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import api from '../../../services/api';
import { showError, showSuccess } from '../../../utils/toast';

/**
 * Generated documents block:
 *  - Ordonnance       (PDF — list of prescribed medications)
 *  - Lettre médicale  (PDF — letter to a colleague / referral)
 *  - Bilan biologique (PDF — laboratory analyses to request)
 *
 * Each download:
 *   1. Persists the latest diagnosis/prescription state.
 *   2. Calls the backend route returning a PDF blob.
 *   3. Triggers a browser download.
 */
function buildFilename(kind, caseId) {
  const map = {
    prescription: 'ordonnance',
    letter: 'lettre',
    analyses: 'bilan_biologique',
  };
  return `${map[kind] || kind}_cas_${caseId}.pdf`;
}

export default function GeneratedDocsBlock({
  caseId,
  onPersist,           // async () => void  (auto-save current diagnosis/prescription before generating)
  hasMedications,
  hasDiagnosis,
}) {
  const [busy, setBusy] = useState(null); // null | 'prescription' | 'letter' | 'analyses'

  const downloadPdf = async (kind) => {
    setBusy(kind);
    try {
      // 1. Persist latest values so the PDF reflects them
      if (typeof onPersist === 'function') {
        try { await onPersist(); } catch { /* non-blocking */ }
      }
      // 2. Fetch the PDF as a blob
      const url = `/cases/${caseId}/${kind}/pdf`;
      const blob = await api.get(url, { responseType: 'blob' });
      const objUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = buildFilename(kind, caseId);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
      showSuccess('Document téléchargé');
    } catch (err) {
      console.error(`Download ${kind} error:`, err);
      const msg = err?.response?.data?.message || `Échec du téléchargement (${kind})`;
      showError(msg);
    } finally {
      setBusy(null);
    }
  };

  const items = [
    {
      kind: 'prescription',
      icon: '💊',
      label: 'Ordonnance',
      desc: 'Liste imprimable des médicaments prescrits.',
      disabledReason: !hasMedications ? 'Ajoutez au moins un médicament.' : null,
    },
    {
      kind: 'letter',
      icon: '✉️',
      label: 'Lettre médicale',
      desc: 'Lettre de liaison / orientation.',
      disabledReason: !hasDiagnosis ? 'Saisissez un diagnostic.' : null,
    },
    {
      kind: 'analyses',
      icon: '🧪',
      label: 'Bilan biologique',
      desc: 'Demande d\'analyses de laboratoire.',
      disabledReason: null,
    },
  ];

  return (
    <section className="case-block" id="block-generated-docs">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>📑</span>
          Documents générés
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3, 12px)',
        }}
      >
        {items.map(({ kind, icon, label, desc, disabledReason }) => {
          const isBusy = busy === kind;
          const disabled = isBusy || Boolean(disabledReason);
          return (
            <motion.button
              key={kind}
              whileHover={!disabled ? { y: -2 } : undefined}
              whileTap={!disabled ? { scale: 0.98 } : undefined}
              onClick={() => !disabled && downloadPdf(kind)}
              disabled={disabled}
              title={disabledReason || `Télécharger ${label}`}
              style={{
                textAlign: 'left',
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-lg, 14px)',
                padding: 16,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !isBusy ? 0.55 : 1,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                color: 'var(--color-text-primary)',
                transition: 'transform .15s ease, border-color .15s ease',
              }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>{icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 'var(--font-size-base, 15px)',
                  fontWeight: 'var(--font-weight-semibold, 600)',
                }}>
                  {label}
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs, 12px)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}>
                  {disabledReason || desc}
                </span>
                <span style={{
                  marginTop: 6,
                  fontSize: 'var(--font-size-sm, 13px)',
                  color: isBusy ? 'var(--color-text-muted)' : 'var(--color-brand-600)',
                  fontWeight: 'var(--font-weight-medium, 500)',
                }}>
                  {isBusy ? '⌛ Génération…' : '⬇ Télécharger PDF'}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
