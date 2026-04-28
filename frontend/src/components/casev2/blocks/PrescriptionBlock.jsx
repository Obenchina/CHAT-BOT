import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const empty = () => ({
  id: Date.now() + Math.random(),
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  notes: '',
});

export default function PrescriptionBlock({
  medications = [],
  onChange,
  onSuggestAi,
  suggestingAi,
  onDownloadPdf,
  downloading,
}) {
  const [search, setSearch] = useState('');

  const update = (idx, field, value) => {
    const next = medications.slice();
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };
  const remove = (idx) => onChange(medications.filter((_, i) => i !== idx));
  const add = () => onChange([...medications, empty()]);

  return (
    <section className="case-block" id="block-prescription">
      <div className="case-block__header">
        <h2 className="case-block__title">
          <span className="case-block__icon" aria-hidden>💊</span>
          Ordonnance
        </h2>
        <div className="case-block__actions">
          <button className="btn btn--ghost btn--small" onClick={onSuggestAi} disabled={suggestingAi}>
            ✨ {suggestingAi ? 'Suggestion…' : 'Suggérer (IA)'}
          </button>
          <button className="btn btn--primary btn--small" onClick={onDownloadPdf} disabled={downloading || medications.length === 0}>
            ⬇ {downloading ? 'PDF…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="rx__searchbar">
        <input
          className="rx__search-input"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un médicament dans le catalogue…"
        />
        <button className="btn btn--ghost btn--small" onClick={add}>+ Ajouter manuellement</button>
      </div>

      {medications.length === 0 ? (
        <div className="rx__empty">Aucun médicament. Ajoutez manuellement ou utilisez la suggestion IA.</div>
      ) : (
        <div className="rx__list">
          <AnimatePresence initial={false}>
            {medications.map((m, idx) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="rx__item"
              >
                <span className="rx__drag" aria-hidden>≡</span>
                <div className="rx__item-body">
                  <div className="rx__item-title">
                    <input
                      type="text"
                      value={m.name || ''}
                      onChange={(e) => update(idx, 'name', e.target.value)}
                      placeholder="Nom du médicament"
                    />
                  </div>
                  <div className="rx__item-row">
                    <input
                      type="text"
                      value={m.dosage || ''}
                      onChange={(e) => update(idx, 'dosage', e.target.value)}
                      placeholder="Posologie (ex. 500 mg)"
                    />
                    <input
                      type="text"
                      value={m.frequency || ''}
                      onChange={(e) => update(idx, 'frequency', e.target.value)}
                      placeholder="Fréquence (ex. 3×/jour)"
                    />
                    <input
                      type="text"
                      value={m.duration || ''}
                      onChange={(e) => update(idx, 'duration', e.target.value)}
                      placeholder="Durée (ex. 5 jours)"
                    />
                  </div>
                  <input
                    type="text"
                    value={m.notes || ''}
                    onChange={(e) => update(idx, 'notes', e.target.value)}
                    placeholder="Notes (facultatif)"
                  />
                </div>
                <button className="rx__remove" onClick={() => remove(idx)} aria-label="Supprimer">×</button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
